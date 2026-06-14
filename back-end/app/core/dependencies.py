"""
FastAPI dependencies for authentication and per-session application state.

Authentication is backed by Firebase Admin session cookies. Redis stores only
application state tied to the current Firebase session cookie, such as database
connection metadata.
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

from app.core.config import get_config

logger = logging.getLogger(__name__)
Config = get_config()

_memory_state: dict[str, tuple[dict, float]] = {}


async def get_redis():
    """Get Redis client from application state."""
    from app.main import get_redis_client

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


def verify_csrf(request: Request) -> None:
    """Validate the double-submit CSRF token for cookie-authenticated writes."""
    cookie_token = request.cookies.get(Config.CSRF_COOKIE_NAME)
    header_token = request.headers.get(Config.CSRF_HEADER_NAME)

    if not cookie_token or not header_token or cookie_token != header_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid CSRF token",
        )


async def _read_state(key: str) -> Optional[dict]:
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


async def _write_state(key: str, data: dict, expire_seconds: int) -> None:
    redis_client = await get_redis()
    if redis_client:
        await redis_client.set(key, json.dumps(data), ex=expire_seconds)
        return

    _memory_state[key] = (dict(data), time.time() + expire_seconds)


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
        from app.features.database.application.database_service import DatabaseService

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
        HTTPException 401 if not authenticated
    """
    session_cookie = request.cookies.get(Config.SESSION_COOKIE_NAME)
    if session_cookie:
        try:
            user = await run_in_threadpool(verify_session_cookie_value, session_cookie)
            request.state.user = user
            request.state.session_state_key = _state_key_from_cookie(request)
            logger.debug(f"Firebase session auth for user: {user.get('uid')}")
            return user
        except Exception as e:
            logger.debug(f"Invalid Firebase session cookie: {e}")

    if Config.DEBUG and Config.DEV_AUTH_BYPASS:
        user = {
            "uid": Config.DEV_AUTH_USER_ID,
            "email": Config.DEV_AUTH_EMAIL,
            "name": "Local Dev",
            "verified": True,
        }
        request.state.user = user
        logger.debug("Development auth bypass for user: %s", user["uid"])
        return user

    print(f"\n[DEBUG] get_current_user: Config={Config}, id(Config)={id(Config)}, DEBUG={Config.DEBUG}, DEV_AUTH_BYPASS={Config.DEV_AUTH_BYPASS}, APP_ENV={Config.APP_ENV}\n")

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
    )


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


async def update_session_data(
    request: Request, updates: dict, expire_seconds: int | None = None
) -> bool:
    """
    Update per-Firebase-session application state.

    Returns:
        True if updated, False if no Firebase session cookie exists
    """
    key = _state_key_from_cookie(request)
    if not key:
        return False

    expire_seconds = expire_seconds or Config.SESSION_EXPIRE_SECONDS
    session_data = await get_session_data(request) or {}
    session_data.update(updates)
    session_data["session_active_at"] = time.time()

    await _write_state(key, session_data, expire_seconds)
    return True


async def replace_session_data_for_cookie(
    session_cookie: str, data: dict, expire_seconds: int | None = None
) -> None:
    """Write application state for a freshly issued Firebase session cookie."""
    expire_seconds = expire_seconds or Config.SESSION_EXPIRE_SECONDS
    session_data = dict(data)
    session_data["session_active_at"] = time.time()
    await _write_state(
        state_key_from_session_cookie(session_cookie), session_data, expire_seconds
    )


async def clear_session_state(request: Request) -> bool:
    """
    Clear per-Firebase-session application state.
    """
    key = _state_key_from_cookie(request)
    if not key:
        return False

    await _delete_state(key)
    return True
