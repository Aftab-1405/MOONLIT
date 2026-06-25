"""
LangGraph tool wrappers — ``@tool``-decorated functions that the agent calls.

Each tool:
  1. Receives its args (visible to LLM) + ``config: RunnableConfig`` (injected).
  2. Validates args via Pydantic schemas.
  3. Checks the per-conversation tool cache.
  4. Calls the matching ``AIToolExecutor._get_*()`` method directly (no dispatcher).
  5. Emits ``tool_start`` / ``tool_end`` SSE events via ``get_stream_writer()``.
  6. Returns the token-efficient LLM summary (``summarize_for_llm``).
"""

import json
import logging
import threading
from typing import Optional

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.types import interrupt

from langgraph_orchestration.tool_executor import ToolExecutor
from service.database.ai_tool_executor import AIToolExecutor as DBTools

logger = logging.getLogger(__name__)

_TAVILY_LOCK = threading.Lock()

# Tools whose results can be cached within a single conversation turn set.
CACHEABLE_TOOLS = {
    "get_connection_status",
    "get_database_list",
    "get_table_indexes",
    "get_schema_overview",
}


# ── internal helpers ─────────────────────────────────────────────────


def _cfg(config: RunnableConfig) -> dict:
    """Shortcut to ``config["configurable"]``."""
    return config.get("configurable", {})


def _try_writer():
    """Return the LangGraph stream writer, or a no-op if unavailable."""
    try:
        from langgraph.config import get_stream_writer

        return get_stream_writer()
    except Exception:
        return lambda _data: None


def _effective_max_rows(user_max_rows):
    """Return user's max_rows setting, or the server-configured cap if unset."""
    if user_max_rows is not None:
        return user_max_rows
    from config import get_config

    Config = get_config()

    return Config.MAX_QUERY_RESULTS


def _with_ui_metadata(
    tool_name: str,
    payload: dict | None = None,
    *,
    title: str | None = None,
    message: str | None = None,
    intent: str = "guide",
    severity: str = "info",
    requires_confirmation: bool = False,
) -> dict:
    """Attach the shared guided-copilot metadata every UI action may use."""
    base = dict(payload or {})
    metadata = {
        "title": title,
        "message": message,
        "intent": intent,
        "severity": severity,
        "requiresConfirmation": requires_confirmation,
        "sourceTool": tool_name,
    }
    for key, value in metadata.items():
        if value is not None and (key != "requiresConfirmation" or value):
            base[key] = value
    return base


def _emit_ui_action_tool(
    tool_name: str,
    raw_args: dict,
    payload: dict | None,
    summary: str,
    *,
    title: str | None = None,
    message: str | None = None,
    intent: str = "guide",
    severity: str = "info",
    requires_confirmation: bool = False,
) -> str:
    try:
        validated = ToolExecutor.validate_and_parse_args(tool_name, raw_args)
    except ValueError as e:
        # Prevent crash, return error to LLM
        return f"Tool Argument Validation Error: {str(e)}. Please correct your arguments and try again."
    writer = _try_writer()
    enriched_payload = _with_ui_metadata(
        tool_name,
        payload,
        title=title,
        message=message,
        intent=intent,
        severity=severity,
        requires_confirmation=requires_confirmation,
    )
    result = {"success": True, "action": tool_name}
    if requires_confirmation:
        result["requiresConfirmation"] = True

    writer({"type": "tool_start", "name": tool_name, "args": validated})
    writer({"type": "ui_action", "action": tool_name, "payload": enriched_payload})
    writer({"type": "tool_end", "name": tool_name, "args": validated, "result": result})
    return summary


def _is_user_approved(decision) -> bool:
    """Normalize a human-in-the-loop resume payload into a boolean approval."""
    if isinstance(decision, bool):
        return decision
    if isinstance(decision, dict):
        return bool(decision.get("approved") or decision.get("confirmed"))
    return False


def _guided_interrupt_payload(
    tool_name: str,
    payload: dict | None = None,
    *,
    title: str,
    message: str,
    confirm_text: str = "Confirm",
    cancel_text: str = "Not now",
    intent: str = "confirm",
    severity: str = "warning",
) -> dict:
    return _with_ui_metadata(
        tool_name,
        {
            **(payload or {}),
            "action": tool_name,
            "confirmText": confirm_text,
            "cancelText": cancel_text,
        },
        title=title,
        message=message,
        intent=intent,
        severity=severity,
        requires_confirmation=True,
    )


def _execute_tool(
    tool_name: str,
    raw_args: dict,
    config: RunnableConfig,
    executor_fn,
) -> str:
    """
    Shared execution pipeline used by every tool function.

    ``executor_fn(validated, user_id, db_config, max_rows) -> dict``
    is a callable that performs the actual DB work for each specific tool.

    Returns the LLM-efficient summary string (becomes ``ToolMessage.content``).
    """
    cfg = _cfg(config)
    writer = _try_writer()

    # 1. Validate with Pydantic schemas
    try:
        validated = ToolExecutor.validate_and_parse_args(tool_name, raw_args)
    except ValueError as e:
        return f"Tool Argument Validation Error: {str(e)}. Please correct your arguments and try again."

    # 2. Display args (show effective max_rows for execute_query)
    display_args = dict(validated)
    if tool_name == "execute_query":
        user_max_rows = cfg.get("max_rows")
        if user_max_rows is not None:
            display_args["max_rows"] = user_max_rows
        else:
            from config import get_config

            Config = get_config()

            display_args["max_rows"] = (
                f"No Limit (server max: {Config.MAX_QUERY_RESULTS})"
            )

    # 3. Emit tool_start
    writer({"type": "tool_start", "name": tool_name, "args": display_args})

    # 4. Cache check
    cache = cfg.get("tool_cache", {})
    cache_key = None
    if tool_name in CACHEABLE_TOOLS:
        cache_args = dict(validated)
        cache_key = f"{tool_name}:{json.dumps(cache_args, sort_keys=True)}"

    if cache_key and cache_key in cache:
        logger.info(f"Cache hit for {tool_name}")
        parsed = cache[cache_key]
    else:
        # 5. Execute directly — no dispatcher
        parsed = executor_fn(
            validated,
            cfg.get("user_id", ""),
            cfg.get("db_config"),
            cfg.get("max_rows"),
        )
        if cache_key:
            cache[cache_key] = parsed
            logger.info(f"Cached result for {tool_name}")

    # 6. Dual summarization
    ui_result, llm_summary = ToolExecutor.summarize(tool_name, parsed)

    # 7. Emit tool_end with full UI data
    writer(
        {
            "type": "tool_end",
            "name": tool_name,
            "args": display_args,
            "result": ui_result,
        }
    )

    # 8. Return LLM summary (becomes ToolMessage.content)
    return llm_summary


# ── tool definitions ─────────────────────────────────────────────────


@tool
def get_connection_status(*, config: RunnableConfig) -> str:
    """Check if user is connected to a database and get connection details like database type, name, host, and whether it's a remote connection."""
    return _execute_tool(
        "get_connection_status",
        {},
        config,
        lambda v, uid, db_cfg, mx: DBTools._get_connection_status(uid),
    )


@tool
def get_database_list(*, config: RunnableConfig) -> str:
    """Get list of all databases available on the connected server."""
    return _execute_tool(
        "get_database_list",
        {},
        config,
        lambda v, uid, db_cfg, mx: DBTools._get_database_list(uid, db_config=db_cfg),
    )


@tool
def execute_query(
    query: str,
    max_rows: int = 100,
    *,
    config: RunnableConfig,
) -> str:
    """Execute a read-only SQL query. Only SELECT/WITH queries are allowed for safety."""
    tool_name = "execute_query"
    raw_args = {"query": query, "max_rows": max_rows}

    return _execute_tool(
        tool_name,
        raw_args,
        config,
        lambda v, uid, db_cfg, mx: DBTools._execute_query(
            uid, v["query"], _effective_max_rows(mx), db_config=db_cfg
        ),
    )


@tool
def get_table_indexes(
    table_name: str,
    *,
    config: RunnableConfig,
) -> str:
    """Get all indexes defined on a specific table, including index name, columns, uniqueness, and whether it's a primary key index."""
    return _execute_tool(
        "get_table_indexes",
        {"table_name": table_name, },
        config,
        lambda v, uid, db_cfg, mx: DBTools._get_table_indexes(
            uid, v["table_name"], db_config=db_cfg
        ),
    )


@tool
def get_schema_overview(
    target_tables: Optional[list[str]] = None,
    *,
    config: RunnableConfig,
) -> str:
    """Get an overview of the database schema including tables, columns, and foreign keys in a single call. Use this instead of making multiple calls to get_table_columns and get_foreign_keys."""
    return _execute_tool(
        "get_schema_overview",
        {"target_tables": target_tables},
        config,
        lambda v, uid, db_cfg, mx: DBTools._get_schema_overview(
            uid, v.get("target_tables"), db_config=db_cfg
        ),
    )


@tool
def web_search(query: str, *, config: RunnableConfig) -> str:
    """Search the web for current information, recent news, external documentation, or any topic not available in the connected database. Use this when the user needs up-to-date knowledge, real-world context, or information that cannot be answered from database data alone."""
    writer = _try_writer()
    writer({"type": "tool_start", "name": "web_search", "args": {"query": query}})

    try:
        global _tavily_searcher
        if "_tavily_searcher" not in globals():
            with _TAVILY_LOCK:
                if "_tavily_searcher" not in globals():
                    from langchain_tavily import TavilySearch

                    _tavily_searcher = TavilySearch(max_results=5, topic="general")

        raw = _tavily_searcher.invoke({"query": query})

        # Normalize: may return a list of result dicts or a dict with a 'results' key
        if isinstance(raw, list):
            results = raw
        elif isinstance(raw, dict):
            results = raw.get("results", [])
        else:
            results = []

        parsed = {
            "success": True,
            "query": query,
            "count": len(results),
            "results": [
                {
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": r.get("content", ""),
                }
                for r in results
            ],
        }
    except Exception as e:
        logger.error("web_search failed: %s", e)
        parsed = {
            "success": False,
            "query": query,
            "error": str(e),
            "count": 0,
            "results": [],
        }

    writer(
        {
            "type": "tool_end",
            "name": "web_search",
            "args": {"query": query},
            "result": parsed,
        }
    )

    if not parsed["success"]:
        return f"Web search failed: {parsed.get('error', 'Unknown error')}"

    if not parsed["results"]:
        return f"No results found for: {query}"

    lines = [f"Web search results for '{query}':\n"]
    for i, r in enumerate(parsed["results"], 1):
        title = r["title"] or "Untitled"
        url = r["url"]
        snippet = r["content"][:400].strip() if r["content"] else ""
        lines.append(f"{i}. {title}\n   {url}\n   {snippet}\n")

    return "\n".join(lines)


# ── UI action tools ──────────────────────────────────────────────────


@tool
def open_sql_editor(
    query: Optional[str] = None,
    *,
    config: RunnableConfig,
) -> str:
    """Opens the SQL editor panel in the UI. Optionally pre-populates the editor with a SQL query."""
    tool_name = "open_sql_editor"
    q = query
    summary = (
        "Opened the SQL editor with the provided query pre-populated."
        if q
        else "Opened the SQL editor."
    )
    return _emit_ui_action_tool(
        tool_name,
        {"query": query},
        {"query": q},
        summary,
        title="SQL editor ready",
        message="Review the query before running it." if q else None,
        intent="prepare",
    )


@tool
def open_database_modal(
    db_type: Optional[str] = None,
    *,
    config: RunnableConfig,
) -> str:
    """Opens the database connection modal in the UI. Optionally pre-selects a database type."""
    tool_name = "open_database_modal"
    dt = db_type
    summary = (
        f"Opened the database connection modal with '{dt}' pre-selected."
        if dt
        else "Opened the database connection modal."
    )
    return _emit_ui_action_tool(
        tool_name,
        {"db_type": db_type},
        {"db_type": dt},
        summary,
        title="Connect a database",
        message="Fill in the connection details to continue.",
        intent="navigate",
    )


@tool
def open_settings_modal(
    section: Optional[str] = None,
    *,
    config: RunnableConfig,
) -> str:
    """Opens the settings modal in the UI. Optionally navigates to a specific section (appearance, ai, database, context)."""
    tool_name = "open_settings_modal"
    sec = section
    summary = (
        f"Opened the settings modal on the '{sec}' section."
        if sec
        else "Opened the settings modal."
    )
    return _emit_ui_action_tool(
        tool_name,
        {"section": section},
        {"section": sec},
        summary,
        title="Settings opened",
        message=f"Showing the {sec} settings." if sec else None,
        intent="navigate",
    )


@tool
def navigate_new_chat(
    *,
    config: RunnableConfig,
) -> str:
    """Navigates to a new chat conversation, clearing the current context."""
    tool_name = "navigate_new_chat"
    validated = ToolExecutor.validate_and_parse_args(
        tool_name, {}
    )
    decision = interrupt(
        _guided_interrupt_payload(
            tool_name,
            title="Start a new chat?",
            message="This will leave the current conversation.",
            confirm_text="New Chat",
            intent="navigate",
        )
    )

    approved = _is_user_approved(decision)
    writer = _try_writer()
    result = {
        "success": True,
        "action": tool_name,
        "approved": approved,
        "requiresConfirmation": True,
    }
    writer({"type": "tool_start", "name": tool_name, "args": validated})
    if approved:
        writer(
            {
                "type": "ui_action",
                "action": "complete_navigate_new_chat",
                "payload": _with_ui_metadata(
                    tool_name,
                    {"delayMs": 900},
                    title="Starting new chat",
                    message="Opening a fresh conversation.",
                    intent="navigate",
                    severity="success",
                ),
            }
        )
        summary = "The user confirmed starting a new conversation. Tell them you are starting it for them."
    else:
        summary = "The user declined starting a new conversation. Tell them you will continue in the current chat."
    writer({"type": "tool_end", "name": tool_name, "args": validated, "result": result})
    return summary


@tool
def get_query_history(*, config: RunnableConfig) -> str:
    """Retrieve the 10 most recently executed SQL queries from your long-term episodic memory. Use this tool if the user asks about a past query, requests a modification to a previous query, or refers to context that is no longer visible in your active conversation history."""
    import json

    tool_name = "get_query_history"
    tool_args = {}
    writer = _try_writer()
    writer({"type": "tool_start", "name": tool_name, "args": tool_args})

    uid = config["configurable"]["user_id"]
    queries = DBTools._get_query_history(uid)

    if not queries:
        writer(
            {
                "type": "tool_end",
                "name": tool_name,
                "args": tool_args,
                "result": {"count": 0},
            }
        )
        return "No recent queries found in long-term memory."

    writer(
        {
            "type": "tool_end",
            "name": tool_name,
            "args": tool_args,
            "result": {"count": len(queries)},
        }
    )
    return json.dumps(queries, indent=2)


# ── public list ──────────────────────────────────────────────────────

ALL_TOOLS = [
    get_connection_status,
    get_database_list,
    execute_query,
    get_table_indexes,
    get_schema_overview,
    web_search,
    get_query_history,
    open_sql_editor,
    open_database_modal,
    open_settings_modal,
    navigate_new_chat,
]
