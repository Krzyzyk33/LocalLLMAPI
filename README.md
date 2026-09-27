# LocalLLMAPI

A fast, lightweight, **local** API server that mimics OpenAI's endpoints
(`/v1/chat/completions`, `/v1/models`), powered by `llama-cpp-python` with
hardware acceleration (Vulkan / CUDA / CPU). It ships with a model manager,
custom API keys, detailed usage logging and a web dashboard.

Runs on **port 1000**.

## Features

- **OpenAI API compatibility** — works with the official Python/JS clients,
  LangChain, Open WebUI and anything else that speaks the OpenAI protocol.
- **Home dashboard** — last used model, total tokens, request count, average
  and best tokens/s, models on disk, uptime, slot occupancy, recent requests.
- **3 model slots** — each bound to a different device (`Vulkan` / `CUDA` /
  `CPU`). Models are routed into the slot matching the API key's engine.
- **No duplicate loads** — concurrent requests for the same model share a
  single in-memory instance instead of loading one per request.
- **VRAM auto-unload** — models idle for more than 2 minutes are freed
  automatically. Reload on demand from the panel or via `POST /api/unload`.
- **API key management** — create, edit and delete keys, switch their engine,
  track token usage per key.
- **Detailed logging** — every request is recorded with TTFT, duration, token
  count and tokens/s (avg / min / max), plus a 24-hour chart.
- **In-app documentation** — the **Docs** tab covers reloading a model, what to
  send to the API, every endpoint and every error, with runnable examples
  filled in with your address and key.
- **Collapsible sidebar** — click the logo (or `Ctrl`/`Cmd`+`B`) to collapse it
  to icons. The state persists.
- **Light & dark theme** — follows your OS preference, with a manual toggle.
- **Polish / English** — switchable from the Settings tab.
- **Works offline** — Chart.js, the Tabler icon font and every asset are served
  locally. No CDN, no internet required once installed.

## Requirements

- **Python 3.10+**
- A `.gguf` model in `models/` (a small test model downloads automatically if
  the folder is empty)
- A C++ compiler — `llama-cpp-python` is built from source
- For GPU acceleration: the **Vulkan SDK** (recommended) or CUDA

## Getting started

**1. Install Vulkan** — download the [Vulkan SDK](https://vulkan.lunarg.com/)
and make sure a C++ compiler is available (Visual Studio Build Tools on
Windows).

**2. Install the dependencies**

```bat
pip install -r requirements.txt
```

Then build `llama-cpp-python` with the backend you want. Vulkan:

```bat
set CMAKE_ARGS=-DGGML_VULKAN=on
pip install llama-cpp-python --upgrade --force-reinstall --no-cache-dir
```

For CUDA, set `CMAKE_ARGS=-DGGML_CUDA=on` instead. For CPU-only, plain
`pip install llama-cpp-python` works.

**3. Add a model** — put your `.gguf` files in `models/`.

**4. Run it**

```bat
start.bat
```

That's it. The server starts and the dashboard opens at
<http://localhost:1000>. Close the window or press `Ctrl`+`C` to stop.

## Connecting an app

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:1000/v1",
    api_key="PASTE_YOUR_API_KEY_HERE",
)

stream = client.chat.completions.create(
    model="MODEL_NAME_FROM_MODELS_TAB",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True,
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)
```

The **Connection** tab shows ready-made snippets for Python, cURL and
JavaScript with your LAN address already filled in. The **Docs** tab has the
parameter reference, every endpoint and every error code — with a `curl`
command you can copy and run as-is.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/chat/completions` | Chat completion, streaming and non-streaming — requires a key |
| `GET` | `/v1/models` | List of available models |
| `GET` | `/api/status` | Loaded models, slots, uptime, local IP |
| `GET` | `/api/stats` | Aggregates for the Home dashboard |
| `GET`/`POST`/`PUT`/`DELETE` | `/api/keys`, `/api/keys/{id}` | API key management |
| `GET` | `/api/logs/{id}` | Request history for one key |
| `GET`/`PUT` | `/api/settings/slots` | Slot → device mapping |
| `POST` | `/api/unload` | Free models from memory |
| `GET` | `/docs` | Interactive OpenAPI reference |

## Files

```
start.bat              launches the server
requirements.txt       dependencies
backend/               server, database, model discovery
web/                   the dashboard (plain HTML, CSS and JS — no build step)
models/                your .gguf files
logs.db                your API keys and request history
```

`models/` and `logs.db` are yours — they are not tracked by git, and deleting
`logs.db` deletes your keys.

## Security note

The panel endpoints under `/api/*` are not authenticated. Anyone who can
reach port 1000 on your network can create and delete keys. To restrict that,
change the host in `start.bat` from `0.0.0.0` to `127.0.0.1` and use a
firewall or an SSH tunnel for remote access.

## License

MIT — see [LICENSE](LICENSE).
