# File: services/firestore_service.py
"""Firestore service for conversation storage"""

import firebase_admin
from firebase_admin import credentials, firestore
from config import Config
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class FirestoreService:
    _db = None

    @classmethod
    def initialize(cls):
        """Initialize Firebase Admin SDK"""
        if not firebase_admin._apps:
            try:
                # Validate credentials first
                if not Config.validate_firebase_credentials():
                    raise ValueError("Firebase credentials validation failed")
                
                # Get credentials from environment variables
                firebase_credentials = Config.get_firebase_credentials()
                cred = credentials.Certificate(firebase_credentials)
                firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin SDK initialized successfully")
                
                # Log project info for verification
                logger.info(f"Connected to Firebase project: {firebase_credentials['project_id']}")
                
            except Exception as e:
                logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
                raise
        cls._db = firestore.client()

    @classmethod
    def get_db(cls):
        """Get Firestore database instance"""
        if cls._db is None:
            cls.initialize()
        return cls._db

    @staticmethod
    def store_conversation(conversation_id, sender, message, user_id):
        """Store conversation message in Firestore"""
        try:
            db = FirestoreService.get_db()
            conversation_ref = db.collection('conversations').document(conversation_id)

            if not conversation_ref.get().exists:
                conversation_ref.set({
                    'user_id': user_id,
                    'timestamp': datetime.now(),
                    'messages': []
                })

            conversation_ref.update({
                'messages': firestore.ArrayUnion([{
                    'sender': sender,
                    'content': message,
                    'timestamp': datetime.now()
                }])
            })
            logger.debug(f"Conversation {conversation_id} updated successfully")
        except Exception as e:
            logger.error(f"Error storing conversation: {e}")
            raise

    @staticmethod
    def get_conversations(user_id):
        """Get all conversations for a user"""
        try:
            db = FirestoreService.get_db()
            conversations = db.collection('conversations').where('user_id', '==', user_id).get()
            conversation_list = []
            for conv in conversations:
                conv_data = conv.to_dict()
                if conv_data.get('messages'):
                    conversation_list.append({
                        'id': conv.id,
                        'timestamp': conv_data['timestamp'],
                        'title': conv_data['messages'][0]['content'][:40] + ('...' if len(conv_data['messages'][0]['content']) > 40 else ''),
                        'preview': conv_data['messages'][0]['content'][:50] + '...'
                    })
            return conversation_list
        except Exception as e:
            logger.error(f"Error retrieving conversations: {e}")
            raise

    @staticmethod
    def get_conversation(conversation_id):
        """Get specific conversation by ID"""
        try:
            db = FirestoreService.get_db()
            conversation = db.collection('conversations').document(conversation_id).get()
            if conversation.exists:
                return conversation.to_dict()
            return None
        except Exception as e:
            logger.error(f"Error retrieving conversation {conversation_id}: {e}")
            raise

    @staticmethod
    def delete_conversation(conversation_id, user_id):
        """Delete a conversation by ID and ensure user owns it"""
        try:
            db = FirestoreService.get_db()

            # Get conversation reference
            conversation_ref = db.collection('conversations').document(conversation_id)
            conversation = conversation_ref.get()

            # Check if conversation exists and belongs to user
            if conversation.exists:
                conv_data = conversation.to_dict()
                if conv_data['user_id'] == user_id:
                    conversation_ref.delete()
                    logger.info(f"Conversation {conversation_id} deleted successfully")
                    return True
                else:
                    raise PermissionError("User does not own this conversation")
            else:
                raise ValueError("Conversation not found")
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}")
            raise