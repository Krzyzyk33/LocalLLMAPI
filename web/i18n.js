/* ==========================================================================
   LocalLLMAPI — tłumaczenia (PL / EN)

   ZASADA: oba słowniki MUSZĄ mieć identyczny zestaw kluczy. Brak klucza
   w jednym języku renderuje nazwę klucza zamiast tekstu — trafiło się na to
   przy 7 kluczach obecnych tylko w `pl`, przez co w angielskim UI
   pojawiało się "65d time_ago" zamiast "65d ago".

   Kolejność bloków nie ma znaczenia, ale `en` idzie pierwszy, bo to
   domyślny język i źródło prawdy dla nowych kluczy.
   ========================================================================== */
(() => {
'use strict';

const DICT = {
  /* =======================================================================
     ENGLISH — default language
     ======================================================================= */
  en: {
    /* --- sidebar / topbar --- */
    brand_tagline: 'Local LLM router',
    nav_label_manage: 'Manage',
    nav_label_system: 'System',
    nav_home: 'Home',
    nav_models: 'Models',
    nav_expand: 'Expand sidebar',
    nav_collapse: 'Collapse sidebar',
    nav_keys: 'API Keys',
    nav_logs: 'API Logs',
    nav_connect: 'Connection',
    nav_docs: 'Docs',
    nav_settings: 'Settings',
    status_connecting: 'Connecting…',
    topbar_api: 'API',
    sub_home: 'Local server at a glance',
    sub_models: 'GGUF files found in models/',
    sub_keys: 'Keys to track usage per application',
    sub_logs: 'Request history and usage chart',
    sub_connect: 'Connect your app to this router',
    sub_docs: 'Reload models, send requests, endpoints and errors',
    sub_settings: 'Slots, theme and panel language',

    /* --- home --- */
    home_headline: 'OpenAI-compatible router running entirely on this machine.',
    tag_compat: 'OpenAI compatible',
    tag_vulkan: 'Vulkan / CUDA / CPU',
    tag_unload: 'Unload after 2 min',
    stat_last_model: 'Last used model',
    stat_tokens: 'Tokens used',
    stat_requests: 'Requests',
    stat_tps: 'Average speed',
    stat_models: 'Models on disk',
    stat_uptime: 'Uptime',
    stat_slots: 'slots',
    stat_best: 'Best',
    stat_in_memory: 'in memory',
    stat_no_recent: 'none in the last hour',
    stat_avg_tps: 'Average',
    stat_best_tps: 'Best',
    home_slots_title: 'Slots',
    home_recent_title: 'Recent requests',
    home_see_all: 'See all',
    home_no_requests: 'No requests yet. Send one through the API and it will show up here.',
    home_never_used: 'The API has not been used yet',
    home_none_loaded: 'Nothing in memory — models load on first request',
    last_hour: 'in the last hour',

    /* --- slots --- */
    slot_busy: 'Active',
    slot_loaded: 'Loaded',
    slot_free: 'Free',
    slot_waiting: 'Awaiting a model',
    slot_idle: 'Idle',

    /* --- table headers --- */
    th_time: 'Time',
    th_model_id: 'Model',
    th_key_name: 'Key',
    th_tokens: 'Tokens',
    th_time_s: 'Time (s)',
    th_tps_short: 't/s',
    th_tps: 't/s (avg / min / max)',
    th_ttft: 'TTFT (s)',
    th_name: 'Name',
    th_engine: 'Engine',
    th_last_used: 'Last used',
    th_usage: 'Tokens',
    th_actions: 'Actions',

    /* --- models --- */
    models_active_label: 'Loaded in memory:',
    models_none: 'None',

    /* --- keys --- */
    keys_create_title: 'New key',
    keys_name_label: 'Name',
    keys_name_placeholder: 'e.g. My Project',
    keys_val_label: 'Key value',
    keys_val_placeholder: 'e.g. sk-my-api-123',
    keys_engine_label: 'Engine',
    keys_create_btn: 'Create',
    keys_list_title: 'Your keys',
    keys_empty: 'No keys yet. Create the first one above.',

    /* --- logs --- */
    logs_pick_key: 'Select a key',
    logs_no_keys: 'No keys available. Create one in the API Keys tab.',
    logs_go_keys: 'Go to keys',
    logs_back: 'All keys',
    logs_chart_title: 'Tokens, last 24 hours',
    logs_history_title: 'Query history',

    /* --- connect --- */
    conn_title: 'How to connect',
    conn_copy: 'Copy',
    conn_tip: 'Use the exact model name from the <b>Models</b> tab and a valid key from the <b>API Keys</b> tab.',
    ep_local: 'On this machine',
    ep_lan: 'From another device (LAN)',
    ep_chat: 'Chat',
    ep_models: 'Model list',

    /* --- settings --- */
    settings_slots_title: 'Model slots',
    settings_slots_desc: 'Each slot has its own device. A model is placed in the slot matching the API key engine.',
    settings_lang: 'Language',
    settings_loaded_title: 'Loaded models',
    settings_unload_all: 'Unload all',

    /* Backends llama.cpp */
    settings_backends_title: 'Backends',
    settings_backends_refresh: 'Rescan',
    settings_backends_desc: 'The GPU backend is compiled into llama-cpp-python, so it cannot be switched on at runtime. A request for a backend that is not installed fails with a provider error instead of silently running on CPU.',
    settings_backends_log: 'Build log',
    be_ready: 'ready',
    be_absent: 'not installed',
    be_installed: 'Installed',
    be_not_installed: 'Not installed in this build — can be added here',
    be_missing: 'Cannot build: {what} missing',
    be_builtin: 'built in',
    be_install: 'Install',
    be_install_title: 'Rebuild llama-cpp-python with this backend',
    be_building: 'Building…',
    be_started: 'Building {name}. This takes several minutes — the log is below.',
    be_done: 'done',
    be_failed: 'failed',
    be_no_log: 'No build has been run yet.',
    be_rescanned: 'Backends rescanned',
    be_restart: 'Backend installed. Restart the server to load it.',
    be_go_settings: 'Open Settings',
    be_ignore: 'Ignore',
    be_alert_title: '{what} loader is not installed',
    be_alert_ready: '{count} slot(s) or API key(s) are assigned to it, so every request will fail with a 503 provider error. Everything needed to build it is already on this machine.',
    be_alert_missing: '{count} slot(s) or API key(s) are assigned to it, so every request will fail with a 503 provider error. Missing first: {what}.',

    settings_unload: 'Unload from memory',
    settings_unloaded: 'Model unloaded',
    settings_slot_label: 'Slot',
    settings_device_label: 'Device',
    settings_save_btn: 'Save',
    settings_saved: 'Settings saved',
    settings_no_models: 'No models in memory.',
    settings_loaded_in: 'In slot',
    settings_n_ctx: 'Context',
    settings_refcount: 'Active',

    /* --- modals --- */
    modal_edit_title: 'Edit API key',
    modal_key_name: 'Key name',
    modal_key_val: 'Key value',
    modal_engine: 'Engine',
    modal_cancel: 'Cancel',
    modal_save: 'Save',
    confirm_title: 'Confirm',
    confirm_yes: 'Delete',
    confirm_delete_key: 'Delete key “{name}”? All of its logs will be removed too.',
    confirm_unload_all: 'Unload all unused models from GPU memory?',

    /* --- dokumentacja (Ustawienia) --- */
    docs_title: 'Documentation',
    docs_reload_title: 'Reloading a model',
    docs_reload_desc: 'A model is read from disk the first time it is used, then released from memory automatically after 2 minutes without activity. To force a fresh load, unload it first — the next request reads it again.',
    docs_reload_ui: 'From the panel',
    docs_reload_ui_hint: 'Unload all',
    docs_reload_ui_desc: 'in this tab, or the bin icon next to a loaded model to unload just that one.',
    docs_reload_slot: 'Slot device',
    docs_reload_slot_desc: "Changing a slot's device makes the next request load the model into a matching slot instead.",
    docs_reload_busy: 'While in use',
    docs_reload_busy_desc: 'A model with active requests is never unloaded. If every slot is busy the API returns 503 — retry in a moment.',
    docs_send_title: 'Sending a request',
    docs_send_desc: 'Every call needs a bearer token from the API Keys tab. The model field must match the file name exactly, including the .gguf suffix.',
    docs_field: 'Field',
    docs_required: 'Required',
    docs_default: 'Default',
    docs_meaning: 'Meaning',
    docs_p_model: 'Exact file name of the model, e.g. gemma-4-E4B-it-Q4_0.gguf',
    docs_p_messages: 'Array of { role, content }. Roles: system, user, assistant.',
    docs_p_stream: 'true sends server-sent events token by token instead of one JSON at the end.',
    docs_p_temperature: '0–2. Lower is more predictable, higher is more random.',
    docs_p_max_tokens: 'Upper limit on generated tokens.',
    docs_endpoints_title: 'Endpoints',
    docs_method: 'Method',
    docs_path: 'Path',
    docs_auth: 'Auth',
    docs_purpose: 'Purpose',
    docs_bearer: 'bearer',
    docs_open: 'open',
    docs_e_chat: 'Chat completion — the only endpoint that needs a key.',
    docs_e_models: 'List of models found in models/.',
    docs_e_status: 'Loaded models, slots, uptime and local IP.',
    docs_e_stats: 'Aggregates shown on the Home page.',
    docs_e_keys_get: 'List keys with token totals.',
    docs_e_keys_post: 'Create a key: { name, api_key, engine }.',
    docs_e_keys_put: 'Update a key: { name, api_key, engine }.',
    docs_e_keys_del: 'Delete a key and its logs.',
    docs_e_logs: 'Request history for one key.',
    docs_e_slots_get: 'Slot → device mapping and what is loaded.',
    docs_e_slots_put: 'Change a slot: { slot_index, device }.',
    docs_e_unload: 'Free models from memory. Optional ?model_name=…',
    docs_e_swagger: 'Interactive OpenAPI reference.',
    docs_errors_title: 'Errors',
    docs_status: 'Status',
    docs_x_400: 'Malformed payload, or a key value that already exists.',
    docs_x_401: 'The bearer token is not recognised — the key was deleted or mistyped.',
    docs_x_403: 'The Authorization header is missing. Send Authorization: Bearer <key>.',
    docs_x_422: 'The body is not valid JSON, or a required field is missing.',
    docs_x_503: 'All slots are busy with active requests — retry shortly.',
    docs_x_backend: 'The <b>backend_unavailable</b> provider error: the engine assigned to this API key is not compiled into llama-cpp-python. The response names the provider and lists the backends that are available — the model is never silently downgraded to CPU. Build the loader from <b>Settings → Backends</b>.',
    docs_x_ctx: 'In a stream: the context window was exceeded. The server grows it automatically, so retry the request.',

    /* --- time / messages --- */
    time_never: 'never',
    time_now: 'just now',
    time_ago: 'ago',
    js_never: 'never',
    js_copied: 'Copied to clipboard',
    js_copy: 'Copy',
    js_copy_fail: 'Copy failed',
    js_copy_key: 'Click to copy the key',
    js_copy_id: 'Copy model name',
    js_loaded_vram: 'Loaded in memory',
    js_avail_disk: 'Available on disk',
    js_no_models: 'No .gguf files in models/. A test model is downloading in the background…',
    js_created: 'Key created',
    js_changes_saved: 'Changes saved',
    js_key_deleted: 'Key deleted',
    js_err_fields: 'Fill in both the name and the key value',
    js_online: 'Online',
    js_offline: 'Offline',
    js_err_conn: 'Lost connection to the server',
    js_edit: 'Edit',
    js_delete: 'Delete',
    js_no_queries: 'No requests for this key',
    js_search: 'Search model…',
  },

  /* =======================================================================
     POLSKI
     ======================================================================= */
  pl: {
    /* --- sidebar / topbar --- */
    brand_tagline: 'Lokalny router LLM',
    nav_label_manage: 'Zarządzanie',
    nav_label_system: 'System',
    nav_home: 'Home',
    nav_models: 'Modele',
    nav_expand: 'Rozwiń pasek',
    nav_collapse: 'Zwiń pasek',
    nav_keys: 'Klucze API',
    nav_logs: 'Logi API',
    nav_connect: 'Połączenie',
    nav_docs: 'Dokumentacja',
    nav_settings: 'Ustawienia',
    status_connecting: 'Łączenie…',
    topbar_api: 'API',
    sub_home: 'Podsumowanie pracy serwera',
    sub_models: 'Pliki GGUF w katalogu models/',
    sub_keys: 'Klucze do śledzenia zużycia per aplikacja',
    sub_logs: 'Historia requestów i wykres zużycia',
    sub_connect: 'Jak połączyć aplikację do tego routera',
    sub_docs: 'Przeładowanie modeli, zapytania, endpointy i błędy',
    sub_settings: 'Sloty, motyw i język panelu',

    /* --- home --- */
    home_headline: 'Router zgodny z OpenAI, działający w całości na tym komputerze.',
    tag_compat: 'Zgodne z OpenAI',
    tag_vulkan: 'Vulkan / CUDA / CPU',
    tag_unload: 'Zwalnianie po 2 min',
    stat_last_model: 'Ostatnio używany model',
    stat_tokens: 'Zużyte tokeny',
    stat_requests: 'Requesty',
    stat_tps: 'Średnia prędkość',
    stat_models: 'Modele na dysku',
    stat_uptime: 'Czas działania',
    stat_slots: 'slotów',
    stat_best: 'Rekord',
    stat_in_memory: 'w pamięci',
    stat_no_recent: 'brak w ostatniej godzinie',
    stat_avg_tps: 'Średnia',
    stat_best_tps: 'Rekord',
    home_slots_title: 'Sloty',
    home_recent_title: 'Ostatnie requesty',
    home_see_all: 'Zobacz wszystkie',
    home_no_requests: 'Jeszcze nie było żadnego requestu. Wyślij zapytanie przez API, a pojawi się tutaj.',
    home_never_used: 'API nie zostało jeszcze użyte',
    home_none_loaded: 'Brak modeli w pamięci — ładują się przy pierwszym zapytaniu',
    last_hour: 'w ostatniej godz.',

    /* --- slots --- */
    slot_busy: 'Aktywny',
    slot_loaded: 'Wczytany',
    slot_free: 'Wolny',
    slot_waiting: 'Oczekuje na model',
    slot_idle: 'Bezczynny',

    /* --- table headers --- */
    th_time: 'Czas',
    th_model_id: 'Model',
    th_key_name: 'Klucz',
    th_tokens: 'Tokeny',
    th_time_s: 'Czas (s)',
    th_tps_short: 't/s',
    th_tps: 't/s (śr / min / max)',
    th_ttft: 'TTFT (s)',
    th_name: 'Nazwa',
    th_engine: 'Silnik',
    th_last_used: 'Ostatnio użyty',
    th_usage: 'Tokeny',
    th_actions: 'Akcje',

    /* --- models --- */
    models_active_label: 'Wczytany w pamięci:',
    models_none: 'Brak',

    /* --- keys --- */
    keys_create_title: 'Nowy klucz',
    keys_name_label: 'Nazwa',
    keys_name_placeholder: 'np. Mój Projekt',
    keys_val_label: 'Wartość klucza',
    keys_val_placeholder: 'np. sk-moje-api-123',
    keys_engine_label: 'Silnik',
    keys_create_btn: 'Utwórz',
    keys_list_title: 'Twoje klucze',
    keys_empty: 'Brak kluczy. Utwórz pierwszy powyżej.',

    /* --- logs --- */
    logs_pick_key: 'Wybierz klucz',
    logs_no_keys: 'Brak kluczy. Wygeneruj je w zakładce Klucze API.',
    logs_go_keys: 'Przejdź do kluczy',
    logs_back: 'Wszystkie klucze',
    logs_chart_title: 'Tokeny, ostatnie 24 godziny',
    logs_history_title: 'Historia zapytań',

    /* --- connect --- */
    conn_title: 'Jak się połączyć',
    conn_copy: 'Kopiuj',
    conn_tip: 'Podaj dokładną nazwę modelu z zakładki <b>Modele</b> i poprawny klucz z zakładki <b>Klucze API</b>.',
    ep_local: 'Na tym komputerze',
    ep_lan: 'Z innego urządzenia (LAN)',
    ep_chat: 'Czat',
    ep_models: 'Lista modeli',

    /* --- settings --- */
    settings_slots_title: 'Sloty modeli',
    settings_slots_desc: 'Każdy slot ma własne urządzenie. Model trafia do slotu pasującego do silnika klucza API.',
    settings_lang: 'Język',
    settings_loaded_title: 'Załadowane modele',
    settings_unload_all: 'Zwolnij wszystkie',

    /* Backendy llama.cpp */
    settings_backends_title: 'Backendy',
    settings_backends_refresh: 'Skanuj ponownie',
    settings_backends_desc: 'Backend GPU jest wkompilowany w llama-cpp-python, więc nie da się go włączyć w trakcie pracy. Zapytanie o backend, którego nie ma, kończy się błędem providera, a nie po cichu jedzie na CPU.',
    settings_backends_log: 'Log kompilacji',
    be_ready: 'gotowy',
    be_absent: 'niezainstalowany',
    be_installed: 'Zainstalowany',
    be_not_installed: 'Brak w tej instalacji — można dodać tutaj',
    be_missing: 'Nie da się zbudować: brakuje {what}',
    be_builtin: 'wbudowany',
    be_install: 'Zainstaluj',
    be_install_title: 'Przebuduj llama-cpp-python z tym backendem',
    be_building: 'Budowanie…',
    be_started: 'Budowanie {name}. Trwa kilka minut — log poniżej.',
    be_done: 'gotowe',
    be_failed: 'nieudane',
    be_no_log: 'Nie uruchamiano jeszcze kompilacji.',
    be_rescanned: 'Backendy przeskanowane ponownie',
    be_restart: 'Backend zainstalowany. Zrestartuj serwer, żeby go wczytać.',
    be_go_settings: 'Otwórz Ustawienia',
    be_ignore: 'Zignoruj',
    be_alert_title: 'Brak loadera {what}',
    be_alert_ready: '{count} slot(ów) lub kluczy API jest do niego przypisanych, więc każde zapytanie skończy się błędem 503 od providera. Wszystko potrzebne do budowy jest już na tej maszynie.',
    be_alert_missing: '{count} slot(ów) lub kluczy API jest do niego przypisanych, więc każde zapytanie skończy się błędem 503 od providera. Brakuje najpierw: {what}.',
    settings_unload: 'Zwolnij z pamięci',
    settings_unloaded: 'Model zwolniony',
    settings_slot_label: 'Slot',
    settings_device_label: 'Urządzenie',
    settings_save_btn: 'Zapisz',
    settings_saved: 'Ustawienia zapisane',
    settings_no_models: 'Brak modeli w pamięci.',
    settings_loaded_in: 'W slocie',
    settings_n_ctx: 'Kontekst',
    settings_refcount: 'Aktywne',

    /* --- modals --- */
    modal_edit_title: 'Edytuj klucz API',
    modal_key_name: 'Nazwa klucza',
    modal_key_val: 'Wartość klucza',
    modal_engine: 'Silnik',
    modal_cancel: 'Anuluj',
    modal_save: 'Zapisz',
    confirm_title: 'Potwierdź',
    confirm_yes: 'Usuń',
    confirm_delete_key: 'Usunąć klucz „{name}”? Wszystkie powiązane logi też zostaną skasowane.',
    confirm_unload_all: 'Zwolnić wszystkie nieużywane modele z pamięci GPU?',

    /* --- dokumentacja (Ustawienia) --- */
    docs_title: 'Dokumentacja',
    docs_reload_title: 'Przeładowanie modelu',
    docs_reload_desc: 'Model jest wczytywany z dysku przy pierwszym użyciu, a po 2 minutach bezczynności zwalniany z pamięci automatycznie. Aby wymusić ponowne wczytanie, najpierw go zwolnij — następne zapytanie wczyta go od nowa.',
    docs_reload_ui: 'Z panelu',
    docs_reload_ui_hint: 'Zwolnij wszystkie',
    docs_reload_ui_desc: 'w tej zakładce albo ikona kosza przy załadowanym modelu, aby zwolnić tylko ten jeden.',
    docs_reload_slot: 'Urządzenie slotu',
    docs_reload_slot_desc: 'Zmiana urządzenia w slocie sprawia, że następne zapytanie wczyta model do pasującego slotu.',
    docs_reload_busy: 'W trakcie użycia',
    docs_reload_busy_desc: 'Model z aktywnymi requestami nigdy nie jest zwalniany. Jeśli wszystkie sloty są zajęte, API zwraca 503 — spróbuj ponownie za chwilę.',
    docs_send_title: 'Wysyłanie zapytania',
    docs_send_desc: 'Każde wywołanie wymaga tokenu z zakładki Klucze API. Pole model musi być identyczne z nazwą pliku, razem z rozszerzeniem .gguf.',
    docs_field: 'Pole',
    docs_required: 'Wymagane',
    docs_default: 'Domyślnie',
    docs_meaning: 'Znaczenie',
    docs_p_model: 'Dokładna nazwa pliku modelu, np. gemma-4-E4B-it-Q4_0.gguf',
    docs_p_messages: 'Tablica { role, content }. Role: system, user, assistant.',
    docs_p_stream: 'true wysyła zdarzenia serwera token po tokenie zamiast całego JSON na końcu.',
    docs_p_temperature: '0–2. Niższa = bardziej przewidywalne, wyższa = bardziej losowe.',
    docs_p_max_tokens: 'Górny limit generowanych tokenów.',
    docs_endpoints_title: 'Endpointy',
    docs_method: 'Metoda',
    docs_path: 'Ścieżka',
    docs_auth: 'Autoryzacja',
    docs_purpose: 'Zastosowanie',
    docs_bearer: 'bearer',
    docs_open: 'otwarty',
    docs_e_chat: 'Zapytanie czatu — jedyny endpoint wymagający klucza.',
    docs_e_models: 'Lista modeli znalezionych w models/.',
    docs_e_status: 'Załadowane modele, sloty, uptime i adres IP.',
    docs_e_stats: 'Agregaty pokazywane na stronie Home.',
    docs_e_keys_get: 'Lista kluczy z sumami tokenów.',
    docs_e_keys_post: 'Utworzenie klucza: { name, api_key, engine }.',
    docs_e_keys_put: 'Aktualizacja klucza: { name, api_key, engine }.',
    docs_e_keys_del: 'Usunięcie klucza wraz z logami.',
    docs_e_logs: 'Historia requestów dla jednego klucza.',
    docs_e_slots_get: 'Mapowanie slotów na urządzenia i co jest załadowane.',
    docs_e_slots_put: 'Zmiana slotu: { slot_index, device }.',
    docs_e_unload: 'Zwalnia modele. Opcjonalnie ?model_name=…',
    docs_e_swagger: 'Interaktywna dokumentacja OpenAPI.',
    docs_errors_title: 'Błędy',
    docs_status: 'Status',
    docs_x_400: 'Błędna treść zapytania lub wartość klucza, która już istnieje.',
    docs_x_401: 'Token bearer nie jest rozpoznany — klucz usunięty lub literówka.',
    docs_x_403: 'Brak nagłówka Authorization. Wyślij Authorization: Bearer <klucz>.',
    docs_x_422: 'Treść nie jest poprawnym JSON-em albo brakuje wymaganego pola.',
    docs_x_503: 'Wszystkie sloty zajęte aktywnymi requestami — spróbuj za chwilę.',
    docs_x_backend: 'Błąd providera <b>backend_unavailable</b>: silnik przypisany do tego klucza API nie jest wkompilowany w llama-cpp-python. Odpowiedź nazywa providera i wymienia dostępne backendy — model nigdy nie jest po cichu przenoszony na CPU. Zbuduj loader w <b>Ustawieniach → Backendy</b>.',
    docs_x_ctx: 'W streamie: przekroczono okno kontekstu. Serwer powiększa je automatycznie, więc powtórz zapytanie.',

    /* --- time / messages --- */
    time_never: 'nigdy',
    time_now: 'przed chwilą',
    time_ago: 'temu',
    js_never: 'nigdy',
    js_copied: 'Skopiowano do schowka',
    js_copy: 'Kopiuj',
    js_copy_fail: 'Nie udało się skopiować',
    js_copy_key: 'Kliknij, aby skopiować klucz',
    js_copy_id: 'Kopiuj nazwę modelu',
    js_loaded_vram: 'Załadowany w pamięci',
    js_avail_disk: 'Dostępny na dysku',
    js_no_models: 'Brak plików .gguf w katalogu models/. Trwa pobieranie modelu testowego w tle…',
    js_created: 'Klucz utworzony',
    js_changes_saved: 'Zmiany zapisane',
    js_key_deleted: 'Klucz usunięty',
    js_err_fields: 'Uzupełnij nazwę i wartość klucza',
    js_online: 'Połączono',
    js_offline: 'Offline',
    js_err_conn: 'Utracono połączenie z serwerem',
    js_edit: 'Edytuj',
    js_delete: 'Usuń',
    js_no_queries: 'Brak zapytań dla tego klucza',
    js_search: 'Szukaj modelu…',
  },
};

const KEY = 'llmapi.lang';
// Angielski domyślnie, niezależnie od lokalizacji przeglądarki.
let lang = localStorage.getItem(KEY) || 'en';

/** Podmienia {placeholder} w tłumaczeniu. */
function fill(str, vars) {
  return Object.entries(vars || {}).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, v), str,
  );
}

function t(key, vars) {
  const dict = DICT[lang] || DICT.en;
  return fill(dict[key] ?? DICT.en[key] ?? key, vars);
}

function translateUI() {
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const value = DICT[lang]?.[node.dataset.i18n];
    if (value === undefined) return;
    // Ikony mieszkaja w osobnych <span>, wiec tu bezpiecznie podmieniamy sam tekst.
    node.innerHTML = value;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const value = DICT[lang]?.[node.dataset.i18nPlaceholder];
    if (value !== undefined) node.placeholder = value;
  });

  /* Tooltipy w pasku. Bez tego pokazywaly surowy klucz ("nav_logs")
     zamiast "API Logs" — atrybut data-tip nie jest tlumaczony przez
     przebieg [data-i18n]. */
  document.querySelectorAll('.nav-item').forEach((item) => {
    const label = item.querySelector('span[data-i18n]');
    const text = label ? label.textContent.trim() : '';
    if (text) item.dataset.tip = text;
  });
  document.querySelectorAll('[data-i18n-tip]').forEach((node) => {
    const value = DICT[lang]?.[node.dataset.i18nTip];
    if (value !== undefined) node.dataset.tip = value;
  });

  document.querySelectorAll('.lang-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.lang === lang);
  });
}

function setLanguage(next) {
  lang = DICT[next] ? next : 'en';
  localStorage.setItem(KEY, lang);
  translateUI();

  // Etykiety sa generowane w JS, wiec trzeba przerysowac dane.
  const api = window.LLMAPI;
  if (!api) return;
  // applyRail() przepisuje tooltip logo — jego tresc zalezy od stanu paska,
  // wiec musi sie odnowic po zmianie jezyka, inaczej pokazywalby stara.
  api.applyRail();
  api.showTab(document.querySelector('.panel.is-active')?.id || 'home', false);
  api.renderCode();
  api.renderEndpoints();
  api.renderDocs();
  api.loadStats();
}
window.t = t;
window.setLanguage = setLanguage;
window.translateUI = translateUI;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', translateUI);
} else {
  translateUI();
}

})();
