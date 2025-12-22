"""
Context Service

Manages persistent AI context in Firestore.
Provides schema caching, connection state, and query history.

Separation of Concerns:
- This service ONLY manages context data storage/retrieval
- Does NOT make database connections (uses session_utils)
- Does NOT interact with AI (that's llm_service's job)
"""

import hashlib
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


class ContextService:
    """
    Manages AI context in Firestore.
    
    Firestore Structure:
        user_context/{user_id}
            ├── current_connection
            ├── database_schemas
            └── recent_queries
    """
    
    COLLECTION_NAME = 'user_context'
    MAX_RECENT_QUERIES = 10
    
    # =========================================================================
    # Firestore Access
    # =========================================================================
    
    @staticmethod
    def _get_context_ref(user_id: str):
        """Get Firestore document reference for user context."""
        from services.firestore_service import FirestoreService
        db = FirestoreService.get_db()
        return db.collection(ContextService.COLLECTION_NAME).document(user_id)
    
    @staticmethod
    def _get_context(user_id: str) -> Dict:
        """Get full context document, or empty dict if not exists."""
        try:
            doc = ContextService._get_context_ref(user_id).get()
            return doc.to_dict() if doc.exists else {}
        except Exception as e:
            logger.error(f"Error getting context for user {user_id}: {e}")
            return {}
    
    @staticmethod
    def _update_context(user_id: str, data: Dict) -> bool:
        """Update context document with merge."""
        try:
            data['updated_at'] = datetime.now()
            ContextService._get_context_ref(user_id).set(data, merge=True)
            return True
        except Exception as e:
            logger.error(f"Error updating context for user {user_id}: {e}")
            return False
    
    # =========================================================================
    # Connection State Management
    # =========================================================================
    
    @staticmethod
    def set_connection(user_id: str, db_type: str, database: str, 
                       host: str, is_remote: bool, schema: str = 'public') -> bool:
        """
        Set current connection state.
        
        Args:
            user_id: User ID
            db_type: 'mysql', 'postgresql', 'sqlite'
            database: Database name
            host: Host address
            is_remote: Whether it's a remote connection
            schema: PostgreSQL schema (default 'public')
        """
        connection_data = {
            'current_connection': {
                'connected': True,
                'db_type': db_type,
                'database': database,
                'host': host,
                'is_remote': is_remote,
                'schema': schema,
                'connected_at': datetime.now().isoformat()
            }
        }
        logger.info(f"Setting connection context for user {user_id}: {db_type}/{database}")
        return ContextService._update_context(user_id, connection_data)
    
    @staticmethod
    def clear_connection(user_id: str) -> bool:
        """Clear current connection state (user disconnected)."""
        connection_data = {
            'current_connection': {
                'connected': False,
                'db_type': None,
                'database': None,
                'host': None,
                'is_remote': False,
                'schema': None,
                'disconnected_at': datetime.now().isoformat()
            }
        }
        logger.info(f"Clearing connection context for user {user_id}")
        return ContextService._update_context(user_id, connection_data)
    
    @staticmethod
    def get_connection(user_id: str) -> Dict:
        """Get current connection state."""
        context = ContextService._get_context(user_id)
        return context.get('current_connection', {'connected': False})
    
    @staticmethod
    def update_schema(user_id: str, schema_name: str) -> bool:
        """Update current schema (PostgreSQL)."""
        context = ContextService._get_context(user_id)
        connection = context.get('current_connection', {})
        connection['schema'] = schema_name
        return ContextService._update_context(user_id, {'current_connection': connection})
    
    # =========================================================================
    # Schema Caching
    # =========================================================================
    
    @staticmethod
    def compute_schema_hash(tables: List[str], columns: Dict[str, List]) -> str:
        """Compute hash of schema for change detection."""
        schema_str = json.dumps({
            'tables': sorted(tables),
            'columns': {k: sorted(v) if isinstance(v, list) else v for k, v in sorted(columns.items())}
        }, sort_keys=True)
        return hashlib.md5(schema_str.encode()).hexdigest()
    
    @staticmethod
    def get_cached_schema(user_id: str, database: str) -> Optional[Dict]:
        """Get cached schema for a database."""
        context = ContextService._get_context(user_id)
        schemas = context.get('database_schemas', {})
        return schemas.get(database)
    
    @staticmethod
    def cache_schema(user_id: str, database: str, tables: List[str], 
                     columns: Dict[str, List]) -> bool:
        """
        Cache schema for a database.
        
        Args:
            user_id: User ID
            database: Database name
            tables: List of table names
            columns: Dict mapping table names to column info
        """
        schema_data = {
            'tables': tables,
            'columns': columns,
            'schema_hash': ContextService.compute_schema_hash(tables, columns),
            'cached_at': datetime.now().isoformat()
        }
        
        # Get existing schemas and add/update this one
        context = ContextService._get_context(user_id)
        schemas = context.get('database_schemas', {})
        schemas[database] = schema_data
        
        logger.info(f"Caching schema for user {user_id}, database {database}: {len(tables)} tables")
        return ContextService._update_context(user_id, {'database_schemas': schemas})
    
    @staticmethod
    def is_schema_changed(user_id: str, database: str, 
                          current_tables: List[str], current_columns: Dict) -> bool:
        """Check if schema has changed since last cache."""
        cached = ContextService.get_cached_schema(user_id, database)
        if not cached:
            return True  # No cache exists
        
        current_hash = ContextService.compute_schema_hash(current_tables, current_columns)
        return cached.get('schema_hash') != current_hash
    
    @staticmethod
    def invalidate_schema_cache(user_id: str, database: str) -> bool:
        """Invalidate schema cache for a database."""
        context = ContextService._get_context(user_id)
        schemas = context.get('database_schemas', {})
        if database in schemas:
            del schemas[database]
            return ContextService._update_context(user_id, {'database_schemas': schemas})
        return True
    
    @staticmethod
    def get_all_cached_schemas(user_id: str) -> Dict:
        """Get all cached schemas for user (for AI context)."""
        context = ContextService._get_context(user_id)
        return context.get('database_schemas', {})
    
    # =========================================================================
    # Query History
    # =========================================================================
    
    @staticmethod
    def add_query(user_id: str, query: str, database: str, 
                  row_count: int = 0, status: str = 'success') -> bool:
        """
        Add a query to recent history.
        
        Args:
            user_id: User ID
            query: SQL query executed
            database: Database it was executed against
            row_count: Number of rows affected/returned
            status: 'success' or 'error'
        """
        query_entry = {
            'query': query[:500],  # Truncate long queries
            'database': database,
            'row_count': row_count,
            'status': status,
            'executed_at': datetime.now().isoformat()
        }
        
        # Get existing queries and append
        context = ContextService._get_context(user_id)
        queries = context.get('recent_queries', [])
        queries.append(query_entry)
        
        # Keep only last N queries
        queries = queries[-ContextService.MAX_RECENT_QUERIES:]
        
        return ContextService._update_context(user_id, {'recent_queries': queries})
    
    @staticmethod
    def get_recent_queries(user_id: str, limit: int = 10) -> List[Dict]:
        """Get recent queries for user."""
        context = ContextService._get_context(user_id)
        queries = context.get('recent_queries', [])
        return queries[-limit:]
    
    @staticmethod
    def clear_query_history(user_id: str) -> bool:
        """Clear query history."""
        return ContextService._update_context(user_id, {'recent_queries': []})
    
    # =========================================================================
    # Full Context for AI
    # =========================================================================
    
    @staticmethod
    def get_full_context(user_id: str) -> Dict:
        """
        Get complete context for AI tools.
        
        Returns all context data needed by AI to answer questions.
        """
        context = ContextService._get_context(user_id)
        
        return {
            'connection': context.get('current_connection', {'connected': False}),
            'schemas': context.get('database_schemas', {}),
            'recent_queries': context.get('recent_queries', []),
            'updated_at': context.get('updated_at')
        }
    
    @staticmethod
    def clear_all_context(user_id: str) -> bool:
        """Clear all context for user."""
        try:
            ContextService._get_context_ref(user_id).delete()
            logger.info(f"Cleared all context for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error clearing context for user {user_id}: {e}")
            return False
