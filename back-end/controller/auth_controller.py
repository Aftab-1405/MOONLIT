"""Authentication routes - FastAPI Router."""

import logging
import secrets
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from firebase_admin import auth
from pydantic import BaseModel, Field

from config import get_config
from dependencies import (
    clear_session_state,
    get_current_user_optional,
    get_session_data,
    replace_session_data_for_cookie,
    verify_csrf_token,
)

Config = get_config()
router = APIRouter(tags=["Authentication & Authorization"])
logger = logging.getLogger(__name__)


class SetSessionRequest(BaseModel):
    """Request body for /set_authenticated_user_session."""

    idToken: str = Field(..., min_length=1)


# Helper to generate a secure random CSRF token and set it in the client cookie jar.
def generate_and_set_csrf_cookie(response: Response) -> str:
    token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=Config.CSRF_COOKIE_NAME,
        value=token,
        httponly=False,
        secure=Config.SESSION_COOKIE_SECURE,
        samesite=Config.SESSION_COOKIE_SAMESITE,
        max_age=Config.SESSION_EXPIRE_SECONDS,
        path="/",
    )
    return token


def _delete_cookie(response: Response, name: str, *, httponly: bool) -> None:
    response.delete_cookie(
        key=name,
        path="/",
        secure=Config.SESSION_COOKIE_SECURE,
        httponly=httponly,
        samesite=Config.SESSION_COOKIE_SAMESITE,
    )


@router.post("/set_authenticated_user_session")
async def set_authenticated_user_session(request: Request, response: Response, data: SetSessionRequest):
    """
    Verify a Firebase ID token and establish a secure session cookie for the authenticated user.
    """
    verify_csrf_token(request)

    try:
        decoded_token = await run_in_threadpool(
            auth.verify_id_token,
            data.idToken,
            check_revoked=Config.FIREBASE_SESSION_CHECK_REVOKED,
        )
        expires_in = timedelta(seconds=Config.SESSION_EXPIRE_SECONDS)
        session_cookie = await run_in_threadpool(
            auth.create_session_cookie,
            data.idToken,
            expires_in=expires_in,
        )

        existing_user = await get_current_user_optional(request)
        existing_state = {}
        if existing_user and existing_user.get("uid") == decoded_token["uid"]:
            existing_state = await get_session_data(request) or {}

        response.set_cookie(
            key=Config.SESSION_COOKIE_NAME,
            value=session_cookie,
            httponly=Config.SESSION_COOKIE_HTTPONLY,
            secure=Config.SESSION_COOKIE_SECURE,
            samesite=Config.SESSION_COOKIE_SAMESITE,
            max_age=Config.SESSION_EXPIRE_SECONDS,
            path="/",
        )

        user_data = {
            "uid": decoded_token["uid"],
            "email": decoded_token.get("email"),
            "name": decoded_token.get("name"),
            "picture": decoded_token.get("picture"),
            "verified": bool(decoded_token.get("email_verified", True)),
        }
        request.state.user = user_data

        if existing_state:
            await replace_session_data_for_cookie(session_cookie, existing_state)

        logger.info("Firebase session established for user: %s", decoded_token["uid"])
        return {"status": "success", "user": user_data}

    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )


@router.get("/check_authenticated_user_session")
async def check_authenticated_user_session(request: Request):
    """
    Validate whether the client request contains a valid, active session cookie.
    If authenticated, returns status and user profile data.
    """
    user = await get_current_user_optional(request)
    if user:
        return {"status": "session_active", "user": user}
    return {"status": "no_session"}


@router.post("/logout_authenticated_user_session")
async def logout_authenticated_user_session(request: Request, response: Response):
    """
    Terminates the active session. This deletes the secure session cookie on the client side
    and completely cleans up all server-side temporary resources (like database connections, etc.).
    """
    verify_csrf_token(request)
    await clear_session_state(request)

    _delete_cookie(response, Config.SESSION_COOKIE_NAME, httponly=True)

    logger.debug("User session cleared on /logout_authenticated_user_session")
    return {"status": "success", "message": "Logged out successfully"}


@router.get("/firebase-config-and-csrf-token")
async def get_firebase_config_and_csrf_token(response: Response):
    """Serve Firebase web client configuration and issue a CSRF token."""
    try:
        config = Config.get_firebase_web_config()
        csrf_token = generate_and_set_csrf_cookie(response)
        return {"status": "success", "config": config, "csrfToken": csrf_token}
    except Exception as e:
        logger.error(f"Error getting Firebase config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve Firebase configuration",
        )
