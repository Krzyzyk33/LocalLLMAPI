import os
import threading

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
is_downloading = False

def download_test_model():
    global is_downloading
    is_downloading = True
    print("Rozpoczęto pobieranie modelu testowego z HuggingFace (w tle)...")
    try:
        from huggingface_hub import hf_hub_download
        downloaded_path = hf_hub_download(
            repo_id="TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
            filename="tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
            local_dir=MODELS_DIR,
            local_dir_use_symlinks=False
        )
        print(f"Pobieranie zakończone: {downloaded_path}")
    except Exception as e:
        print(f"Błąd pobierania: {e}")
    finally:
        is_downloading = False

def get_available_models():
    if not os.path.exists(MODELS_DIR):
        os.makedirs(MODELS_DIR)
    
    models = []
    for file in os.listdir(MODELS_DIR):
        if file.endswith(".gguf"):
            models.append(file)
            
    global is_downloading
    if not models and not is_downloading:
        # Odpalenie pobierania w tle
        thread = threading.Thread(target=download_test_model)
        thread.daemon = True
        thread.start()
        # Zwracamy pustą listę i informację
        return []
        
    return models

def get_model_path(model_name: str) -> str:
    path = os.path.join(MODELS_DIR, model_name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model {model_name} nie został znaleziony w {MODELS_DIR}")
    return path
