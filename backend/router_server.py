"""LocalLLMAPI — serwer FastAPI naśladujący endpointy OpenAI.

Kluczowe decyzje wydajnościowe (wszystkie potrzebne, żeby serwer nie zamrażał
się przy obsłudze dużych modeli):

* ``Llama(...)`` jest konstruowane w wątku roboczym (``asyncio.to_thread``),
  a nie w pętli zdarzeń. Wcześniej ładowanie modelu 7–16 GB blokowało cały
  serwer na 10–60 s i dashboard pokazywał „Offline".
* Każdy model ma własny ``asyncio.Lock``, więc N równoległych requestów
  tworzy **jedną** instancję zamiast N (wcześniej to był wyciek VRAM).
* Slot jest rezerwowany **przed** budowaniem modelu, więc dwa różne modele
  nie wskoczą do tego samego slotu.
* ``release_model`` jest wołane w ``finally``, więc rozłączenie klienta w
  trakcie streamu nie zostawia modelu „zablokowanego" na stałe (wcześniej
  powodowało to trwały 503).
"""

import asyncio
import contextlib
import gc
import json
import os
import socket
import threading
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.db_manager import (
    add_log,
    create_api_key,
    delete_api_key,
    get_api_key_by_value,
    get_api_keys_stats,
    get_engine_for_key,
    get_global_stats,
    get_logs_for_key,
    get_recent_logs,
    get_slot_devices,
    init_db,
    update_api_key,
    update_slot_device,
)
from backend.model_manager import get_available_models, get_model_path

SERVER_PORT = 1000
MAX_SLOTS = 3
UNLOAD_IDLE_SECONDS = 120
START_TIME = time.time()

# Wymagane okno kontekstu per model (rośnie automatycznie po przepełnieniu)
model_n_ctx_prefs: Dict[str, int] = {}

init_db()

security = HTTPBearer()

# ==========================================================================
# Stan współdzielony
# ==========================================================================


@dataclass
class LoadedModel:
    slot_index: int
    engine: str
    llama_instance: Any
    refcount: int = 0
    last_used: float = 0.0
    n_ctx: int = 8192
    size_bytes: int = 0
    loaded_at: float = 0.0


loaded_models: Dict[str, LoadedModel] = {}
# threading.RLock, nie asyncio.Lock: release_model() wołany jest z wątku
# streamera (GeneratorExit), więc nie może potrzebować pętli zdarzeń.
# Wszystkie sekcje krytyczne są krótkie i nie zawierają await.
models_lock = threading.RLock()
_slots_reserved: Set[int] = set()
_model_locks: Dict[str, asyncio.Lock] = {}
_model_locks_guard = asyncio.Lock()

app = FastAPI(title="Local LLM API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # nieparzwalne z "*" — inaczej FastAPI echo-uje origin
    allow_methods=["*"],
    allow_headers=["*"],
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(auto_unload_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app.router.lifespan_context = lifespan


async def auto_unload_loop():
    """Zwalnia modele nieużywane przez ``UNLOAD_IDLE_SECONDS``."""
    while True:
        await asyncio.sleep(5)
        expired: List[str] = []
        with models_lock:
            now = time.time()
            for name, lm in list(loaded_models.items()):
                if lm.refcount <= 0 and now - lm.last_used > UNLOAD_IDLE_SECONDS:
                    expired.append(name)
        for name in expired:
            print(f"[Auto-Unload] Zwalnianie modelu (bezczynność): {name}")
            await unload_model(name)


# ==========================================================================
# Registry modeli i slotów
# ==========================================================================


async def _model_lock(name: str) -> asyncio.Lock:
    async with _model_locks_guard:
        lk = _model_locks.get(name)
        if lk is None:
            lk = asyncio.Lock()
            _model_locks[name] = lk
        return lk


async def _acquire_slot(requested_engine: str) -> tuple:
    """Rezerwuje wolny slot pasujący do silnika (ewictując LRU jeśli trzeba).

    Zwraca ``(slot_index, model_do_wygnania)``. Rezerwacja następuje **przed**
    budową modelu, więc równoległe requesty nie wybiorą tego samego slotu.
    """
    # Urządzenia slotów czytamy PRZED blokadą — nie trzymamy locka przez await.
    devices = await asyncio.to_thread(get_slot_devices)

    with models_lock:
        for idx in range(1, MAX_SLOTS + 1):
            if devices.get(idx, "cpu") != requested_engine:
                continue
            if idx in _slots_reserved:
                continue
            if any(lm.slot_index == idx for lm in loaded_models.values()):
                continue
            _slots_reserved.add(idx)
            return idx, None

        # Brak wolnego slotu z pasującym silnikiem → wyrzuć LRU (refcount == 0).
        candidates = [
            (lm.last_used, name)
            for name, lm in loaded_models.items()
            if lm.refcount <= 0
            and lm.slot_index not in _slots_reserved
            and devices.get(lm.slot_index, "cpu") == requested_engine
        ]
        label = "matching engine"
        if not candidates:
            candidates = [
                (lm.last_used, name)
                for name, lm in loaded_models.items()
                if lm.refcount <= 0 and lm.slot_index not in _slots_reserved
            ]
            label = "any slot"

        if not candidates:
            raise HTTPException(
                status_code=503,
                detail="All slots are busy with active requests. Try again shortly.",
            )

        _, evict_name = min(candidates)
        slot_idx = loaded_models[evict_name].slot_index
        # Wyrzucamy pod lockiem, więc nikt nie zdąży chwycić ofiary w międzyczasie.
        victim = loaded_models.pop(evict_name)
        print(f"[Model] Evicting ({label}): {evict_name}")
        _slots_reserved.add(slot_idx)
        return slot_idx, victim


def _engine_layers(engine: str) -> int:
    return 0 if engine == "cpu" else -1  # cuda / vulkan → wszystko na GPU


def _build_llama(model_path: str, layers: int, n_ctx: int):
    """Budowa instancji Llama — wołana w wątku roboczym, nie w pętli zdarzeń."""
    from llama_cpp import Llama

    return Llama(model_path=model_path, n_gpu_layers=layers, n_ctx=n_ctx, verbose=False)


def _file_size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


async def load_model(model_name: str, requested_engine: str):
    """Zwraca instancję Llama, wczytując model jeśli trzeba. Zwiększa refcount."""
    with models_lock:
        lm = loaded_models.get(model_name)
        if lm is not None:
            lm.refcount += 1
            lm.last_used = time.time()
            return lm.llama_instance

    # Blokada per model: równoległe requesty tego samego modelu czekają na
    # jedno wczytanie zamiast tworzyć po jednej instancji na request.
    async with await _model_lock(model_name):
        with models_lock:
            lm = loaded_models.get(model_name)
            if lm is not None:
                lm.refcount += 1
                lm.last_used = time.time()
                return lm.llama_instance

        slot_idx, victim = await _acquire_slot(requested_engine)
        if victim is not None:
            await _close_instance(victim.llama_instance)

        try:
            model_path = await asyncio.to_thread(get_model_path, model_name)
            n_ctx = model_n_ctx_prefs.get(model_name, 8192)
            layers = _engine_layers(requested_engine)
            print(f"[Model] Loading {model_name} -> slot {slot_idx} ({requested_engine})")
            instance = await asyncio.to_thread(_build_llama, model_path, layers, n_ctx)
        except BaseException:
            with models_lock:
                _slots_reserved.discard(slot_idx)
            raise

        with models_lock:
            loaded_models[model_name] = LoadedModel(
                slot_index=slot_idx,
                engine=requested_engine,
                llama_instance=instance,
                refcount=1,
                last_used=time.time(),
                n_ctx=n_ctx,
                size_bytes=_file_size(model_path),
                loaded_at=time.time(),
            )
            _slots_reserved.discard(slot_idx)
        return instance


def release_model(model_name: str) -> None:
    """Synchronous — wywoływane też z wątku streamera, bez pętli zdarzeń.

    Dzięki ``threading.RLock`` nie potrzebujemy ``run_coroutine_threadsafe``,
    który w bloku ``finally`` potrafił zakleszczyć pętlę.
    """
    with models_lock:
        lm = loaded_models.get(model_name)
        if lm is not None:
            lm.refcount = max(0, lm.refcount - 1)
            lm.last_used = time.time()


async def unload_model(model_name: str, force: bool = False) -> bool:
    """Zwalnia model. Bez ``force`` czeka aż spadnie liczba aktywnych requestów."""
    with models_lock:
        lm = loaded_models.get(model_name)
        if lm is None:
            return False
        if lm.refcount > 0 and not force:
            return False
        loaded_models.pop(model_name, None)
        instance, slot = lm.llama_instance, lm.slot_index

    # Ciężkie zamykanie poza lockiem, żeby nie blokować innych operacji.
    await _close_instance(instance)
    print(f"[Model] Unloaded {model_name} (slot {slot})")
    return True


async def _close_instance(instance) -> None:
    with contextlib.suppress(Exception):
        instance.close()
    gc.collect()


async def _handle_context_overflow(model_name: str):
    """Zwiększa n_ctx i zwalnia model, by następny request wczytał go z nowym oknem."""
    safe = False
    with models_lock:
        lm = loaded_models.get(model_name)
        if lm is None:
            return
        new_ctx = min(lm.n_ctx + 2000, 131072)
        model_n_ctx_prefs[model_name] = new_ctx
        print(f"[Model] n_ctx for {model_name} -> {new_ctx}")
        # Nie zamykaj modelu, którego używają inne aktywne requesty —
        # zwolni się sam, gdy refcount spadnie do zera.
        safe = lm.refcount <= 1
        if safe:
            lm.refcount = 0
    if safe:
        await unload_model(model_name)


def snapshot_models() -> List[Dict[str, Any]]:
    """Migawka stanu modeli — bezpieczna do iteracji."""
    with models_lock:
        source = list(loaded_models.items())
    items = [
        {
            "name": name,
            "slot": lm.slot_index,
            "engine": lm.engine,
            "refcount": lm.refcount,
            "n_ctx": lm.n_ctx,
            "size_bytes": lm.size_bytes,
            "loaded_at": lm.loaded_at,
            "last_used": lm.last_used,
        }
        for name, lm in list(loaded_models.items())
    ]
    items.sort(key=lambda m: m["slot"])
    return items


# ==========================================================================
# Cache kosztownych operacji
# ==========================================================================

_ip_cache: Dict[str, Any] = {"value": "127.0.0.1", "at": 0.0}


def get_local_ip(ttl: float = 60.0) -> str:
    """Lookup IP tylko raz na ttl — było wołane co 2 s i robiło nowy socket."""
    if time.time() - _ip_cache["at"] < ttl:
        return _ip_cache["value"]
    ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except OSError:
        pass
    _ip_cache.update({"value": ip, "at": time.time()})
    return ip


_encoders: Dict[str, Any] = {}
_encoder_lock = threading.Lock()


def _get_encoder(name: str = "cl100k_base"):
    """tiktoken ładuje rankingi BPE z dysku — cache'ujemy, wołamy to per request."""
    with _encoder_lock:
        enc = _encoders.get(name)
        if enc is None:
            import tiktoken

            enc = tiktoken.get_encoding(name)
            _encoders[name] = enc
        return enc


def count_prompt_tokens(messages: List[Dict[str, Any]]) -> int:
    try:
        enc = _get_encoder()
    except Exception:
        return 0
    total = 0
    for m in messages:
        content = m.get("content", "")
        if isinstance(content, str):
            total += len(enc.encode(content))
    return total + len(messages) * 4 + 2


_signature_cache: Dict[type, frozenset] = {}


def _supported_kwargs(llm) -> frozenset:
    """Sygnatura create_chat_completion jest stała dla klasy — cache'ujemy."""
    cls = type(llm)
    sig = _signature_cache.get(cls)
    if sig is None:
        import inspect

        sig = frozenset(inspect.signature(llm.create_chat_completion).parameters.keys())
        _signature_cache[cls] = sig
    return sig


_ERROR_LOG = "error.txt"
_ERROR_LOG_MAX = 256 * 1024


def log_error(message: str):
    """Dopisuje błąd zamiast nadpisywać plik przy każdym wyjątku."""
    try:
        with open(_ERROR_LOG, "a", encoding="utf-8") as f:
            f.write(f"\n===== {time.strftime('%Y-%m-%d %H:%M:%S')} =====\n{message}\n")
        if os.path.getsize(_ERROR_LOG) > _ERROR_LOG_MAX:
            with open(_ERROR_LOG, "r+", encoding="utf-8") as f:
                f.seek(_ERROR_LOG_MAX // 2)
                rest = f.read()
                f.seek(0)
                f.write("[...starsze wpisy usunięte...]\n")
                f.write(rest)
                f.truncate()
    except OSError:
        pass


def friendly_error(exc: BaseException) -> str:
    msg = str(exc).lower()
    if isinstance(exc, MemoryError) or any(
        w in msg for w in ("memory", "vram", "allocation", "out of memory")
    ):
        return "GPU memory exhausted — the model is too large for this hardware."
    if isinstance(exc, FileNotFoundError) or "no such file" in msg:
        return "Model file not found in models/."
    if "context window" in msg or "context length" in msg:
        return "Context window exceeded — the server is growing it, please retry."
    if "json" in msg or "decode" in msg:
        return "Malformed request payload."
    return f"{type(exc).__name__}: {str(exc)[:180]}"


# ==========================================================================
# Pomiar wydajności
# ==========================================================================


class Metrics:
    """Liczy t/s, TTFT i tokeny zgodnie z oryginalną formułą aplikacji."""

    __slots__ = ("completion_tokens", "chunk_times", "first_token_latency", "last_t", "content")

    def __init__(self):
        self.completion_tokens = 0
        self.chunk_times: List[float] = []
        self.first_token_latency: Optional[float] = None
        self.last_t = time.time()
        self.content: List[str] = []

    def observe(self, delta_content: str):
        now = time.time()
        delta = now - self.last_t
        self.completion_tokens += 1
        if self.first_token_latency is None:
            self.first_token_latency = delta
        elif delta > 0:
            self.chunk_times.append(1.0 / delta)
        self.last_t = now
        if delta_content:
            self.content.append(delta_content)

    def summary(self, start_time: float, prompt_tokens: int) -> Dict[str, Any]:
        elapsed = time.time() - start_time
        ttft = self.first_token_latency or 0.0
        gen_time = elapsed - ttft
        return {
            "elapsed": round(elapsed, 2),
            "prompt_tokens": prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.completion_tokens + prompt_tokens,
            "avg_tps": round(self.completion_tokens / gen_time if gen_time > 0 else 0.0, 2),
            "min_tps": round(min(self.chunk_times), 2) if self.chunk_times else 0.0,
            "max_tps": round(max(self.chunk_times), 2) if self.chunk_times else 0.0,
            "ttft": round(ttft, 3),
        }


def _persist(api_key_id: int, model: str, m: Dict[str, Any]):
    add_log(
        api_key_id,
        model,
        m["elapsed"],
        m["total_tokens"],
        m["avg_tps"],
        m["min_tps"],
        m["max_tps"],
        m["ttft"],
    )


def _collect_chunks(chunks, metrics: Metrics) -> None:
    """Blokujące — wywoływane w wątku roboczym dla trybu non-streaming."""
    for chunk in chunks:
        try:
            delta = chunk["choices"][0]["delta"].get("content", "")
        except (KeyError, IndexError, TypeError):
            continue
        metrics.observe(delta)


# ==========================================================================
# Endpointy OpenAI
# ==========================================================================


class ChatCompletionRequest(BaseModel):
    model_config = {"extra": "allow"}
    model: str
    messages: List[Dict[str, Any]]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 4096
    stream: Optional[bool] = False


def get_current_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
    key_id = get_api_key_by_value(credentials.credentials)
    if not key_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key. Create one in the API Keys tab.",
        )
    return key_id


@app.post("/v1/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest, api_key_id: int = Depends(get_current_api_key)
):
    if not request.model:
        raise HTTPException(status_code=400, detail="Missing the 'model' field.")

    api_engine = await asyncio.to_thread(get_engine_for_key, api_key_id)
    start_time = time.time()
    llm = await load_model(request.model, api_engine)

    # Od tego momentu refcount musi zawsze spaść — inaczej slot zostaje
    # zablokowany na stałe (tak było przy rozłączeniu klienta w trakcie streamu).
    try:
        extra = request.model_extra or {}
        filtered = {k: v for k, v in extra.items() if k in _supported_kwargs(llm)}
        prompt_tokens = await asyncio.to_thread(count_prompt_tokens, request.messages)

        chunks = llm.create_chat_completion(
            model=request.model,
            messages=request.messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=True,
            **filtered,
        )
        metrics = Metrics()

        if request.stream:
            return _stream_response(
                request, api_key_id, chunks, metrics, start_time, prompt_tokens
            )

        # Non-streaming: generacja w wątku, żeby pętla zdarzeń nie stała.
        try:
            await asyncio.to_thread(_collect_chunks, chunks, metrics)
        except (OSError, ValueError) as e:
            if "context window" in str(e) or "context length" in str(e):
                await _handle_context_overflow(request.model)
                log_error(f"context overflow ({request.model}): {e}")
            else:
                raise

        summary = metrics.summary(start_time, prompt_tokens)
        await asyncio.to_thread(_persist, api_key_id, request.model, summary)
        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": request.model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "".join(metrics.content)},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": summary["prompt_tokens"],
                "completion_tokens": summary["completion_tokens"],
                "total_tokens": summary["total_tokens"],
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback

        log_error(f"{e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=friendly_error(e))
    finally:
        release_model(request.model)


def _stream_response(request, api_key_id, chunks, metrics, start_time, prompt_tokens):
    """Odpowiedź SSE. Synchronous generator — Starlette iteruje go w threadpool."""

    def stream_generator():
        try:
            for chunk in chunks:
                try:
                    delta = chunk["choices"][0]["delta"].get("content", "")
                except (KeyError, IndexError, TypeError):
                    delta = ""
                chunk["object"] = "chat.completion.chunk"
                yield f"data: {json.dumps(chunk)}\n\n"
                if delta:
                    metrics.observe(delta)
            yield "data: [DONE]\n\n"
        except (OSError, ValueError) as e:
            msg = str(e)
            log_error(f"stream error ({request.model}): {msg}")
            if "context window" in msg or "context length" in msg:
                yield (
                    "data: "
                    + json.dumps(
                        {
                            "error": {
                                "message": msg,
                                "type": "context_length_exceeded",
                                "code": "context_length_exceeded",
                            }
                        }
                    )
                    + "\n\n"
                )
                yield "data: [DONE]\n\n"
        finally:
            # GeneratorExit przy rozłączeniu klienta też wchodzi tutaj, więc
            # log i release_model nigdy nie zostaną pominięte. release_model
            # jest sync i nie potrzebuje pętli zdarzeń.
            with contextlib.suppress(Exception):
                _persist(
                    api_key_id,
                    request.model,
                    metrics.summary(start_time, prompt_tokens),
                )
            with contextlib.suppress(Exception):
                release_model(request.model)

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/v1/models")
async def list_models():
    models = await asyncio.to_thread(get_available_models)
    return {"object": "list", "data": [{"id": m, "object": "model"} for m in models]}


# ==========================================================================
# Endpointy panelu
# ==========================================================================


class CreateKeyRequest(BaseModel):
    name: str
    api_key: str
    engine: Optional[str] = "vulkan"


@app.post("/api/keys")
async def create_new_key(req: CreateKeyRequest):
    if not req.name or not req.api_key:
        raise HTTPException(status_code=400, detail="Fields 'name' and 'api_key' are required.")
    try:
        key_id = await asyncio.to_thread(create_api_key, req.name, req.api_key, req.engine)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": key_id, "name": req.name, "api_key": req.api_key, "engine": req.engine}


@app.get("/api/keys")
async def get_keys():
    return await asyncio.to_thread(get_api_keys_stats)


class UpdateKeyRequest(BaseModel):
    name: str
    api_key: Optional[str] = None
    engine: Optional[str] = "vulkan"


@app.put("/api/keys/{api_key_id}")
async def update_key(api_key_id: int, req: UpdateKeyRequest):
    if not req.name:
        raise HTTPException(status_code=400, detail="Name is required.")
    await asyncio.to_thread(update_api_key, api_key_id, req.name, req.api_key, req.engine)
    return {"status": "ok"}


@app.delete("/api/keys/{api_key_id}")
async def delete_key(api_key_id: int):
    await asyncio.to_thread(delete_api_key, api_key_id)
    return {"status": "ok"}


@app.get("/api/logs/{api_key_id}")
async def get_logs(api_key_id: int):
    return await asyncio.to_thread(get_logs_for_key, api_key_id, 200)


@app.post("/api/unload")
async def unload_all(model_name: Optional[str] = None):
    if model_name:
        ok = await unload_model(model_name)
        return {
            "status": "ok",
            "message": f"Model {model_name} {'unloaded' if ok else 'was not loaded'}",
        }
    free = [m["name"] for m in snapshot_models() if m["refcount"] <= 0]
    for n in free:
        await unload_model(n)
    return {"status": "ok", "message": "All unused models unloaded"}


@app.get("/api/status")
async def get_status():
    loaded = snapshot_models()
    return {
        "loaded_models": {
            m["name"]: {k: v for k, v in m.items() if k != "name"} for m in loaded
        },
        "local_ip": get_local_ip(),
        "port": SERVER_PORT,
        "uptime": int(time.time() - START_TIME),
        # Backward-compat: panel używa tego pola do podświetlenia modelu
        "active_model": loaded[0]["name"] if loaded else None,
    }


@app.get("/api/stats")
async def get_stats():
    """Agregaty dla strony HOME."""
    models_on_disk = await asyncio.to_thread(get_available_models)
    glob = await asyncio.to_thread(get_global_stats)
    recent = await asyncio.to_thread(get_recent_logs, 8)
    return {
        "uptime": int(time.time() - START_TIME),
        "port": SERVER_PORT,
        "local_ip": get_local_ip(),
        "models_on_disk": len(models_on_disk),
        "loaded_models": snapshot_models(),
        "slots_total": MAX_SLOTS,
        "recent": recent,
        **glob,
    }


@app.get("/api/settings/slots")
async def get_slots():
    devices = await asyncio.to_thread(get_slot_devices)
    loaded = snapshot_models()
    result = {}
    for idx in range(1, MAX_SLOTS + 1):
        occupied = next((m["name"] for m in loaded if m["slot"] == idx), None)
        result[str(idx)] = {"device": devices.get(idx, "cpu"), "loaded_model": occupied}
    return result


class SlotUpdateRequest(BaseModel):
    slot_index: int
    device: str


@app.put("/api/settings/slots")
async def update_slot(req: SlotUpdateRequest):
    if not 1 <= req.slot_index <= MAX_SLOTS:
        raise HTTPException(status_code=400, detail=f"Slot index must be between 1 and {MAX_SLOTS}")
    if req.device not in ("cpu", "cuda", "vulkan"):
        raise HTTPException(status_code=400, detail="Device must be 'cpu', 'cuda' or 'vulkan'")
    await asyncio.to_thread(update_slot_device, req.slot_index, req.device)
    return {"status": "ok"}


# ==========================================================================
# Panel WWW
# ==========================================================================

web_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web")
if os.path.exists(web_dir):
    app.mount("/", StaticFiles(directory=web_dir, html=True), name="web")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=SERVER_PORT, log_level="warning")
