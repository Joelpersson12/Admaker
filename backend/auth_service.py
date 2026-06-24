from __future__ import annotations

import hashlib
import os
import secrets
import sqlite3
import time
from typing import Optional

DB_PATH = os.getenv("DB_PATH", "/tmp/reelix.db")
_SECRET_KEY = os.getenv("JWT_SECRET", secrets.token_hex(32))
_ALGORITHM = "HS256"
_EXPIRE_SECONDS = 60 * 60 * 24 * 7  # 7 days


def init_db() -> None:
    with _conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                email        TEXT    UNIQUE NOT NULL,
                password_hash TEXT   NOT NULL,
                name         TEXT    NOT NULL,
                created_at   INTEGER NOT NULL
            )
        """)


def _conn() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def _hash(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"{salt}:{h.hex()}"


def _verify(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split(":", 1)
        expected = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return secrets.compare_digest(expected.hex(), h)
    except Exception:
        return False


def _make_token(user_id: int, email: str) -> str:
    from jose import jwt  # type: ignore
    return jwt.encode(
        {"sub": str(user_id), "email": email, "exp": int(time.time()) + _EXPIRE_SECONDS},
        _SECRET_KEY, algorithm=_ALGORITHM,
    )


def verify_token(token: str) -> Optional[dict]:
    from jose import JWTError, jwt  # type: ignore
    try:
        return jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
    except JWTError:
        return None


def register(email: str, password: str, name: str) -> dict:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    try:
        with _conn() as con:
            cur = con.execute(
                "INSERT INTO users (email, password_hash, name, created_at) VALUES (?,?,?,?)",
                (email.lower().strip(), _hash(password), name.strip(), int(time.time())),
            )
            uid = cur.lastrowid
    except sqlite3.IntegrityError:
        raise ValueError("Email already registered")
    return {"token": _make_token(uid, email), "user": {"id": uid, "email": email, "name": name}}


def login(email: str, password: str) -> dict:
    with _conn() as con:
        row = con.execute("SELECT * FROM users WHERE email=?", (email.lower().strip(),)).fetchone()
    if not row or not _verify(password, row["password_hash"]):
        raise ValueError("Invalid email or password")
    return {
        "token": _make_token(row["id"], row["email"]),
        "user": {"id": row["id"], "email": row["email"], "name": row["name"]},
    }


def get_user(user_id: int) -> Optional[dict]:
    with _conn() as con:
        row = con.execute(
            "SELECT id, email, name, created_at FROM users WHERE id=?", (user_id,)
        ).fetchone()
    return dict(row) if row else None
