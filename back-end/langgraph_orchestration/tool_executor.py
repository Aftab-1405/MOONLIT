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
    def summarize(
        tool_name: str,
        result: Dict[str, Any],
        *,
        include_query_preview: bool = False,
    ) -> tuple[Dict[str, Any], str]:
        """
        Create structured summaries of the tool result.
        Returns:
            tuple: (ui_result_dict, llm_summary_json_string)
        """
        ui_structured = structure_tool_result(tool_name, result)
        llm_structured = dict(ui_structured)

        # Full rows stay in the UI payload. A bounded preview is necessary for
        # the model to interpret aggregates and plan multi-step analysis.
        if tool_name == "execute_query":
            llm_structured.pop("data", None)
            if not include_query_preview:
                llm_structured.pop("preview", None)
            policy = (
                "<required_query_result_response_policy>\n"
                "The full available query result is already visible in chat as an interactive Material React Table. "
                "Use the preview as bounded evidence for analysis, interpretation, and deciding whether a focused "
                "follow-up query is needed. Unless the user explicitly requested an assistant-authored table, "
                "summarize findings in prose instead of repeating rows. A preview never proves unseen rows or a "
                "complete result. If the user requested a manual table, disclose that it contains preview rows only.\n"
                "</required_query_result_response_policy>"
            )
            evidence_tag = (
                "<query_result_preview_json>\n"
                + json.dumps(llm_structured)
                + "\n</query_result_preview_json>"
            )
            if not include_query_preview:
                evidence_tag = (
                    "<query_result_metadata_json>\n"
                    + json.dumps(llm_structured)
                    + "\n</query_result_metadata_json>"
                )
            return ui_structured, policy + "\n" + evidence_tag

        return ui_structured, json.dumps(llm_structured)
