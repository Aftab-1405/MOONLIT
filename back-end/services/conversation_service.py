"""
Conversation Service

Handles conversation management, AI streaming responses, and Firestore persistence.
Centralizes all conversation-related business logic.
"""

import uuid
import logging
import re
from typing import Optional, Generator
from flask import session

logger = logging.getLogger(__name__)


class ConversationService:
    """Service for managing conversations and AI interactions."""
    
    @staticmethod
    def create_or_get_conversation_id(provided_id: Optional[str] = None) -> str:
        """
        Generate new conversation ID or return provided one.
        Single source of truth for conversation ID logic.
        
        Args:
            provided_id: Optional conversation ID from client
            
        Returns:
            A valid conversation ID (either provided or newly generated)
        """
        if provided_id:
            return provided_id
        
        # Generate new ID and store in session
        new_id = str(uuid.uuid4())
        session['conversation_id'] = new_id
        return new_id
    
    @staticmethod
    def initialize_conversation(conversation_id: str, history: list = None) -> None:
        """
        Initialize conversation (no-op - conversation history is passed with each request).
        
        Args:
            conversation_id: The conversation to initialize
            history: Optional list of message history (not used)
        """
        # No-op: Cerebras doesn't need session initialization
        pass
    
    @staticmethod
    def get_conversation_data(conversation_id: str) -> Optional[dict]:
        """
        Fetch conversation from Firestore.
        
        Args:
            conversation_id: The conversation to fetch
            
        Returns:
            Conversation data dict or None if not found
        """
        from services.firestore_service import FirestoreService
        
        conv_data = FirestoreService.get_conversation(conversation_id)
        
        if conv_data:
            # Store conversation ID in session
            session['conversation_id'] = conversation_id
            # Note: History is now passed directly to generate_content, no session needed
            
        return conv_data
    
    @staticmethod
    def delete_user_conversation(conversation_id: str, user_id: str) -> None:
        """
        Delete conversation from Firestore.
        
        Args:
            conversation_id: The conversation to delete
            user_id: Owner of the conversation
            
        Raises:
            Exception on failure
        """
        from services.firestore_service import FirestoreService
        FirestoreService.delete_conversation(conversation_id, user_id)
        
        # Clear from session if it's the current conversation
        if session.get('conversation_id') == conversation_id:
            session.pop('conversation_id', None)
    
    @staticmethod
    def get_user_conversations(user_id: str) -> list:
        """
        Get all conversations for a user.
        
        Args:
            user_id: The user ID
            
        Returns:
            List of conversation summaries
        """
        from services.firestore_service import FirestoreService
        return FirestoreService.get_conversations(user_id)
    
    @staticmethod
    def create_streaming_generator(conversation_id: str, prompt: str, user_id: str, 
                                    db_config: dict = None,
                                    enable_reasoning: bool = True,
                                    reasoning_effort: str = 'medium',
                                    response_style: str = 'balanced',
                                    max_rows: int = None) -> Generator:
        """
        Create a generator for streaming AI responses WITH tool support.
        
        Handles:
        - Streaming from Cerebras with function calling
        - Tool status markers ([[TOOL:name:running:...]], [[TOOL:name:done:...]])
        - Storing user prompt on first successful chunk
        - Storing complete AI response after streaming
        - Error handling for quota/API errors
        
        CRITICAL: Doesn't store anything in Firestore if API errors occur
        
        Args:
            conversation_id: The conversation ID
            prompt: User's prompt
            user_id: The user ID for Firestore
            db_config: Database connection config for tool execution
            enable_reasoning: Whether to use reasoning (from user settings)
            reasoning_effort: 'low', 'medium', or 'high' (from user settings)
            response_style: 'concise', 'balanced', or 'detailed' (from user settings)
            max_rows: Max rows to return from queries (None = use server config)
            
        Yields:
            Text chunks from AI response, tool status markers, or error messages
        """
        from services.firestore_service import FirestoreService
        from services.llm_service import LLMService
        
        prompt_stored = False
        response_stored = False  # Track if we've stored the AI response
        full_response_content = []
        tools_used = []  # Track tools for persistence
        was_aborted = False  # Track if stream was aborted by user
        
        try:
            # Fetch existing conversation history for context
            # Limit to last 20 messages to prevent token explosion in long conversations
            conv_data = FirestoreService.get_conversation(conversation_id)
            history = None
            if conv_data and conv_data.get('messages'):
                messages = conv_data.get('messages', [])
                # Keep only last 20 messages for context (token efficiency)
                recent_messages = messages[-20:] if len(messages) > 20 else messages
                history = [
                    {"role": "user" if msg["sender"] == "user" else "model", "parts": [msg["content"]]}
                    for msg in recent_messages
                ]
                logger.debug(f"Loaded {len(history)} messages for context (from {len(messages)} total)")
            
            # Use LLM Service (generic) with tool support
            # Pass reasoning settings, response style, and max_rows from user preferences
            responses = LLMService.send_message_with_tools(
                conversation_id, prompt, user_id, 
                history=history, 
                db_config=db_config,
                enable_reasoning=enable_reasoning,
                reasoning_effort=reasoning_effort,
                response_style=response_style,
                max_rows=max_rows
            )
            
            for chunk in responses:
                # Tool status markers - pass through to frontend AND track for storage
                # Format: [[TOOL:name:status:args:result]]
                if chunk.startswith('[[TOOL:'):
                    # Parse: [[TOOL:toolname:running:args:null]] or [[TOOL:toolname:done:args:result]]
                    match = re.match(r'\[\[TOOL:(\w+):(running|done):.*?\]\]', chunk)
                    if match:
                        tool_name, status = match.groups()
                        if status == 'running':
                            tools_used.append({'name': tool_name, 'status': 'running'})
                            # Store user prompt when we start using tools (if not already stored)
                            if not prompt_stored:
                                FirestoreService.store_conversation(conversation_id, 'user', prompt, user_id)
                                prompt_stored = True
                                logger.debug(f"Stored user prompt on tool start: {prompt[:50]}...")
                        elif status == 'done':
                            # Update the tool status
                            for tool in tools_used:
                                if tool['name'] == tool_name and tool['status'] == 'running':
                                    tool['status'] = 'done'
                                    break
                    
                    # INCLUDE tool markers in stored content for history replay
                    full_response_content.append(chunk)
                    yield chunk
                    continue
                
                # Handle thinking markers - pass through AND store for history
                if chunk.startswith('[[THINKING:'):
                    full_response_content.append(chunk)
                    yield chunk
                    continue
                
                # Store user prompt only when we get the first actual text chunk
                if not prompt_stored and not chunk.startswith('['):
                    FirestoreService.store_conversation(conversation_id, 'user', prompt, user_id)
                    prompt_stored = True
                    logger.debug(f"Stored user prompt on text chunk: {prompt[:50]}...")
                
                # Collect ALL content for storage (including markers)
                full_response_content.append(chunk)
                
                yield chunk

        except GeneratorExit:
            # User aborted the stream (frontend closed connection)
            was_aborted = True
            logger.info(f"Stream aborted by user for conversation {conversation_id}")
            
        except Exception as err:
            # Handle any API or streaming errors
            error_str = str(err).lower()
            
            if 'rate_limit' in error_str or 'quota' in error_str or '429' in error_str:
                logger.warning(f'Cerebras rate limit exceeded: {err}')
                error_msg = "⚠️ **API Rate Limit Exceeded**\n\nThe AI service is temporarily unavailable due to high usage. Please wait a moment and try again.\n\n_This message was not saved to your conversation._"
            elif 'authentication' in error_str or '401' in error_str:
                logger.error(f'Cerebras authentication error: {err}')
                error_msg = "⚠️ **Authentication Error**\n\nThere was a problem with the AI service authentication. Please check API keys.\n\n_This message was not saved to your conversation._"
            else:
                logger.error(f'Cerebras API error: {err}')
                error_msg = "⚠️ **AI Service Error**\n\nThere was a problem connecting to the AI service. Please try again.\n\n_This message was not saved to your conversation._"
            
            yield error_msg
            
        finally:
            # Store AI response (complete or partial) - runs even on abort
            if prompt_stored and not response_stored:
                response_text = "".join(full_response_content).strip()
                if response_text or tools_used:
                    # If no text but tools were used, create a placeholder response
                    if not response_text and tools_used:
                        response_text = "(Used tools to gather information)"
                        logger.warning("AI returned no text after tool use, using placeholder")
                    
                    # Add indicator if response was stopped mid-stream
                    if was_aborted and response_text:
                        response_text += "\n\n_(Response stopped by user)_"
                    
                    FirestoreService.store_conversation(
                        conversation_id, 'ai', response_text, user_id,
                        tools=tools_used if tools_used else None
                    )
                    response_stored = True
                    status = "partial (aborted)" if was_aborted else "complete"
                    logger.info(f"Stored AI response ({status}): {len(response_text)} chars, {len(tools_used)} tools")
    
    @staticmethod
    def get_streaming_headers(conversation_id: str) -> dict:
        """
        Get HTTP headers for streaming responses.
        
        Args:
            conversation_id: The conversation ID to include in headers
            
        Returns:
            Dict of HTTP headers optimized for streaming
        """
        return {
            'X-Conversation-Id': conversation_id,
            'Cache-Control': 'no-cache, no-transform',
            # Some reverse proxies buffer streamed responses; this header helps disable that behavior
            'X-Accel-Buffering': 'no'
        }
    
    @staticmethod
    def check_quota_error(error_message: str) -> bool:
        """
        Check if an error message indicates quota exceeded.
        
        Args:
            error_message: The error message to check
            
        Returns:
            True if it's a quota error, False otherwise
        """
        error_lower = error_message.lower()
        return 'quota' in error_lower or '429' in error_lower or 'rate' in error_lower
