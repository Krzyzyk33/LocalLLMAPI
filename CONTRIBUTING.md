# Contributing to LocalLLMAPI

Thank you for considering contributing. This is a small, self-contained
project — a FastAPI server plus a vanilla-JS dashboard, with no build step and
no framework.

## Setup

```bat
pip install -r requirements.txt
```

`llama-cpp-python` is compiled from source, so you need a C++ compiler
(Visual Studio Build Tools on Windows) and, for GPU support, the Vulkan SDK.
See "Getting started" in the README.

## Verifying your change

There is no test framework to install, but please check your work manually
before opening a pull request:

1. `start.bat`, then open <http://localhost:1000>.
2. Walk the tabs: **Home**, **Models**, **API Keys**, **API Logs**,
   **Connection**, **Docs**, **Settings**.
3. Open the browser console — it must stay clean. Most of the historical
   breakage in this project was silent JavaScript errors.
4. Send a real request using the runnable example in the **Docs** tab.
5. If you touched the server, restart it and confirm the dashboard still
   reports the same token totals.

## Things worth knowing before you change something

- **The i18n dictionaries must stay in sync.** `web/i18n.js` holds `en` and
  `pl` side by side and every key must exist in both. This is not
  theoretical: a missing English key shipped once and rendered as
  `65d time_ago` in the interface. When you add a user-visible string, add it
  to both blocks.
- **Tooltips come from translated text, never from key names.** A tooltip in
  the collapsed sidebar is filled from the label's own `<span>`, so it can
  never show a raw key. Keep it that way.
- **Never build HTML from user data.** `el()` in `web/script.js` deliberately
  has no `html:` option. Model names and API key names come from the database
  and end up in the DOM — keep it that way.
- **Model loading must not block the event loop.** `Llama()` is built in a
  worker thread, each model has its own lock so concurrent requests share one
  instance, and `release_model()` runs in a `finally` on a plain
  `threading.RLock`. Removing any of those reintroduces a frozen server, VRAM
  exhaustion, or a permanent `503` after a client disconnects mid-stream.
- **The documentation is part of the product.** The error table in the **Docs**
  tab must match what the API actually returns. If you change a status code,
  update `DOC_ERRORS` in `web/script.js` in the same commit.
- **Assets are vendored on purpose.** `web/vendor/` exists so the dashboard
  works without internet access. Do not replace those files with CDN links.

## Repository layout

```
backend/
  router_server.py    FastAPI app, model registry, slots
  db_manager.py       SQLite: API keys, request logs, settings
  model_manager.py    finds .gguf files in models/
web/
  index.html          the dashboard
  style.css           design tokens, light and dark themes
  script.js           all dashboard logic
  i18n.js             en / pl strings
  branding/icon.svg   app icon and favicon
  vendor/             Chart.js and the Tabler icon font (offline)
models/               your .gguf files — not tracked by git
logs.db               API keys and request history — not tracked by git
```

## Pull requests

- One concern per commit; explain *why*, not *what*.
- Reference the issue number in the body, not the title.
- Include a screenshot for anything visual.
- End files with a newline.

## Reporting bugs

Include the model name, the slot configuration, the engine, and the relevant
part of `error.txt` (rotated automatically). The indicator at the bottom of
the sidebar shows whether the server is reachable.
