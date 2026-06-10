# File: api/routes/database.py
"""Database connection and query related API routes."""

import logging
import time
from typing import Any, Optional

from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from dependencies import (
    get_current_user,
    get_db_config,
    require_db_config,
    update_session_data,
)
from services.connection_service import ConnectionService
from services.database_service import DatabaseService
from api.request_schemas import RunQueryRequest, SwitchDatabaseRequest, ConnectDBRequest
from api.schemas.common import COMMON_ERROR_RESPONSES, ApiSuccess
from api.schemas.database import (
    ConnectDatabaseData,
    DatabaseConfigPublic,
    DatabaseStatusData,
    DisconnectDatabaseData,
    DatabaseListData,
    DatabaseSelectionData,
)
from api.schemas.query import QueryResultData, RunSqlQueryData

logger = logging.getLogger(__name__)
router = APIRouter(tags=["database"])


def _raise_service_error(result: dict, status_code: int = 400) -> None:
    if result.get("status") == "error":
        raise HTTPException(
            status_code=status_code,
            detail={
                "error": "database_operation_failed",
                "message": result.get("message") or "Database operation failed.",
            },
        )


def _public_db_config(raw_config: dict | None, fallback_db_type: str | None = None):
    if not raw_config and not fallback_db_type:
        return None

    raw_config = raw_config or {}
    db_type = raw_config.get("db_type") or fallback_db_type
    if not db_type:
        return None

    return DatabaseConfigPublic(
        db_type=db_type,
        database=raw_config.get("database"),
        host=raw_config.get("host"),
        port=raw_config.get("port"),
        username=raw_config.get("username") or raw_config.get("user"),
        is_remote=bool(raw_config.get("is_remote") or raw_config.get("connection_string")),
        schema_name=raw_config.get("schema"),
        service_name=raw_config.get("service_name"),
    )


def _selected_database(result: dict, db_config: DatabaseConfigPublic | None = None):
    return (
        result.get("selected_database")
        or result.get("selectedDatabase")
        or (db_config.database if db_config else None)
    )


async def _schema_metadata_for_config(raw_config: dict | None) -> dict[str, Any]:
    if not raw_config or raw_config.get("db_type") != "postgresql":
        return {"schemas": [], "current_schema": None}

    try:
        result = await run_in_threadpool(DatabaseService.get_schemas, raw_config)
        if result.get("status") == "success":
            return {
                "schemas": result.get("schemas") or [],
                "current_schema": result.get("current_schema") or raw_config.get("schema", "public"),
            }
    except Exception as e:
        logger.warning(f"Failed to fetch schemas for connection metadata: {e}")

    return {
        "schemas": [],
        "current_schema": raw_config.get("schema", "public"),
    }


def _schema_metadata_from_result(
    result: dict,
    db_config: DatabaseConfigPublic,
    schema_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metadata = schema_metadata or {}
    return {
        "schemas": metadata.get("schemas") or result.get("schemas") or [],
        "current_schema": (
            metadata.get("current_schema")
            or result.get("current_schema")
            or result.get("schema")
            or db_config.schema_name
        ),
    }


def _normalize_connect_response(
    result: dict,
    schema_metadata: dict[str, Any] | None = None,
) -> ConnectDatabaseData:
    db_config = _public_db_config(result.get("db_config"), result.get("db_type"))
    if not db_config:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "invalid_database_response",
                "message": "Database connection response did not include db_config.",
            },
        )

    normalized_schema_metadata = _schema_metadata_from_result(
        result,
        db_config,
        schema_metadata,
    )
    return ConnectDatabaseData(
        db_config=db_config,
        db_type=db_config.db_type,
        selected_database=_selected_database(result, db_config),
        schemas=normalized_schema_metadata["schemas"],
        current_schema=normalized_schema_metadata["current_schema"],
        databases=result.get("databases") or [],
        tables=result.get("tables") or [],
        is_remote=db_config.is_remote,
    )


def _normalize_database_list_response(result: dict) -> DatabaseListData:
    return DatabaseListData(
        databases=result.get("databases") or [],
        db_type=result.get("db_type"),
        is_remote=bool(result.get("is_remote")),
    )


def _normalize_database_selection_response(
    result: dict,
    requested_database: str,
    schema_metadata: dict[str, Any] | None = None,
) -> DatabaseSelectionData:
    db_config = _public_db_config(result.get("db_config"))
    if not db_config:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "invalid_database_response",
                "message": "Database selection response did not include db_config.",
            },
        )

    selected_database = _selected_database(result, db_config) or requested_database
    normalized_schema_metadata = _schema_metadata_from_result(
        result,
        db_config,
        schema_metadata,
    )
    return DatabaseSelectionData(
        db_config=db_config,
        selected_database=selected_database,
        tables=result.get("tables") or [],
        db_type=db_config.db_type,
        is_remote=db_config.is_remote,
        schemas=normalized_schema_metadata["schemas"],
        current_schema=normalized_schema_metadata["current_schema"],
    )


def _normalize_rows(rows: list[Any]) -> list[list[Any]]:
    normalized = []
    for row in rows:
        if isinstance(row, list):
            normalized.append(row)
        elif isinstance(row, tuple):
            normalized.append(list(row))
        else:
            normalized.append([row])
    return normalized


def _normalize_query_response(result: dict) -> RunSqlQueryData:
    result_payload = result.get("result") or {}
    columns = result_payload.get("columns") or result_payload.get("fields") or []
    rows = _normalize_rows(result_payload.get("rows") or [])
    query_type = result.get("query_type") or "SELECT"
    if query_type not in {"SELECT", "WITH"}:
        query_type = "OTHER"

    return RunSqlQueryData(
        result=QueryResultData(columns=columns, rows=rows),
        row_count=result.get("row_count", len(rows)),
        total_rows=result.get("total_rows"),
        truncated=bool(result.get("truncated", False)),
        execution_time_ms=result.get("execution_time_ms", 0),
        query_type=query_type,
    )


# =============================================================================
# DATABASE CONNECTION ROUTES
# =============================================================================


@router.post(
    "/connect_db",
    response_model=ApiSuccess[ConnectDatabaseData],
    responses=COMMON_ERROR_RESPONSES,
)
async def connect_db(
    request: Request, data: ConnectDBRequest, user: dict = Depends(get_current_user)
):
    """Connect to a remote database via connection string or host/port credentials."""
    user_id = user.get("uid") or user

    # Log connection request without sensitive fields
    safe_log_data = {
        k: v
        for k, v in data.model_dump().items()
        if k not in ("password", "connection_string")
    }
    logger.info(f"Connect request data: {safe_log_data}")

    result = await run_in_threadpool(
        ConnectionService.connect_database, data.model_dump(), user_id
    )

    # Store db_config in session if connection successful
    if result.get("status") in ["connected", "success"] and "db_config" in result:
        await update_session_data(
            request,
            {
                "db_config": result["db_config"],
                "db_config_last_used_at": time.time(),
                "db_config_last_closed_at": None,
            },
        )

    if result.get("status") == "error":
        logger.error(f"Connection failed: {result.get('message')}")
        _raise_service_error(result)

    schema_metadata = await _schema_metadata_for_config(result.get("db_config"))
    return ApiSuccess(
        data=_normalize_connect_response(result, schema_metadata),
        message=result.get("message"),
    )


@router.post(
    "/disconnect_db",
    response_model=ApiSuccess[DisconnectDatabaseData],
    responses=COMMON_ERROR_RESPONSES,
)
async def disconnect_db(
    request: Request,
    db_config: Optional[dict] = Depends(get_db_config),
    user: dict = Depends(get_current_user),
):
    """Disconnect from the current database."""
    user_id = user.get("uid") or user

    result = await run_in_threadpool(DatabaseService.disconnect, db_config, user_id)

    # Clear db_config from session
    await update_session_data(
        request,
        {
            "db_config": None,
            "db_config_last_used_at": None,
            "db_config_last_closed_at": None,
        },
    )

    if result.get("status") == "error":
        _raise_service_error(result, status_code=500)

    return ApiSuccess(
        data=DisconnectDatabaseData(disconnected=True),
        message="Database disconnected successfully",
    )


@router.get(
    "/db_status",
    response_model=ApiSuccess[DatabaseStatusData],
    responses=COMMON_ERROR_RESPONSES,
)
async def db_status(db_config: Optional[dict] = Depends(get_db_config)):
    """Get current database connection status.

    Returns all state needed by frontend DatabaseContext:
    - connected: boolean connection status
    - current_database: currently selected database name
    - db_type: database type (mysql, postgresql, sqlserver, oracle)
    - is_remote: whether using connection string
    - databases: list of available databases for switching
    """
    if not db_config:
        return ApiSuccess(
            data=DatabaseStatusData(
                connected=False,
                db_type=None,
                current_database=None,
                is_remote=False,
                databases=[],
                schemas=[],
                current_schema=None,
            ),
            message=None,
        )

    # Fetch available databases for the switcher chip
    databases = []
    schema_metadata = await _schema_metadata_for_config(db_config)
    try:
        result = await run_in_threadpool(DatabaseService.get_databases, db_config)
        if result.get("status") == "success":
            databases = result.get("databases", [])
    except Exception as e:
        logger.warning(f"Failed to fetch databases for status: {e}")

    return ApiSuccess(
        data=DatabaseStatusData(
            connected=True,
            db_type=db_config.get("db_type"),
            current_database=db_config.get("database"),
            is_remote=db_config.get("is_remote", False),
            databases=databases,
            schemas=schema_metadata["schemas"],
            current_schema=schema_metadata["current_schema"],
        ),
        message=None,
    )


@router.get(
    "/get_databases",
    response_model=ApiSuccess[DatabaseListData],
    responses=COMMON_ERROR_RESPONSES,
)
async def get_databases_route(db_config: dict = Depends(require_db_config)):
    """Get list of available databases."""
    result = await run_in_threadpool(DatabaseService.get_databases, db_config)
    _raise_service_error(result)
    return ApiSuccess(data=_normalize_database_list_response(result))


@router.post(
    "/switch_remote_database",
    response_model=ApiSuccess[DatabaseSelectionData],
    responses=COMMON_ERROR_RESPONSES,
)
async def switch_remote_database(
    request: Request,
    data: SwitchDatabaseRequest,
    db_config: dict = Depends(require_db_config),
    user: dict = Depends(get_current_user),
):
    """Switch to a different database on remote server."""
    user_id = user.get("uid") or user

    result = await run_in_threadpool(
        DatabaseService.switch_remote_database, db_config, data.database, user_id
    )

    # Update session with new db_config
    if result.get("status") == "success" and "db_config" in result:
        await update_session_data(
            request,
            {
                "db_config": result["db_config"],
                "db_config_last_used_at": time.time(),
                "db_config_last_closed_at": None,
            },
        )

    _raise_service_error(result)
    schema_metadata = await _schema_metadata_for_config(result.get("db_config"))
    return ApiSuccess(
        data=_normalize_database_selection_response(result, data.database, schema_metadata),
        message=result.get("message"),
    )


@router.post(
    "/select_database",
    response_model=ApiSuccess[DatabaseSelectionData],
    responses=COMMON_ERROR_RESPONSES,
)
async def select_database(
    request: Request,
    data: SwitchDatabaseRequest,
    db_config: dict = Depends(require_db_config),
    user: dict = Depends(get_current_user),
):
    """Select a database on existing connection."""
    user_id = user.get("uid") or user

    result = await run_in_threadpool(
        ConnectionService.select_database, db_config, data.database, user_id
    )

    if result.get("status") in ["connected", "success"] and "db_config" in result:
        await update_session_data(
            request,
            {
                "db_config": result["db_config"],
                "db_config_last_used_at": time.time(),
                "db_config_last_closed_at": None,
            },
        )

    _raise_service_error(result)
    schema_metadata = await _schema_metadata_for_config(result.get("db_config"))
    return ApiSuccess(
        data=_normalize_database_selection_response(result, data.database, schema_metadata),
        message=result.get("message"),
    )


# =============================================================================
# QUERY ROUTES
# =============================================================================


@router.post(
    "/run_sql_query",
    response_model=ApiSuccess[RunSqlQueryData],
    responses=COMMON_ERROR_RESPONSES,
)
async def run_sql_query(
    data: RunQueryRequest,
    db_config: dict = Depends(require_db_config),
    user: dict = Depends(get_current_user),
):
    """Execute a SQL query."""
    from config import Config

    user_id = user.get("uid") or user
    sql_query = data.sql_query
    max_rows = data.max_rows or Config.MAX_QUERY_RESULTS
    timeout = data.timeout

    result = await run_in_threadpool(
        DatabaseService.execute_query,
        db_config,
        sql_query,
        user_id,
        max_rows=max_rows,
        timeout=timeout,
    )
    _raise_service_error(result)
    return ApiSuccess(
        data=_normalize_query_response(result),
        message=result.get("message"),
    )
