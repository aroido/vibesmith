"""인증 비즈니스 로직 — 사용자 등록, 로그인, 세션 관리."""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from vibesmith_core.infra.db import DatabaseManager

from vibesmith_api.auth.jwt import create_refresh_token, decode_token
from vibesmith_api.auth.password import hash_password, verify_password


def _now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def register_user(db: DatabaseManager, email: str, password: str, name: str | None = None) -> tuple[str, str]:
    """사용자를 등록한다.

    Returns:
        (user_id, password_hash)

    Raises:
        ValueError: 이메일이 이미 등록됨
    """
    conn = db.get_connection()
    cur = conn.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email.lower(),))
    if cur.fetchone():
        raise ValueError("EMAIL_ALREADY_EXISTS")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(password)
    now = _now_iso()
    conn.execute(
        "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, email.lower(), password_hash, name or "", now, now),
    )
    conn.commit()
    return user_id, password_hash


def get_user_by_email(db: DatabaseManager, email: str) -> dict | None:
    """이메일로 사용자를 조회한다."""
    conn = db.get_connection()
    cur = conn.execute(
        "SELECT id, email, password_hash, name, created_at, updated_at FROM users WHERE LOWER(email) = ?",
        (email.lower(),),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "email": row[1],
        "password_hash": row[2],
        "name": row[3] or None,
        "created_at": row[4],
        "updated_at": row[5],
    }


def get_user_by_id(db: DatabaseManager, user_id: str) -> dict | None:
    """ID로 사용자를 조회한다."""
    conn = db.get_connection()
    cur = conn.execute(
        "SELECT id, email, password_hash, name, created_at, updated_at FROM users WHERE id = ?",
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "email": row[1],
        "password_hash": row[2],
        "name": row[3] or None,
        "created_at": row[4],
        "updated_at": row[5],
    }


def authenticate_user(db: DatabaseManager, email: str, password: str) -> dict | None:
    """이메일과 비밀번호로 사용자를 인증한다. 성공 시 사용자 dict 반환."""
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return user


def create_session(db: DatabaseManager, user_id: str) -> str:
    """Refresh Token 세션을 생성한다. 클라이언트에 전달할 refresh_token을 반환한다."""
    token, token_hash = create_refresh_token(user_id)
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    expires_at = (datetime.now(UTC) + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    now = _now_iso()
    conn = db.get_connection()
    conn.execute(
        "INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
        (session_id, user_id, token_hash, expires_at, now),
    )
    conn.commit()
    return token


def get_session_by_refresh_token(db: DatabaseManager, refresh_token: str) -> dict | None:
    """Refresh Token으로 세션(사용자)을 조회한다."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    conn = db.get_connection()
    cur = conn.execute(
        "SELECT id, user_id, expires_at FROM sessions WHERE user_id = ? AND refresh_token_hash = ?",
        (user_id, token_hash),
    )
    row = cur.fetchone()
    if not row:
        return None
    expires_at = datetime.fromisoformat(row[2].replace("Z", "+00:00"))
    if datetime.now(UTC) > expires_at:
        conn.execute("DELETE FROM sessions WHERE id = ?", (row[0],))
        conn.commit()
        return None
    return get_user_by_id(db, user_id)


def delete_user_sessions(db: DatabaseManager, user_id: str) -> None:
    """사용자의 모든 세션을 삭제한다 (로그아웃)."""
    conn = db.get_connection()
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    conn.commit()


def delete_session_by_refresh_token(db: DatabaseManager, refresh_token: str) -> bool:
    """Refresh Token에 해당하는 세션을 삭제한다. 없으면 False."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return False
    user_id = payload.get("sub")
    if not user_id:
        return False
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    conn = db.get_connection()
    cur = conn.execute(
        "DELETE FROM sessions WHERE user_id = ? AND refresh_token_hash = ?",
        (user_id, token_hash),
    )
    conn.commit()
    return cur.rowcount > 0
