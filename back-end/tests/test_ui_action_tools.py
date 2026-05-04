"""
Property-based tests for UI action tools in agent/tools.py.

# Feature: agent-ui-interaction-tools, Property 2: UI tool event sequence ordering
# Feature: agent-ui-interaction-tools, Property 3: tool_end result structure

Validates: Requirements 2.2, 3.2, 4.2, 5.2, 6.2, 8.4, 8.5
"""

import json
from typing import Any, List
from unittest.mock import patch, MagicMock

import pytest
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_event(raw: Any) -> dict:
    """
    Normalise a value emitted by the mock writer into a plain dict.

    All events (tool_start, ui_action, tool_end) are now emitted as dicts
    so the writer can pass them through sse_encode in agent.py.
    """
    if isinstance(raw, dict):
        return raw
    raise TypeError(f"Unexpected writer payload type: {type(raw)}")


def _invoke_tool(tool_fn, args: dict) -> tuple[str, List[dict]]:
    """
    Invoke a UI action tool with a mock writer that records all emitted events.

    Returns (llm_summary_string, list_of_parsed_events).
    """
    recorded: List[Any] = []

    def mock_writer(data):
        recorded.append(data)

    with patch("agent.tools._try_writer", return_value=mock_writer):
        result = tool_fn.invoke(args, config={"configurable": {}})

    events = [_parse_event(r) for r in recorded]
    return result, events


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Non-empty rationale strings (tools require rationale)
rationale_st = st.text(min_size=1)

# Optional SQL query strings
optional_query_st = st.one_of(st.none(), st.text())

# Non-empty query strings (write_sql_editor_query requires a non-empty query)
nonempty_query_st = st.text(min_size=1)

# Optional db_type strings
optional_db_type_st = st.one_of(st.none(), st.text())

# Optional section strings
optional_section_st = st.one_of(st.none(), st.text())


# ---------------------------------------------------------------------------
# Property 2: UI tool event sequence ordering
# ---------------------------------------------------------------------------

@given(
    rationale=rationale_st,
    query=optional_query_st,
)
@settings(max_examples=100, deadline=None)
def test_open_sql_editor_event_sequence(rationale: str, query):
    """
    For any valid args for open_sql_editor, the emitted SSE events must be
    exactly: tool_start → ui_action → tool_end, with no other types interleaved.

    # Feature: agent-ui-interaction-tools, Property 2: UI tool event sequence ordering
    Validates: Requirements 2.2, 8.4
    """
    from agent.tools import open_sql_editor

    args = {"rationale": rationale}
    if query is not None:
        args["query"] = query

    _, events = _invoke_tool(open_sql_editor, args)

    assert len(events) == 3, f"Expected 3 events, got {len(events)}: {events}"
    assert events[0]["type"] == "tool_start", f"First event must be tool_start, got {events[0]['type']!r}"
    assert events[1]["type"] == "ui_action", f"Second event must be ui_action, got {events[1]['type']!r}"
    assert events[2]["type"] == "tool_end", f"Third event must be tool_end, got {events[2]['type']!r}"


@given(
    rationale=rationale_st,
    query=nonempty_query_st,
)
@settings(max_examples=100, deadline=None)
def test_write_sql_editor_query_event_sequence(rationale: str, query: str):
    """
    For any valid args for write_sql_editor_query, the emitted SSE events must be
    exactly: tool_start → ui_action → tool_end, with no other types interleaved.

    # Feature: agent-ui-interaction-tools, Property 2: UI tool event sequence ordering
    Validates: Requirements 3.2, 8.4
    """
    from agent.tools import write_sql_editor_query

    _, events = _invoke_tool(write_sql_editor_query, {"query": query, "rationale": rationale})

    assert len(events) == 3, f"Expected 3 events, got {len(events)}: {events}"
    assert events[0]["type"] == "tool_start"
    assert events[1]["type"] == "ui_action"
    assert events[2]["type"] == "tool_end"


@given(
    rationale=rationale_st,
    db_type=optional_db_type_st,
)
@settings(max_examples=100, deadline=None)
def test_open_database_modal_event_sequence(rationale: str, db_type):
    """
    For any valid args for open_database_modal, the emitted SSE events must be
    exactly: tool_start → ui_action → tool_end, with no other types interleaved.

    # Feature: agent-ui-interaction-tools, Property 2: UI tool event sequence ordering
    Validates: Requirements 4.2, 8.4
    """
    from agent.tools import open_database_modal

    args = {"rationale": rationale}
    if db_type is not None:
        args["db_type"] = db_type

    _, events = _invoke_tool(open_database_modal, args)

    assert len(events) == 3, f"Expected 3 events, got {len(events)}: {events}"
    assert events[0]["type"] == "tool_start"
    assert events[1]["type"] == "ui_action"
    assert events[2]["type"] == "tool_end"


@given(
    rationale=rationale_st,
    section=optional_section_st,
)
@settings(max_examples=100, deadline=None)
def test_open_settings_modal_event_sequence(rationale: str, section):
    """
    For any valid args for open_settings_modal, the emitted SSE events must be
    exactly: tool_start → ui_action → tool_end, with no other types interleaved.

    # Feature: agent-ui-interaction-tools, Property 2: UI tool event sequence ordering
    Validates: Requirements 5.2, 8.4
    """
    from agent.tools import open_settings_modal

    args = {"rationale": rationale}
    if section is not None:
        args["section"] = section

    _, events = _invoke_tool(open_settings_modal, args)

    assert len(events) == 3, f"Expected 3 events, got {len(events)}: {events}"
    assert events[0]["type"] == "tool_start"
    assert events[1]["type"] == "ui_action"
    assert events[2]["type"] == "tool_end"


@given(rationale=rationale_st)
@settings(max_examples=100, deadline=None)
def test_navigate_new_chat_event_sequence(rationale: str):
    """
    For any valid args for navigate_new_chat, the emitted SSE events must be
    exactly: tool_start → ui_action → tool_end, with no other types interleaved.

    # Feature: agent-ui-interaction-tools, Property 2: UI tool event sequence ordering
    Validates: Requirements 6.2, 8.4
    """
    from agent.tools import navigate_new_chat

    _, events = _invoke_tool(navigate_new_chat, {"rationale": rationale})

    assert len(events) == 3, f"Expected 3 events, got {len(events)}: {events}"
    assert events[0]["type"] == "tool_start"
    assert events[1]["type"] == "ui_action"
    assert events[2]["type"] == "tool_end"


# ---------------------------------------------------------------------------
# Property 3: tool_end result structure for UI tools
# ---------------------------------------------------------------------------

@given(
    rationale=rationale_st,
    query=optional_query_st,
)
@settings(max_examples=100, deadline=None)
def test_open_sql_editor_tool_end_result(rationale: str, query):
    """
    For any valid args for open_sql_editor, the result field of the tool_end event
    must be { "success": True, "action": "open_sql_editor" }.

    # Feature: agent-ui-interaction-tools, Property 3: tool_end result structure
    Validates: Requirements 8.5
    """
    from agent.tools import open_sql_editor

    args = {"rationale": rationale}
    if query is not None:
        args["query"] = query

    _, events = _invoke_tool(open_sql_editor, args)

    tool_end = events[2]
    assert tool_end["type"] == "tool_end"
    assert tool_end["result"] == {"success": True, "action": "open_sql_editor"}, (
        f"Unexpected tool_end result: {tool_end['result']!r}"
    )


@given(
    rationale=rationale_st,
    query=nonempty_query_st,
)
@settings(max_examples=100, deadline=None)
def test_write_sql_editor_query_tool_end_result(rationale: str, query: str):
    """
    For any valid args for write_sql_editor_query, the result field of the tool_end
    event must be { "success": True, "action": "write_sql_editor_query" }.

    # Feature: agent-ui-interaction-tools, Property 3: tool_end result structure
    Validates: Requirements 8.5
    """
    from agent.tools import write_sql_editor_query

    _, events = _invoke_tool(write_sql_editor_query, {"query": query, "rationale": rationale})

    tool_end = events[2]
    assert tool_end["type"] == "tool_end"
    assert tool_end["result"] == {"success": True, "action": "write_sql_editor_query"}


@given(
    rationale=rationale_st,
    db_type=optional_db_type_st,
)
@settings(max_examples=100, deadline=None)
def test_open_database_modal_tool_end_result(rationale: str, db_type):
    """
    For any valid args for open_database_modal, the result field of the tool_end
    event must be { "success": True, "action": "open_database_modal" }.

    # Feature: agent-ui-interaction-tools, Property 3: tool_end result structure
    Validates: Requirements 8.5
    """
    from agent.tools import open_database_modal

    args = {"rationale": rationale}
    if db_type is not None:
        args["db_type"] = db_type

    _, events = _invoke_tool(open_database_modal, args)

    tool_end = events[2]
    assert tool_end["type"] == "tool_end"
    assert tool_end["result"] == {"success": True, "action": "open_database_modal"}


@given(
    rationale=rationale_st,
    section=optional_section_st,
)
@settings(max_examples=100, deadline=None)
def test_open_settings_modal_tool_end_result(rationale: str, section):
    """
    For any valid args for open_settings_modal, the result field of the tool_end
    event must be { "success": True, "action": "open_settings_modal" }.

    # Feature: agent-ui-interaction-tools, Property 3: tool_end result structure
    Validates: Requirements 8.5
    """
    from agent.tools import open_settings_modal

    args = {"rationale": rationale}
    if section is not None:
        args["section"] = section

    _, events = _invoke_tool(open_settings_modal, args)

    tool_end = events[2]
    assert tool_end["type"] == "tool_end"
    assert tool_end["result"] == {"success": True, "action": "open_settings_modal"}


@given(rationale=rationale_st)
@settings(max_examples=100, deadline=None)
def test_navigate_new_chat_tool_end_result(rationale: str):
    """
    For any valid args for navigate_new_chat, the result field of the tool_end
    event must be { "success": True, "action": "navigate_new_chat" }.

    # Feature: agent-ui-interaction-tools, Property 3: tool_end result structure
    Validates: Requirements 8.5
    """
    from agent.tools import navigate_new_chat

    _, events = _invoke_tool(navigate_new_chat, {"rationale": rationale})

    tool_end = events[2]
    assert tool_end["type"] == "tool_end"
    assert tool_end["result"] == {"success": True, "action": "navigate_new_chat"}


# ---------------------------------------------------------------------------
# Additional unit tests for specific cases
# ---------------------------------------------------------------------------

def test_all_tools_contains_ui_action_tools():
    """ALL_TOOLS must include all five UI action tools."""
    from agent.tools import ALL_TOOLS

    tool_names = {t.name for t in ALL_TOOLS}
    expected = {
        "open_sql_editor",
        "write_sql_editor_query",
        "open_database_modal",
        "open_settings_modal",
        "navigate_new_chat",
    }
    assert expected.issubset(tool_names), (
        f"Missing tools in ALL_TOOLS: {expected - tool_names}"
    )


def test_open_sql_editor_ui_action_payload_with_query():
    """open_sql_editor emits ui_action with the provided query in the payload."""
    from agent.tools import open_sql_editor

    _, events = _invoke_tool(open_sql_editor, {"rationale": "test", "query": "SELECT 1"})
    ui_action = events[1]
    assert ui_action["action"] == "open_sql_editor"
    assert ui_action["payload"]["query"] == "SELECT 1"


def test_open_sql_editor_ui_action_payload_without_query():
    """open_sql_editor emits ui_action with query=None when no query is provided."""
    from agent.tools import open_sql_editor

    _, events = _invoke_tool(open_sql_editor, {"rationale": "test"})
    ui_action = events[1]
    assert ui_action["action"] == "open_sql_editor"
    assert ui_action["payload"]["query"] is None


def test_navigate_new_chat_ui_action_payload_is_null():
    """navigate_new_chat emits ui_action with null payload."""
    from agent.tools import navigate_new_chat

    _, events = _invoke_tool(navigate_new_chat, {"rationale": "test"})
    ui_action = events[1]
    assert ui_action["action"] == "navigate_new_chat"
    assert ui_action["payload"] is None
