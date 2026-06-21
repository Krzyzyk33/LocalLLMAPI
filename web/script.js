const API_BASE = "http://localhost:8000";
let currentIp = "127.0.0.1";
let usageChart = null;
let selectedKeyId = null;

let lastModelsDataStr = "";
let lastKeysDataStr = "";
let activeModel = null;

// Obsługa zakładek
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        const tabId = item.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    });
});

function initChart() {
    const ctx = document.getElementById('usageChart').getContext('2d');
    usageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [{
                label: 'Zużyte tokeny',
                data: Array(24).fill(0),
                backgroundColor: 'rgba(37, 99, 235, 0.5)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#888' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#888' }
                }
            }
        }
    });
}

function updateChart(logs) {
    if (!usageChart) return;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const hourlyData = Array(24).fill(0);
    
    logs.forEach(log => {
        const date = new Date(log.timestamp * 1000);
        if (date >= today) {
            const hour = date.getHours();
            hourlyData[hour] += log.total_tokens;
        }
    });
    
    usageChart.data.datasets[0].data = hourlyData;
    usageChart.update();
}

async function createApiKey() {
    const name = document.getElementById("new-key-name").value;
    const val = document.getElementById("new-key-value").value;
    const errDiv = document.getElementById("key-error");
    
    if (!name || !val) {
        errDiv.textContent = "Wypełnij oba pola!";
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/keys`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: name, api_key: val})
        });
        
        if (res.ok) {
            errDiv.style.color = "var(--success)";
            errDiv.textContent = "Utworzono pomyślnie!";
            document.getElementById("new-key-name").value = "";
            document.getElementById("new-key-value").value = "";
            setTimeout(() => { errDiv.textContent = ""; }, 2000);
            fetchData();
        } else {
            const err = await res.json();
            errDiv.style.color = "#ef4444";
            errDiv.textContent = err.detail || "Błąd podczas tworzenia klucza.";
        }
    } catch (e) {
        errDiv.textContent = "Błąd serwera.";
    }
}

function selectKey(id, name) {
    selectedKeyId = id;
    document.getElementById("key-details").style.display = "block";
    document.getElementById("details-title").textContent = `Szczegóły klucza: ${name}`;
    
    document.querySelectorAll('.key-card').forEach(card => card.classList.remove('selected'));
    const selectedCard = Array.from(document.querySelectorAll('.key-card')).find(c => c.dataset.id == id);
    if (selectedCard) selectedCard.classList.add('selected');
    
    fetchKeyDetails();
}

async function fetchKeyDetails() {
    if (!selectedKeyId) return;
    try {
        const logsRes = await fetch(`${API_BASE}/api/logs/${selectedKeyId}`);
        const logsTbody = document.getElementById("logs-tbody");

        if (logsRes.ok) {
            const logsData = await logsRes.json();
            
            updateChart(logsData);
            
            if (logsData.length > 0) {
                const reversedLogs = [...logsData].reverse();
                logsTbody.innerHTML = reversedLogs.map((log, index) => {
                    const date = new Date(log.timestamp * 1000);
                    const timeStr = date.toLocaleTimeString('pl-PL');
                    return `
                        <tr class="animate-fade-in-up" style="animation-delay: ${index * 0.05}s">
                            <td>${timeStr}</td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <span style="color: var(--accent); font-family: monospace;">${log.model}</span>
                                        <button onclick="copyToClipboard('${log.model}')" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 2px;" title=t('js_copy_id')><i class="ph ph-copy"></i></button>
                                    </div>
                                </td>
                            <td>${log.elapsed_seconds}</td>
                            <td>${log.total_tokens}</td>
                            <td style="color: var(--success);">
                                <strong>${log.tokens_per_second}</strong>
                                <span style="color: #64748b; font-size: 0.85rem; margin-left: 0.5rem;">
                                    (Min: ${log.min_tps !== undefined && log.min_tps !== 0 ? log.min_tps : log.tokens_per_second} / Max: ${log.max_tps !== undefined && log.max_tps !== 0 ? log.max_tps : log.tokens_per_second})
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                logsTbody.innerHTML = `<tr><td colspan="5" style="color: #888; text-align: center;">Brak zapytań dla tego klucza</td></tr>`;
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function fetchData() {
    try {
        // 1. Status API
        const statusRes = await fetch(`${API_BASE}/api/status`);
        const statusIndicator = document.getElementById("status-indicator");
        const statusText = document.getElementById("status-text");
        const activeModelName = document.getElementById("active-model-name");

        if (statusRes.ok) {
            const statusData = await statusRes.json();
            statusIndicator.classList.add("online");
            statusText.textContent = t("js_online");
            activeModel = statusData.active_model;
            activeModelName.textContent = activeModel || t("models_none");
            
            if (statusData.local_ip) {
                currentIp = statusData.local_ip;
                updateConnectionCode();
            }
        } else {
            throw new Error("API błąd");
        }

        // 2. Modele
        const modelsRes = await fetch(`${API_BASE}/v1/models`);
        const modelsList = document.getElementById("models-list");

        if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            const modelsStr = JSON.stringify(modelsData);
            
            if (modelsStr !== lastModelsDataStr) {
                lastModelsDataStr = modelsStr;
                const models = modelsData.data || [];
                
                if (models.length > 0) {
                    modelsList.innerHTML = modelsData.data.map((m, index) => {
                        const isLoaded = m.id === activeModel;
                        return `
                            <div class="model-card animate-fade-in-up" style="animation-delay: ${index * 0.05}s; ${isLoaded ? 'border-color: var(--success); background: rgba(16, 185, 129, 0.05);' : ''}">
                                <h3><i class="ph ph-cube"></i> ${m.id}</h3>
                                ${isLoaded ? '<div style="color: var(--success); font-size: 0.85rem; font-weight: 500; margin-bottom: 1rem;"><i class="ph ph-check-circle"></i> Załadowany do VRAM</div>' : '<div style="color: #64748b; font-size: 0.85rem; margin-bottom: 1rem;"><i class="ph ph-hard-drive"></i> Dostępny na dysku</div>'}
                                <div class="api-id-label">API Model ID</div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                                    <div class="api-id-value" style="margin-top: 0;">${m.id}</div>
                                    <button onclick="copyToClipboard('${m.id}')" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 2px;" title=t('js_copy_id')><i class="ph ph-copy"></i></button>
                                </div>
                            </div>
                        `;
                    }).join('');

                    // Aktualizacja listy modeli w Playground
                    const pgSelect = document.getElementById("pg-model-select");
                    if (pgSelect) {
                        const currentVal = pgSelect.value;
                        pgSelect.innerHTML = '<option value="">Wybierz model...</option>' + 
                            modelsData.data.map(m => `<option value="${m.id}">${m.id}</option>`).join('');
                        if (currentVal && modelsData.data.some(m => m.id === currentVal)) {
                            pgSelect.value = currentVal;
                        }
                    }
                } else {
                    modelsList.innerHTML = `<div style="color: #888;">Brak modeli. Trwa pobieranie z HF w tle...</div>`;
                }
            }
        }

        // 3. Klucze API
        const keysRes = await fetch(`${API_BASE}/api/keys`);
        const keysList = document.getElementById("keys-list");
        const logKeysGrid = document.getElementById("log-keys-grid");
        
        if (keysRes.ok) {
            const keysData = await keysRes.json();
            
            const keysDataStr = JSON.stringify(keysData);
            if (keysDataStr !== lastKeysDataStr) {
                lastKeysDataStr = keysDataStr;
                
                // Wypełnianie siatki w sekcji Logów
                if (keysData.length > 0) {
                    playgroundApiKey = keysData[0].api_key;
                    document.getElementById("no-keys-msg").style.display = "none";
                    
                    // Sort by last_used descending
                    const sortedKeys = [...keysData].sort((a, b) => (b.last_used || 0) - (a.last_used || 0));
                    
                    if(logKeysGrid) {
                        logKeysGrid.innerHTML = sortedKeys.map((k, index) => {
                            const lastUsed = k.last_used ? new Date(k.last_used * 1000).toLocaleString('pl-PL') : 'Nigdy';
                            return `
                                <div class="key-card-selectable animate-fade-in-up" onclick="selectLogKey(${k.id}, '${k.name}')" style="background: var(--card-bg); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s ease; animation-delay: ${index * 0.05}s">
                                    <h3 style="margin-bottom: 0.5rem; color: #f8fafc;"><i class="ph ph-key"></i> ${k.name}</h3>
                                    <div style="color: #94a3b8; font-size: 0.85rem;">Tokeny: <span style="color: #3b82f6; font-weight: bold;">${k.total_tokens.toLocaleString()}</span></div>
                                    <div style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.25rem;"><i class="ph ph-clock"></i> Ostatnio: ${lastUsed}</div>
                                </div>
                            `;
                        }).join('');
                    }
                    
                    // Rysowanie tabeli kluczy tylko jeśli nie ma otwartego menu
                    const isDropdownOpen = document.querySelector('.dropdown-menu.show');
                    if (!isDropdownOpen) {
                        keysList.innerHTML = keysData.map((k, index) => {
                            const lastUsed = k.last_used ? new Date(k.last_used * 1000).toLocaleString('pl-PL') : 'Never';
                            const keyString = k.api_key.length > 15 
                                ? k.api_key.substring(0, 10) + "..." + k.api_key.substring(k.api_key.length - 3)
                                : k.api_key;
                            return `
                                <tr class="key-card animate-fade-in-up" data-id="${k.id}" style="animation-delay: ${index * 0.05}s">
                                    <td><div class="checkbox-custom"></div></td>
                                    <td>
                                        <div class="key-name-block">
                                            <strong>${k.name}</strong>
                                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                                                <span class="blurred-key" id="key-val-${k.id}" onclick="copyToClipboard('${k.api_key}')" title="Kliknij aby skopiować">${keyString}</span>
                                                <button onclick="copyToClipboard('${k.api_key}')" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 2px;"><i class="ph ph-copy"></i></button>
                                            </div>
                                        </div>
                                    </td>
                                    <td style="color: #94a3b8;">No guardrails</td>
                                    <td style="color: #94a3b8;">Never</td>
                                    <td style="color: #94a3b8;">${lastUsed}</td>
                                    <td>
                                        <div class="usage-btn" style="cursor: default;">
                                            ${k.total_tokens.toLocaleString()}
                                        </div>
                                    </td>
                                    <td>
                                        <div class="kebab-menu">
                                            <button class="kebab-button" onclick="toggleDropdown(${k.id}, event)"><i class="ph ph-dots-three-vertical"></i></button>
                                            <div class="dropdown-menu" id="dropdown-${k.id}">
                                                <a href="#" onclick="openRenameModal(${k.id}, '${k.name}'); event.preventDefault();"><i class="ph ph-pencil-simple"></i> Zmień nazwę</a>
                                                <a href="#" onclick="deleteKey(${k.id}); event.preventDefault();" style="color: #ef4444;"><i class="ph ph-trash"></i> Usuń klucz</a>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('');
                    }
                } else {
                    document.getElementById("no-keys-msg").style.display = "block";
                    keysList.innerHTML = "";
                    if(logKeysGrid) logKeysGrid.innerHTML = "";
                }
            }
        }

    } catch (err) {
        console.error(err);
        document.getElementById("status-indicator").classList.remove("online");
        document.getElementById("status-text").textContent = "Offline";
    }
}

// Obsługa Dropdownów
function toggleDropdown(e, id) {
    e.stopPropagation();
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if(menu.id !== `dropdown-${id}`) menu.classList.remove('show');
    });
    document.getElementById(`dropdown-${id}`).classList.toggle('show');
}

window.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
});

// Akcje Menu
// Zmienne do edycji klucza
let editingKeyId = null;

// Obsługa okienek modalnych
function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const notify = document.createElement('div');
        notify.textContent = "Skopiowano!";
        notify.style.cssText = "position:fixed;bottom:20px;right:20px;background:var(--success);color:white;padding:10px 20px;border-radius:4px;z-index:9999;";
        document.body.appendChild(notify);
        setTimeout(() => notify.remove(), 2000);
    });
}

function editKey(id, oldName, oldKey) {
    editingKeyId = id;
    document.getElementById('edit-key-input').value = oldName;
    document.getElementById('edit-key-value-input').value = oldKey;
    document.getElementById('edit-modal').classList.add('show');
}

async function saveEditKey() {
    const newName = document.getElementById('edit-key-input').value;
    const newKey = document.getElementById('edit-key-value-input').value;
    if (!newName || !newKey || !editingKeyId) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/keys/${editingKeyId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: newName, api_key: newKey})
        });
        if (res.ok) {
            closeModal('edit-modal');
            fetchData();
        }
    } catch (e) {
        console.error("Błąd edycji klucza");
    }
}

async function deleteKey(id) {
    if (!confirm("Czy na pewno chcesz usunąć ten klucz API? Wszystkie powiązane z nim logi również zostaną wykasowane!")) return;
    try {
        const res = await fetch(`${API_BASE}/api/keys/${id}`, { method: 'DELETE' });
        if (res.ok) {
            if (currentLogKeyId == id) backToLogsGrid();
            fetchData();
        }
    } catch (e) {
        console.error("Błąd usuwania klucza");
    }
}

function updateConnectionCode() {
    const codeBlock = document.getElementById("connection-code");
    const code = `from openai import OpenAI

# Połączenie do lokalnego routera
client = OpenAI(
  base_url="http://${currentIp}:8000/v1",
  api_key="TUTAJ_WKLEJ_SWOJ_KLUCZ_API"
)

completion = client.chat.completions.create(
  model="NAZWA_MODELU_Z_ZAKLADKI_MODELE",
  messages=[
    {"role": "user", "content": "Witaj, powiedz mi coś ciekawego."}
  ]
)

print(completion.choices[0].message.content)`;
    
    if (codeBlock.textContent !== code) {
        codeBlock.textContent = code;
    }
}

function copyCode() {
    const code = document.getElementById("connection-code").textContent;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn');
        const oldText = btn.textContent;
        btn.textContent = "Skopiowano!";
        setTimeout(() => btn.textContent = oldText, 2000);
    });
}

let currentLogKeyId = null;

function selectLogKey(id, name) {
    currentLogKeyId = id;
    document.getElementById('log-keys-grid').style.display = 'none';
    document.getElementById('key-details').style.display = 'block';
    document.getElementById('key-details-title').textContent = `Statystyki klucza: ${name}`;
    fetchKeyDetails();
}

function backToLogsGrid() {
    currentLogKeyId = null;
    document.getElementById('log-keys-grid').style.display = 'grid';
    document.getElementById('key-details').style.display = 'none';
}

async function fetchKeyDetails() {
    if (!currentLogKeyId) return;
    const selectedKeyId = currentLogKeyId;
    
    try {
        const logsRes = await fetch(`${API_BASE}/api/logs/${selectedKeyId}`);
        const logsTbody = document.getElementById("logs-tbody");

        if (logsRes.ok) {
            const logsData = await logsRes.json();
            
            updateChart(logsData);
            
            if (logsData.length > 0) {
                const reversedLogs = [...logsData].reverse();
                logsTbody.innerHTML = reversedLogs.map(log => {
                    const date = new Date(log.timestamp * 1000);
                    const timeStr = date.toLocaleTimeString('pl-PL');
                    return `
                        <tr>
                            <td>${timeStr}</td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span style="color: var(--accent); font-family: monospace;">${log.model}</span>
                                    <button onclick="copyToClipboard('${log.model}')" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 2px;" title=t('js_copy_id')>📋</button>
                                </div>
                            </td>
                            <td>${log.elapsed_seconds}</td>
                            <td>${log.total_tokens}</td>
                            <td style="color: var(--success);">
                                <strong>${log.tokens_per_second}</strong>
                                <span style="color: #64748b; font-size: 0.85rem; margin-left: 0.5rem;">
                                    (Min: ${log.min_tps !== undefined && log.min_tps !== 0 ? log.min_tps : log.tokens_per_second} / Max: ${log.max_tps !== undefined && log.max_tps !== 0 ? log.max_tps : log.tokens_per_second})
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                logsTbody.innerHTML = `<tr><td colspan="5" style="color: #888; text-align: center;">Brak zapytań dla tego klucza</td></tr>`;
            }
        }
    } catch (e) {
        console.error(e);
    }
}

// Inicjalizacja
initChart();
fetchData();
setInterval(fetchData, 2000);

// --- PLAYGROUND LOGIC ---
let chatHistory = [];
let playgroundApiKey = null;

async function sendPlaygroundMessage() {
    const inputEl = document.getElementById("pg-message-input");
    const selectEl = document.getElementById("pg-model-select");
    const chatWindow = document.getElementById("chat-window");
    
    const text = inputEl.value.trim();
    const model = selectEl.value;
    
    if(!text) return;
    if(!model) {
        alert(t('js_err_no_model'));
        return;
    }
    if(!playgroundApiKey) {
        alert(t('js_err_no_key'));
        return;
    }
    
    // Dodanie wiadomości użytkownika
    chatHistory.push({ role: "user", content: text });
    inputEl.value = "";
    
    const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    const userMsgHTML = `<div class="chat-message user animate-fade-in-up"><div class="bubble">${safeText}</div></div>`;
    chatWindow.insertAdjacentHTML('beforeend', userMsgHTML);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    // Placeholder dla asystenta
    const assistantId = "msg-" + Date.now();
    const assistantMsgHTML = `<div class="chat-message assistant animate-fade-in-up" id="${assistantId}"><div class="bubble"><span class="cursor-blink"></span></div></div>`;
    chatWindow.insertAdjacentHTML('beforeend', assistantMsgHTML);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    const bubbleEl = document.querySelector(`#${assistantId} .bubble`);
    
    try {
        const response = await fetch(`${API_BASE}/v1/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${playgroundApiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: chatHistory,
                stream: true
            })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            bubbleEl.innerHTML = `<span style="color: #ef4444;">Błąd: ${errData.detail || response.statusText}</span>`;
            chatHistory.pop();
            return;
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullContent = "";
        let tokenCount = 0;
        const startTime = performance.now();
        let promptTime = null;
        
        bubbleEl.innerHTML = "";
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, {stream: true});
            const lines = chunk.split("\n");
            for(let line of lines) {
                if(line.startsWith("data: ")) {
                    const dataStr = line.replace("data: ", "").trim();
                    if(dataStr === "[DONE]") continue;
                    try {
                        const data = JSON.parse(dataStr);
                        if(data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                            if (promptTime === null) promptTime = performance.now();
                            tokenCount++;
                            fullContent += data.choices[0].delta.content;
                            const safeContent = fullContent.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
                            bubbleEl.innerHTML = safeContent + `<span class="cursor-blink"></span>`;
                            chatWindow.scrollTop = chatWindow.scrollHeight;
                        }
                    } catch(e) {}
                }
            }
        }
        
        const endTime = performance.now();
        const elapsedSec = ((endTime - startTime) / 1000).toFixed(2);
        // Zamiast samego czasu dekodowania, liczymy łączny czas (tzw. overall tps), co lepiej oddaje odczucia użytkownika
        const tps = elapsedSec > 0 ? (tokenCount / elapsedSec).toFixed(1) : "0.0";
        
        const finalSafeContent = fullContent.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
        bubbleEl.innerHTML = finalSafeContent;
        
        const statsHTML = `<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.5rem; display: flex; gap: 1rem; align-items: center;">
            <span><i class="ph ph-clock"></i> ${elapsedSec}s</span>
            <span><i class="ph ph-lightning"></i> ${tps} t/s</span>
            <span><i class="ph ph-text-aa"></i> ${tokenCount} tokenów</span>
        </div>`;
        bubbleEl.parentElement.insertAdjacentHTML('beforeend', statsHTML);
        
        chatHistory.push({ role: "assistant", content: fullContent });
        chatWindow.scrollTop = chatWindow.scrollHeight;
        
    } catch (err) {
        bubbleEl.innerHTML = `<span style="color: #ef4444;">Błąd połączenia: ${err.message}</span>`;
        chatHistory.pop();
    }
}

const pgInput = document.getElementById("pg-message-input");
if (pgInput) {
    pgInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendPlaygroundMessage();
        }
    });
}

// Dodatkowe zabezpieczenie: pobranie modeli po kliknięciu/rozwinięciu listy w Playground
const pgSelectEl = document.getElementById("pg-model-select");
if (pgSelectEl) {
    pgSelectEl.addEventListener("focus", async function() {
        if (this.options.length <= 1) {
            try {
                const res = await fetch(`${API_BASE}/v1/models`);
                if (res.ok) {
                    const data = await res.json();
                    const currentVal = this.value;
                    this.innerHTML = '<option value="">Wybierz model...</option>' + 
                        data.data.map(m => `<option value="${m.id}">${m.id}</option>`).join('');
                    if (currentVal && data.data.some(m => m.id === currentVal)) {
                        this.value = currentVal;
                    }
                }
            } catch(e) {
                console.error("Błąd podczas pobierania modeli:", e);
            }
        }
    });
}
