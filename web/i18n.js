const translations = {
    en: {
        nav_models: "<i class=\"ph ph-cpu\"></i> Models",
        nav_playground: "<i class=\"ph ph-chat-teardrop-text\"></i> Playground",
        nav_keys: "<i class=\"ph ph-key\"></i> API Keys",
        nav_logs: "<i class=\"ph ph-chart-bar\"></i> API Logs",
        nav_connect: "<i class=\"ph ph-plug\"></i> Connection",
        nav_settings: "<i class=\"ph ph-gear\"></i> Settings",
        status_connecting: "Connecting...",
        models_title: "Available Models",
        models_desc: "All models loaded from the <code>models/</code> folder.",
        models_active_label: "Currently loaded in memory:",
        models_none: "None",
        pg_title: "Playground",
        pg_desc: "Test any loaded model live in the browser.",
        pg_model_label: "Model:",
        pg_select_model: "Select model...",
        pg_welcome: "Select a model from the list above and write a message to start! Remember that you need to create your API Key in the 'API Keys' tab if you haven't already.",
        pg_placeholder: "Write to the model... (Shift+Enter to send)",
        keys_title: "API Key Management",
        keys_desc: "Create your own keys to track usage for different apps or projects.",
        keys_create_title: "Create new key",
        keys_name_placeholder: "Key name (e.g. My Project)",
        keys_val_placeholder: "Key value (e.g. sk-my-api-123)",
        keys_create_btn: "<i class=\"ph ph-plus-circle\"></i> Create",
        th_name: "Name",
        th_guardrails: "Guardrails",
        th_expires: "Expires",
        th_last_used: "Last Used",
        th_usage: "Usage",
        logs_title: "Logs & Statistics",
        logs_desc: "Select a key to check its history and usage chart.",
        logs_back: "← Back to key selection",
        logs_stats_title: "Key statistics",
        logs_history_title: "Query history for the selected key",
        th_time: "Time",
        th_model_id: "Model API ID",
        th_time_s: "Time (s)",
        th_tokens: "Tokens",
        th_tps: "t/s (Avg / Min / Max)",
        logs_no_keys: "No keys available. Generate them in the 'API Keys' tab.",
        conn_title: "How to connect?",
        conn_desc: "Use the code below to connect any app (e.g. Python script) to this local router.",
        conn_copy: "Copy",
        conn_tip: "💡 <strong>Tip:</strong> Remember to provide the exact model name from the 'Models' tab and the correct <code>api_key</code> from the 'API Keys' tab.",
        modal_edit_title: "Edit API key",
        modal_edit_desc: "Change name and value for this key.",
        modal_key_name: "Key name",
        modal_key_val: "API Key",
        modal_cancel: "Cancel",
        modal_save: "Save",
        settings_title: "Settings",
        settings_desc: "Configure the application preferences.",
        settings_lang: "Language",
        js_loaded_vram: "<i class=\"ph ph-check-circle\"></i> Loaded in VRAM",
        js_avail_disk: "<i class=\"ph ph-hard-drive\"></i> Available on disk",
        js_copy_id: "Copy model ID",
        js_no_models: "No models. Downloading from HF in the background...",
        js_never: "Never",
        js_no_queries: "No queries for this key",
        js_err_no_model: "Select a model from the list above first!",
        js_err_no_key: "No API key! Go to API Keys tab and create at least one key.",
        js_err_conn: "Connection error: ",
        js_error: "Error: ",
        js_tokens: "tokens",
        js_key_deleted: "Key deleted!",
        js_changes_saved: "Changes saved!",
        js_copied: "Copied to clipboard!",
        js_online: "Online",
        js_offline: "Offline"
    },
    pl: {
        nav_models: "<i class=\"ph ph-cpu\"></i> Modele",
        nav_playground: "<i class=\"ph ph-chat-teardrop-text\"></i> Playground",
        nav_keys: "<i class=\"ph ph-key\"></i> Klucze API",
        nav_logs: "<i class=\"ph ph-chart-bar\"></i> Logi API",
        nav_connect: "<i class=\"ph ph-plug\"></i> Połączenie",
        nav_settings: "<i class=\"ph ph-gear\"></i> Ustawienia",
        status_connecting: "Łączenie...",
        models_title: "Dostępne Modele",
        models_desc: "Wszystkie modele wczytane z folderu <code>models/</code>.",
        models_active_label: "Aktualnie załadowany do pamięci:",
        models_none: "Brak",
        pg_title: "Playground",
        pg_desc: "Przetestuj dowolny załadowany model na żywo w przeglądarce.",
        pg_model_label: "Model:",
        pg_select_model: "Wybierz model...",
        pg_welcome: "Wybierz model z listy u góry i napisz wiadomość, aby rozpocząć! Pamiętaj, że potrzebujesz stworzyć swój Klucz API w zakładce \"Klucze API\", jeśli jeszcze go nie masz.",
        pg_placeholder: "Napisz do modelu... (Shift+Enter by wysłać)",
        keys_title: "Zarządzanie Kluczami API",
        keys_desc: "Twórz własne klucze by śledzić zużycie dla różnych aplikacji lub projektów.",
        keys_create_title: "Utwórz nowy klucz",
        keys_name_placeholder: "Nazwa klucza (np. Mój Projekt)",
        keys_val_placeholder: "Wartość klucza (np. sk-moje-api-123)",
        keys_create_btn: "<i class=\"ph ph-plus-circle\"></i> Utwórz",
        th_name: "Name",
        th_guardrails: "Guardrails",
        th_expires: "Expires",
        th_last_used: "Last Used",
        th_usage: "Usage",
        logs_title: "Logi i Statystyki",
        logs_desc: "Wybierz klucz, aby sprawdzić jego historię i wykres użycia.",
        logs_back: "← Wróć do wyboru klucza",
        logs_stats_title: "Statystyki klucza",
        logs_history_title: "Historia zapytań dla wybranego klucza",
        th_time: "Czas",
        th_model_id: "Model API ID",
        th_time_s: "Czas (s)",
        th_tokens: "Tokeny",
        th_tps: "t/s (Średnia / Min / Max)",
        logs_no_keys: "Brak dostępnych kluczy. Wygeneruj je w zakładce \"Klucze API\".",
        conn_title: "Jak się połączyć?",
        conn_desc: "Użyj poniższego kodu, aby połączyć dowolną aplikację (np. skrypt w Pythonie) z tym lokalnym routerem.",
        conn_copy: "Kopiuj",
        conn_tip: "💡 <strong>Wskazówka:</strong> Pamiętaj aby podać dokładną nazwę modelu z zakładki \"Modele\" i poprawny <code>api_key</code> z zakładki \"Klucze API\".",
        modal_edit_title: "Edytuj klucz API",
        modal_edit_desc: "Zmień nazwę i wartość dla tego klucza.",
        modal_key_name: "Nazwa klucza",
        modal_key_val: "Klucz API",
        modal_cancel: "Anuluj",
        modal_save: "Zapisz",
        settings_title: "Ustawienia",
        settings_desc: "Skonfiguruj preferencje aplikacji.",
        settings_lang: "Język",
        js_loaded_vram: "<i class=\"ph ph-check-circle\"></i> Załadowany do VRAM",
        js_avail_disk: "<i class=\"ph ph-hard-drive\"></i> Dostępny na dysku",
        js_copy_id: "Kopiuj ID modelu",
        js_no_models: "Brak modeli. Trwa pobieranie z HF w tle...",
        js_never: "Nigdy",
        js_no_queries: "Brak zapytań dla tego klucza",
        js_err_no_model: "Wybierz najpierw model z listy u góry!",
        js_err_no_key: "Brak klucza API! Przejdź do zakładki Klucze API i utwórz przynajmniej jeden klucz.",
        js_err_conn: "Błąd połączenia: ",
        js_error: "Błąd: ",
        js_tokens: "tokenów",
        js_key_deleted: "Usunięto klucz!",
        js_changes_saved: "Zapisano zmiany!",
        js_copied: "Skopiowano do schowka!",
        js_online: "Połączono",
        js_offline: "Brak połączenia"
    }
};

let currentLang = localStorage.getItem('app_language') || 'en';

function t(key) {
    return translations[currentLang][key] || key;
}

function translateUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.placeholder) el.placeholder = translations[currentLang][key];
                if (el.value && el.type === 'button') el.value = translations[currentLang][key];
            } else {
                el.innerHTML = translations[currentLang][key];
            }
        }
    });
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('app_language', lang);
    translateUI();
    // Refresh dynamic data
    if (typeof fetchData === 'function') {
        lastModelsDataStr = "";
        lastKeysDataStr = "";
        fetchData();
        const pgSelect = document.getElementById("pg-model-select");
        if(pgSelect && pgSelect.options.length > 0 && pgSelect.options[0].value === "") {
            pgSelect.options[0].text = t('pg_select_model');
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    translateUI();
    const langSelect = document.getElementById("settings-lang-select");
    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener("change", (e) => {
            setLanguage(e.target.value);
        });
    }
});
