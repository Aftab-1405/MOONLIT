import pytest

from service.conversations.conversation_service import (
    _coerce_message_cursor,
    _parse_summary_json_response,
)


def test_parse_summary_json_response_accepts_wrapped_json():
    raw = """
    Some accidental preface.
    ```json
    {
      "summary_text": "1. Primary Request\\n- Inspect sales data",
      "memory_bullets": [
        {"bullet_id": "b001", "bullet_index": 1, "text": "Sales database is PostgreSQL.", "type": "database_fact"}
      ]
    }
    ```
    """

    parsed = _parse_summary_json_response(raw)

    assert parsed["summary_text"].startswith("1. Primary Request")
    assert parsed["memory_bullets"][0]["text"] == "Sales database is PostgreSQL."


def test_parse_summary_json_response_rejects_empty_bullets():
    raw = '{"summary_text": "Summary", "memory_bullets": []}'

    with pytest.raises(ValueError, match="memory_bullets"):
        _parse_summary_json_response(raw)


def test_parse_summary_json_response_normalizes_bullets():
    raw = """
    {
      "summary_text": "1. Task State\\n- Continue database analysis",
      "memory_bullets": [
        {"bullet_id": "custom", "bullet_index": 99, "text": "  Sales database is PostgreSQL on Neon.  ", "type": "database_fact"},
        {"bullet_id": "dupe", "bullet_index": 100, "text": "Sales database is PostgreSQL on Neon.", "type": "database_fact"},
        {"bullet_id": "personal", "bullet_index": 101, "text": "User girlfriend baked cake.", "type": "other"},
        {"bullet_id": "badtype", "bullet_index": 102, "text": "Top employee query used total_sales descending.", "type": "unknown_type"}
      ]
    }
    """

    parsed = _parse_summary_json_response(raw)
    bullets = parsed["memory_bullets"]

    assert [b["bullet_index"] for b in bullets] == [1, 2, 3]
    assert bullets[0]["type"] == "overview"
    assert bullets[0]["text"] == "Sales database is PostgreSQL on Neon."
    assert bullets[1]["type"] == "other"
    assert bullets[1]["text"] == "User girlfriend baked cake."
    assert bullets[2]["type"] == "other"


def test_coerce_message_cursor_clamps_invalid_values():
    assert _coerce_message_cursor("4", message_count=10) == 4
    assert _coerce_message_cursor(-3, message_count=10) == 0
    assert _coerce_message_cursor(99, message_count=10) == 10
    assert _coerce_message_cursor("bad", message_count=10) == 0
