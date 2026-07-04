"""
FastAPI dependencies for authentication and per-session application state.

Authentication
--------------
Authentication is backed by **Firebase Admin session cookies**. The web
client exchanges a Firebase ID token for a stateless session cookie
(valid up to 24h) via ``/set_authenticated_user_session``.
:func:`get_current_user` verifies that cookie on every protected request
using ``auth.verify_session_cookie(check_revoked=True)``.

Dev bypass
----------
In development, ``Config.DEV_AUTH_BYPASS=True`` lets callers without a
session cookie authenticate as the dev user. FIX [M17] restricts the
bypass to ONLY the no-cookie case: if a cookie was presented but
Firebase raised an infrastructure error (network, backend down,
malformed), the request fails with 503 instead of silently dev-authing.
Only the typed Firebase auth exceptions (``ExpiredSessionCookieError``,
``InvalidSessionCookieError``, ``RevokedSessionCookieError``) fall
through to a 401 / dev-bypass — those indicate the cookie itself is bad,
not that the auth backend is broken.

DB-config lifecycle
-------------------
``get_db_config`` reads per-session DB connection metadata from Redis
and applies a configurable persistence policy: if the client closed the
tab (no recent ``session_active_at`` heartbeat) and the user opted into
``connectionPersistenceMinutes``, the cached pool connection is kept
alive for that long; otherwise it is disconnected eagerly.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from firebase_admin import auth
from firebase_admin.auth import (
    ExpiredSessionCookieError,
    InvalidSessionCookieError,
    RevokedSessionCookieError,
)

from config import get_config
from core.audit import audit_log
from core.security import constant_time_eq

logger = logging.getLogger(__name__)
Config = get_config()

_memory_state: dict[str, tuple[dict, float]] = {}


async def get_redis():
    """Get Redis client from application state."""
    from service.redis_service import get_redis_client

    return get_redis_client()


def _state_key_from_cookie(request: Request) -> Optional[str]:
    session_cookie = request.cookies.get(Config.SESSION_COOKIE_NAME)
    if not session_cookie:
        return None

    return state_key_from_session_cookie(session_cookie)


def state_key_from_session_cookie(session_cookie: str) -> str:
    digest = hashlib.sha256(session_cookie.encode("utf-8")).hexdigest()
    return f"session_state:{digest}"


def _user_from_decoded_session(decoded: dict) -> dict:
    return {
        "uid": decoded["uid"],
        "email": decoded.get("email"),
        "name": decoded.get("name"),
        "picture": decoded.get("picture"),
        "verified": bool(decoded.get("email_verified", True)),
    }


def verify_session_cookie_value(session_cookie: str) -> dict:
    """Verify a Firebase session cookie and return the app user payload."""
    decoded = auth.verify_session_cookie(
        session_cookie,
        check_revoked=Config.FIREBASE_SESSION_CHECK_REVOKED,
    )
    return _user_from_decoded_session(decoded)


def verify_csrf_token(request: Request) -> None:
    """Validate the double-submit CSRF token for state-mutating requests.

    Compares the CSRF token stored in the client's cookie with the token sent in
    the request headers using a constant-time comparison. If either value is
    missing, or the two values do not match, a 403 Forbidden exception is
    raised to protect endpoints against Cross-Site Request Forgery attacks.

    The double-submit pattern works because an attacker on a third-party origin
    cannot read the user's ``csrf_token`` cookie (it is not ``HttpOnly`` but it
    IS ``SameSite=lax``) and therefore cannot forge a matching header value.

    Args:
        request: Inbound FastAPI request.

    Raises:
        HTTPException: 403 Forbidden if the CSRF cookie or header is missing,
            or if the two tokens do not match.
    """
    cookie_token = request.cookies.get(Config.CSRF_COOKIE_NAME)
    header_token = request.headers.get(Config.CSRF_HEADER_NAME)

    # Constant-time comparison defeats timing oracles that could otherwise
    # recover a valid CSRF token byte-by-byte.
    if not cookie_token or not header_token or not constant_time_eq(cookie_token, header_token):
        audit_log(
            actor="anonymous",
            action="csrf.verify",
            resource="csrf_token",
            outcome="denied",
            details={"path": request.url.path, "method": request.method},
            request_id=request.headers.get("X-Request-ID"),
            actor_ip=request.client.host if request.client else None,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid CSRF token",
        )


async def _read_state(key: str) -> Optional[dict]:
    """Read per-session state from Redis (or in-memory fallback).

    Args:
        key: Redis key for the session state.

    Returns:
        Deserialized session dict, or ``None`` if the key does not exist
        or has expired.
    """
    redis_client = await get_redis()
    if redis_client:
        raw = await redis_client.get(key)
        return json.loads(raw) if raw else None

    record = _memory_state.get(key)
    if not record:
        return None

    data, expires_at = record
    if expires_at <= time.time():
        _memory_state.pop(key, None)
        return None
    return dict(data)


# Lua script for atomic read-merge-write on Redis. Using EVAL keeps the
# read-modify-write inside a single Redis atomic operation, eliminating the
# race where two concurrent requests from the same session both read the
# old state, both merge their updates, and the second write clobbers the
# first. The script also refreshes TTL on every write.
#
# FIX [BUG-LUA]: ARGV[2] is a JSON-encoded string (Python dicts cannot be
# passed as native Lua tables via redis-py). The previous version tried
# ``pairs(ARGV[2])`` directly, which raised
# ``bad argument #1 to pairs (table expected, got string)``. We now
# decode the JSON inside Lua with ``cjson.decode`` before iterating.
_ATOMIC_MERGE_LUA = """
local current = redis.call('GET', KEYS[1])
local data = {}
if current then
  local ok, parsed = pcall(cjson.decode, current)
  if ok and type(parsed) == 'table' then data = parsed end
end
local updates_ok, updates = pcall(cjson.decode, ARGV[2])
if not updates_ok or type(updates) ~= 'table' then
  return redis.error_reply('updates payload is not valid JSON')
end
for k, v in pairs(updates) do
  data[k] = v
end
local ttl = tonumber(ARGV[1])
if not ttl then
  return redis.error_reply('ttl must be a number')
end
redis.call('SETEX', KEYS[1], ttl, cjson.encode(data))
return redis.call('GET', KEYS[1])
"""


async def _write_state(key: str, data: dict, expire_seconds: int) -> None:
    """Write per-session state, replacing the previous value atomically.

    Args:
        key: Redis key for the session state.
        data: Full state dict to persist.
        expire_seconds: TTL in seconds.
    """
    redis_client = await get_redis()
    if redis_client:
        await redis_client.set(key, json.dumps(data), ex=expire_seconds)
        return

    _memory_state[key] = (dict(data), time.time() + expire_seconds)


async def _merge_state(key: str, updates: dict, expire_seconds: int) -> Optional[dict]:
    """Atomically merge ``updates`` into the existing session state.

    On Redis this is a single Lua EVAL (read-merge-write-setex) so concurrent
    requests from the same session cannot lose updates. If the Lua EVAL
    fails for any reason (script error, Redis version without cjson,
    network hiccup), the method falls back to a non-atomic
    read-merge-write so the request still succeeds — the race window is
    tiny (sub-millisecond) and only matters under concurrent same-session
    writes, which are rare. The in-memory fallback acquires a per-process
    lock (single-worker dev only).

    Args:
        key: Redis key for the session state.
        updates: Partial dict to merge into the existing state.
        expire_seconds: TTL in seconds (refreshed on every write).

    Returns:
        The new merged session dict, or ``None`` if the key was not written.
    """
    redis_client = await get_redis()
    if redis_client:
        # ARGV[1] = TTL (int); ARGV[2] = updates as a JSON string.
        # The Lua script decodes the JSON inside Redis so the merge is
        # atomic. If EVAL fails, we fall back to a non-atomic
        # read-merge-write so the request never breaks.
        try:
            merged_json = await redis_client.eval(
                _ATOMIC_MERGE_LUA,
                1,
                key,
                int(expire_seconds),
                json.dumps(updates),
            )
            return json.loads(merged_json) if merged_json else None
        except Exception as exc:
            logger.warning(
                "Atomic Lua merge failed for key %s, falling back to non-atomic read-merge-write: %s",
                key[:32],
                exc,
            )
            # Non-atomic fallback: read, merge, write. This has a tiny
            # race window under concurrent same-session writes, but it
            # is strictly better than failing the request.
            try:
                raw = await redis_client.get(key)
                existing = json.loads(raw) if raw else {}
            except Exception:
                existing = {}
            if not isinstance(existing, dict):
                existing = {}
            existing.update(updates)
            await redis_client.set(key, json.dumps(existing), ex=int(expire_seconds))
            return existing

    # In-memory fallback (single-worker dev only). The lock is reentrant
    # within the same event loop because there is no real concurrency
    # across requests without threads.
    import threading

    _memory_lock = getattr(_merge_state, "_lock", None)
    if _memory_lock is None:
        _memory_lock = threading.Lock()
        setattr(_merge_state, "_lock", _memory_lock)

    with _memory_lock:
        existing = _memory_state.get(key)
        if existing:
            data, _ = existing
            data = dict(data)
        else:
            data = {}
        data.update(updates)
        _memory_state[key] = (data, time.time() + expire_seconds)
        return dict(data)


async def _delete_state(key: str) -> None:
    redis_client = await get_redis()
    if redis_client:
        await redis_client.delete(key)
        return

    _memory_state.pop(key, None)


async def get_session_data(request: Request) -> Optional[dict]:
    """
    Get per-Firebase-session application state.

    This is not an authentication source. Authentication is always verified from
    the Firebase session cookie by get_current_user().
    """
    key = _state_key_from_cookie(request)
    if not key:
        return None

    try:
        return await _read_state(key)
    except Exception as e:
        logger.warning(f"Error reading session state: {e}")
        return None


def _get_connection_persistence_minutes(session_data: dict) -> Optional[int]:
    value = session_data.get("connectionPersistenceMinutes")
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


async def _expire_db_config(request: Request, db_config: dict, reason: str) -> None:
    try:
        user = getattr(request.state, "user", None)
        user_id = user.get("uid") if isinstance(user, dict) else None
    except Exception:
        user_id = None

    try:
        from service.database.database_service import DatabaseService

        await run_in_threadpool(DatabaseService.disconnect, db_config, user_id)
    except Exception as e:
        logger.warning(f"Failed to disconnect expired DB config: {e}")

    try:
        await update_session_data(
            request,
            {
                "db_config": None,
                "db_config_last_used_at": None,
                "db_config_last_closed_at": None,
            },
        )
    except Exception as e:
        logger.warning(f"Failed to clear expired DB config from session state: {e}")


async def get_current_user(request: Request) -> dict:
    """
    Authenticate request via Firebase Admin session cookie.

    Returns:
        User dict with uid, email, name, picture, verified flag

    Raises:
        HTTPException 401 if no cookie is present (or the cookie is
            expired/invalid/revoked) and dev-bypass is disabled.
        HTTPException 503 if a cookie IS present but Firebase raised an
            infrastructure error (network, backend down, malformed JWT).
            FIX [M17] prevents a Firebase outage from silently authenticating
            callers as the dev user.
    """
    session_cookie = request.cookies.get(Config.SESSION_COOKIE_NAME)
    if session_cookie:
        try:
            user = await run_in_threadpool(verify_session_cookie_value, session_cookie)
            request.state.user = user
            logger.debug(f"Firebase session auth for user: {user.get('uid')}")
            return user
        except (
            ExpiredSessionCookieError,
            InvalidSessionCookieError,
            RevokedSessionCookieError,
        ) as e:
            # FIX [M17]: These typed exceptions indicate the cookie itself is
            # bad (expired, malformed, or revoked). They are safe to fall
            # through to the 401 / dev-bypass path below.
            logger.debug(f"Invalid Firebase session cookie: {e}")
        except Exception as e:
            # FIX [M17]: Any OTHER exception (network error, Firebase backend
            # down, malformed internal state) means the auth service itself is
            # unhealthy. We must NOT silently dev-auth the request — that
            # would grant full dev-user access to every unauthenticated
            # request during a Firebase outage. Surface a 503 so the operator
            # sees the outage and the client can retry.
            logger.error(f"Firebase verification error (non-auth): {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Auth service temporarily unavailable",
            )

    # FIX [M17]: Only fall through to dev bypass when NO cookie was
    # presented. A presented-but-invalid cookie must NOT be silently
    # replaced with the dev identity.
    if Config.DEBUG and Config.DEV_AUTH_BYPASS:
        user = {
            "uid": Config.DEV_AUTH_USER_ID,
            "email": Config.DEV_AUTH_EMAIL,
            "name": Config.DEV_AUTH_NAME,
            "verified": True,
        }
        request.state.user = user
        logger.debug("Development auth bypass for user: %s", user["uid"])
        return user

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")


async def get_current_user_optional(request: Request) -> Optional[dict]:
    """
    Like get_current_user but returns None instead of raising exception.
    Useful for routes that work with or without authentication.
    """
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


async def get_db_config(request: Request) -> Optional[dict]:
    """
    Get database configuration from request state or per-session state.

    The cached ``db_config`` is keyed per Firebase session cookie (via
    :func:`_state_key_from_cookie`). Persistence is governed by
    ``connectionPersistenceMinutes`` in the session state:

    - If the tab is closed (no recent ``session_active_at`` heartbeat) and
      no persistence was configured, the connection is closed eagerly and
      the cached config is dropped.
    - If persistence was configured, the connection stays alive for that
      many minutes after the tab closes, then is closed automatically.

    Returns ``None`` when there is no cached config or the cached config
    has expired.
    """
    if hasattr(request.state, "db_config") and request.state.db_config:
        return request.state.db_config

    session_data = await get_session_data(request)
    if session_data and "db_config" in session_data:
        db_config = session_data["db_config"]
        if not db_config:
            return None

        persistence_minutes = _get_connection_persistence_minutes(session_data)
        closed_at = session_data.get("db_config_last_closed_at")
        active_at = session_data.get("session_active_at")
        now = time.time()

        # If no explicit close event and heartbeat stopped, treat as implicit close.
        if closed_at is None and active_at is not None:
            try:
                if now - float(active_at) > Config.SESSION_ACTIVITY_GRACE_SECONDS:
                    closed_at = float(active_at)
                    await update_session_data(
                        request,
                        {
                            "db_config_last_closed_at": closed_at,
                        },
                    )
            except (TypeError, ValueError):
                pass

        if closed_at is not None:
            if not persistence_minutes or persistence_minutes <= 0:
                await _expire_db_config(request, db_config, "tab_closed_no_persistence")
                return None

            if now - float(closed_at) > (persistence_minutes * 60):
                await _expire_db_config(request, db_config, "tab_closed_expired")
                return None

            await update_session_data(
                request,
                {
                    "db_config_last_closed_at": None,
                    "db_config_last_used_at": now,
                    "session_active_at": now,
                },
            )
        else:
            await update_session_data(
                request,
                {
                    "db_config_last_used_at": now,
                    "session_active_at": now,
                },
            )

        request.state.db_config = db_config
        return db_config

    return None


async def require_db_config(db_config: Optional[dict] = Depends(get_db_config)) -> dict:
    """
    Like get_db_config but raises exception if not configured.
    Use for routes that require a database connection.
    """
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No database configured. Please connect to a database first.",
        )
    return db_config


async def update_session_data(request: Request, updates: dict, expire_seconds: int | None = None) -> bool:
    """Update per-Firebase-session application state (atomic read-merge-write).

    Always refreshes ``session_active_at`` so :func:`get_db_config` can use
    it as a heartbeat to detect closed tabs.

    Args:
        request: Inbound FastAPI request.
        updates: Partial dict to merge into the existing session state.
        expire_seconds: Optional TTL override. Defaults to
            ``Config.SESSION_EXPIRE_SECONDS``.

    Returns:
        True if the state was updated, False if no Firebase session cookie
        exists (i.e. the caller is not authenticated).
    """
    key = _state_key_from_cookie(request)
    if not key:
        return False

    expire_seconds = expire_seconds or Config.SESSION_EXPIRE_SECONDS
    merged_updates = dict(updates)
    merged_updates["session_active_at"] = time.time()
    await _merge_state(key, merged_updates, expire_seconds)
    return True


async def replace_session_data_for_cookie(session_cookie: str, data: dict, expire_seconds: int | None = None) -> None:
    """Write application state for a freshly issued Firebase session cookie."""
    expire_seconds = expire_seconds or Config.SESSION_EXPIRE_SECONDS
    session_data = dict(data)
    session_data["session_active_at"] = time.time()
    await _write_state(state_key_from_session_cookie(session_cookie), session_data, expire_seconds)


async def clear_session_state(request: Request) -> bool:
    """
    Clear per-Firebase-session application state.
    """
    key = _state_key_from_cookie(request)
    if not key:
        return False

    await _delete_state(key)
    return True
