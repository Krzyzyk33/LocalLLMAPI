from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time
import os
import socket

from backend.model_manager import get_available_models, get_model_path
from backend.db_manager import init_db, add_log, get_logs_for_key, create_api_key, get_api_keys_stats, get_api_key_by_value

# Inicjalizacja bazy logów na starcie
init_db()

app = FastAPI(title="Local LLM Router API")
security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_model_name = None
active_llama_instance = None
last_activity_time = time.time()
import asyncio
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def load_model(model_name: str):
    global active_model_name, active_llama_instance
    if active_model_name == model_name and active_llama_instance is not None:
        return active_llama_instance
    
    if active_llama_instance is not None:
        print(f"Zwalnianie modelu z pamięci: {active_model_name}")
        try:
            active_llama_instance.close()
        except Exception:
            pass
        active_llama_instance = None
        import gc
        gc.collect()
    
    try:
        from llama_cpp import Llama
    except ImportError:
        raise HTTPException(status_code=500, detail="llama-cpp-python nie jest zainstalowane.")

    model_path = get_model_path(model_name)
    print(f"Ładowanie modelu: {model_path}")
    
    active_llama_instance = Llama(
        model_path=model_path,
        n_gpu_layers=0,
        n_ctx=8192,
        verbose=False
    )
    active_model_name = model_name
    return active_llama_instance

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[Dict[str, str]]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 4096
    stream: Optional[bool] = False

def get_current_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    key_val = credentials.credentials
    key_id = get_api_key_by_value(key_val)
    if not key_id:
        raise HTTPException(status_code=401, detail="Nieprawidłowy klucz API. Upewnij się, że utworzyłeś go w panelu.")
    return key_id

background_tasks = set()

@app.on_event("startup")
async def startup_event():
    task = asyncio.create_task(auto_unload_model())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)

async def auto_unload_model():
    global active_llama_instance, active_model_name
    while True:
        await asyncio.sleep(10)
        if active_llama_instance is not None:
            if time.time() - last_activity_time > 120:
                print(f"\n[Auto-Unload] Zwalnianie modelu z pamięci (bezczynność > 2 min): {active_model_name}")
                try:
                    active_llama_instance.close()
                except Exception:
                    pass
                active_llama_instance = None
                active_model_name = None
                import gc
                gc.collect()

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest, api_key_id: int = Depends(get_current_api_key)):
    global last_activity_time
    last_activity_time = time.time()
    try:
        if not request.model:
            raise HTTPException(status_code=400, detail="Brak pola 'model'.")

        start_time = time.time()
        try:
            llm = load_model(request.model)
            # Wymuszamy stream internally, by mierzyć prędkość każdego tokena
            chunks = llm.create_chat_completion(
                model=request.model,
                messages=request.messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                stream=True
            )
            
            if request.stream:
                async def stream_generator():
                    full_content = ""
                    chunk_times = []
                    last_t = time.time()
                    prompt_t = None
                    
                    for chunk in chunks:
                        now = time.time()
                        delta = now - last_t
                        if prompt_t is None:
                            prompt_t = delta
                        else:
                            if delta > 0:
                                chunk_times.append(1.0 / delta)
                        last_t = now
                        
                        delta_content = chunk["choices"][0]["delta"].get("content", "")
                        if delta_content:
                            full_content += delta_content
                        
                        import json
                        chunk["object"] = "chat.completion.chunk"
                        yield f"data: {json.dumps(chunk)}\n\n"
                    
                    
                    end_time = time.time()
                    global last_activity_time
                    last_activity_time = end_time
                    
                    elapsed = end_time - start_time
                    completion_tokens = len(chunk_times) + 1
                    min_tps = min(chunk_times) if chunk_times else 0
                    max_tps = max(chunk_times) if chunk_times else 0
                    avg_tps = completion_tokens / (elapsed - prompt_t) if prompt_t and elapsed > prompt_t else 0
                    
                    add_log(api_key_id, request.model, round(elapsed, 2), completion_tokens, round(avg_tps, 2), round(min_tps, 2), round(max_tps, 2))
                    
                    yield "data: [DONE]\n\n"
                
                return StreamingResponse(
                    stream_generator(), 
                    media_type="text/event-stream",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive"
                    }
                )
            else:
                full_content = ""
                chunk_times = []
                last_t = time.time()
                prompt_t = None
                
                for chunk in chunks:
                    now = time.time()
                    delta = now - last_t
                    if prompt_t is None:
                        prompt_t = delta
                    else:
                        if delta > 0:
                            chunk_times.append(1.0 / delta)
                    last_t = now
                    
                    delta_content = chunk["choices"][0]["delta"].get("content", "")
                    if delta_content:
                        full_content += delta_content
                
                
                end_time = time.time()
                last_activity_time = end_time
                
                elapsed = end_time - start_time
                
                completion_tokens = len(chunk_times) + 1
                total_tokens = completion_tokens
                
                min_tps = min(chunk_times) if chunk_times else 0
                max_tps = max(chunk_times) if chunk_times else 0
                avg_tps = completion_tokens / (elapsed - prompt_t) if prompt_t and elapsed > prompt_t else 0
                
                add_log(api_key_id, request.model, round(elapsed, 2), total_tokens, round(avg_tps, 2), round(min_tps, 2), round(max_tps, 2))
                
                return {
                    "id": f"chatcmpl-{int(time.time())}",
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": request.model,
                    "choices": [{
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": full_content
                        },
                        "finish_reason": "stop"
                    }],
                    "usage": {
                        "prompt_tokens": 0,
                        "completion_tokens": completion_tokens,
                        "total_tokens": total_tokens
                    }
                }
        except Exception as inner_e:
            raise inner_e
    except Exception as e:
        import traceback
        err_str = str(e).lower()
        with open("error.txt", "w") as f:
            f.write(f"{str(e)}\n{traceback.format_exc()}")
            
        friendly_error = "Wystąpił nieoczekiwany błąd serwera."
        if "memory" in err_str or "vram" in err_str or "allocation" in err_str or isinstance(e, MemoryError):
            friendly_error = "Błąd API: Przepełnienie VRAM (Zbyt duży model lub zbyt mało pamięci)."
        elif "not found" in err_str or "no such file" in err_str or isinstance(e, FileNotFoundError):
            friendly_error = "Błąd API: Nie znaleziono pliku modelu na dysku (Sprawdź ścieżkę)."
        elif "json" in err_str or "parse" in err_str:
            friendly_error = "Błąd API: Problem z parsowaniem danych wejściowych."
        else:
            friendly_error = f"Błąd API: {str(e)[:100]}..."
            
        raise HTTPException(status_code=500, detail=friendly_error)

@app.get("/v1/models")
async def list_models():
    models = get_available_models()
    return {
        "object": "list",
        "data": [{"id": m, "object": "model"} for m in models]
    }

class CreateKeyRequest(BaseModel):
    name: str
    api_key: str

@app.post("/api/keys")
async def create_new_key(req: CreateKeyRequest):
    if not req.name or not req.api_key:
        raise HTTPException(status_code=400, detail="Pola 'name' i 'api_key' są wymagane.")
    try:
        key_id = create_api_key(req.name, req.api_key)
        return {"id": key_id, "name": req.name, "api_key": req.api_key}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/keys")
async def get_keys():
    return get_api_keys_stats()

class UpdateKeyRequest(BaseModel):
    name: str
    api_key: Optional[str] = None

@app.put("/api/keys/{api_key_id}")
async def update_key(api_key_id: int, req: UpdateKeyRequest):
    if not req.name:
        raise HTTPException(status_code=400, detail="Nazwa jest wymagana.")
    update_api_key(api_key_id, req.name, req.api_key)
    return {"status": "ok"}

@app.delete("/api/keys/{api_key_id}")
async def delete_key(api_key_id: int):
    from backend.db_manager import delete_api_key
    delete_api_key(api_key_id)
    return {"status": "ok"}

@app.get("/api/logs/{api_key_id}")
async def get_logs(api_key_id: int):
    return get_logs_for_key(api_key_id, limit=200)

@app.get("/api/status")
async def get_status():
    return {
        "active_model": active_model_name,
        "local_ip": get_local_ip()
    }

web_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web")
if os.path.exists(web_dir):
    app.mount("/", StaticFiles(directory=web_dir, html=True), name="web")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
