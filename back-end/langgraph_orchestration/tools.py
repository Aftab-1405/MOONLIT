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

TOOL_REQUIRED_SKILLS = {
    "execute_query": ("database-querying",),
    "analyze_query_result": ("database-querying",),
    "get_table_indexes": ("database-querying",),
    "get_schema_overview": ("database-querying", "react-flow-diagram"),
    "web_search": ("web-research",),
    "get_query_history": ("query-history",),
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


def _effective_query_max_rows(requested_max_rows, configured_max_rows):
    """Apply the agent's requested limit under user and server caps."""
    from config import get_config

    Config = get_config()
    requested = int(requested_max_rows or 100)
    configured = int(configured_max_rows or Config.MAX_QUERY_RESULTS)
    return max(1, min(requested, configured, Config.MAX_QUERY_RESULTS))


def _required_skill_message(tool_name: str, config: RunnableConfig) -> str | None:
    """Return a retry instruction when a specialized tool's skill is not loaded."""
    required_skills = TOOL_REQUIRED_SKILLS.get(tool_name)
    if not required_skills:
        return None

    activated = _cfg(config).get("activated_skills", [])
    if any(skill in activated for skill in required_skills):
        return None

    if len(required_skills) == 1:
        retry_instruction = (
            f'Call read_skill(skill_name="{required_skills[0]}") first, then retry '
            f"{tool_name} with the same intent."
        )
    else:
        options = ", ".join(required_skills)
        retry_instruction = (
            f"Choose the one skill matching the current task from: {options}. "
            f"Call read_skill for it, then retry {tool_name} with the same intent."
        )

    return (
        "<required_skill_not_loaded>\n"
        f"The {tool_name} action was not executed. {retry_instruction} "
        "Do not answer the user as if the action succeeded.\n"
        "</required_skill_not_loaded>"
    )


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

    missing_skill = _required_skill_message(tool_name, config)
    if missing_skill:
        return missing_skill

    # 1. Validate with Pydantic schemas
    try:
        validated = ToolExecutor.validate_and_parse_args(tool_name, raw_args)
    except ValueError as e:
        return f"Tool Argument Validation Error: {str(e)}. Please correct your arguments and try again."

    # 2. Display args (show effective max_rows for execute_query)
    display_args = dict(validated)
    execution_max_rows = cfg.get("max_rows")
    if tool_name == "execute_query":
        execution_max_rows = _effective_query_max_rows(
            validated.get("max_rows"), cfg.get("max_rows")
        )
        display_args["max_rows"] = execution_max_rows

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
        try:
            parsed = executor_fn(
                validated,
                cfg.get("user_id", ""),
                cfg.get("db_config"),
                execution_max_rows,
            )
        except Exception as exc:
            logger.exception("%s execution failed", tool_name)
            result = {
                "success": False,
                "error": str(exc)[:500] or exc.__class__.__name__,
            }
            writer(
                {
                    "type": "tool_end",
                    "name": tool_name,
                    "args": display_args,
                    "result": result,
                }
            )
            return (
                "<tool_execution_error>\n"
                f"{tool_name} failed and produced no usable evidence: "
                f"{result['error']}. Correct the call and retry once only if a "
                "clear fix exists; otherwise report the failure. Do not claim "
                "success.\n</tool_execution_error>"
            )
        # Do not pin transient failures in the request-scoped cache. Executor
        # methods report expected failures as ``{"error": ...}`` dictionaries.
        if cache_key and not (
            isinstance(parsed, dict)
            and (parsed.get("error") or parsed.get("success") is False)
        ):
            cache[cache_key] = parsed
            logger.info(f"Cached result for {tool_name}")

    # Generate execution_id and save large query results to Firestore Subcollection
    if tool_name == "execute_query" and isinstance(parsed, dict) and parsed.get("success") is True:
        import uuid
        from service.firestore.firestore_service import store_execution_result

        thread_id = cfg.get("thread_id", "")
        conversation_id = thread_id.rsplit(":", 1)[-1]

        execution_id = str(uuid.uuid4())
        parsed["execution_id"] = execution_id
        parsed["conversation_id"] = conversation_id or None

        if conversation_id:
            try:
                # Save just the result rows and columns, not the whole payload if we don't want, but whole payload is fine.
                store_execution_result(conversation_id, execution_id, parsed)
            except Exception as e:
                logger.error(f"Failed to store execution result: {e}")

    # 6. Dual summarization
    ui_result, llm_summary = ToolExecutor.summarize(
        tool_name,
        parsed,
        # A data analyst must be able to inspect bounded query evidence in
        # order to interpret aggregates and decide on follow-up queries. The
        # full result remains UI-only; ToolExecutor exposes a small preview.
        include_query_preview=(tool_name == "execute_query"),
    )

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
    """Check whether the user is connected to a database and return connection details. No skill is required."""
    return _execute_tool(
        "get_connection_status",
        {},
        config,
        lambda v, uid, db_cfg, mx: DBTools._get_connection_status(uid),
    )


@tool
def get_database_list(*, config: RunnableConfig) -> str:
    """Get databases available on the connected server. No skill is required."""
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
    """Requires read_skill('database-querying') first. Execute one read-only SELECT/WITH query and return bounded result evidence for interpretation and follow-up analysis. Full rows are rendered in the UI."""
    tool_name = "execute_query"
    raw_args = {
        "query": query,
        "max_rows": max_rows,
    }

    return _execute_tool(
        tool_name,
        raw_args,
        config,
        lambda v, uid, db_cfg, mx: DBTools._execute_query(
            uid, v["query"], mx, db_config=db_cfg
        ),
    )


@tool
def analyze_query_result(
    execution_id: str,
    operation: str,
    columns: Optional[list[str]] = None,
    *,
    config: RunnableConfig,
) -> str:
    """Requires read_skill('database-querying') first. Deterministically profile columns, check nulls/duplicates, or calculate Pearson correlation over a bounded prior execute_query result."""

    def execute(validated, _uid, _db_cfg, _max_rows):
        from langgraph_orchestration.result_analysis import analyze_execution_result
        from service.firestore.firestore_service import get_execution_result

        thread_id = _cfg(config).get("thread_id", "")
        conversation_id = thread_id.rsplit(":", 1)[-1]
        if not conversation_id:
            return {"success": False, "error": "Conversation id is unavailable"}
        execution = get_execution_result(conversation_id, validated["execution_id"])
        if not execution:
            return {"success": False, "error": "Query execution result was not found"}
        return analyze_execution_result(
            execution,
            operation=validated["operation"],
            columns=validated.get("columns"),
        )

    return _execute_tool(
        "analyze_query_result",
        {
            "execution_id": execution_id,
            "operation": operation,
            "columns": columns,
        },
        config,
        execute,
    )


@tool
def get_table_indexes(
    table_name: str,
    *,
    config: RunnableConfig,
) -> str:
    """Requires read_skill('database-querying') first. Get indexes for a table, including columns, uniqueness, and primary-key status."""
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
    """Requires a relevant skill first: database-querying for SQL/data work, or react-flow-diagram for a requested visualization. Get tables, columns, and foreign keys in one call."""
    return _execute_tool(
        "get_schema_overview",
        {"target_tables": target_tables},
        config,
        lambda v, uid, db_cfg, mx: DBTools._get_schema_overview(
            uid, v.get("target_tables"), db_config=db_cfg
        ),
    )


@tool
def read_skill(skill_name: str, *, config: RunnableConfig) -> str:
    """Load detailed instructions for one available skill. Use this before applying a specialized skill listed in the system prompt's available_skills block."""
    writer = _try_writer()
    args = {"skill_name": skill_name}
    writer({"type": "tool_start", "name": "read_skill", "args": args})

    from skills.skill_registry import get_skill_registry

    registry = get_skill_registry()
    skill = registry.get_skill(skill_name)

    if skill is None:
        result = {
            "success": False,
            "error": f"Unknown skill: {skill_name}",
            "available_skills": registry.all_skill_names,
        }
        writer({"type": "tool_end", "name": "read_skill", "args": args, "result": result})
        return (
            f"Unknown skill: {skill_name}. Available skills: "
            + ", ".join(registry.all_skill_names)
        )

    cfg = _cfg(config)
    activated = cfg.setdefault("activated_skills", [])
    if skill.name in activated:
        result = {
            "success": True,
            "skill_name": skill.name,
            "already_loaded": True,
        }
        writer({"type": "tool_end", "name": "read_skill", "args": args, "result": result})
        return (
            f'<skill_already_loaded name="{skill.name}">The instructions are already '
            "available in this turn. Continue with the related action; do not read "
            "this skill again.</skill_already_loaded>"
        )

    activated.append(skill.name)
    writer({"type": "skills_activated", "skills": [skill.name]})

    result = {
        "success": True,
        "skill_name": skill.name,
        "description": skill.description,
    }
    writer({"type": "tool_end", "name": "read_skill", "args": args, "result": result})
    return skill.build_agent_context()


@tool
def web_search(query: str, *, config: RunnableConfig) -> str:
    """Requires read_skill('web-research') first. Search the web for current external information or documentation unavailable from the connected database."""
    missing_skill = _required_skill_message("web_search", config)
    if missing_skill:
        return missing_skill

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
    """Requires read_skill('query-history') first. Retrieve the 10 most recently executed SQL queries when the user refers to past query history."""
    import json

    tool_name = "get_query_history"
    missing_skill = _required_skill_message(tool_name, config)
    if missing_skill:
        return missing_skill

    tool_args = {}
    writer = _try_writer()
    writer({"type": "tool_start", "name": tool_name, "args": tool_args})

    uid = config["configurable"]["user_id"]
    try:
        queries = DBTools._get_query_history(uid)
    except Exception as exc:
        logger.exception("%s execution failed", tool_name)
        result = {
            "success": False,
            "error": str(exc)[:500] or exc.__class__.__name__,
        }
        writer(
            {
                "type": "tool_end",
                "name": tool_name,
                "args": tool_args,
                "result": result,
            }
        )
        return (
            "<tool_execution_error>Query history could not be retrieved: "
            f"{result['error']}. Do not claim that history was loaded."
            "</tool_execution_error>"
        )

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
    read_skill,
    get_connection_status,
    get_database_list,
    execute_query,
    analyze_query_result,
    get_table_indexes,
    get_schema_overview,
    web_search,
    get_query_history,
    open_sql_editor,
    open_database_modal,
    open_settings_modal,
    navigate_new_chat,
]
