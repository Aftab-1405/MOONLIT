import os
import json
import logging
import textwrap
from typing import List, Dict, Generator, Any
from openai import OpenAI
from cerebras.cloud.sdk import Cerebras
from services.ai_tools import ai_tools_list

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants for default values - can be overridden by env vars
# Cerebras offers 1M free tokens/day with excellent tool calling support
# gpt-oss-120b supports reasoning with reasoning_effort parameter
DEFAULT_MODEL = "gpt-oss-120b"
DEFAULT_BASE_URL = "https://api.cerebras.ai/v1"

# Models that support reasoning (Cerebras-specific)
REASONING_MODELS = ['gpt-oss-120b', 'zai-glm-4.6']

class LLMService:
    """
    Service for LLM APIs - uses Cerebras SDK for Cerebras models, OpenAI for others.
    """
    
    @staticmethod
    def _get_client():
        """Creates and returns an OpenAI-compatible client for general use."""
        api_key = os.getenv('LLM_API_KEY')
        base_url = os.getenv('LLM_BASE_URL', DEFAULT_BASE_URL)
        
        if not api_key:
            logger.error("LLM_API_KEY not found in environment variables")
            raise ValueError("LLM_API_KEY is required")
            
        return OpenAI(
            api_key=api_key,
            base_url=base_url
        )
    
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
    def _summarize_result(result: Dict[str, Any]) -> str:
        """Create a concise summary of the tool result for the logs/UI."""
        summary = {}
        
        if 'error' in result:
            summary['status'] = 'error'
            summary['message'] = result['error']
        elif 'connected' in result:
            # Connection status tool
            summary['connected'] = result.get('connected', False)
            summary['database'] = result.get('database')
            summary['db_type'] = result.get('db_type')
            summary['host'] = result.get('host')
        elif 'tables' in result:
            # Schema tool - has 'tables' list (check BEFORE 'columns' since schema has both!)
            tables = result['tables']
            count = len(tables) if isinstance(tables, list) else 0
            summary['tables'] = count
            summary['database'] = result.get('database')
        elif 'columns' in result and isinstance(result['columns'], list):
            # Table columns tool - 'columns' is a list of column info
            summary['columns'] = len(result['columns'])
            summary['table'] = result.get('table_name')
        elif 'databases' in result:
            # Database list tool
            dbs = result['databases']
            summary['databases'] = len(dbs) if isinstance(dbs, list) else 0
            summary['current'] = result.get('current_database')
        elif 'row_count' in result:
            summary['rows'] = result['row_count']
        elif 'queries' in result:
            summary['count'] = len(result['queries']) if isinstance(result['queries'], list) else 0
        else:
            summary['status'] = 'success'
        
        return json.dumps(summary)
    
    @staticmethod
    def send_message(conversation_id: str, message: str, history: list = None):
        """
        Simple message without tools - used for basic chat.
        Returns a non-streaming response.
        """
        client = LLMService._get_client()
        
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
        reasoning_effort: str = 'medium'
    ) -> Generator[str, None, None]:
        """
        Sends a message to the LLM and handles tool calls in a streaming response.
        This orchestration loop runs on the backend to handle the multi-turn interaction.
        
        Args:
            enable_reasoning: Whether to use reasoning (from user settings)
            reasoning_effort: 'low', 'medium', or 'high' (from user settings)
        """
        client = LLMService._get_client()
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
                    try:
                        function_args = json.loads(tool_call.function.arguments)
                        if function_args is None:
                            function_args = {}
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse arguments for {function_name}: {tool_call.function.arguments}")
                        function_args = {}
                    
                    # Extract conversational rationale if present
                    rationale = function_args.get('rationale')
                    if rationale:
                        yield f"{rationale}\n\n"
                    
                    # Prepare arguments for display (exclude rationale from UI)
                    display_args = {k: v for k, v in function_args.items() if k != 'rationale'}
                    args_json = json.dumps(display_args, default=str)
                    
                    # Yield "running" status BEFORE tool execution
                    yield f"[[TOOL:{function_name}:running:{args_json}:null]]\n\n"
                    
                    # Execute the tool
                    function_response = LLMService.execute_tool(
                        function_name, function_args, user_id, db_config=db_config
                    )
                    
                    # Yield "done" status with result AFTER tool completes
                    result_summary = LLMService._summarize_result(json.loads(function_response))
                    yield f"[[TOOL:{function_name}:done:{args_json}:{result_summary}]]\n\n"
                    
                    # Add tool response to messages for LLM context
                    messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": function_response
                    })
            
            # After tool loop, get final streaming response
            logger.info("Getting final response after all tool executions (streaming)")
            
            # Determine if we should use reasoning for this request
            use_reasoning = enable_reasoning and LLMService.is_reasoning_model()
            
            if use_reasoning:
                # Use Cerebras SDK for reasoning models
                cerebras_client = LLMService._get_cerebras_client()
                stream = cerebras_client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    stream=True,
                    reasoning_effort=reasoning_effort,
                    max_completion_tokens=8192,
                    temperature=1,
                    top_p=1
                )
            else:
                # Final call without tools to get text response
                stream = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    stream=True
                )
            
            # Yield chunks as they arrive, handling reasoning tokens
            reasoning_started = False
            first_chunk = True
            has_content = False
            
            for chunk in stream:
                delta = chunk.choices[0].delta
                
                # Debug: Log the first chunk to see its structure
                if first_chunk and use_reasoning:
                    logger.info(f"First chunk delta type: {type(delta)}")
                    logger.info(f"First chunk delta attrs: {dir(delta)}")
                    first_chunk = False
                
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
    def execute_tool(function_name, function_args, user_id, db_config=None):
        """Execute a tool and return the result as JSON string."""
        from services.ai_tools import AIToolExecutor
        result = AIToolExecutor.execute(function_name, function_args, user_id, db_config=db_config)
        # Ensure we return a string for the LLM tool result
        if isinstance(result, (dict, list)):
            return json.dumps(result, default=str)
        return str(result)
    
    @staticmethod
    def get_system_prompt():
        """Returns DB-Genie's conversational personality and instructions."""
        return textwrap.dedent("""
            You are DB-Genie, a friendly and experienced database engineer from ABN Alliance.
            You speak naturally, like a helpful colleague who genuinely enjoys databases.
            
            ## YOUR PERSONALITY
            
            - You're enthusiastic about data and databases
            - You explain things clearly, like a senior engineer mentoring a junior
            - **CRITICAL**: Do NOT say "Let me check" or "I'll run that" - the action has already happened.
            - Start your response directly with the findings/results.
            - After getting results, you summarize them conversationally
            - If something goes wrong, you explain it helpfully, not robotically
            
            ## CONVERSATION FLOW
            
            When user asks something that needs a tool:
            1. You MUST generate a 'rationale' argument for the tool call
            2. The system will show this rationale to the user BEFORE the tool runs
            3. Then the tool runs
            4. Then you explain the results naturally
            
            Example flow for "Am I connected?":
            - You call get_connection_status(rationale="Let me check your current connection status...")
            - User sees: "Let me check your current connection status..." -> [Tool runs]
            - You say: "Great news! You're connected to the 'sales' database..."
            
            ## STEP-BY-STEP WORKFLOW
            
            For database operations, follow these steps:
            
            **STEP 1:** Check connection first (get_connection_status)
            **STEP 2:** Understand context (remote/local, db_type, database)
            **STEP 3:** Proceed with user's request
            
            ## WHEN TO USE TOOLS
            
            - "Am I connected?" → get_connection_status
            - "What tables exist?" → get_database_schema
            - "Show columns in X" → get_table_columns
            - "Show data from X" → get_sample_data
            - "Run/Execute this query" → execute_query
            
            ## WHEN NOT TO USE TOOLS
            
            Just chat naturally for:
            - Greetings ("hi", "hello") - respond warmly!
            - "Write me a query" - provide the SQL, don't execute
            - SQL syntax questions - explain helpfully
            
            ## HANDLING ERRORS
            
            If a tool returns an error:
            - Don't panic! Explain what went wrong in friendly terms
            - Suggest what the user can do to fix it
            - Example: "Hmm, it looks like you're not connected to a database yet. 
              You can connect using the sidebar on the left!"
            
            ## SECURITY: READ-ONLY MODE
            
            - Only SELECT queries are allowed
            - Politely decline INSERT/UPDATE/DELETE/DROP requests
            - Example: "I'm in read-only mode for safety, but I can help you 
              write the query - you'll just need to run it yourself!"
            
            ## RESPONSE STYLE
            
            - Be warm, professional, and helpful
            - Use ```sql blocks for SQL code
            - Summarize query results clearly with insights
            - Use markdown formatting for readability
            
            You're not a robot - you're a skilled database professional who loves helping!
        """)
    
    @staticmethod
    def get_tool_definitions() -> List[Dict]:
        """Get tool definitions in JSON Schema format."""
        return ai_tools_list
