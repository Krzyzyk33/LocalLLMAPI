/* ==========================================================================
   LocalLLMAPI — panel
   Same-origin API (bez CORS, działa też z LAN), brak innerHTML na danych
   użytkownika, polling adaptacyjny.
   ========================================================================== */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const PORT = 1000;

/* i18n.js wystawia window.t. Rozwiązujemy leniwie, więc kolejność
   wczytywania skryptów nie ma znaczenia. */
const t = (key, vars) => (window.t ? window.t(key, vars) : key);

/** Buduje DOM zamiast sklejać HTML — dane użytkownika nigdy nie są parsowane.
 *  Celowo brak trybu `html:` — dostęp do innerHTML zostaje tylko dla ikon. */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c && c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

const icon = (name) => el('i', { class: `ti ti-${name}` });
const $s = (id) => document.getElementById(id);

/* ---------- formatowanie ---------- */
const nf = new Intl.NumberFormat('en-US');
const num = (n) => nf.format(Math.round(Number(n) || 0));
const dec = (n, d = 1) => (Number(n) || 0).toFixed(d);

function ago(ts) {
  if (!ts) return t('time_never');
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 45) return t('time_now');
  if (s < 3600) return `${Math.floor(s / 60)}m ${t('time_ago')}`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${t('time_ago')}`;
  return `${Math.floor(s / 86400)}d ${t('time_ago')}`;
}

function uptime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}

const fmtDT = (ts) => (ts ? new Date(ts * 1000).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
}) : '—');

const fmtTime = (ts) => (ts ? new Date(ts * 1000).toLocaleTimeString('en-GB') : '—');

const maskKey = (k) => (!k ? '—' : k.length > 15 ? `${k.slice(0, 10)}…${k.slice(-3)}` : k);

/* ---------- fetch ---------- */
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    ...options,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { detail = (await res.json()).detail || detail; } catch { /* pusta body */ }
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

/* Schowek: najpierw Clipboard API, potem execCommand.
   Nie gate'ujemy tego przez isSecureContext — panel bywa otwarty z LAN po
   http://, gdzie API nie istnieje i użytkownik dostawałby tylko błąd. */
async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fallback */ }
  }
  try {
    const ta = el('textarea', { style: 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0' });
    ta.value = text;
    ta.setAttribute('readonly', '');
    document.body.append(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

const copyAndToast = async (text, btn) => {
  const ok = await copyText(text);
  toast(ok ? t('js_copied') : t('js_copy_fail'), ok ? 'ok' : 'err');
  if (ok && btn) {
    // Krotkie potwierdzenie w miejscu — czytelniejsze niz toast.
    btn.classList.add('is-copied');
    setTimeout(() => btn.classList.remove('is-copied'), 1100);
  }
  return ok;
};

/* ---------- animacje wartosci ---------- */
const lastValues = new WeakMap();
/** Podswietla kafelek tylko wtedy, gdy liczba faktycznie sie zmienila. */
function setValue(node, text) {
  if (!node || node.textContent === text) return;
  node.textContent = text;
  if (lastValues.get(node) === text) return;
  lastValues.set(node, text);
  const tile = node.closest('.stat');
  if (!tile) return;
  tile.classList.remove('is-updated');
  void tile.offsetWidth;        // wymuszenie reflow, by animacja sie powtorzyla
  tile.classList.add('is-updated');
}

/* Kaskadowe wejscie blokow na panelu (przy zmianie zakladki). */
function stagger(panel) {
  panel.classList.remove('stagger');
  void panel.offsetWidth;
  panel.classList.add('stagger');
}

/* ---------- toasty ---------- */
const TOAST_ICON = { ok: 'circle-check', err: 'alert-circle', info: 'info-circle' };
function toast(message, kind = 'ok', ms = 2800) {
  const host = $s('toasts');
  const node = el('div', { class: `toast ${kind}` },
    icon(TOAST_ICON[kind] || 'info-circle'), el('span', { text: message }));
  host.append(node);
  let done = false;
  const kill = () => {
    if (done) return;
    done = true;
    node.classList.add('is-out');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  };
  const timer = setTimeout(kill, ms);
  node.addEventListener('click', () => { clearTimeout(timer); kill(); });
  while (host.children.length > 3) host.firstElementChild.remove();
}

/* ==========================================================================
   Nawigacja
   ========================================================================== */
let currentTab = 'home';

function showTab(name, push = true) {
  const panel = $(`#${name}`);
  if (!panel) return;
  currentTab = name;

  $$('.nav-item').forEach((n) => {
    const on = n.dataset.tab === name;
    n.classList.toggle('is-active', on);
    if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
  });
  $$('.panel').forEach((p) => p.classList.toggle('is-active', p === panel));

  const label = $(`.nav-item[data-tab="${name}"] span`);
  $s('page-title').textContent = label ? label.textContent : '';
  $s('page-sub').textContent = t(`sub_${name}`) || '';

  $s('scroll').scrollTop = 0;
  stagger(panel);
  if (push && location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);

  if (name === 'settings') { loadSlots(); loadLoadedModels(); }
  if (name === 'docs') renderDocs();
  if (name === 'home') loadStats();
  refresh(true);
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('.nav-item');
  if (nav) { e.preventDefault(); showTab(nav.dataset.tab); return; }
  const goto = e.target.closest('[data-goto]');
  if (goto) showTab(goto.dataset.goto);
});

/* ---------- zwijanie paska ----------
   Jedna mechanika, dwa stany: rozwiniety (232px) i zwiniety do ikon (52px).
   Bez drawera i bez slajdu — pasek jest zawsze na miejscu, a przelacza go
   klik w logo. Dzieki temu logo musi zawsze byc dostepne. */
const NAV_KEY = 'llmapi.rail';

const resizeChart = () => requestAnimationFrame(() => usageChart?.resize?.());

function applyRail(collapsed, persist = true) {
  if (collapsed === undefined) {
    collapsed = $('.app').classList.contains('is-rail');
    persist = false;
  }
  $('.app').classList.toggle('is-rail', collapsed);
  const btn = $('#nav-toggle');
  btn.setAttribute('aria-expanded', String(!collapsed));
  // Klucz tooltipu zalezy od stanu, wiec trzymamy go w data-i18n-tip —
  // wtedy zmiana jezyka w translateUI() nadal da poprawny tekst.
  const key = collapsed ? 'nav_expand' : 'nav_collapse';
  btn.dataset.i18nTip = key;
  btn.dataset.tip = t(key);
  btn.setAttribute('aria-label', t(key));
  if (persist) {
    try { localStorage.setItem(NAV_KEY, collapsed ? '1' : '0'); } catch { /* prywatny tryb */ }
  }
  resizeChart();
}

function toggleNav() {
  applyRail(!$('.app').classList.contains('is-rail'));
}

$('#nav-toggle').addEventListener('click', toggleNav);

/* Wykres musi dostac resize() po zmianie szerokosci, inaczej zostalby
   rozciagniety na stara szerokosc canvasu. */
window.addEventListener('resize', resizeChart);

/* ---------- motyw ---------- */
const THEME_KEY = 'llmapi.theme';
function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  const dark = mode === 'dark';
  $s('theme-icon').className = `ti ti-${dark ? 'sun' : 'moon'}`;
  const label = dark ? 'Light' : 'Dark';
  $s('theme-label').textContent = label;
  $s('theme-toggle').dataset.tip = label;   // tooltip pokazuje akcje, nie stan
  localStorage.setItem(THEME_KEY, mode);
  if (usageChart) applyChartTheme();
}
$('#theme-toggle').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

/* ---------- modale ---------- */
let lastFocus = null;
function openModal(id) {
  lastFocus = document.activeElement;
  $(`#${id}`).hidden = false;
  document.body.style.overflow = 'hidden';
  const focusable = $(`#${id} input, #${id} select, #${id} button`);
  (focusable || $(`#${id}`)).focus?.();
}
function closeModal(id) {
  $(`#${id}`).hidden = true;
  if (!$$('.modal:not([hidden])').length) document.body.style.overflow = '';
  lastFocus?.focus?.();
}
$$('.modal').forEach((m) => {
  m.addEventListener('mousedown', (e) => { if (e.target === m) closeModal(m.id); });
});
$('#modal-x').addEventListener('click', () => closeModal('edit-modal'));
$('#modal-cancel').addEventListener('click', () => closeModal('edit-modal'));
$('#modal-save').addEventListener('click', saveEditKey);

document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd+B — zwijanie paska, jak w VS Code i Linear
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    toggleNav();
    return;
  }
  if (e.key === 'Escape') {
    const open = $$('.modal:not([hidden])').pop();
    if (open) closeModal(open.id);
    return;
  }
  if (e.key !== 'Tab') return;
  const m = $$('.modal:not([hidden])').pop();
  if (!m) return;
  const f = $$('button, input, select, textarea, [tabindex]:not([tabindex="-1"])', m)
    .filter((n) => !n.disabled && n.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

let confirmAction = null;
function askConfirm(message, action) {
  $s('confirm-text').textContent = message;
  confirmAction = action;
  openModal('confirm-modal');
}
$('#confirm-no').addEventListener('click', () => { closeModal('confirm-modal'); confirmAction = null; });
$('#confirm-yes').addEventListener('click', async () => {
  const fn = confirmAction;
  confirmAction = null;
  closeModal('confirm-modal');
  if (fn) await fn();
});

/* ==========================================================================
   HOME
   ========================================================================== */
function renderSlots(total, loaded) {
  const track = $s('slot-track');
  const rows = loaded.map((m) => {
    const busy = m.refcount > 0;
    return el('div', { class: `slot${busy ? ' is-busy' : ''}` },
      el('div', { class: 'slot-idx', text: String(m.slot) }),
      el('div', { class: 'slot-bar' },
        el('div', { class: 'slot-top' },
          el('span', { class: 'slot-dev', text: m.engine }),
          el('span', { class: 'slot-name', text: m.name, title: m.name })),
        el('div', { class: 'slot-fill' }, el('span', { style: `width:${busy ? 100 : 18}%` }))),
      el('div', { class: 'slot-badge' },
        icon(busy ? 'loader-2' : 'circle-check'),
        busy ? t('slot_busy') : t('slot_loaded')),
    );
  });

  for (let i = loaded.length; i < total; i++) {
    rows.push(el('div', { class: 'slot' },
      el('div', { class: 'slot-idx', text: '—' }),
      el('div', { class: 'slot-bar' },
        el('div', { class: 'slot-top' },
          el('span', { class: 'slot-dev', text: t('slot_free') }),
          el('span', { class: 'slot-name', text: t('slot_waiting') }))),
      el('div', { class: 'slot-badge' }, icon('circle'), t('slot_idle')),
    ));
  }
  track.replaceChildren(...rows);
  $s('slots-chip').textContent = `${loaded.length}/${total} ${t('stat_slots')}`;
}

function renderRecent(rows) {
  const tb = $s('recent-tbody');
  if (!rows.length) {
    tb.replaceChildren(el('tr', {}, el('td', { colspan: 6 },
      el('div', { class: 'empty' },
        icon('inbox'),
        el('p', { text: t('home_no_requests') })))));
    return;
  }
  tb.replaceChildren(...rows.map((r) => el('tr', {},
    el('td', { class: 'dim' }, `${ago(r.timestamp)} · ${fmtTime(r.timestamp)}`),
    el('td', {}, el('span', { class: 'ellip mono', title: r.model, text: r.model })),
    el('td', { class: 'dim' }, el('span', { class: 'ellip', text: r.key_name || '—' })),
    el('td', { class: 'num' }, el('strong', { text: num(r.total_tokens) })),
    el('td', { class: 'num dim' }, dec(r.elapsed_seconds, 2)),
    el('td', { class: 'num good' }, dec(r.tokens_per_second, 1)),
  )));
}

/* Skeleton na pierwszym zaladowaniu danych — nie miga przy pollingu.
   Nakladamy go warstwa NAD siatka: karty w HTML maja id, a loadStats()
   tylko aktualizuje ich textContent, wiec nie mozemy ich podmienic. */
let statsLoaded = false;
function showSkeleton() {
  if (statsLoaded) return;
  const layer = $s('stat-skeleton');
  if (layer.childElementCount) return;
  layer.replaceChildren(...Array.from({ length: 6 }, () => el('article', { class: 'stat' },
    el('div', { class: 'skel skel-line', style: 'width:45%' }),
    el('div', { class: 'skel skel-val' }),
    el('div', { class: 'skel skel-line', style: 'width:65%;margin-bottom:0' }))));
  layer.hidden = false;
}

function hideSkeleton() {
  $s('stat-skeleton').hidden = true;
}

async function loadStats() {
  try {
    const raw = await api('/api/stats');
    if (!raw || typeof raw !== 'object') return;
    // Niepełna odpowiedz nie może wywrócić strony głównej — brakujące
    // pola dostają wartości domyślne zamiast rzucać wyjątkiem w UI.
    const d = {
      loaded_models: [], recent: [], last: null,
      total_tokens: 0, total_requests: 0, avg_tps: 0, best_tps: 0,
      models_on_disk: 0, slots_total: 3, uptime: 0, port: PORT,
      local_ip: '127.0.0.1', requests_1h: 0, tokens_1h: 0,
      ...raw,
    };
    if (!Array.isArray(d.loaded_models)) d.loaded_models = [];
    if (!Array.isArray(d.recent)) d.recent = [];
    const last = d.last;

    const lm = $s('s-last-model');
    if (last?.model) { lm.textContent = last.model; lm.title = last.model; }
    else { lm.textContent = t('models_none'); lm.title = ''; }
    $s('s-last-model-sub').textContent = last
      ? `${ago(last.timestamp)} · ${dec(last.tokens_per_second, 1)} t/s`
      : t('home_never_used');

    setValue($s('s-tokens'), num(d.total_tokens));
    $s('s-tokens-sub').textContent = d.requests_1h
      ? `+${num(d.tokens_1h)} ${t('last_hour')}` : t('stat_no_recent');

    setValue($s('s-requests'), num(d.total_requests));
    $s('s-requests-sub').textContent = d.requests_1h
      ? `+${num(d.requests_1h)} ${t('last_hour')}` : t('stat_no_recent');

    setValue($s('s-tps-n'), dec(d.avg_tps, 1));
    $s('s-tps-sub').textContent = `${t('stat_best')} ${dec(d.best_tps, 1)} t/s`;

    setValue($s('s-models'), num(d.models_on_disk));
    $s('s-models-sub').textContent = `${d.loaded_models.length} ${t('stat_in_memory')}`;

    $s('s-uptime').textContent = uptime(d.uptime);
    $s('s-uptime-sub').textContent = `port ${d.port} · ${d.local_ip}`;

    statsLoaded = true;
    hideSkeleton();
    renderSlots(d.slots_total, d.loaded_models);
    renderRecent(d.recent || []);

    $s('home-loaded').replaceChildren(...(d.loaded_models.length
      ? d.loaded_models.map((m) => el('div', { class: 'mchip' },
          icon('cpu-2'),
          el('span', { text: m.name }),
          el('em', { text: `slot ${m.slot} · ${m.engine}` })))
      : [el('div', { class: 'mchip' }, icon('info-circle'), el('em', { text: t('home_none_loaded') }))]));
  } catch (e) { console.error('stats', e); }
}

/* ==========================================================================
   MODELS
   ========================================================================== */
function renderModels(models, loadedNames) {
  const host = $s('models-list');
  if (!models.length) {
    host.replaceChildren(el('div', { class: 'empty', style: 'grid-column:1/-1' },
      icon('cloud-download'), el('p', { text: t('js_no_models') })));
    return;
  }
  host.replaceChildren(...models.map((m) => {
    const isLoaded = loadedNames.includes(m.id);
    return el('article', { class: `model-card${isLoaded ? ' is-loaded' : ''}` },
      el('div', { class: 'mc-top' }, el('div', { class: 'mc-name', text: m.id })),
      el('div', { class: `mc-status ${isLoaded ? 'ok' : 'idle'}` },
        icon(isLoaded ? 'circle-check' : 'database'),
        el('span', { text: isLoaded ? t('js_loaded_vram') : t('js_avail_disk') })),
      el('div', { class: 'mc-id' },
        el('span', { text: m.id, title: m.id }),
        el('button', {
          class: 'icon-btn', 'aria-label': t('js_copy_id'),
          onclick: (e) => copyAndToast(m.id, e.currentTarget),
        }, icon('copy'))),
    );
  }));
}

/* ==========================================================================
   KEYS
   ========================================================================== */
let keysCache = [];

const engineBadge = (engine) =>
  el('span', { class: `engine-badge ${engine}`, text: (engine || 'vulkan').toUpperCase() });

function renderKeys(keys) {
  keysCache = keys;
  $s('keys-empty').hidden = keys.length > 0;
  $s('keys-count-chip').textContent = String(keys.length);
  $s('nav-keys-count').textContent = String(keys.length);
  $s('log-keys-card').hidden = keys.length === 0;

  if (!keys.length) {
    $s('keys-list').replaceChildren();
    renderLogKeyGrid([]);
    return;
  }

  $s('keys-list').replaceChildren(...keys.map((k) => el('tr', {},
    el('td', {},
      el('div', { class: 'key-name' },
        el('strong', { text: k.name }),
        el('button', {
          class: 'key-val', 'aria-label': t('js_copy_key'), title: t('js_copy_key'),
          onclick: (e) => copyAndToast(k.api_key, e.currentTarget),
        }, el('span', { text: maskKey(k.api_key) })))),
    el('td', {}, engineBadge(k.engine)),
    el('td', { class: 'dim', title: fmtDT(k.last_used) }, k.last_used ? ago(k.last_used) : t('js_never')),
    el('td', { class: 'num' }, el('strong', { text: num(k.total_tokens) })),
    el('td', {},
      el('div', { class: 'row-acts' },
        el('button', { class: 'icon-btn', 'aria-label': t('js_edit'), onclick: () => openEdit(k) }, icon('pencil')),
        el('button', {
          class: 'icon-btn danger', 'aria-label': t('js_delete'),
          onclick: () => askConfirm(t('confirm_delete_key').replace('{name}', k.name), () => deleteKey(k.id)),
        }, icon('trash')))),
  )));
  renderLogKeyGrid(keys);
}

function randomKey() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return 'sk-' + Array.from(buf, (b) => alphabet[b % alphabet.length]).join('');
}

$('#gen-key').addEventListener('click', () => {
  $s('new-key-value').value = randomKey();
  $s('new-key-value').focus();
});

$('#create-key-btn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const name = $s('new-key-name').value.trim();
  const value = $s('new-key-value').value.trim();
  const engine = $s('new-key-engine').value;
  const msg = $s('key-error');

  if (!name || !value) {
    msg.className = 'form-msg is-err';
    msg.textContent = t('js_err_fields');
    (name ? $s('new-key-value') : $s('new-key-name')).classList.add('shake');
    setTimeout(() => $$('.shake').forEach((n) => n.classList.remove('shake')), 500);
    return;
  }
  btn.classList.add('is-spinning');
  btn.disabled = true;
  try {
    await api('/api/keys', { method: 'POST', body: JSON.stringify({ name, api_key: value, engine }) });
    $s('new-key-name').value = '';
    $s('new-key-value').value = '';
    msg.className = 'form-msg';
    msg.textContent = '';
    toast(t('js_created'), 'ok');
    keysCache = [];
    await refresh(true);
  } catch (err) {
    msg.className = 'form-msg is-err';
    msg.textContent = err.message;
  } finally {
    btn.classList.remove('is-spinning');
    btn.disabled = false;
  }
});

let editingId = null;
function openEdit(k) {
  editingId = k.id;
  $s('edit-key-input').value = k.name;
  $s('edit-key-value-input').value = k.api_key;
  $s('edit-key-engine-input').value = k.engine || 'vulkan';
  openModal('edit-modal');
}
$('#edit-gen-key').addEventListener('click', () => { $s('edit-key-value-input').value = randomKey(); });

async function saveEditKey() {
  if (!editingId) return;
  const name = $s('edit-key-input').value.trim();
  const value = $s('edit-key-value-input').value.trim();
  const engine = $s('edit-key-engine-input').value;
  if (!name || !value) { toast(t('js_err_fields'), 'err'); return; }
  try {
    await api(`/api/keys/${editingId}`, { method: 'PUT', body: JSON.stringify({ name, api_key: value, engine }) });
    closeModal('edit-modal');
    toast(t('js_changes_saved'), 'ok');
    keysCache = [];
    await refresh(true);
  } catch (err) { toast(err.message, 'err'); }
}

async function deleteKey(id) {
  try {
    await api(`/api/keys/${id}`, { method: 'DELETE' });
    if (currentLogKey === id) backToKeyGrid();
    keysCache = [];
    toast(t('js_key_deleted'), 'ok');
    await refresh(true);
  } catch (err) { toast(err.message, 'err'); }
}

/* ==========================================================================
   LOGS
   ========================================================================== */
let currentLogKey = null;
let logRows = [];
let usageChart = null;

function renderLogKeyGrid(keys) {
  $s('no-keys-msg').hidden = keys.length > 0;
  if (!keys.length) { $s('log-keys-grid').replaceChildren(); return; }

  const sorted = [...keys].sort((a, b) => (b.last_used || 0) - (a.last_used || 0));
  $s('log-keys-grid').replaceChildren(...sorted.map((k) => el('button', { class: 'kcard', onclick: () => selectLogKey(k) },
    el('div', { class: 'kcard-head' }, icon('key'), el('strong', { text: k.name })),
    el('div', { class: 'kcard-row' }, el('span', { text: t('stat_tokens') }), el('b', { text: num(k.total_tokens) })),
    el('div', { class: 'kcard-row' }, el('span', { text: t('th_last_used') }),
      el('b', { text: k.last_used ? ago(k.last_used) : t('js_never') })),
  )));
}

async function selectLogKey(k) {
  currentLogKey = k.id;
  $s('log-keys-view').hidden = true;
  $s('key-details').hidden = false;
  $s('key-details-title').replaceChildren(el('span', { text: k.name }));
  $s('logs-back').focus();
  await loadLogs();
}

function backToKeyGrid() {
  currentLogKey = null;
  $s('key-details').hidden = true;
  $s('log-keys-view').hidden = false;
}

$('#logs-back').addEventListener('click', backToKeyGrid);

function applyChartTheme() {
  if (!usageChart) return;
  const cs = getComputedStyle(document.documentElement);
  const pick = (v) => cs.getPropertyValue(v).trim();

  // Defensywnie: przyciski motywu muszą dzialac nawet jesli wykres
  // nie ma jeszcze skali (albo inna wersja Chart.js nie da ticks/grid).
  const opt = usageChart.options || {};
  const scales = opt.scales || (opt.scales = {});
  for (const axis of ['x', 'y']) {
    const s = scales[axis] || (scales[axis] = {});
    (s.ticks || (s.ticks = {})).color = pick('--text-3');
    if (axis === 'y') (s.grid || (s.grid = {})).color = 'rgba(127,127,140,.14)';
  }
  const tip = (opt.plugins && opt.plugins.tooltip) || ((opt.plugins ||= {}).tooltip ||= {});
  tip.backgroundColor = pick('--bg-nav');
  tip.borderColor = pick('--border-2');
  tip.titleColor = pick('--text');
  tip.bodyColor = pick('--text-2');
  usageChart.update('none');
}

function ensureChart() {
  if (usageChart) return usageChart;
  const cs = getComputedStyle(document.documentElement);
  usageChart = new Chart($s('usageChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`),
      datasets: [{
        label: t('th_tokens'),
        data: Array(24).fill(0),
        backgroundColor: cs.getPropertyValue('--accent').trim(),
        borderRadius: 2,
        maxBarThickness: 22,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: cs.getPropertyValue('--bg-nav'),
          borderColor: cs.getPropertyValue('--border-2'),
          borderWidth: 1,
          titleColor: cs.getPropertyValue('--text'),
          bodyColor: cs.getPropertyValue('--text-2'),
          padding: 9,
          cornerRadius: 6,
          displayColors: false,
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: cs.getPropertyValue('--text-3'), font: { size: 10 }, maxRotation: 0, autoSkipPadding: 12 } },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(127,127,140,.14)' },
          ticks: { color: cs.getPropertyValue('--text-3'), font: { size: 10 }, precision: 0 },
        },
      },
    },
  });
  return usageChart;
}

function renderLogs() {
  const filter = $s('log-search').value.trim().toLowerCase();
  const rows = filter ? logRows.filter((r) => (r.model || '').toLowerCase().includes(filter)) : logRows;

  $s('logs-empty').hidden = rows.length > 0;
  $s('logs-table-wrap').hidden = rows.length === 0;
  if (!rows.length) { $s('logs-tbody').replaceChildren(); return; }

  $s('logs-tbody').replaceChildren(...[...rows].reverse().map((r) => el('tr', {},
    el('td', { class: 'dim' }, fmtDT(r.timestamp)),
    el('td', {},
      el('div', { class: 'cell-flex' },
        el('span', { class: 'ellip mono', title: r.model, text: r.model }),
        el('button', {
          class: 'icon-btn', style: 'width:22px;height:22px;font-size:13px',
          'aria-label': t('js_copy_id'),
          onclick: (e) => copyAndToast(r.model, e.currentTarget),
        }, icon('copy')))),
    el('td', { class: 'num dim' }, dec(r.elapsed_seconds, 2)),
    el('td', { class: 'num dim' }, dec(r.ttft, 3)),
    el('td', { class: 'num' }, el('strong', { text: num(r.total_tokens) })),
    el('td', { class: 'num' },
      el('strong', { class: 'good', text: dec(r.tokens_per_second, 1) }),
      el('span', { class: 'dim', text: ` (${dec(r.min_tps, 1)} / ${dec(r.max_tps, 1)})` })),
  )));
}

async function loadLogs() {
  if (!currentLogKey) return;
  try {
    logRows = await api(`/api/logs/${currentLogKey}`);
    const tokens = logRows.reduce((a, r) => a + (r.total_tokens || 0), 0);
    const tps = logRows.map((r) => r.tokens_per_second || 0);
    const avg = tps.length ? tps.reduce((x, y) => x + y, 0) / tps.length : 0;

    setValue($s('lg-tokens'), num(tokens));
    setValue($s('lg-requests'), num(logRows.length));
    setValue($s('lg-avg'), dec(avg, 1));
    setValue($s('lg-best'), dec(tps.length ? Math.max(...tps) : 0, 1));

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const hourly = Array(24).fill(0);
    for (const r of logRows) {
      const d = new Date(r.timestamp * 1000);
      if (d >= today) hourly[d.getHours()] += r.total_tokens || 0;
    }
    const chart = ensureChart();
    chart.data.datasets[0].data = hourly;
    chart.update();
    renderLogs();
  } catch (e) { console.error('logs', e); }
}

$('#log-search').addEventListener('input', renderLogs);

/* ==========================================================================
   CONNECT
   ========================================================================== */
let serverIp = '127.0.0.1';
let codeLang = 'python';

const CODE = {
  python: (ip, key) => [
    ['c-com', '# pip install openai'],
    ['c', 'from openai import OpenAI'],
    ['', ''],
    ['c-key', `client = OpenAI(base_url="http://${ip}:${PORT}/v1", api_key="${key}")`],
    ['', ''],
    ['c-com', '# model name must match the "Models" tab exactly'],
    ['fn', 'stream = client.chat.completions.create('],
    ['c-key', '    model="MODEL_NAME",'],
    ['c-key', '    messages=[{"role": "user", "content": "Hello!"}],'],
    ['', '    stream=True,'],
    ['', ')'],
    ['', ''],
    ['c-com', '# stream the response'],
    ['fn', 'for chunk in stream:'],
    ['c-key', '    print(chunk.choices[0].delta.content or "", end="", flush=True)'],
  ],
  curl: (ip, key) => [
    ['c-com', '# streaming'],
    ['c-key', `curl -N http://${ip}:${PORT}/v1/chat/completions \\`],
    ['c-key', '  -H "Content-Type: application/json" \\'],
    ['c-key', `  -H "Authorization: Bearer ${key}" \\`],
    ['c-key', '  -d \'{'],
    ['c-key', '    "model": "MODEL_NAME",'],
    ['c-key', '    "messages": [{"role": "user", "content": "Hello!"}],'],
    ['c-key', '    "stream": true'],
    ['', "  }'"],
  ],
  js: (ip, key) => [
    ['c-com', '// npm install openai'],
    ['c', 'import OpenAI from "openai";'],
    ['', ''],
    ['c-key', `const client = new OpenAI({ baseURL: "http://${ip}:${PORT}/v1", apiKey: "${key}" });`],
    ['', ''],
    ['fn', 'const stream = await client.chat.completions.create({'],
    ['c-key', '  model: "MODEL_NAME",'],
    ['c-key', '  messages: [{ role: "user", content: "Hello!" }],'],
    ['', '  stream: true,'],
    ['', '});'],
    ['', ''],
    ['fn', 'for await (const chunk of stream) {'],
    ['c-key', '  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");'],
    ['', '}'],
  ],
};

const CODE_META = {
  python: ['example.py', { com: 'c-com', key: 'c-key', fn: 'fn' }],
  curl:   ['request.sh',  { com: 'c-com', key: 'c-key', fn: 'fn' }],
  js:     ['example.mjs', { com: 'c-com', key: 'c-key', fn: 'fn' }],
};

function renderCode() {
  const key = keysCache[0]?.api_key || 'sk-YOUR_API_KEY';
  const [file, cls] = CODE_META[codeLang];
  const sig = `${codeLang}|${serverIp}|${key}`;
  if (renderCode._sig === sig) return;     // nie przebudowuj bez zmian
  renderCode._sig = sig;

  const lines = CODE[codeLang](serverIp, key).map(([type, text]) => {
    const span = el('span', { class: type === 'c' ? '' : (cls[type] || ''), text });
    span.style.whiteSpace = 'pre';
    return span;
  });

  $s('code-file').textContent = file;
  const pre = $s('connection-code');
  pre.replaceChildren();
  lines.forEach((span, i) => {
    pre.append(span);
    if (i < lines.length - 1) pre.append(document.createTextNode('\n'));
  });
}

$('#code-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  $$('.tab', $('#code-tabs')).forEach((x) => x.classList.toggle('is-active', x === tab));
  codeLang = tab.dataset.lang;
  renderCode();
});

$('#copy-code').addEventListener('click', () => copyAndToast($s('connection-code').textContent));

function renderEndpoints() {
  const eps = [
    { icon: 'world',  label: t('ep_local'),  value: `http://127.0.0.1:${PORT}/v1` },
    { icon: 'device-lan', label: t('ep_lan'), value: `http://${serverIp}:${PORT}/v1` },
    { icon: 'messages', label: t('ep_chat'),   value: '/v1/chat/completions' },
    { icon: 'list',     label: t('ep_models'), value: '/v1/models' },
  ];
  $s('endpoints').replaceChildren(...eps.map((e) => el('div', { class: 'ep' },
    el('div', { class: 'ep-ic' }, icon(e.icon)),
    el('div', { class: 'ep-body' },
      el('small', { text: e.label }),
      el('code', {
        title: t('js_copy'),
        onclick: () => copyAndToast(e.value.startsWith('http') ? e.value : `http://${serverIp}:${PORT}${e.value}`),
      }, e.value)))));
}

/* ==========================================================================
   SETTINGS
   ========================================================================== */
const ENGINES = ['cpu', 'cuda', 'vulkan'];

async function loadSlots() {
  try {
    const slots = await api('/api/settings/slots');
    $s('slots-container').replaceChildren(...Object.entries(slots).map(([idx, s]) =>
      el('div', { class: 'slot-edit' },
        el('div', { class: 'field field-fix' },
          el('label', { text: `${t('settings_slot_label')} ${idx}` })),
        el('div', { class: 'field' },
          el('label', { text: t('settings_device_label') }),
          el('select', { class: 'slot-sel', dataset: { slot: idx } },
            ...ENGINES.map((d) => el('option', { value: d, selected: s.device === d }, d.toUpperCase())))),
        el('div', { class: 'field', style: 'flex:1 1 180px' },
          el('label', { text: t('settings_loaded_in') }),
          el('div', { class: 'info' },
            icon(s.loaded_model ? 'circle-check' : 'circle'),
            el('span', { text: s.loaded_model || t('js_never') }))),
        el('button', { class: 'btn', onclick: () => saveSlot(idx) },
          icon('device-floppy'), el('span', { text: t('settings_save_btn') })),
      )));
  } catch (e) { console.error('slots', e); }
}

async function saveSlot(idx) {
  const sel = $(`.slot-sel[data-slot="${idx}"]`);
  if (!sel) return;
  try {
    await api('/api/settings/slots', {
      method: 'PUT',
      body: JSON.stringify({ slot_index: Number(idx), device: sel.value }),
    });
    toast(t('settings_saved'), 'ok');
    loadSlots();
  } catch (e) { toast(e.message, 'err'); }
}

async function loadLoadedModels() {
  const host = $s('loaded-models-container');
  try {
    const d = await api('/api/status');
    const entries = Object.entries(d.loaded_models || {});
    if (!entries.length) {
      host.replaceChildren(el('div', { class: 'empty' },
        icon('cpu-off'), el('p', { text: t('settings_no_models') })));
      return;
    }
    host.replaceChildren(...entries.map(([name, m]) => el('div', { class: 'slot-edit' },
      el('div', { class: 'field', style: 'flex:1 1 200px' },
        el('label', { text: name }),
        el('div', { class: 'info' }, icon('cpu-2'),
          el('span', { text: `${t('settings_loaded_in')} ${m.slot} · ${String(m.engine).toUpperCase()}` }))),
      el('div', { class: 'field field-fix' },
        el('label', { text: t('settings_n_ctx') }),
        el('div', { class: 'info' }, el('span', { text: num(m.n_ctx) }))),
      el('div', { class: 'field field-fix' },
        el('label', { text: t('settings_refcount') }),
        el('div', { class: 'info' }, el('span', { text: String(m.refcount) }))),
      el('button', {
        class: 'btn btn-sm', 'aria-label': t('settings_unload'),
        onclick: async () => {
          try {
            await api(`/api/unload?model_name=${encodeURIComponent(name)}`, { method: 'POST' });
            toast(t('settings_unloaded'), 'ok');
            loadLoadedModels();
          } catch (e) { toast(e.message, 'err'); }
        },
      }, icon('trash')),
    )));
  } catch (e) { console.error('loaded', e); }
}

$('#unload-all').addEventListener('click', () =>
  askConfirm(t('confirm_unload_all'), async () => {
    try {
      const r = await api('/api/unload', { method: 'POST' });
      toast(r.message, 'ok');
      loadLoadedModels();
    } catch (e) { toast(e.message, 'err'); }
  }));

/* ==========================================================================
   DOKUMENTACJA (w zakladce Ustawienia)
   Tresc generowana z zywych danych — adres IP, klucz i nazwy modeli
   sa wklejane prosto do przykladow, wiec da sie je skopiowac i uruchomic.
   ========================================================================== */
const baseUrl = () => `http://${serverIp}:${PORT}`;

const DOC_PARAMS = [
  ['model', true, '—', 'docs_p_model'],
  ['messages', true, '—', 'docs_p_messages'],
  ['stream', false, 'false', 'docs_p_stream'],
  ['temperature', false, '0.7', 'docs_p_temperature'],
  ['max_tokens', false, '4096', 'docs_p_max_tokens'],
];

const DOC_ENDPOINTS = [
  ['post', '/v1/chat/completions', true, 'docs_e_chat'],
  ['get', '/v1/models', false, 'docs_e_models'],
  ['get', '/api/status', false, 'docs_e_status'],
  ['get', '/api/stats', false, 'docs_e_stats'],
  ['get', '/api/keys', false, 'docs_e_keys_get'],
  ['post', '/api/keys', false, 'docs_e_keys_post'],
  ['put', '/api/keys/<b>{id}</b>', false, 'docs_e_keys_put'],
  ['delete', '/api/keys/<b>{id}</b>', false, 'docs_e_keys_del'],
  ['get', '/api/logs/<b>{id}</b>', false, 'docs_e_logs'],
  ['get', '/api/settings/slots', false, 'docs_e_slots_get'],
  ['put', '/api/settings/slots', false, 'docs_e_slots_put'],
  ['post', '/api/unload', false, 'docs_e_unload'],
  ['get', '/docs', false, 'docs_e_swagger'],
];

/* Statusy zweryfikowane przeciwko backendowi — to jest kontrakt: każdy z nich
   musi odpowiadać temu, co API faktycznie zwraca. Zmiana kodu HTTP bez
   aktualizacji tej tabeli wprowadza w dokumentacji kłamstwo. */
const DOC_ERRORS = [
  ['400', '400', 'docs_x_400'],
  ['401', '401', 'docs_x_401'],
  ['403', '403', 'docs_x_403'],
  ['422', '422', 'docs_x_422'],
  ['503', '503', 'docs_x_503'],
  ['ctx', '—', 'docs_x_ctx'],
];

function docCell(value) {
  if (typeof value !== 'string') return el('span', { text: value });
  // Maly helper: <b> w tresci endpointu psuje inaczej tresc cell.
  const parts = value.split(/(<b>.*?<\/b>)/g);
  const node = el('span');
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith('<b>')) node.append(el('b', { text: p.slice(3, -4) }));
    else node.append(p);
  }
  return node;
}

function renderDocs() {
  const base = baseUrl();

  $s('docs-base').textContent = `${base}/v1`;

  // --- 1. przeladowanie modelu ---
  const loadedNames = Object.keys(loadedModelsCache);
  const sample = loadedNames[0] || 'MODEL_NAME.gguf';
  $s('doc-unload-one').textContent =
    `curl -X POST "${base}/api/unload?model_name=${sample}"`;
  $s('doc-unload-all').textContent = `curl -X POST "${base}/api/unload"`;

  // --- 2. parametry zapytania ---
  $s('docs-params').replaceChildren(...DOC_PARAMS.map(([name, req, def, descKey]) => el('tr', {},
    el('td', {}, el('code', { class: 'docs-path', text: name })),
    el('td', {}, el('span', { class: req ? 'docs-yes' : 'docs-auth no', text: req ? 'yes' : 'no' })),
    el('td', { class: 'dim' }, el('code', { class: 'mono', text: def })),
    el('td', {}, docCell(t(descKey))),
  )));

  // --- 3. przyklad curl z zywymi danymi ---
  const key = keysCache[0]?.api_key || 'sk-YOUR_API_KEY';
  const model = sample;
  $s('docs-curl').textContent =
    `curl -N -X POST "${base}/v1/chat/completions" \\\n` +
    `  -H "Content-Type: application/json" \\\n` +
    `  -H "Authorization: Bearer ${key}" \\\n` +
    `  -d '{\n` +
    `    "model": "${model}",\n` +
    `    "messages": [{"role": "user", "content": "Hello!"}],\n` +
    `    "stream": true\n` +
    `  }'`;

  // --- 4. endpointy ---
  $s('docs-endpoints').replaceChildren(...DOC_ENDPOINTS.map(([method, path, auth, descKey]) => el('tr', {},
    el('td', {}, el('span', { class: `docs-method m-${method}`, text: method.toUpperCase() })),
    el('td', {}, el('code', { class: 'docs-path' }, docCell(path))),
    el('td', {}, el('span', {
      class: `docs-auth ${auth ? 'docs-yes' : 'no'}`,
      text: auth ? t('docs_bearer') : t('docs_open'),
    })),
    el('td', {}, docCell(t(descKey))),
  )));

  // --- 5. bledy ---
  $s('docs-errors').replaceChildren(...DOC_ERRORS.map(([status, label, descKey]) => el('tr', { class: 'docs-err-row' },
    el('td', {}, el('span', { class: `docs-status s${status}`, text: label })),
    el('td', {}, docCell(t(descKey))),
  )));
}

$('#docs').addEventListener('click', (e) => {
  const code = e.target.closest('code.copyable');
  if (code) copyAndToast(code.textContent, code);
});

/* ==========================================================================
   POLLING
   ========================================================================== */
let online = null;
let timer = null;
let failures = 0;
let refreshing = false;
/* Nazwy modeli w pamieci — potrzebne w przykladach w dokumentacji. */
let loadedModelsCache = {};

function setStatus(isOnline, sub) {
  $s('status-indicator').classList.toggle('is-online', isOnline);
  $s('status-text').textContent = isOnline ? t('js_online') : t('js_offline');
  $s('conn').dataset.tip = isOnline ? t('js_online') : t('js_offline');
  if (sub !== undefined) $s('status-sub').textContent = sub;
  if (online === isOnline) return;
  online = isOnline;
  if (!isOnline) toast(t('js_err_conn'), 'err');
}

/* Adres LAN pojawia się dopiero po pierwszym /api/status. Bez tego endpointy
   i snippety pokazywały 127.0.0.1 do następnego ticka pollingu (albo wcale,
   gdy użytkownik siedział na innej zakładce). */
let lastIp = null;
function updateServerIp(ip) {
  if (!ip || ip === lastIp) return;
  lastIp = ip;
  serverIp = ip;
  renderEndpoints();
  renderCode();
}

/* Interwał rośnie przy błędach, a gdy karta jest w tle — rzadziej. */
function schedule() {
  clearTimeout(timer);
  const base = online ? 2500 : 7000;
  const delay = Math.min(30000, base * (1 + failures * 0.6));
  timer = setTimeout(poll, document.hidden ? Math.max(delay, 12000) : delay);
}

async function refresh(force = false) {
  if (refreshing) return;
  refreshing = true;
  try {
    const [status, models, keys] = await Promise.all([
      api('/api/status'), api('/v1/models'), api('/api/keys'),
    ]);
    setStatus(true, `${status.local_ip}:${status.port}`);
    updateServerIp(status.local_ip);

    const loadedNames = Object.keys(status.loaded_models || {});
    loadedModelsCache = status.loaded_models || {};
    $s('active-model-name').textContent = loadedNames[0] || t('models_none');

    if (currentTab === 'home') await loadStats();
    if (currentTab === 'models') {
      const sig = JSON.stringify([models.data, loadedNames]);
      if (force || sig !== renderModels._sig) {
        renderModels._sig = sig;
        renderModels(models.data, loadedNames);
      }
    }
    if (JSON.stringify(keys) !== JSON.stringify(keysCache)) renderKeys(keys);

    failures = 0;
  } catch {
    setStatus(false, '—');
    failures++;
  } finally {
    refreshing = false;
  }
}

async function poll() {
  if (document.hidden) { schedule(); return; }
  try {
    if (currentTab === 'home') {
      const s = await api('/api/status');
      setStatus(true, `${s.local_ip}:${s.port}`);
      updateServerIp(s.local_ip);
      await loadStats();
    } else {
      const [status, keys] = await Promise.all([api('/api/status'), api('/api/keys')]);
      setStatus(true, `${status.local_ip}:${status.port}`);
      updateServerIp(status.local_ip);
      if (JSON.stringify(keys) !== JSON.stringify(keysCache)) renderKeys(keys);
      if (currentTab === 'settings') { loadSlots(); loadLoadedModels(); }
      if (currentTab === 'docs') renderDocs();
      if (currentLogKey) await loadLogs();
    }
    failures = 0;
  } catch {
    setStatus(false, '—');
    failures++;
  }
  schedule();
}

$('#refresh-now').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.classList.add('is-spinning');
  renderModels._sig = null;
  keysCache = [];
  await refresh(true);
  if (currentLogKey) await loadLogs();
  if (currentTab === 'settings') { loadSlots(); loadLoadedModels(); }
  if (currentTab === 'docs') renderDocs();
  btn.classList.remove('is-spinning');
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

/* ==========================================================================
   START
   ========================================================================== */
/* matchMedia nie istnieje w starszych przegladarkach i niektorych webview —
   panel musi dzialac mimo to. */
const prefersLight = () => {
  try { return window.matchMedia('(prefers-color-scheme: light)').matches; } catch { return false; }
};

function start() {
  applyTheme(localStorage.getItem(THEME_KEY) || (prefersLight() ? 'light' : 'dark'));

  let stored = null;
  try { stored = localStorage.getItem(NAV_KEY); } catch { /* prywatny tryb */ }
  applyRail(stored === '1', false);

  $$('.lang-btn').forEach((b) => b.addEventListener('click', () => setLanguage(b.dataset.lang)));

  const initial = location.hash.replace('#', '');
  const TABS = ['home', 'models', 'keys', 'logs', 'connect', 'docs', 'settings'];
  showTab(TABS.includes(initial) ? initial : 'home', false);

  renderEndpoints();
  renderCode();
  showSkeleton();
  refresh(true).then(schedule);
  setTimeout(schedule, 3000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

/* i18n.js potrzebuje tych, żeby przerysować dane po zmianie języka. */
window.LLMAPI = { toast, showTab, loadStats, renderCode, renderEndpoints, renderKeys, renderDocs, applyRail };

})();
