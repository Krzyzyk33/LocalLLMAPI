import sqlite3
import os
import time

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Tabela kluczy API
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            api_key TEXT UNIQUE NOT NULL,
            created_at REAL
        )
    ''')
    # Tabela logów (z referencją do klucza)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS request_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key_id INTEGER,
            timestamp REAL,
            model TEXT,
            elapsed_seconds REAL,
            total_tokens INTEGER,
            tokens_per_second REAL,
            FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
        )
    ''')
    conn.commit()
    conn.close()

def create_api_key(name: str, api_key: str):
    """Tworzy nowy klucz (o zadanej wartości). Rzuca wyjątek, jeśli klucz już istnieje."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO api_keys (name, api_key, created_at)
            VALUES (?, ?, ?)
        ''', (name, api_key, time.time()))
        conn.commit()
        key_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        raise ValueError("Taki klucz API już istnieje. Wymyśl inną, unikalną wartość.")
    finally:
        conn.close()
    return key_id

def get_api_keys_stats():
    """Zwraca listę kluczy wraz z podsumowaniem (ostatnie użycie, łącznie tokenów)."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT 
            k.id, k.name, k.api_key, k.created_at,
            MAX(l.timestamp) as last_used,
            SUM(l.total_tokens) as total_tokens
        FROM api_keys k
        LEFT JOIN request_logs l ON k.id = l.api_key_id
        GROUP BY k.id
        ORDER BY k.created_at DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    
    keys = []
    for row in rows:
        keys.append({
            "id": row[0],
            "name": row[1],
            "api_key": row[2],
            "created_at": row[3],
            "last_used": row[4],
            "total_tokens": row[5] or 0
        })
    return keys

def get_api_key_by_value(api_key: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM api_keys WHERE api_key = ?', (api_key,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None

def add_log(api_key_id: int, model: str, elapsed: float, tokens: int, tps: float, min_tps: float = 0.0, max_tps: float = 0.0):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO request_logs (api_key_id, timestamp, model, elapsed_seconds, total_tokens, tokens_per_second, min_tps, max_tps)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (api_key_id, time.time(), model, elapsed, tokens, tps, min_tps, max_tps))
    conn.commit()
    conn.close()

def get_logs_for_key(api_key_id: int, limit=200):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT timestamp, model, elapsed_seconds, total_tokens, tokens_per_second, min_tps, max_tps
        FROM request_logs
        WHERE api_key_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    ''', (api_key_id, limit))
    rows = cursor.fetchall()
    conn.close()
    
    logs = []
    for row in reversed(rows):
        logs.append({
            "timestamp": row[0],
            "model": row[1],
            "elapsed_seconds": row[2],
            "total_tokens": row[3],
            "tokens_per_second": row[4],
            "min_tps": row[5] if len(row) > 5 and row[5] is not None else row[4],
            "max_tps": row[6] if len(row) > 6 and row[6] is not None else row[4]
        })
    return logs

def delete_api_key(key_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Usuń kaskadowo logi przypisane do klucza
    cursor.execute('DELETE FROM request_logs WHERE api_key_id = ?', (key_id,))
    # Usuń sam klucz
    cursor.execute('DELETE FROM api_keys WHERE id = ?', (key_id,))
    conn.commit()
    conn.close()

def update_api_key(key_id: int, new_name: str, new_api_key: str = None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    if new_api_key:
        cursor.execute('UPDATE api_keys SET name = ?, api_key = ? WHERE id = ?', (new_name, new_api_key, key_id))
    else:
        cursor.execute('UPDATE api_keys SET name = ? WHERE id = ?', (new_name, key_id))
    conn.commit()
    conn.close()

