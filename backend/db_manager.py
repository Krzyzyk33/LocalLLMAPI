"""Warstwa dostępu do bazy SQLite (klucze API, logi requestów, ustawienia slotów).

Wszystkie połączenia są trzymane w thread-local, więc każdy wątek (oraz
`asyncio.to_thread`) dostaje własne połączenie zamiast otwierać nowe przy
każdym zapytaniu. Baza działa w trybie WAL, dzięki czemu odczyty nie blokują
się nawzajem z zapisami.
"""

import os
import sqlite3
import threading
import time
from typing import Any, Dict, List, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs.db")

_local = threading.local()
_init_lock = threading.Lock()
_write_lock = threading.Lock()
_initialized = False


def _connect() -> sqlite3.Connection:
    """Zwraca połączenie SQLite dla bieżącego wątku (tworzy je raz).

    ``journal_mode`` ustawiamy tylko raz w :func:`init_db` — przełączanie trybu
    wymaga krótkiej blokady wyłącznej i przy wielu wątkach wywalało się
    „database is locked".
    """
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH, timeout=30.0, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout=30000")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return conn


def _query(sql: str, params: tuple = ()) -> List[sqlite3.Row]:
    return _connect().execute(sql, params).fetchall()


def _write(sql: str, params: tuple = ()) -> sqlite3.Cursor:
    """Wpis z mutexem procesowym.

    SQLite dopuszcza tylko jeden writer, a panel potrafi zapisać logi z kilku
    requestów naraz. Mutyksochrona jest tu tańsza i pewniejsza niż czekanie na
    ``busy_timeout`` przy każdym kolizyjnym INSERT-cie.
    """
    with _write_lock:
        conn = _connect()
        cur = conn.execute(sql, params)
        return cur


# --------------------------------------------------------------------------
# Inicjalizacja schematu
# --------------------------------------------------------------------------


def init_db():
    global _initialized
    with _init_lock, _write_lock:
        conn = _connect()
        cur = conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                api_key TEXT UNIQUE NOT NULL,
                created_at REAL,
                engine TEXT DEFAULT 'vulkan'
            )
        """
        )
        # Migracja: kolumna 'engine' mogła nie istnieć w starszych bazach.
        cols = {r["name"] for r in cur.execute("PRAGMA table_info(api_keys)")}
        if "engine" not in cols:
            cur.execute("ALTER TABLE api_keys ADD COLUMN engine TEXT DEFAULT 'vulkan'")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS request_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_key_id INTEGER,
                timestamp REAL,
                model TEXT,
                elapsed_seconds REAL,
                total_tokens INTEGER,
                tokens_per_second REAL,
                ttft REAL DEFAULT 0.0,
                min_tps REAL,
                max_tps REAL,
                FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
            )
            """
        )
        log_cols = {r["name"] for r in cur.execute("PRAGMA table_info(request_logs)")}
        if "ttft" not in log_cols:
            cur.execute("ALTER TABLE request_logs ADD COLUMN ttft REAL DEFAULT 0.0")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """
        )

        # Indeks krytyczny dla dashboardu: agregaty i historia per klucz
        # są odpytywane co parę sekund, a tabela rośnie z każdym requestem.
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_logs_key_ts
            ON request_logs (api_key_id, timestamp DESC)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_logs_timestamp
            ON request_logs (timestamp DESC)
            """
        )

        # Domyślne sloty: 1=vulkan, 2=cpu, 3=cpu
        for k, v in (
            ("slot_1_device", "vulkan"),
            ("slot_2_device", "cpu"),
            ("slot_3_device", "cpu"),
        ):
            cur.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v)
            )

        conn.commit()
        _initialized = True

    init_settings()


def init_settings():
    _write(
        """
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """
    )
    for k, v in (
        ("slot_1_device", "vulkan"),
        ("slot_2_device", "cpu"),
        ("slot_3_device", "cpu"),
    ):
        _write("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))


# --------------------------------------------------------------------------
# Klucze API
# --------------------------------------------------------------------------


def create_api_key(name: str, api_key: str, engine: str = "vulkan") -> int:
    """Tworzy nowy klucz o podanej wartości.

    Rzuca ``ValueError``, jeśli taki klucz już istnieje.
    """
    try:
        cur = _write(
            "INSERT INTO api_keys (name, api_key, created_at, engine) VALUES (?, ?, ?, ?)",
            (name, api_key, time.time(), engine),
        )
        return cur.lastrowid
    except sqlite3.IntegrityError:
        raise ValueError("This API key already exists. Pick a different, unique value.")


def get_api_keys_stats() -> List[Dict[str, Any]]:
    """Lista kluczy wraz z podsumowaniem (ostatnie użycie, łącznie tokenów).

    Agregacja idzie po indeksie zamiast pełnym skanem tabeli logów.
    """
    rows = _query(
        """
        SELECT
            k.id            AS id,
            k.name          AS name,
            k.api_key       AS api_key,
            k.created_at    AS created_at,
            k.engine        AS engine,
            MAX(l.timestamp)      AS last_used,
            COALESCE(SUM(l.total_tokens), 0) AS total_tokens
        FROM api_keys k
        LEFT JOIN (
            SELECT api_key_id, MAX(timestamp) AS timestamp, SUM(total_tokens) AS total_tokens
            FROM request_logs
            GROUP BY api_key_id
        ) l ON l.api_key_id = k.id
        GROUP BY k.id
        ORDER BY k.created_at DESC
        """
    )
    return [dict(r) for r in rows]


def get_api_key_by_value(api_key: str) -> Optional[int]:
    row = _query("SELECT id FROM api_keys WHERE api_key = ?", (api_key,))
    return row[0]["id"] if row else None


def get_engine_for_key(key_id: int) -> str:
    row = _query("SELECT engine FROM api_keys WHERE id = ?", (key_id,))
    return (row[0]["engine"] if row and row[0]["engine"] else "vulkan") or "vulkan"


def update_api_key(
    key_id: int, new_name: str, new_api_key: Optional[str] = None, new_engine: str = "vulkan"
):
    if new_api_key:
        _write(
            "UPDATE api_keys SET name = ?, api_key = ?, engine = ? WHERE id = ?",
            (new_name, new_api_key, new_engine, key_id),
        )
    else:
        _write(
            "UPDATE api_keys SET name = ?, engine = ? WHERE id = ?",
            (new_name, new_engine, key_id),
        )


def delete_api_key(key_id: int):
    with _write_lock:
        conn = _connect()
        conn.execute("BEGIN IMMEDIATE")
        try:
            conn.execute("DELETE FROM request_logs WHERE api_key_id = ?", (key_id,))
            conn.execute("DELETE FROM api_keys WHERE id = ?", (key_id,))
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise


# --------------------------------------------------------------------------
# Logi requestów
# --------------------------------------------------------------------------


def add_log(
    api_key_id: int,
    model: str,
    elapsed: float,
    tokens: int,
    tps: float,
    min_tps: float = 0.0,
    max_tps: float = 0.0,
    ttft: float = 0.0,
):
    _write(
        """
        INSERT INTO request_logs
            (api_key_id, timestamp, model, elapsed_seconds, total_tokens,
             tokens_per_second, min_tps, max_tps, ttft)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (api_key_id, time.time(), model, elapsed, tokens, tps, min_tps, max_tps, ttft),
    )


def get_logs_for_key(api_key_id: int, limit: int = 200) -> List[Dict[str, Any]]:
    rows = _query(
        """
        SELECT timestamp, model, elapsed_seconds, total_tokens,
               tokens_per_second, min_tps, max_tps, ttft
        FROM request_logs
        WHERE api_key_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
        """,
        (api_key_id, limit),
    )
    logs = []
    for r in reversed(rows):
        tps = r["tokens_per_second"] or 0.0
        logs.append(
            {
                "timestamp": r["timestamp"],
                "model": r["model"],
                "elapsed_seconds": r["elapsed_seconds"],
                "total_tokens": r["total_tokens"],
                "tokens_per_second": tps,
                "min_tps": r["min_tps"] if r["min_tps"] else tps,
                "max_tps": r["max_tps"] if r["max_tps"] else tps,
                "ttft": r["ttft"] if r["ttft"] is not None else 0.0,
            }
        )
    return logs


def get_recent_logs(limit: int = 8) -> List[Dict[str, Any]]:
    """Ostatnie requesty ze wszystkich kluczy — na stronę HOME."""
    rows = _query(
        """
        SELECT l.timestamp, l.model, l.elapsed_seconds, l.total_tokens,
               l.tokens_per_second, l.ttft, k.name AS key_name
        FROM request_logs l
        LEFT JOIN api_keys k ON k.id = l.api_key_id
        ORDER BY l.timestamp DESC
        LIMIT ?
        """,
        (limit,),
    )
    return [dict(r) for r in rows]


def get_global_stats() -> Dict[str, Any]:
    """Agregaty dla strony HOME — jeden zestaw zapytań na indeksach."""
    agg = _query(
        """
        SELECT
            COUNT(*)                                        AS total_requests,
            COALESCE(SUM(total_tokens), 0)                  AS total_tokens,
            COALESCE(AVG(NULLIF(tokens_per_second, 0)), 0)   AS avg_tps,
            COALESCE(MAX(tokens_per_second), 0)              AS best_tps,
            COALESCE(AVG(elapsed_seconds), 0)                AS avg_duration,
            MAX(timestamp)                                   AS last_request_at
        FROM request_logs
        """
    )[0]

    last = _query(
        """
        SELECT model, elapsed_seconds, total_tokens, tokens_per_second, timestamp
        FROM request_logs ORDER BY timestamp DESC LIMIT 1
        """
    )

    hour = _query(
        """
        SELECT COUNT(*) AS requests_1h, COALESCE(SUM(total_tokens), 0) AS tokens_1h
        FROM request_logs WHERE timestamp >= ?
        """,
        (time.time() - 3600,),
    )[0]

    keys = _query("SELECT COUNT(*) AS n FROM api_keys")[0]

    return {
        "total_requests": agg["total_requests"],
        "total_tokens": agg["total_tokens"],
        "avg_tps": round(agg["avg_tps"] or 0.0, 2),
        "best_tps": round(agg["best_tps"] or 0.0, 2),
        "avg_duration": round(agg["avg_duration"] or 0.0, 2),
        "last_request_at": agg["last_request_at"],
        "api_keys": keys["n"],
        "requests_1h": hour["requests_1h"],
        "tokens_1h": hour["tokens_1h"],
        "last": dict(last[0]) if last else None,
    }


# --------------------------------------------------------------------------
# Sloty
# --------------------------------------------------------------------------


def get_slot_devices() -> Dict[int, str]:
    rows = _query("SELECT key, value FROM settings WHERE key LIKE 'slot\\_%\\_device' ESCAPE '\\'")
    result = {}
    for r in rows:
        try:
            result[int(r["key"].split("_")[1])] = r["value"]
        except (ValueError, IndexError):
            continue
    return result


def update_slot_device(slot_index: int, device: str):
    _write(
        "UPDATE settings SET value = ? WHERE key = ?",
        (device, f"slot_{slot_index}_device"),
    )
