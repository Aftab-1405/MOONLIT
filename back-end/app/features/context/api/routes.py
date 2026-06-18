# File: api/routes/context.py
"""User context and settings related API routes."""

import logging
import time
import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app.core.dependencies import (
    get_current_user,
    require_db_config,
    get_session_data,
    update_session_data,
    _expire_db_config,
)
from app.features.context.schemas.request_schemas import (
    SaveUserSettingsRequest,
    CloseSessionRequest,
    SessionActiveRequest,
)
from app.features.context.infrastructure.context_repository import ContextRepository
from app.features.user_settings.application.user_settings_service import UserSettingsService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["context"])


def _user_id(user: dict) -> str:
    return user.get("uid") or user


def _parse_cache_time(cached_at):
    if hasattr(cached_at, "timestamp"):
        return datetime.fromtimestamp(cached_at.timestamp(), tz=timezone.utc)
    if hasattr(cached_at, "isoformat"):
        return cached_at
    return datetime.fromisoformat(str(cached_at).replace("Z", "+00:00"))


def _build_context_metrics_payload(context: dict) -> dict:
    from app.core.config import get_config

    config = get_config()
    telemetry = context.get("metrics_telemetry", {})
    hits = telemetry.get("hits", 0)
    misses = telemetry.get("misses", 0)
    stores = telemetry.get("stores", 0)
    clears = telemetry.get("clears", 0)
    total = hits + misses
    hit_rate = (hits / total * 100) if total > 0 else 0.0

    ttl_remaining = None
    active_table_count = 0
    connected_database = None
    connection = context.get("current_connection", {})

    if connection.get("connected"):
        connected_database = connection.get("database")
        if connected_database:
            schemas = context.get("database_schemas", {})
            cached = schemas.get(connected_database)
            if cached:
                active_table_count = len(cached.get("tables", []))
                cached_at = cached.get("cached_at")
                if cached_at:
                    try:
                        cache_time = _parse_cache_time(cached_at)
                        now = (
                            datetime.now(cache_time.tzinfo)
                            if cache_time.tzinfo
                            else datetime.now()
                        )
                        age_seconds = (now - cache_time).total_seconds()
                        ttl_remaining = max(
                            0,
                            int(config.SCHEMA_CONTEXT_TTL_SECONDS - age_seconds),
                        )
                    except Exception:
                        pass

    return {
        "hits": hits,
        "misses": misses,
        "stores": stores,
        "clears": clears,
        "total_lookups": total,
        "hit_rate_percent": round(hit_rate, 2),
        "metrics_enabled": config.CONTEXT_METRICS_ENABLED,
        "config": {
            "schema_context_ttl_seconds": config.SCHEMA_CONTEXT_TTL_SECONDS,
            "schema_context_max_tables": config.SCHEMA_CONTEXT_MAX_TABLES,
            "connection_context_ttl_seconds": config.CONNECTION_CONTEXT_TTL_SECONDS,
            "ttl_remaining": ttl_remaining,
            "active_table_count": active_table_count,
            "connected_database": connected_database,
            "remaining_tables": max(
                0, config.SCHEMA_CONTEXT_MAX_TABLES - active_table_count
            ),
        },
    }


async def _sync_persistence_to_session(request: Request, prefs: dict) -> None:
    minutes = UserSettingsService.connection_persistence_minutes(prefs)
    await update_session_data(
        request, {"connectionPersistenceMinutes": minutes}
    )


async def _resolve_connection_persistence_minutes(
    request: Request,
    user: dict,
    explicit: int | None = None,
) -> int:
    if explicit is not None:
        return int(explicit)

    session = await get_session_data(request) or {}
    session_value = session.get("connectionPersistenceMinutes")
    if session_value is not None:
        try:
            return int(session_value)
        except (TypeError, ValueError):
            pass

    prefs = await run_in_threadpool(
        UserSettingsService.get_merged, _user_id(user)
    )
    return UserSettingsService.connection_persistence_minutes(prefs)


# =============================================================================
# USER CONTEXT ROUTES
# =============================================================================


@router.get("/user/context")
async def get_user_context(user: dict = Depends(get_current_user)):
    """Get full user context including connection state and cached schemas."""
    from app.features.context.application.context_service import ContextService

    user_id = user.get("uid") or user
    context = await run_in_threadpool(ContextService.get_full_context, user_id)

    # Convert schemas dict to array for frontend
    schemas_dict = context.get("schemas", {})
    schemas_list = []
    for db_name, schema_data in schemas_dict.items():
        schemas_list.append(
            {
                "database": db_name,
                "tables": schema_data.get("tables", []),
                "columns": schema_data.get("columns", {}),
                "cached_at": schema_data.get("cached_at"),
            }
        )

    return {
        "status": "success",
        "connection": context.get("connection", {"connected": False}),
        "schemas": schemas_list,
        "recent_queries": context.get("recent_queries", []),
    }


@router.post("/user/context/refresh")
async def refresh_user_context(
    db_config: dict = Depends(require_db_config), user: dict = Depends(get_current_user)
):
    """Refresh schema cache for current database."""
    from app.features.context.application.context_service import ContextService
    from app.features.database.tools.db_tool_executors import AIToolExecutor

    user_id = user.get("uid") or user
    database = db_config.get("database")
    db_type = db_config.get("db_type", "postgresql")

    # Use AIToolExecutor's batch fetch which includes primary key info
    tables, columns = await run_in_threadpool(
        AIToolExecutor._fetch_tables_and_columns, db_config, db_type, database
    )

    # Store schema as AI context
    await run_in_threadpool(
        ContextService.store_schema_context, user_id, database, tables, columns
    )

    return {"status": "success", "tables": len(tables)}


@router.delete("/user/context/schema/{database}")
async def delete_schema_context(database: str, user: dict = Depends(get_current_user)):
    """Delete stored schema context for a specific database."""
    from app.features.context.application.context_service import ContextService

    user_id = user.get("uid") or user
    success = await run_in_threadpool(
        ContextService.clear_schema_context, user_id, database
    )

    if success:
        return {
            "status": "success",
            "message": f"Schema context for {database} cleared",
        }
    return {"status": "error", "message": "Failed to clear schema context"}


@router.delete("/user/context/schemas")
async def delete_all_schema_contexts(user: dict = Depends(get_current_user)):
    """Delete all stored schema contexts for user."""
    from app.features.context.application.context_service import ContextService

    user_id = user.get("uid") or user
    # Get all schemas first
    context = await run_in_threadpool(ContextService.get_full_context, user_id)
    schemas = context.get("schemas", {})

    # Delete each schema context
    for db_name in schemas.keys():
        await run_in_threadpool(ContextService.clear_schema_context, user_id, db_name)

    return {"status": "success", "message": f"Cleared {len(schemas)} schema contexts"}


@router.delete("/user/context/queries")
async def clear_query_history(user: dict = Depends(get_current_user)):
    """Clear query history for user."""
    from app.features.context.application.context_service import ContextService

    user_id = user.get("uid") or user
    success = await run_in_threadpool(ContextService.clear_query_history, user_id)

    if success:
        return {"status": "success", "message": "Query history cleared"}
    return {"status": "error", "message": "Failed to clear query history"}


# =============================================================================
# CONTEXT METRICS ROUTES
# =============================================================================


@router.get("/context/metrics")
async def get_context_metrics(user: dict = Depends(get_current_user)):
    """
    Get context hit/miss metrics for monitoring effectiveness.

    Returns:
        - hits: Number of times context was found and fresh
        - misses: Number of times context was stale or not found
        - stores: Number of context store operations
        - clears: Number of context clear operations
        - hit_rate_percent: Hit rate percentage
        - metrics_enabled: Whether metrics tracking is enabled
    """
    from app.features.context.application.context_service import ContextService

    def build_metrics_payload(user_id: str):
        context = ContextService._get_context(user_id)
        return _build_context_metrics_payload(context)

    stats = await run_in_threadpool(build_metrics_payload, _user_id(user))
    return {"status": "success", "metrics": stats}


@router.get("/context/metrics/stream")
async def stream_context_metrics(
    request: Request, user: dict = Depends(get_current_user)
):
    """Stream per-user context metrics whenever the Firestore context document changes."""
    from app.features.context.infrastructure.context_repository import ContextRepository

    user_id = _user_id(user)

    async def event_stream():
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict | None] = asyncio.Queue(maxsize=20)

        def publish(payload: dict):
            def put_latest():
                if queue.full():
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                queue.put_nowait(payload)

            loop.call_soon_threadsafe(put_latest)

        def on_snapshot(doc_snapshot, _changes, _read_time):
            snapshot = doc_snapshot[0] if isinstance(doc_snapshot, list) else doc_snapshot
            context = snapshot.to_dict() if snapshot and snapshot.exists else {}
            publish(_build_context_metrics_payload(context))

        watch = await run_in_threadpool(
            lambda: ContextRepository.get_ref(user_id).on_snapshot(on_snapshot)
        )

        try:
            while not await request.is_disconnected():
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=25)
                    if payload is None:
                        break
                    yield f"event: metrics\ndata: {json.dumps(payload, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield "event: heartbeat\ndata: {}\n\n"
        finally:
            await run_in_threadpool(watch.unsubscribe)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/context/metrics/reset")
async def reset_context_metrics(user: dict = Depends(get_current_user)):
    """Reset context metrics counters (for testing/monitoring)."""
    from app.features.context.application.context_service import ContextMetrics
    from app.core.config import get_config

    config = get_config()
    if not config.DEBUG and not config.TESTING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Context metrics reset is disabled in this environment",
        )

    user_id = _user_id(user)
    ContextMetrics.reset(user_id)
    return {"status": "success", "message": "Context metrics reset"}


# =============================================================================
# USER SETTINGS ROUTES
# =============================================================================


@router.get("/user/settings")
async def get_user_settings(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Get per-user preferences (Firestore) and mirror persistence into the session."""
    uid = _user_id(user)
    prefs = await run_in_threadpool(UserSettingsService.get_merged, uid)

    session = await get_session_data(request) or {}
    doc = await run_in_threadpool(ContextRepository.get, uid)
    if not doc.get("preferences") and session.get("connectionPersistenceMinutes") is not None:
        try:
            legacy_minutes = int(session["connectionPersistenceMinutes"])
            prefs = await run_in_threadpool(
                UserSettingsService.save,
                uid,
                {"connectionPersistence": legacy_minutes},
            )
        except (TypeError, ValueError):
            pass

    await _sync_persistence_to_session(request, prefs)
    minutes = UserSettingsService.connection_persistence_minutes(prefs)
    return {
        "status": "success",
        "settings": prefs,
        "connectionPersistenceMinutes": minutes,
    }


@router.post("/user/settings")
async def save_user_settings(
    request: Request,
    data: SaveUserSettingsRequest,
    user: dict = Depends(get_current_user),
):
    """Save per-user preferences to Firestore and mirror persistence into the session."""
    patch = data.model_dump(exclude_unset=True)
    prefs = await run_in_threadpool(
        UserSettingsService.save, _user_id(user), patch
    )
    await _sync_persistence_to_session(request, prefs)

    persistence_minutes = UserSettingsService.connection_persistence_minutes(prefs)
    if (
        data.connectionPersistence is not None
        or data.connectionPersistenceMinutes is not None
    ):
        session = await get_session_data(request) or {}
        db_config = session.get("db_config")
        if db_config:
            closed_at = session.get("db_config_last_closed_at")
            if closed_at and persistence_minutes > 0:
                if time.time() - float(closed_at) > (
                    persistence_minutes * 60
                ):
                    await _expire_db_config(request, db_config, "settings_update")
            elif closed_at and persistence_minutes <= 0:
                await _expire_db_config(
                    request, db_config, "settings_update_no_persistence"
                )

    return {"status": "success", "settings": prefs}


@router.post("/user/session/close")
async def close_user_session(
    request: Request, data: CloseSessionRequest, user: dict = Depends(get_current_user)
):
    """Mark session as closed to enforce connection persistence window."""
    now = time.time()

    # Store the latest persistence setting in the session if provided
    if data.connectionPersistenceMinutes is not None:
        await update_session_data(
            request, {"connectionPersistenceMinutes": data.connectionPersistenceMinutes}
        )
    if data.sessionInstanceId:
        await update_session_data(
            request, {"session_instance_id": data.sessionInstanceId}
        )

    session = await get_session_data(request) or {}
    db_config = session.get("db_config")
    if not db_config:
        return {"status": "success"}

    persistence_minutes = await _resolve_connection_persistence_minutes(
        request, user, data.connectionPersistenceMinutes
    )

    if not persistence_minutes or persistence_minutes <= 0:
        await _expire_db_config(request, db_config, "tab_close_no_persistence")
        return {"status": "success"}

    # Mark closed time; reopened requests will enforce persistence window
    await update_session_data(
        request,
        {
            "db_config_last_closed_at": now,
        },
    )

    return {"status": "success"}


@router.post("/user/session/active")
async def mark_user_session_active(
    request: Request, data: SessionActiveRequest, user: dict = Depends(get_current_user)
):
    """Heartbeat to mark session as active."""
    session = await get_session_data(request) or {}
    incoming_id = data.sessionInstanceId
    stored_id = session.get("session_instance_id")
    db_config = session.get("db_config")

    # Ignore heartbeats without an instance id to avoid extending activity
    # for ambiguous clients/tabs.
    if not incoming_id:
        logger.warning("Ignoring session heartbeat without sessionInstanceId")
        return {"status": "success"}

    if incoming_id and stored_id and incoming_id != stored_id and db_config:
        # Treat as a new session instance (e.g., browser reopened)
        persistence_minutes = await _resolve_connection_persistence_minutes(
            request, user, None
        )
        last_active = session.get("session_active_at") or time.time()
        now = time.time()

        if persistence_minutes <= 0:
            await _expire_db_config(
                request, db_config, "session_instance_changed_no_persistence"
            )
        elif now - float(last_active) > (persistence_minutes * 60):
            await _expire_db_config(
                request, db_config, "session_instance_changed_expired"
            )
        else:
            await update_session_data(
                request,
                {
                    "db_config_last_closed_at": None,
                    "db_config_last_used_at": now,
                },
            )

    updates = {"session_instance_id": incoming_id}
    await update_session_data(request, updates)
    return {"status": "success"}
