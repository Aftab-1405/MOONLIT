"""Compatibility exports for the shared Firestore infrastructure service."""

from service.firestore.firestore_service import (
    FirestoreService,
    _initialize_firebase,
    delete_conversation,
    get_conversation,
    get_conversations,
    get_firestore_db,
    store_conversation,
)

__all__ = [
    "FirestoreService",
    "_initialize_firebase",
    "delete_conversation",
    "get_conversation",
    "get_conversations",
    "get_firestore_db",
    "store_conversation",
]
