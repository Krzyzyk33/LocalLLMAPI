# LocalLLMAPI

A fast, lightweight, local API server that mimics OpenAI's endpoints (e.g., `/v1/chat/completions`, `/v1/models`), powered by `llama-cpp-python` with hardware acceleration support (Vulkan/CUDA). It comes with a built-in model manager, a system for generating custom API keys, detailed usage logging, and a modern "Playground" chat interface that runs directly in your browser!

## Features

- **OpenAI API Compatibility**: Endpoints are fully compatible with OpenAI client libraries and tools.
- **Web Dashboard**: A beautiful, responsive user interface with a sleek Dark Mode. View usage statistics, manage models, and test your API keys.
- **API Key Management**: Create multiple keys for different applications, track usage stats, log every request, and monitor token consumption.
- **VRAM Optimization**: Loaded models are automatically unloaded from memory after 2 minutes of inactivity to free up your GPU resources.
- **Built-in Playground**: An interactive web chat to test models in real time, featuring smooth server-sent text streaming and generation statistics (tokens/s).
- **GGUF Model Management**: The application automatically detects `.gguf` models placed in the local directory and exposes them via the API.

## Requirements

- **Python 3.10+**
- (Optional) A compatible GPU for hardware acceleration.

## Getting Started

1. Run `install_vulkan.bat` (or manually install the requirements) to download all dependencies optimized for GPU acceleration.
2. Obtain your LLM models (e.g., Llama 3, Qwen) in `.gguf` format and place them directly in the `models/` folder.
3. Run `start.bat`. The server and the web dashboard will be available at `http://127.0.0.1:8000`.

*This project is designed for personal use and serves as a lightweight local LLM sandbox.*
