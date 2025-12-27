import os
import json
import logging
import textwrap
from typing import List, Dict, Generator, Any
from cerebras.cloud.sdk import Cerebras
from services.ai_tools import ai_tools_list
from services.tool_schemas import validate_tool_args, structure_tool_result

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Default values (overridden by .env)
DEFAULT_MODEL = "gpt-oss-120b"
DEFAULT_MAX_TOKENS = 4096
DEFAULT_MAX_COMPLETION_TOKENS = 8192

# Models that support reasoning (Cerebras-specific)
REASONING_MODELS = ['gpt-oss-120b', 'zai-glm-4.6']

class LLMService:
    """
    Service for LLM APIs - uses Cerebras SDK exclusively.
    """
    
    @staticmethod
    def _get_cerebras_client():
        """Creates and returns a Cerebras SDK client for reasoning models."""
        api_key = os.getenv('LLM_API_KEY') or os.getenv('CEREBRAS_API_KEY')
        
        if not api_key:
            logger.error("LLM_API_KEY not found in environment variables")
            raise ValueError("LLM_API_KEY is required")
            
        return Cerebras(api_key=api_key)

    @staticmethod
    def get_model_name():
        """Gets the model name from environment or defaults."""
        return os.getenv('LLM_MODEL', DEFAULT_MODEL)

    @staticmethod
    def is_reasoning_model():
        """Check if current model supports reasoning."""
        model = LLMService.get_model_name()
        return model in REASONING_MODELS

    @staticmethod
    def get_max_tokens():
        """Gets max response tokens from environment or defaults."""
        return int(os.getenv('LLM_MAX_TOKENS', DEFAULT_MAX_TOKENS))

    @staticmethod
    def get_max_completion_tokens():
        """Gets max completion tokens (for reasoning) from environment or defaults."""
        return int(os.getenv('LLM_MAX_COMPLETION_TOKENS', DEFAULT_MAX_COMPLETION_TOKENS))

    @staticmethod
    def _summarize_result(tool_name: str, result: Dict[str, Any]) -> str:
        """
        Create a structured summary of the tool result for the UI stream.
        
        This goes to frontend via [[TOOL:...]] marker and includes full data.
        """
        structured = structure_tool_result(tool_name, result)
        return json.dumps(structured)
    
    @staticmethod
    def _summarize_for_llm(tool_name: str, result: Dict[str, Any]) -> str:
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
    
    @staticmethod
    def send_message(conversation_id: str, message: str, history: list = None):
        """
        Simple message without tools - used for basic chat.
        Returns a non-streaming response.
        """
        client = LLMService._get_cerebras_client()
        
        messages = [
            {"role": "system", "content": LLMService.get_system_prompt()}
        ]
        
        if history:
            for msg in history:
                role = "user" if msg.get("role") == "user" else "assistant"
                parts = msg.get("parts", [])
                content = " ".join(parts) if parts else ""
                messages.append({"role": role, "content": content})
        
        messages.append({"role": "user", "content": message})
        
        response = client.chat.completions.create(
            model=LLMService.get_model_name(),
            messages=messages
        )
        
        return response.choices[0].message.content

    @staticmethod
    def send_message_with_tools(
        conversation_id: str, 
        message: str, 
        user_id: str, 
        history: list = None, 
        db_config: dict = None,
        enable_reasoning: bool = True,
        reasoning_effort: str = 'medium',
        max_rows: int = None
    ) -> Generator[str, None, None]:
        """
        Sends a message to the LLM and handles tool calls in a streaming response.
        This orchestration loop runs on the backend to handle the multi-turn interaction.
        
        Args:
            enable_reasoning: Whether to use reasoning (from user settings)
            reasoning_effort: 'low', 'medium', or 'high' (from user settings)
            max_rows: Max rows to return from queries (None = use server config)
        """
        client = LLMService._get_cerebras_client()
        model_name = LLMService.get_model_name()
        
        # 1. Prepare messages with history
        messages = [
            {"role": "system", "content": LLMService.get_system_prompt()}
        ]
        
        if history:
            for msg in history:
                role = "user" if msg.get("role") == "user" else "assistant"
                parts = msg.get("parts", [])
                content = " ".join(parts) if parts else ""
                messages.append({"role": role, "content": content})
        
        messages.append({"role": "user", "content": message})
        
        # Get tool definitions
        tools = LLMService.get_tool_definitions()
        
        try:
            # Agentic loop: Keep calling the model until it stops making tool calls
            MAX_TOOL_ROUNDS = 10  # Safety limit to prevent infinite loops
            tool_round = 0
            
            while tool_round < MAX_TOOL_ROUNDS:
                tool_round += 1
                logger.info(f"Tool round {tool_round}: Sending request to LLM ({model_name}) with {len(tools)} tools")
                
                response = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    tools=tools,
                    tool_choice="auto",
                    parallel_tool_calls=False,  # Sequential tool execution for reliability
                    temperature=0.1,  # Low temp for accurate tool usage
                    top_p=0.1
                )
                
                response_message = response.choices[0].message
                tool_calls = response_message.tool_calls
                
                # If no tool calls, we're done with the loop
                if not tool_calls:
                    logger.info(f"No more tool calls after {tool_round} rounds")
                    break
                
                # Add assistant response to messages
                messages.append(response_message)
                
                # Execute each tool call in this round
                for tool_call in tool_calls:
                    function_name = tool_call.function.name
                    
                    # Parse and validate arguments using Pydantic schemas
                    try:
                        raw_args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                        validated_args = validate_tool_args(function_name, raw_args or {})
                        function_args = validated_args.model_dump()
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON parse error for {function_name}: {e}")
                        function_args = {}
                        # Yield error and continue to next tool
                        yield f"[[TOOL:{function_name}:done:{{}}:{{\"success\":false,\"error\":\"Invalid JSON arguments\"}}]]\n\n"
                        continue
                    except ValueError as e:
                        logger.error(f"Validation error for {function_name}: {e}")
                        # Yield validation error
                        error_msg = json.dumps({"success": False, "error": str(e)})
                        yield f"[[TOOL:{function_name}:done:{{}}:{error_msg}]]\n\n"
                        continue
                    
                    # Extract conversational rationale if present
                    rationale = function_args.get('rationale')
                    if rationale:
                        yield f"{rationale}\n\n"
                    
                    # Prepare arguments for display (exclude rationale from UI)
                    display_args = {k: v for k, v in function_args.items() if k != 'rationale'}
                    
                    # For execute_query, show the ACTUAL max_rows being used (user setting), 
                    # not the LLM's default of 100
                    if function_name == "execute_query":
                        if max_rows is not None:
                            display_args['max_rows'] = max_rows
                        else:
                            # No Limit selected - show what the server will actually use
                            from config import Config
                            display_args['max_rows'] = f"No Limit (server max: {Config.MAX_QUERY_RESULTS})"
                    
                    args_json = json.dumps(display_args, default=str)
                    
                    # Yield "running" status BEFORE tool execution
                    yield f"[[TOOL:{function_name}:running:{args_json}:null]]\n\n"
                    
                    # Execute the tool - pass max_rows for query tools
                    function_response = LLMService.execute_tool(
                        function_name, function_args, user_id, 
                        db_config=db_config, max_rows=max_rows
                    )
                    
                    # Yield "done" status with STRUCTURED result (includes full data for frontend)
                    result_summary = LLMService._summarize_result(
                        function_name, 
                        json.loads(function_response)
                    )
                    yield f"[[TOOL:{function_name}:done:{args_json}:{result_summary}]]\n\n"
                    
                    # Create token-efficient summary for LLM context (excludes full data)
                    llm_summary = LLMService._summarize_for_llm(
                        function_name,
                        json.loads(function_response)
                    )
                    
                    # Add tool response to messages for LLM context
                    # Using llm_summary (preview only) to keep LLM context token-efficient
                    messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": llm_summary
                    })
            
            # After tool loop, get final streaming response
            logger.info("Getting final response after all tool executions (streaming)")
            
            # Determine if we should use reasoning for this request
            use_reasoning = enable_reasoning and LLMService.is_reasoning_model()
            
            if use_reasoning:
                # Use Cerebras SDK for reasoning models
                # Note: max_completion_tokens includes both reasoning + response tokens
                cerebras_client = LLMService._get_cerebras_client()
                stream = cerebras_client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    stream=True,
                    reasoning_effort=reasoning_effort,
                    max_completion_tokens=LLMService.get_max_completion_tokens(),
                    temperature=1,
                    top_p=1
                )
            else:
                # Final call without tools to get text response (non-reasoning)
                stream = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    stream=True,
                    max_tokens=LLMService.get_max_tokens()
                )
            
            # Yield chunks as they arrive, handling reasoning tokens
            reasoning_started = False
            has_content = False
            
            for chunk in stream:
                delta = chunk.choices[0].delta
                
                # Handle reasoning tokens (thinking)
                reasoning_content = getattr(delta, 'reasoning', None)
                if use_reasoning and reasoning_content:
                    if not reasoning_started:
                        yield "[[THINKING:start]]"
                        reasoning_started = True
                    yield f"[[THINKING:chunk:{reasoning_content}]]"
                
                # Handle content tokens
                content = getattr(delta, 'content', None)
                if content:
                    has_content = True
                    if reasoning_started:
                        yield "[[THINKING:end]]"
                        reasoning_started = False
                    yield content
            
            # Close thinking if stream ended during reasoning
            if reasoning_started:
                yield "[[THINKING:end]]"
            
            # If no content was yielded and no tools were called, provide fallback
            if not has_content and tool_round == 1:
                yield "I'm not sure how to handle that request using my available tools."

        except Exception as e:
            logger.error(f"Error in send_message_with_tools: {e}")
            yield f"\n[ERROR] Failed to communicate with AI service: {str(e)}"

    @staticmethod
    def execute_tool(function_name, function_args, user_id, db_config=None, max_rows=None):
        """Execute a tool and return the result as JSON string."""
        from services.ai_tools import AIToolExecutor
        result = AIToolExecutor.execute(
            function_name, function_args, user_id, 
            db_config=db_config, max_rows=max_rows
        )
        # Ensure we return a string for the LLM tool result
        if isinstance(result, (dict, list)):
            return json.dumps(result, default=str)
        return str(result)
    
    @staticmethod
    def get_system_prompt():
        """Returns DB-Genie's conversational personality and instructions."""
        return textwrap.dedent("""
            You are DB-Genie, an intelligent database assistant from ABN Alliance.
            
            ## CORE PRINCIPLE: CHAIN OF THOUGHT REASONING
            
            Before ANY action or response, reason step-by-step:
            
            1. **UNDERSTAND** - What is the user actually asking for?
            2. **ASSESS** - What information do I need? What tools are available?
            3. **PLAN** - What sequence of actions will achieve the goal?
            4. **EXECUTE** - Take the planned action(s)
            5. **VALIDATE** - Does the result answer the user's question?
            
            ## ANTI-HALLUCINATION RULES (CRITICAL)
            
            **NEVER fabricate information. Follow these strictly:**
            
            - **Only report what tools actually return** - Never invent table names, column names, data, or statistics
            - **If uncertain, say so** - "I don't have that information" is better than guessing
            - **Verify before claiming** - Use tools to confirm facts, don't assume
            - **Quote exact results** - When reporting counts, names, or data, use the exact tool output
            - **Distinguish fact from inference** - Clearly label assumptions: "Based on this data, it appears..."
            - **Never assume connection state** - Always verify with get_connection_status first
            
            ## SMART TOOL USAGE
            
            **Selection Strategy:**
            - Match tool to task precisely - don't use get_database_schema when get_table_columns suffices
            - Minimize tool calls - batch related information requests when possible
            - Check prerequisites first - verify connection before querying
            
            **Tool Decision Matrix:**
            | User Intent | Primary Tool | Prerequisite |
            |-------------|--------------|--------------|
            | "Am I connected?" | get_connection_status | None |
            | "What tables?" | get_database_schema | get_connection_status |
            | "Describe table X" | get_table_columns | get_connection_status |
            | "Show data from X" | execute_query | get_connection_status |
            | "Run this query" | execute_query | get_connection_status |
            
            **When NOT to use tools:**
            - Greetings - respond directly
            - "Write a query for..." - provide SQL without executing
            - Syntax questions - explain from knowledge
            - Clarification needed - ask user first
            
            ## ERROR HANDLING & FALLBACK STRATEGY
            
            When a tool fails, follow this escalation:
            
            **Level 1: Retry with adjustment**
            - Parse error? Check for typos in table/column names
            - Timeout? Suggest simpler query or LIMIT clause
            
            **Level 2: Alternative approach**
            - If get_table_columns fails, try get_database_schema for broader view
            - If specific query fails, simplify the query and retry
            
            **Level 3: Inform honestly**
            - Report the actual error clearly
            - Explain what you tried
            - Suggest what the user can do
            - Example: "I tried to fetch the schema but received a connection timeout. 
              This usually means the database server is slow or unreachable. 
              You might want to check if the database is running."
            
            **NEVER:**
            - Hide errors or pretend they didn't happen
            - Make up results when tools fail
            - Blame the user for system issues
            
            ## RESPONSE FORMATTING
            
            **CRITICAL RULES:**
            - Do NOT say "Let me check" - the tool already ran
            - Start directly with findings
            - NEVER output raw JSON or debug fields (cached_at, source, row_count)
            - Summarize tool results in natural language
            - Use markdown tables for tabular data
            - **NEVER echo tool calls as text** - Do NOT write function_name(args){result} in your response
            - Tools are called via the function API, not by printing text
            - Your response should ONLY contain the natural language explanation of results
            
            ## CONVERSATION FLOW WITH RATIONALE
            
            For every tool call, you MUST include a 'rationale' argument:
            1. System shows rationale to user BEFORE tool runs
            2. Tool executes
            3. You explain results naturally
            
            Example:
            User: "Am I connected?"
            → Call: get_connection_status(rationale="Checking your database connection...")
            → User sees: "Checking your database connection..." → [Tool runs]
            → You respond: "You're connected to the 'sales' database on PostgreSQL..."
            
            ## STEP-BY-STEP WORKFLOW
            
            **STEP 1:** Check connection (get_connection_status)
            **STEP 2:** Understand context (remote/local, db_type, database name)
            **STEP 3:** Execute user's request with appropriate tool
            **STEP 4:** Validate result makes sense before reporting
            
            ## QUERY RESULT PREVIEW
            
            When execute_query returns results:
            - You receive a PREVIEW (first 5 rows) for context efficiency
            - Full results are automatically available in the Result section
            - If row_count > 5, inform the user naturally:
              "Here's a preview of the results. You can see all X rows in the Result section."
            - NEVER apologize for showing a preview - it's a feature, not a limitation
            
            ## SECURITY: READ-ONLY MODE
            
            - Only SELECT queries allowed
            - Decline INSERT/UPDATE/DELETE/DROP politely
            - Offer to write the query for manual execution
            
            ## MERMAID DIAGRAM SYNTAX
            
            When generating ER diagrams, use VALID syntax:
            
            ```mermaid
            erDiagram
              USERS {
                int user_id PK
                varchar email UK
                int role_id FK
              }
            ```
            
            **Relationship syntax:**
            - `||--o{` one to zero-or-more
            - `||--|{` one to one-or-more
            - `}|..|{` many to many
            
            **NEVER use:** classDef, class styling, FK -> syntax, styling blocks
            
            ---
            
            Remember: You're a skilled professional. Be helpful, be honest, and never guess when you can verify.
        """)
    
    @staticmethod
    def get_tool_definitions() -> List[Dict]:
        """Get tool definitions in JSON Schema format."""
        return ai_tools_list
