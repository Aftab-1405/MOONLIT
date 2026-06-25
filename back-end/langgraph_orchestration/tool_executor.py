"""
ToolExecutor - Tool argument validation and result summarization.

Handles Pydantic validation of tool inputs and dual summarization
(full UI result vs. token-efficient LLM context).
"""

import json
import logging
from typing import Dict, Any

from langgraph_orchestration.tool_schemas import validate_tool_args, structure_tool_result

logger = logging.getLogger(__name__)


class ToolExecutor:
    """Tool argument validation and result processing."""

    @staticmethod
    def validate_and_parse_args(function_name: str, raw_args: Dict) -> Dict[str, Any]:
        """
        Validate and parse tool arguments using Pydantic schemas.

        Args:
            function_name: Name of the tool
            raw_args: Raw arguments dict from LLM

        Returns:
            Validated and parsed arguments dict

        Raises:
            ValueError: If validation fails
        """
        validated = validate_tool_args(function_name, raw_args or {})
        return validated.model_dump()

    @staticmethod
    def summarize(tool_name: str, result: Dict[str, Any]) -> tuple[Dict[str, Any], str]:
        """
        Create structured summaries of the tool result.
        Returns:
            tuple: (ui_result_dict, llm_summary_json_string)
        """
        ui_structured = structure_tool_result(tool_name, result)
        llm_structured = dict(ui_structured)

        # Remove full data field for execute_query - LLM only needs preview.
        # Add explicit anti-hallucination guardrails because preview rows may be partial.
        if tool_name == "execute_query":
            if "data" in llm_structured:
                del llm_structured["data"]
            llm_structured["llm_guardrails"] = {
                "preview_only_context": bool(
                    llm_structured.get("preview_is_partial", False)
                ),
                "do_not_fabricate_unseen_rows": True,
                "when_user_requests_full_results": (
                    "Tell the user complete data is available in SQL editor results pane/canvas."
                ),
            }

        return ui_structured, json.dumps(llm_structured)
