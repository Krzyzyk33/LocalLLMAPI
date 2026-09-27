"""Wykrywanie modeli GGUF w katalogu ``models/``.

Lista jest cache'owana i odświeżana po zmianie katalogu (mtime), bo dashboard
odpytuje ``/v1/models`` co parę sekund — wcześniej każde zapytanie robiło
``os.listdir`` i mogło odpalić drugi wątek pobierania równolegle do pierwszego.
"""

import os
import threading

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

_lock = threading.Lock()
_downloading = False
_cache: dict = {"models": [], "signature": None, "downloading": False}


def download_test_model():
    """Pobiera mały model testowy z HuggingFace (w tle, tylko gdy katalog pusty)."""
    global _downloading
    with _lock:
        if _downloading:
            return
        _downloading = True
    print("Rozpoczęto pobieranie modelu testowego z HuggingFace (w tle)...")
    try:
        from huggingface_hub import hf_hub_download

        path = hf_hub_download(
            repo_id="TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
            filename="tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
            local_dir=MODELS_DIR,
            local_dir_use_symlinks=False,
        )
        print(f"Pobieranie zakończone: {path}")
    except Exception as e:
        print(f"Błąd pobierania: {e}")
    finally:
        with _lock:
            _downloading = False
        invalidate_cache()


def _signature() -> tuple:
    """Sygnatura katalogu — zmiana plików unieważnia cache."""
    try:
        entries = tuple(
            sorted(
                (f, os.path.getsize(os.path.join(MODELS_DIR, f)))
                for f in os.listdir(MODELS_DIR)
                if f.lower().endswith(".gguf")
            )
        )
    except OSError:
        return ()
    return entries


def invalidate_cache():
    with _lock:
        _cache["signature"] = None


def get_available_models() -> list:
    if not os.path.exists(MODELS_DIR):
        os.makedirs(MODELS_DIR, exist_ok=True)

    with _lock:
        sig = _signature()
        if _cache["signature"] is not None and _cache["signature"] == sig:
            return list(_cache["models"])

    models = [f for f, _ in sig]

    with _lock:
        _cache["models"] = models
        _cache["signature"] = sig

    if not models:
        # Pusty katalog: odpal pobieranie w tle (tylko jedno naraz).
        threading.Thread(target=download_test_model, daemon=True).start()
        with _lock:
            _cache["downloading"] = True

    return models


def is_downloading() -> bool:
    with _lock:
        return _downloading


def get_model_path(model_name: str) -> str:
    path = os.path.join(MODELS_DIR, model_name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model {model_name} nie został znaleziony w {MODELS_DIR}")
    return path
