"""
Conversation Repository

Encapsulates Firestore data access for conversation documents.
Collection: conversations/{conversation_id}

Messages are stored as structured fields only:
- ``content``: assistant or user text (no embedded markers)
- ``thinking``: optional reasoning text (from SSE / API)
- ``tools``: optional structured tool call list
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class ConversationRepository:
    """Data access layer for conversations in Firestore."""

    COLLECTION_NAME = "conversations"

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
            doc = (
                db.collection(ConversationRepository.COLLECTION_NAME)
                .document(conversation_id)
                .get()
            )
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error(f"Error retrieving conversation {conversation_id}: {e}")
            raise

    @staticmethod
    def get_for_user(conversation_id: str, user_id: str) -> Optional[Dict]:
        """
        Get conversation by ID, verifying user ownership.

        Args:
            conversation_id: The conversation ID
            user_id: The user ID (must own the conversation)

        Returns:
            Conversation document as dict, or None if not exists

        Raises:
            PermissionError: If the user doesn't own the conversation
        """
        conv = ConversationRepository.get(conversation_id)
        if conv is None:
            return None
        if conv.get("user_id") != user_id:
            raise PermissionError("User does not own this conversation")
        return conv

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
                .where(filter=FieldFilter("user_id", "==", user_id))
                .get()
            )

            conversation_list = []
            for conv in conversations:
                conv_data = conv.to_dict()
                if conv_data.get("messages"):
                    first_msg = conv_data["messages"][0]["content"]
                    title = conv_data.get("title") or first_msg[:40] + (
                        "..." if len(first_msg) > 40 else ""
                    )
                    conversation_list.append(
                        {
                            "id": conv.id,
                            "timestamp": conv_data["timestamp"],
                            "title": title,
                            "preview": first_msg[:50] + "...",
                        }
                    )

            conversation_list.sort(key=lambda x: x["timestamp"], reverse=True)
            return conversation_list
        except Exception as e:
            logger.error(f"Error retrieving conversations for user {user_id}: {e}")
            raise

    @staticmethod
    def rename(conversation_id: str, user_id: str, title: str) -> str:
        """
        Rename a conversation. Verifies user ownership.

        Args:
            conversation_id: The conversation ID
            user_id: The user ID (must own the conversation)
            title: New conversation title

        Returns:
            Sanitized title stored on the conversation

        Raises:
            PermissionError: If the user doesn't own the conversation
            ValueError: If conversation is not found
        """
        from services.firestore_service import FirestoreService

        try:
            db = FirestoreService.get_db()
            conversation_ref = db.collection(
                ConversationRepository.COLLECTION_NAME
            ).document(conversation_id)
            conversation = conversation_ref.get()

            if not conversation.exists:
                raise ValueError("Conversation not found")

            conv_data = conversation.to_dict()
            if conv_data["user_id"] != user_id:
                raise PermissionError("User does not own this conversation")

            sanitized_title = title.strip()
            conversation_ref.update({"title": sanitized_title})
            logger.info(f"Conversation {conversation_id} renamed successfully")
            return sanitized_title
        except (ValueError, PermissionError):
            raise
        except Exception as e:
            logger.error(f"Error renaming conversation {conversation_id}: {e}")
            raise

    @staticmethod
    def store_message(
        conversation_id: str,
        sender: str,
        message: str,
        user_id: str,
        tools: List[Dict] = None,
        *,
        thinking: Optional[str] = None,
        timeline: Optional[List[Dict]] = None,
        append: bool = False,
    ) -> None:
        """
        Store a message in a conversation.

        Creates the conversation document if it doesn't exist.

        Args:
            conversation_id: The conversation ID
            sender: 'user' or 'ai'
            message: Plain message body (no legacy markers)
            user_id: The user ID (owner)
            tools: Optional list of tools used (for AI messages)
            thinking: Optional reasoning text (AI messages)
            append: If True, merges content/thinking/tools into the last message if it is from the same sender
        """
        from services.firestore_service import FirestoreService
        from firebase_admin import firestore

        try:
            db = FirestoreService.get_db()
            conversation_ref = db.collection(
                ConversationRepository.COLLECTION_NAME
            ).document(conversation_id)

            existing_doc = conversation_ref.get()
            if existing_doc.exists:
                conv_data = existing_doc.to_dict()
                if conv_data.get("user_id") != user_id:
                    raise PermissionError("User does not own this conversation")
            else:
                conversation_ref.set(
                    {
                        "user_id": user_id,
                        "timestamp": datetime.now(),
                        "messages": [],
                    }
                )
                conv_data = {"user_id": user_id, "messages": []}

            # If append is requested, modify the last message in-place if sender matches
            if append and existing_doc.exists and conv_data.get("messages"):
                messages_list = conv_data["messages"]
                last_message = messages_list[-1]
                if last_message.get("sender") == sender:
                    # Append text content
                    orig_content = last_message.get("content", "")
                    new_content = (message or "").strip()
                    if orig_content and new_content:
                        # Smart spacing: if both boundary characters are alphanumeric, insert a space
                        if orig_content[-1].isalnum() and new_content[0].isalnum():
                            last_message["content"] = orig_content + " " + new_content
                        else:
                            last_message["content"] = orig_content + new_content
                    elif new_content:
                        last_message["content"] = new_content

                    # Append thinking content
                    if thinking and thinking.strip():
                        orig_thinking = last_message.get("thinking", "")
                        new_thinking = thinking.strip()
                        if orig_thinking:
                            last_message["thinking"] = orig_thinking + "\n" + new_thinking
                        else:
                            last_message["thinking"] = new_thinking

                    # Append tools list
                    if tools:
                        orig_tools = last_message.get("tools", [])
                        last_message["tools"] = orig_tools + tools

                    # Append timeline entries
                    if timeline:
                        orig_tl = last_message.get("timeline", [])
                        last_message["timeline"] = orig_tl + timeline

                    conversation_ref.update({"messages": messages_list})
                    logger.debug(f"Conversation {conversation_id} updated successfully by appending to last {sender} message")
                    return

            content = (message or "").strip()

            message_data: Dict = {
                "sender": sender,
                "content": content,
                "timestamp": datetime.now(),
            }

            if sender == "ai" and thinking and thinking.strip():
                message_data["thinking"] = thinking.strip()

            if tools:
                message_data["tools"] = tools

            if timeline:
                message_data["timeline"] = timeline

            conversation_ref.update({"messages": firestore.ArrayUnion([message_data])})
            logger.debug(f"Conversation {conversation_id} updated successfully")
        except Exception as e:
            logger.error(
                f"Error storing message in conversation {conversation_id}: {e}"
            )
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
            conversation_ref = db.collection(
                ConversationRepository.COLLECTION_NAME
            ).document(conversation_id)
            conversation = conversation_ref.get()

            if not conversation.exists:
                raise ValueError("Conversation not found")

            conv_data = conversation.to_dict()
            if conv_data["user_id"] != user_id:
                raise PermissionError("User does not own this conversation")

            conversation_ref.delete()
            logger.info(f"Conversation {conversation_id} deleted successfully")
            return True
        except (ValueError, PermissionError):
            raise
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}")
            raise
