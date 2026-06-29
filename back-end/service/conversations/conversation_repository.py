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
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

_REST_READ_FALLBACK_ACTIVE = False
_REST_READ_FALLBACK_LOCK = threading.Lock()


def _is_transient_firestore_error(exc: Exception) -> bool:
    from google.api_core import exceptions

    return isinstance(
        exc,
        (
            exceptions.DeadlineExceeded,
            exceptions.ResourceExhausted,
            exceptions.ServiceUnavailable,
            exceptions.TooManyRequests,
        ),
    )


def _interactive_firestore_policy():
    from config import get_config
    from google.api_core.retry import Retry

    timeout = max(
        2.0,
        float(get_config().FIRESTORE_INTERACTIVE_READ_TIMEOUT_SECONDS),
    )
    retry = Retry(
        initial=0.2,
        maximum=1.5,
        multiplier=2.0,
        deadline=timeout,
    )
    return retry, timeout


def _get_conversation_via_rest(
    db,
    conversation_id: str,
    timeout: float,
    *,
    field_paths: list[str] | None = None,
):
    """Read one document through Firestore's non-streaming REST endpoint."""
    from urllib.parse import quote

    from google.api_core import exceptions
    from google.auth.transport.requests import AuthorizedSession
    from google.cloud.firestore_v1 import _helpers
    from google.cloud.firestore_v1.types import Document
    from google.protobuf.json_format import ParseDict
    from requests import RequestException

    project = quote(str(db.project), safe="")
    database = quote(str(getattr(db, "_database", "(default)")), safe="()")
    document_id = quote(str(conversation_id), safe="")
    url = (
        "https://firestore.googleapis.com/v1/projects/"
        f"{project}/databases/{database}/documents/"
        f"{ConversationRepository.COLLECTION_NAME}/{document_id}"
    )
    session = AuthorizedSession(db._credentials)
    try:
        params = [("mask.fieldPaths", path) for path in (field_paths or [])]
        response = session.get(url, params=params or None, timeout=timeout)
    except RequestException as exc:
        raise exceptions.DeadlineExceeded(
            "Firestore REST fallback timed out"
        ) from exc
    finally:
        session.close()

    if response.status_code == 404:
        return None
    if response.status_code == 429:
        raise exceptions.ResourceExhausted("Firestore REST quota exhausted")
    if response.status_code in (502, 503, 504):
        raise exceptions.ServiceUnavailable(
            f"Firestore REST unavailable ({response.status_code})"
        )
    if not response.ok:
        raise exceptions.GoogleAPICallError(
            f"Firestore REST read failed ({response.status_code})"
        )

    document = Document()
    ParseDict(response.json(), document._pb)
    return _helpers.decode_dict(document.fields, db)


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
        from service.firestore.firestore_service import FirestoreService

        global _REST_READ_FALLBACK_ACTIVE
        from config import get_config

        db = FirestoreService.get_db()
        retry, timeout = _interactive_firestore_policy()
        config = get_config()

        if (
            config.FIRESTORE_REST_READ_FALLBACK_ENABLED
            and _REST_READ_FALLBACK_ACTIVE
        ):
            return _get_conversation_via_rest(db, conversation_id, timeout)

        try:
            doc = (
                db.collection(ConversationRepository.COLLECTION_NAME)
                .document(conversation_id)
                .get(retry=retry, timeout=timeout)
            )
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as exc:
            if not (
                config.FIRESTORE_REST_READ_FALLBACK_ENABLED
                and _is_transient_firestore_error(exc)
            ):
                logger.error("Error retrieving conversation %s: %s", conversation_id, exc)
                raise

            with _REST_READ_FALLBACK_LOCK:
                _REST_READ_FALLBACK_ACTIVE = True
            logger.warning(
                "Firestore gRPC conversation read failed; switching this process "
                "to the non-streaming REST fallback: %s",
                exc,
            )
            return _get_conversation_via_rest(db, conversation_id, timeout)

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
    def verify_owner(conversation_id: str, user_id: str) -> bool:
        """Verify ownership without downloading the conversation message array."""
        from service.firestore.firestore_service import FirestoreService

        db = FirestoreService.get_db()
        retry, timeout = _interactive_firestore_policy()
        try:
            snapshot = (
                db.collection(ConversationRepository.COLLECTION_NAME)
                .document(conversation_id)
                .get(
                    field_paths=["user_id"],
                    retry=retry,
                    timeout=timeout,
                )
            )
            if not snapshot.exists:
                return False
            owner_id = (snapshot.to_dict() or {}).get("user_id")
        except Exception as exc:
            if not _is_transient_firestore_error(exc):
                raise
            data = _get_conversation_via_rest(
                db,
                conversation_id,
                timeout,
                field_paths=["user_id"],
            )
            if data is None:
                return False
            owner_id = data.get("user_id")

        if owner_id != user_id:
            raise PermissionError("User does not own this conversation")
        return True

    @staticmethod
    def get_by_user(user_id: str) -> List[Dict]:
        """
        Get all conversations for a user.

        Args:
            user_id: The user ID

        Returns:
            List of conversation summaries (id, timestamp, title, preview)
        """
        from service.firestore.firestore_service import FirestoreService
        from google.cloud.firestore_v1 import FieldFilter

        try:
            db = FirestoreService.get_db()
            retry, timeout = _interactive_firestore_policy()
            conversations = (
                db.collection(ConversationRepository.COLLECTION_NAME)
                .where(filter=FieldFilter("user_id", "==", user_id))
                .select(["timestamp", "title", "preview"])
                .get(retry=retry, timeout=timeout)
            )

            conversation_list = []
            for conv in conversations:
                conv_data = conv.to_dict()
                title = conv_data.get("title") or "Conversation"
                preview = conv_data.get("preview") or "Open to view messages..."
                conversation_list.append(
                    {
                        "id": conv.id,
                        "timestamp": conv_data.get("timestamp"),
                        "title": title,
                        "preview": preview,
                    }
                )

            conversation_list.sort(key=lambda x: x["timestamp"] if x["timestamp"] else datetime.min, reverse=True)
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
        from service.firestore.firestore_service import FirestoreService

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
        usage: Optional[Dict] = None,
        turn_id: Optional[str] = None,
        turn_index: Optional[int] = None,
        message_role: Optional[str] = None,
        is_final_assistant_response: Optional[bool] = None,
        tool_trace_summary: Optional[str] = None,
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
            usage: Optional dictionary of usage metrics (tokens, budget)
            turn_id: unique turn identifier
            turn_index: index of the current turn
            message_role: role ('user' or 'assistant')
            is_final_assistant_response: whether it is the final assistant response
            tool_trace_summary: optional tool execution summary
        """
        from service.firestore.firestore_service import FirestoreService
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
                content_str = (message or "").strip()
                preview = content_str[:50] + "..." if len(content_str) > 50 else content_str
                title = content_str[:40] + ("..." if len(content_str) > 40 else "")
                conversation_ref.set(
                    {
                        "user_id": user_id,
                        "timestamp": datetime.now(timezone.utc),
                        "messages": [],
                        "title": title,
                        "preview": preview,
                    }
                )
                conv_data = {"user_id": user_id, "messages": [], "title": title, "preview": preview}

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
                        
                    # Update usage if provided
                    if usage:
                        last_message["usage"] = usage

                    # Update turn fields if provided
                    if turn_id is not None:
                        last_message["turn_id"] = turn_id
                    if turn_index is not None:
                        last_message["turn_index"] = turn_index
                    if message_role is not None:
                        last_message["message_role"] = message_role
                    if is_final_assistant_response is not None:
                        last_message["is_final_assistant_response"] = is_final_assistant_response
                    if tool_trace_summary is not None:
                        last_message["tool_trace_summary"] = tool_trace_summary

                    conversation_ref.update({"messages": messages_list})
                    logger.debug(f"Conversation {conversation_id} updated successfully by appending to last {sender} message")
                    return

            content = (message or "").strip()

            message_data: Dict = {
                "sender": sender,
                "content": content,
                "timestamp": datetime.now(timezone.utc),
            }

            if sender == "ai" and thinking and thinking.strip():
                message_data["thinking"] = thinking.strip()

            if tools:
                message_data["tools"] = tools

            if timeline:
                message_data["timeline"] = timeline
                
            if usage:
                message_data["usage"] = usage

            if turn_id is not None:
                message_data["turn_id"] = turn_id
            if turn_index is not None:
                message_data["turn_index"] = turn_index
            if message_role is not None:
                message_data["message_role"] = message_role
            if is_final_assistant_response is not None:
                message_data["is_final_assistant_response"] = is_final_assistant_response
            if tool_trace_summary is not None:
                message_data["tool_trace_summary"] = tool_trace_summary

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
        from service.firestore.firestore_service import FirestoreService

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

            # 1. Delete Firestore summary blocks subcollection
            try:
                summary_blocks_ref = conversation_ref.collection("summary_blocks")
                summary_docs = summary_blocks_ref.get()
                for doc in summary_docs:
                    for chunk_doc in doc.reference.collection("payload_chunks").get():
                        chunk_doc.reference.delete()
                    doc.reference.delete()
                logger.debug("Deleted Firestore summary blocks for conversation %s", conversation_id)
            except Exception as blocks_err:
                logger.warning("Failed to clean up Firestore summary blocks: %s", blocks_err)

            # 2. Delete persisted query results and any chunk documents.
            try:
                execution_results_ref = conversation_ref.collection(
                    "execution_results"
                )
                for execution_doc in execution_results_ref.get():
                    for chunk_doc in execution_doc.reference.collection("chunks").get():
                        chunk_doc.reference.delete()
                    execution_doc.reference.delete()
                logger.debug(
                    "Deleted Firestore execution results for conversation %s",
                    conversation_id,
                )
            except Exception as execution_err:
                logger.warning(
                    "Failed to clean up Firestore execution results: %s",
                    execution_err,
                )

            # 3. Delete the conversation document itself
            conversation_ref.delete()
            logger.info(f"Conversation {conversation_id} deleted successfully")
            return True
        except (ValueError, PermissionError):
            raise
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}")
            raise

    @staticmethod
    def create_memory_cleanup_retry(
        conversation_id: str, user_id: str, cleanup_error: Exception
    ) -> None:
        """Create a Firestore retry record for failed external memory cleanup."""
        from service.firestore.firestore_service import FirestoreService

        try:
            db = FirestoreService.get_db()
            db.collection("qdrant_conversation_cleanup").add(
                {
                    "type": "qdrant_conversation_cleanup",
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "status": "pending",
                    "attempts": 0,
                    "last_error": str(cleanup_error),
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                }
            )
            logger.info(
                "Created qdrant_conversation_cleanup retry record for conversation %s",
                conversation_id,
            )
        except Exception as db_err:
            logger.error(
                "Failed to create qdrant_conversation_cleanup retry record: %s",
                db_err,
            )

    @staticmethod
    def retry_qdrant_cleanups(memory_cleaner) -> int:
        """
        Scan Firestore for pending qdrant_conversation_cleanup records,
        attempt pointer deletion, and update/delete records accordingly.
        Returns the number of successfully cleaned up conversations.
        """
        from service.firestore.firestore_service import FirestoreService
        from google.api_core.retry import Retry
        from google.cloud.firestore_v1 import FieldFilter
        from config import get_config
        import asyncio
        import threading

        db = FirestoreService.get_db()
        timeout = max(
            4.0,
            float(get_config().VAMP_MAINTENANCE_QUERY_TIMEOUT_SECONDS),
        )
        pending_docs = (
            db.collection("qdrant_conversation_cleanup")
            .where(filter=FieldFilter("status", "==", "pending"))
            .get(
                retry=Retry(
                    initial=0.5,
                    maximum=4.0,
                    multiplier=2.0,
                    deadline=max(20.0, timeout + 5.0),
                ),
                timeout=timeout,
            )
        )
        success_count = 0

        for doc in pending_docs:
            doc_data = doc.to_dict()
            conversation_id = doc_data.get("conversation_id")
            user_id = doc_data.get("user_id")
            attempts = doc_data.get("attempts", 0)

            if not conversation_id or not user_id:
                doc.reference.delete()
                continue

            try:
                cleanup_errors: list[BaseException] = []

                def _delete():
                    try:
                        asyncio.run(
                            memory_cleaner.delete_conversation_pointers(
                                conversation_id, user_id
                            )
                        )
                    except BaseException as exc:
                        cleanup_errors.append(exc)

                thread = threading.Thread(target=_delete)
                thread.start()
                thread.join()
                if cleanup_errors:
                    raise cleanup_errors[0]
                doc.reference.delete()
                success_count += 1
                logger.info("Successfully retired cleanup for conversation %s on attempt %s", conversation_id, attempts + 1)
            except Exception as e:
                attempts += 1
                status = "failed" if attempts >= 5 else "pending"
                doc.reference.update({
                    "attempts": attempts,
                    "status": status,
                    "last_error": str(e),
                    "updated_at": datetime.now(timezone.utc)
                })
                logger.warning("Retry cleanup attempt %s failed for conversation %s: %s", attempts, conversation_id, e)

        return success_count
