"""
Conversation Repository

Encapsulates Firestore data access for conversation documents.
Collection: conversations/{conversation_id}
"""

import re
import logging
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class ConversationRepository:
    """Data access layer for conversations in Firestore."""
    
    COLLECTION_NAME = 'conversations'
    
    @staticmethod
    def _strip_markers(text: str) -> tuple[str, str]:
        """
        Strip streaming markers from message before storing and extract thinking content.

        THINKING markers are stripped (content extracted separately).
        TOOL markers are PRESERVED in content for proper inline rendering on page load.
        
        Returns:
            tuple: (cleaned_text, thinking_content)
        """
        if not text:
            return text, ''

        thinking_content = ''

        # Extract thinking content from chunks (handles complete markers)
        thinking_chunks = re.findall(r'\[\[THINKING:chunk:(.*?)\]\]', text, re.DOTALL)
        if thinking_chunks:
            thinking_content = ''.join(thinking_chunks)

        # Strip thinking markers (handles both complete and incomplete markers)
        text = re.sub(r'\[\[THINKING:start\]\]', '', text)
        text = re.sub(r'\[\[THINKING:chunk:.*?\]\]', '', text, flags=re.DOTALL)  # Complete markers
        text = re.sub(r'\[\[THINKING:end\]\]', '', text)
        # Clean up any remaining incomplete THINKING markers (without proper closing ]])
        text = re.sub(r'\[\[THINKING:[^\]]*\]?$', '', text)  # Incomplete at end
        text = re.sub(r'\[\[THINKING:[^\]]*\](?!\])', '', text)  # Single ] instead of ]]

        # NOTE: Tool markers [[TOOL:...]] are intentionally KEPT in content
        # This ensures tools render inline with text in correct order after page refresh,
        # matching the streaming behavior. The frontend parseMessageSegments() handles them.

        # Strip raw JSON objects that LLM might echo (tool arguments/results)
        # Pattern: { ... } with proper bracket matching
        text = ConversationRepository._strip_json_objects(text)

        return text.strip(), thinking_content

    @staticmethod
    def _strip_json_objects(text: str) -> str:
        """
        Remove JSON objects that the LLM might echo in its response.
        These are typically tool arguments or error responses that leak through.

        Uses bracket matching to properly identify complete JSON objects.
        PRESERVES JSON inside [[TOOL:...]] markers - those are needed for parsing.
        """
        if not text or '{' not in text:
            return text

        result = []
        i = 0

        while i < len(text):
            # Check if we're inside a [[TOOL: marker - if so, preserve JSON
            # Look backwards to see if we're inside a tool marker
            preceding = text[max(0, i-100):i]  # Check up to 100 chars before
            in_tool_marker = '[[TOOL:' in preceding and ']]' not in preceding[preceding.rfind('[[TOOL:'):]
            
            # Check if we're at the start of a potential JSON object
            if text[i] == '{' and not in_tool_marker:
                # Try to find the matching closing brace
                depth = 1
                j = i + 1
                in_string = False
                escape_next = False

                while j < len(text) and depth > 0:
                    if escape_next:
                        escape_next = False
                        j += 1
                        continue

                    char = text[j]

                    if char == '\\' and in_string:
                        escape_next = True
                    elif char == '"':
                        in_string = not in_string
                    elif not in_string:
                        if char == '{':
                            depth += 1
                        elif char == '}':
                            depth -= 1

                    j += 1

                # If we found a complete JSON object, try to parse it
                if depth == 0:
                    json_candidate = text[i:j]
                    try:
                        import json
                        json.loads(json_candidate)
                        # Valid JSON - skip it (don't add to result)
                        i = j
                        continue
                    except (json.JSONDecodeError, ValueError):
                        # Not valid JSON - keep the character
                        result.append(text[i])
                        i += 1
                else:
                    # Incomplete JSON - keep the character
                    result.append(text[i])
                    i += 1
            else:
                result.append(text[i])
                i += 1

        return ''.join(result)
    
    @staticmethod
    def get(conversation_id: str) -> Optional[Dict]:
        """
        Get conversation by ID.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            Conversation document as dict, or None if not exists
        """
        from services.firestore_service import FirestoreService
        try:
            db = FirestoreService.get_db()
            doc = db.collection(ConversationRepository.COLLECTION_NAME).document(conversation_id).get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error(f"Error retrieving conversation {conversation_id}: {e}")
            raise
    
    @staticmethod
    def get_by_user(user_id: str) -> List[Dict]:
        """
        Get all conversations for a user.
        
        Args:
            user_id: The user ID
            
        Returns:
            List of conversation summaries (id, timestamp, title, preview)
        """
        from services.firestore_service import FirestoreService
        from google.cloud.firestore_v1 import FieldFilter
        
        try:
            db = FirestoreService.get_db()
            conversations = (
                db.collection(ConversationRepository.COLLECTION_NAME)
                .where(filter=FieldFilter('user_id', '==', user_id))
                .get()
            )
            
            conversation_list = []
            for conv in conversations:
                conv_data = conv.to_dict()
                if conv_data.get('messages'):
                    first_msg = conv_data['messages'][0]['content']
                    conversation_list.append({
                        'id': conv.id,
                        'timestamp': conv_data['timestamp'],
                        'title': first_msg[:40] + ('...' if len(first_msg) > 40 else ''),
                        'preview': first_msg[:50] + '...'
                    })
            
            # Sort by timestamp descending (newest first)
            conversation_list.sort(key=lambda x: x['timestamp'], reverse=True)
            return conversation_list
        except Exception as e:
            logger.error(f"Error retrieving conversations for user {user_id}: {e}")
            raise
    
    @staticmethod
    def store_message(
        conversation_id: str, 
        sender: str, 
        message: str, 
        user_id: str, 
        tools: List[Dict] = None
    ) -> None:
        """
        Store a message in a conversation.
        
        Creates the conversation document if it doesn't exist.
        AI messages have streaming markers stripped before storage.
        
        Args:
            conversation_id: The conversation ID
            sender: 'user' or 'ai'
            message: The message content
            user_id: The user ID (owner)
            tools: Optional list of tools used (for AI messages)
        """
        from services.firestore_service import FirestoreService
        from firebase_admin import firestore
        
        try:
            db = FirestoreService.get_db()
            conversation_ref = db.collection(ConversationRepository.COLLECTION_NAME).document(conversation_id)
            
            # Create conversation if it doesn't exist
            if not conversation_ref.get().exists:
                conversation_ref.set({
                    'user_id': user_id,
                    'timestamp': datetime.now(),
                    'messages': []
                })
            
            # Clean the message content for storage and extract thinking
            if sender == 'ai':
                clean_message, thinking_content = ConversationRepository._strip_markers(message)
            else:
                clean_message = message
                thinking_content = ''

            # Build the message object
            message_data = {
                'sender': sender,
                'content': clean_message,
                'timestamp': datetime.now()
            }

            # Add thinking content if present (for AI messages with reasoning)
            if thinking_content:
                message_data['thinking'] = thinking_content

            # Add tools info if provided (for AI messages)
            if tools:
                message_data['tools'] = tools
            
            conversation_ref.update({
                'messages': firestore.ArrayUnion([message_data])
            })
            logger.debug(f"Conversation {conversation_id} updated successfully")
        except Exception as e:
            logger.error(f"Error storing message in conversation {conversation_id}: {e}")
            raise
    
    @staticmethod
    def delete(conversation_id: str, user_id: str) -> bool:
        """
        Delete a conversation. Verifies user ownership.
        
        Args:
            conversation_id: The conversation ID
            user_id: The user ID (must own the conversation)
            
        Returns:
            True if deleted successfully
            
        Raises:
            PermissionError: If the user doesn't own the conversation
            ValueError: If conversation is not found
        """
        from services.firestore_service import FirestoreService
        
        try:
            db = FirestoreService.get_db()
            conversation_ref = db.collection(ConversationRepository.COLLECTION_NAME).document(conversation_id)
            conversation = conversation_ref.get()
            
            if not conversation.exists:
                raise ValueError("Conversation not found")
            
            conv_data = conversation.to_dict()
            if conv_data['user_id'] != user_id:
                raise PermissionError("User does not own this conversation")
            
            conversation_ref.delete()
            logger.info(f"Conversation {conversation_id} deleted successfully")
            return True
        except (ValueError, PermissionError):
            raise
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}")
            raise
