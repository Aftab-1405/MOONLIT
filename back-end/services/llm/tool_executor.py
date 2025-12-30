"""
ToolExecutor - Tool execution and result processing.

Handles tool argument validation, execution delegation, and result summarization.
"""

import json
import logging
from typing import Dict, Any, List

from services.ai_tools import ai_tools_list, AIToolExecutor
from services.tool_schemas import validate_tool_args, structure_tool_result

logger = logging.getLogger(__name__)


class ToolExecutor:
    """Tool execution and result processing."""
    
    @staticmethod
    def get_tool_definitions() -> List[Dict]:
        """Get tool definitions in JSON Schema format."""
        return ai_tools_list
    
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
    def execute(
        function_name: str,
        function_args: Dict[str, Any],
        user_id: str,
        db_config: Dict = None,
        max_rows: int = None
    ) -> str:
        """
        Execute a tool and return the result as JSON string.
        
        Args:
            function_name: Name of the tool to execute
            function_args: Validated arguments dict
            user_id: User ID for context
            db_config: Database connection config
            max_rows: Max rows to return from queries
            
        Returns:
            JSON string of the result
        """
        result = AIToolExecutor.execute(
            function_name, function_args, user_id,
            db_config=db_config, max_rows=max_rows
        )
        # Ensure we return a string for the LLM tool result
        if isinstance(result, (dict, list)):
            return json.dumps(result, default=str)
        return str(result)
    
    @staticmethod
    def summarize_for_ui(tool_name: str, result: Dict[str, Any]) -> str:
        """
        Create a structured summary of the tool result for the UI stream.
        
        This goes to frontend via [[TOOL:...]] marker and includes full data.
        """
        structured = structure_tool_result(tool_name, result)
        return json.dumps(structured)
    
    @staticmethod
    def summarize_for_llm(tool_name: str, result: Dict[str, Any]) -> str:
        """
        Create a token-efficient summary for LLM context.
        
        For execute_query, excludes the full 'data' field - LLM only sees 'preview'.
        This prevents token limit issues with large query results.
        """
        structured = structure_tool_result(tool_name, result)
        
        # Remove full data field for execute_query - LLM only needs preview
        if tool_name == "execute_query" and 'data' in structured:
            del structured['data']
        
        return json.dumps(structured)
