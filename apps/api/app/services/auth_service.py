"""JWT + password hashing service (Phase 1 — Identity Service).

Access tokens are short-lived signed JWTs (never stored server-side).
Refresh tokens are opaque random strings; only their SHA-256 hash is
persisted in `refresh_tokens`, so a leaked DB row can't be replayed and
we can revoke individual sessions on logout.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from ..config import get_settings

settings = get_settings()

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TOKEN_TYPE_ACCESS = "access"


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return _pwd_context.verify(plain_password, hashed_password)


def create_access_token(*, subject: str, role: str) -> tuple[str, int]:
    """Return (token, expires_in_seconds)."""
    now = datetime.now(UTC)
    expires_in = settings.jwt_access_token_expire_minutes * 60
    expire = now + timedelta(seconds=expires_in)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": TOKEN_TYPE_ACCESS,
        "iat": now,
        "exp": expire,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token. Raises JWTError if invalid/expired."""
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != TOKEN_TYPE_ACCESS:
        raise JWTError("Not an access token")
    return payload


def new_refresh_token() -> tuple[str, str, datetime]:
    """Generate a raw refresh token, its hash, and its expiry datetime."""
    raw = secrets.token_urlsafe(48)
    token_hash = hash_refresh_token(raw)
    expires_at = datetime.now(UTC) + timedelta(
        days=settings.jwt_refresh_token_expire_days
    )
    return raw, token_hash, expires_at


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


__all__ = [
    "JWTError",
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "new_refresh_token",
    "hash_refresh_token",
]
