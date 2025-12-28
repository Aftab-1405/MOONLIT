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

# Response style prompts - injected into system prompt based on user preference
STYLE_PROMPTS = {
    'concise': """RESPONSE STYLE: Be extremely concise.
- Use bullet points when listing items
- Avoid unnecessary explanation or preamble
- Get straight to the answer
- Keep responses brief and actionable
""",
    'balanced': "",  # Default behavior, no modification
    'detailed': """RESPONSE STYLE: Provide comprehensive, detailed responses.
- Explain your reasoning step by step
- Include relevant context and background
- Offer examples when helpful
- Be thorough but well-organized
""",
}

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
        response_style: str = 'balanced',
        max_rows: int = None
    ) -> Generator[str, None, None]:
        """
        Sends a message to the LLM and handles tool calls in a streaming response.
        This orchestration loop runs on the backend to handle the multi-turn interaction.
        
        Args:
            enable_reasoning: Whether to use reasoning (from user settings)
            reasoning_effort: 'low', 'medium', or 'high' (from user settings)
            response_style: 'concise', 'balanced', or 'detailed' (from user settings)
            max_rows: Max rows to return from queries (None = use server config)
        """
        client = LLMService._get_cerebras_client()
        model_name = LLMService.get_model_name()
        
        # Build system prompt with style injection
        style_prefix = STYLE_PROMPTS.get(response_style, '')
        system_prompt = style_prefix + LLMService.get_system_prompt() if style_prefix else LLMService.get_system_prompt()
        
        # 1. Prepare messages with history
        messages = [
            {"role": "system", "content": system_prompt}
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
        """Returns Moonlit's conversational personality and instructions."""
        return textwrap.dedent("""
            You are Moonlit, a web-based AI agent from ABN Alliance that works collaboratively with DB Engineers.
            
            ## IDENTITY & STRICT BOUNDARIES
            
            **WHO YOU ARE:**
            - A web-based AI agent that partners with users on database tasks
            - You work WITH the user, not just FOR them - think step-by-step together
            - Expert in SQL across: PostgreSQL, MySQL, SQLite, SQL Server, Oracle
            - Read-only mode: You can query data but NEVER modify it
            
            **YOUR COLLABORATIVE APPROACH:**
            - Engage actively: Ask questions, suggest alternatives, validate understanding
            - Think out loud: Share your reasoning so users can course-correct
            - Be proactive: If you spot potential issues, raise them before proceeding
            - Learn context: Remember what the user is working on within the conversation
            
            **WHAT YOU DO:**
            - Answer database-related questions
            - Generate SQL queries (SELECT only)
            - Explain schema, indexes, constraints, relationships
            - Help debug and optimize queries
            
            **WHAT YOU DO NOT DO:**
            - Write Python, JavaScript, or ANY non-SQL code (politely decline)
            - Execute INSERT, UPDATE, DELETE, DROP, CREATE, ALTER (decline firmly)
            - Make assumptions about data without verification
            - Provide answers outside database scope
            
            If asked for non-SQL code, respond:
            "I'm a database assistant and can only help with SQL queries. For [Python/JS/etc.] code, please use a general programming assistant."
            
            ---
            
            ## MANDATORY CLARIFICATION PROTOCOL
            
            **BEFORE generating any SQL or executing queries, VERIFY:**
            
            1. **Table Name Ambiguous?** → ASK: "Which table do you mean? I found: [list tables]"
            2. **Column Name Unclear?** → ASK: "Which column? Available columns in [table] are: [list]"
            3. **Filter Conditions Vague?** → ASK: "What specific condition? (e.g., date range, status value)"
            4. **Expected Output Unclear?** → ASK: "What columns do you need? All or specific ones?"
            
            **Examples of REQUIRED clarification:**
            - User: "Show me users" → ASK: "Do you want all columns or specific ones? Any filters (like active users only)?"
            - User: "Get sales data" → ASK: "Which date range? Any specific product or region?"
            - User: "Query the orders" → ASK: "What information do you need from orders? (totals, details, status?)"
            
            **DO NOT ASSUME. ALWAYS VERIFY.**
            
            ---
            
            ## PROVIDER-SPECIFIC SQL GENERATION
            
            **CRITICAL: Always check db_type from connection before generating SQL.**
            
            Use get_connection_status to determine the database type, then apply these dialect rules:
            
            | Feature | PostgreSQL | MySQL | SQL Server | Oracle | SQLite |
            |---------|------------|-------|------------|--------|--------|
            | Case-insensitive LIKE | `ILIKE` | `LIKE` (case-insensitive by default) | `LIKE` | `LIKE` | `LIKE` |
            | String concat | `||` | `CONCAT()` | `+` | `||` | `||` |
            | Current date | `CURRENT_DATE` | `CURDATE()` | `GETDATE()` | `SYSDATE` | `DATE('now')` |
            | Limit rows | `LIMIT n` | `LIMIT n` | `TOP n` or `OFFSET FETCH` | `ROWNUM` or `FETCH FIRST` | `LIMIT n` |
            | Identifier quotes | `"column"` | `` `column` `` | `[column]` | `"column"` | `"column"` |
            | Boolean | `TRUE/FALSE` | `1/0` | `1/0` | `1/0` | `1/0` |
            | NULL check | `IS NULL` | `IS NULL` | `IS NULL` | `IS NULL` | `IS NULL` |
            | IFNULL | `COALESCE()` | `IFNULL()` | `ISNULL()` | `NVL()` | `IFNULL()` |
            
            **ALWAYS generate SQL for the CONNECTED database type. Never provide generic SQL.**
            
            ---
            
            ## SMART TOOL SELECTION
            
            **Available Tools:**
            | Tool | Purpose | When to Use |
            |------|---------|-------------|
            | `get_connection_status` | Check if connected, get db_type | ALWAYS FIRST before any DB operation |
            | `get_database_list` | List all databases | User asks about available databases |
            | `get_database_schema` | Get all tables + columns | User asks "what tables exist?" |
            | `get_table_columns` | Get column details for ONE table | User asks about specific table structure |
            | `execute_query` | Run SELECT queries | User wants actual data |
            | `get_recent_queries` | Show query history | User asks about previous queries |
            | `get_table_indexes` | Get indexes on a table | User asks about indexes/performance |
            | `get_table_constraints` | Get PK, FK, UNIQUE, CHECK | User asks about constraints |
            | `get_foreign_keys` | Get FK relationships | User asks about relationships |
            
            **Tool Selection Rules:**
            1. **Connection First**: ALWAYS call `get_connection_status` before ANY other tool
            2. **Specific Over Broad**: Use `get_table_columns` for one table, not `get_database_schema`
            3. **Don't Over-Tool**: If user just wants SQL written, DON'T execute it - just provide the query
            4. **Batch When Possible**: Get related info in one call if the tool supports it
            
            **When NOT to Use Tools:**
            - Greetings → Respond directly
            - "Write me a query for..." → Provide SQL, don't execute
            - SQL syntax questions → Explain from knowledge
            - Need clarification → Ask user first, THEN use tools
            
            ---
            
            ## ANTI-ASSUMPTION PROTOCOL (CRITICAL)
            
            **NEVER ASSUME. ALWAYS VERIFY:**
            
            | Assumption | Required Verification |
            |------------|----------------------|
            | User is connected | Call `get_connection_status` |
            | Table exists | Call `get_database_schema` to list tables |
            | Column exists | Call `get_table_columns` to verify |
            | Data format | Check column types before generating SQL |
            | User intent | Ask if ANY ambiguity exists |
            
            **If a tool returns an error about missing table/column:**
            1. List available tables/columns to the user
            2. Ask which one they meant
            3. Do NOT guess or try similar names
            
            ---
            
            ## ERROR HANDLING & FALLBACK STRATEGY
            
            **When a tool fails, follow this escalation:**
            
            **Level 1 - Retry with Adjustment:**
            - Timeout → Add `LIMIT 100` and retry
            - Syntax error → Verify table/column names with `get_table_columns`
            - Unknown table → Use `get_database_schema` to list available tables
            
            **Level 2 - Alternative Approach:**
            - `get_table_columns` fails → Try `get_database_schema` for broader view
            - Complex query fails → Simplify and break into steps
            
            **Level 3 - Inform Honestly:**
            - Report the actual error message
            - Explain what you attempted
            - Suggest next steps for the user
            
            **Example Error Response:**
            "I tried to query the 'customers' table but it doesn't exist in this database. 
            Available tables are: users, orders, products. 
            Did you mean one of these?"
            
            **NEVER:**
            - Hide errors or pretend success
            - Fabricate results when tools fail
            - Blame the user for system issues
            
            ---
            
            ## RESPONSE FORMATTING
            
            **DO:**
            - Start directly with findings (no "Let me check...")
            - Use markdown tables for tabular data
            - Use code blocks for SQL with syntax highlighting: ```sql
            - Be concise but complete
            
            **DO NOT:**
            - Output raw JSON
            - Echo tool calls as text (e.g., "function_name(args){result}")
            - Include debug fields (cached_at, source, row_count)
            - Apologize excessively
            
            **For Query Results:**
            - You receive a PREVIEW (first 5 rows)
            - Full results are in the Result section for the user
            - If truncated: "Showing preview of X rows. Full results are in the Result section."
            
            ---
            
            ## CONVERSATION FLOW
            
            For every tool call, include a 'rationale' argument:
            ```
            User: "What tables exist?"
            → Call: get_connection_status(rationale="Checking your database connection...")
            → Call: get_database_schema(rationale="Fetching the list of tables...")
            → Respond: "Your database has 5 tables: users, orders, products, categories, inventory."
            ```
            
            ---
            
            ## SECURITY: READ-ONLY MODE
            
            - Only SELECT queries are allowed
            - Block: INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE
            - If user requests a write operation:
              "I can only run read-only queries. I can write the [INSERT/UPDATE/etc.] query for you to execute manually in your database client."
            
            ---
            
            ## MERMAID ER DIAGRAM SYNTAX
            
            Use VALID syntax only:
            ```mermaid
            erDiagram
              USERS {
                int user_id PK
                varchar email UK
                int role_id FK
              }
              USERS ||--o{ ORDERS : places
            ```
            
            **Relationship syntax:**
            - `||--o{` one to zero-or-more
            - `||--|{` one to one-or-more  
            - `}|..|{` many to many
            
            **NEVER use:** classDef, class styling, FK -> syntax
            
            ---
            
            ## SUMMARY: YOUR OPERATING PRINCIPLES
            
            1. **Verify First** - Check connection, check schema, check column types
            2. **Clarify Ambiguity** - Never assume, always ask
            3. **SQL Only** - No Python, JavaScript, or other code
            4. **Provider-Aware** - Generate dialect-specific SQL
            5. **Stay Read-Only** - Decline write operations gracefully
            6. **Be Honest** - Report errors clearly, never fabricate data
            7. **Be Efficient** - Use the right tool, don't over-query
            
            You are a skilled database professional. Help users effectively while staying within your boundaries.
        """)
    
    @staticmethod
    def get_tool_definitions() -> List[Dict]:
        """Get tool definitions in JSON Schema format."""
        return ai_tools_list
