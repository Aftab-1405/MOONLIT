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
    SCHEMA_CACHE_TTL_SECONDS = 300  # 5 minutes TTL for schema cache
    
    # =========================================================================
    # Connection Staleness Detection
    # =========================================================================
    # 
    # PROBLEM: When a user closes their browser tab, the backend has no way to
    # know the session is dead. Firestore still stores { connected: true } 
    # indefinitely, causing the AI to report "You are connected" when the 
    # actual connection pool may have died.
    #
    # SOLUTION: TTL-based lazy validation
    # 1. Store `connected_at` timestamp when connection is established
    # 2. When reading connection state, check if age > CONNECTION_TTL_SECONDS
    # 3. If stale, test the actual DB connection pool
    # 4. If test fails, auto-clear Firestore and return disconnected
    #
    # This provides:
    # - Fast reads for active users (no DB test if recently connected)
    # - Accurate state for returning users (stale data triggers verification)
    # - Self-healing (dead connections auto-clear from Firestore)
    # =========================================================================
    
    CONNECTION_TTL_SECONDS = 300  # 5 minutes - after this, verify actual connection
    
    # =========================================================================
    # Firestore Access
    # =========================================================================
    
    @staticmethod
    def _normalize_user_id(user_id) -> str:
        """
        Normalize user_id to string for Firestore document ID.
        
        Handles both:
        - Dict format (new auth): {'uid': '...', 'email': '...', ...}
        - String format (legacy): 'user@example.com'
        
        Uses email for backward compatibility with existing Firestore documents.
        """
        if isinstance(user_id, dict):
            return user_id.get('email') or user_id.get('uid') or str(user_id)
        return str(user_id) if user_id else 'anonymous'
    
    @staticmethod
    def _get_context_ref(user_id):
        """Get Firestore document reference for user context."""
        from services.firestore_service import FirestoreService
        # Normalize user_id to handle dict format from new auth
        user_id = ContextService._normalize_user_id(user_id)
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
        """
        Get current connection state with staleness validation.
        
        This method implements multi-layer validation to detect stale data:
        
        LAYER 1: Flask Session Check (ALWAYS)
        - When user closes browser, Flask session is destroyed
        - If Firestore says "connected" but Flask session has no DB config,
          the connection is definitely stale → auto-clear
        
        LAYER 2: TTL-based DB Pool Check (if session exists but old)
        - If Flask session exists but connected_at > TTL, test actual DB
        - If DB test fails → auto-clear
        
        This ensures:
        - Browser close detection (session destroyed = stale)
        - Connection pool timeout detection (DB test fails = stale)
        - Fast reads for active users (skip expensive checks)
        
        Args:
            user_id: The user ID to check connection for
            
        Returns:
            Dict with connection state. Will return {'connected': False} if stale.
        """
        context = ContextService._get_context(user_id)
        connection = context.get('current_connection', {'connected': False})
        
        # =====================================================================
        # LAYER 1: Flask Session Check
        # =====================================================================
        # If Firestore says "connected", but Flask session has no DB config,
        # the user has closed their browser/tab and session is gone.
        # This is the MOST COMMON case of stale data.
        # =====================================================================
        
        if connection.get('connected'):
            try:
                from database.session_utils import is_db_configured
                
                # Check if Flask session still has DB configuration
                if not is_db_configured():
                    # Flask session is empty = user closed browser → STALE!
                    logger.warning(
                        f"Stale connection for user {user_id}: "
                        f"Firestore says connected, but Flask session is empty. "
                        f"User likely closed browser. Auto-clearing..."
                    )
                    ContextService.clear_connection(user_id)
                    return {
                        'connected': False, 
                        'stale_cleared': True,
                        'reason': 'session_expired'
                    }
                    
            except Exception as e:
                logger.warning(f"Error checking Flask session: {e}")
                # On error, continue with Firestore data
        
        # =====================================================================
        # LAYER 2: TTL-based DB Pool Check
        # =====================================================================
        # If user configured connection persistence > 0, allow the connection
        # to persist for that duration after last activity.
        # 
        # If persistence = 0 (default "Never"), skip this check - Layer 1 
        # already handles it by checking if session exists.
        #
        # If persistence > 0 and connection age > persistence, verify DB pool.
        # =====================================================================
        
        if connection.get('connected'):
            connected_at = connection.get('connected_at')
            
            if connected_at:
                try:
                    # Get user's persistence preference (in minutes, 0 = never)
                    persistence_minutes = ContextService.get_user_preference(
                        user_id, 'connection_persistence_minutes', 0
                    )
                    
                    # If persistence is 0 ("Never"), connection should already
                    # have been cleared by Layer 1 if session is gone.
                    # If we reach here, session is valid → return connected.
                    if persistence_minutes == 0:
                        return connection
                    
                    # Convert to seconds for comparison
                    persistence_seconds = persistence_minutes * 60
                    
                    # Parse the ISO timestamp and calculate age
                    connected_time = datetime.fromisoformat(connected_at)
                    age_seconds = (datetime.now() - connected_time).total_seconds()
                    
                    # If connection is older than user's persistence setting, verify it
                    if age_seconds > persistence_seconds:
                        logger.debug(
                            f"Connection for user {user_id} is {age_seconds:.0f}s old "
                            f"(persistence={persistence_minutes}min), verifying DB pool..."
                        )
                        
                        # Test actual DB connection pool
                        if not ContextService._verify_db_connection(user_id, connection):
                            logger.warning(
                                f"Stale connection for user {user_id}: "
                                f"DB pool verification failed. Auto-clearing..."
                            )
                            ContextService.clear_connection(user_id)
                            return {
                                'connected': False,
                                'stale_cleared': True,
                                'reason': 'db_pool_dead'
                            }
                        else:
                            # Connection is alive - refresh the timestamp
                            logger.debug(f"Connection verified alive for user {user_id}")
                            ContextService._refresh_connection_timestamp(user_id)
                            
                except (ValueError, TypeError) as e:
                    logger.warning(f"Could not parse connected_at timestamp: {e}")
        
        return connection
    
    @staticmethod
    def _verify_db_connection(user_id: str, connection: Dict) -> bool:
        """
        Test if the actual database connection is still alive.
        
        This is called when connection data is stale (older than TTL).
        We try to execute a simple "SELECT 1" query to verify the pool is alive.
        
        Args:
            user_id: User ID (for logging)
            connection: Connection dict with db_type, database, etc.
            
        Returns:
            True if connection is alive, False if dead
        """
        try:
            from database.session_utils import get_db_connection, is_db_configured
            
            # First check if Flask session still has config
            if not is_db_configured():
                logger.debug(f"No DB config in session for user {user_id}")
                return False
            
            # Try to get a connection and execute a test query
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                cursor.close()
                return True
                
        except Exception as e:
            # Any error means the connection is dead
            logger.debug(f"Connection verification failed for user {user_id}: {e}")
            return False
    
    @staticmethod
    def _refresh_connection_timestamp(user_id: str) -> bool:
        """
        Refresh the connected_at timestamp when we verify a connection is alive.
        
        This prevents us from re-verifying on every request after TTL expires.
        After successful verification, we update the timestamp so the next
        TTL period starts fresh.
        
        Args:
            user_id: User ID
            
        Returns:
            True if update succeeded
        """
        try:
            context = ContextService._get_context(user_id)
            connection = context.get('current_connection', {})
            if connection.get('connected'):
                connection['connected_at'] = datetime.now().isoformat()
                return ContextService._update_context(user_id, {'current_connection': connection})
        except Exception as e:
            logger.warning(f"Failed to refresh connection timestamp: {e}")
        return False
    
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
        """
        Get cached schema for a database with TTL check.
        
        Returns None if cache is expired or doesn't exist.
        """
        context = ContextService._get_context(user_id)
        schemas = context.get('database_schemas', {})
        cached = schemas.get(database)
        
        if not cached:
            return None
        
        # Check TTL - if cached_at is older than TTL, return None
        cached_at = cached.get('cached_at')
        if cached_at:
            try:
                # Parse ISO format datetime
                cache_time = datetime.fromisoformat(cached_at.replace('Z', '+00:00'))
                # Handle timezone-naive comparison
                if cache_time.tzinfo:
                    cache_time = cache_time.replace(tzinfo=None)
                age_seconds = (datetime.now() - cache_time).total_seconds()
                
                if age_seconds > ContextService.SCHEMA_CACHE_TTL_SECONDS:
                    logger.debug(f"Schema cache expired for {database} (age: {age_seconds:.0f}s)")
                    return None
            except (ValueError, TypeError) as e:
                logger.warning(f"Could not parse cached_at timestamp: {e}")
                # If we can't parse, treat as expired
                return None
        
        return cached
    
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
        """
        Invalidate schema cache for a database.
        
        Uses Firestore's FieldValue.delete() with dot notation to properly
        delete a nested field without affecting other schemas.
        """
        from firebase_admin import firestore
        
        try:
            # Use dot notation to delete specific nested field
            # This properly removes just the one database schema instead of 
            # replacing the entire database_schemas object
            ref = ContextService._get_context_ref(user_id)
            ref.update({
                f'database_schemas.{database}': firestore.DELETE_FIELD,
                'updated_at': datetime.now()
            })
            logger.info(f"Invalidated schema cache for {database}")
            return True
        except Exception as e:
            logger.error(f"Error invalidating schema cache: {e}")
            return False
    
    @staticmethod
    def get_schema_summary(user_id: str) -> List[Dict]:
        """
        Get summary of cached schemas for UI display.
        
        Returns list of: {database, table_count, cached_at}
        Does NOT include full column data (too large for UI).
        """
        context = ContextService._get_context(user_id)
        schemas = context.get('database_schemas', {})
        
        summary = []
        for db_name, schema_data in schemas.items():
            summary.append({
                'database': db_name,
                'table_count': len(schema_data.get('tables', [])),
                'cached_at': schema_data.get('cached_at')
            })
        
        # Sort by cached_at descending (most recent first)
        summary.sort(key=lambda x: x.get('cached_at') or '', reverse=True)
        return summary
    
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
    
    # =========================================================================
    # User Preferences
    # =========================================================================
    # These are user-specific settings that the backend needs to know about.
    # Stored in Firestore so they persist across sessions.
    # =========================================================================
    
    @staticmethod
    def set_user_preference(user_id: str, key: str, value: Any) -> bool:
        """
        Set a user preference.
        
        Args:
            user_id: User ID
            key: Preference key (e.g., 'connection_persistence_minutes')
            value: Preference value
            
        Returns:
            True if saved successfully
        """
        try:
            return ContextService._update_context(user_id, {
                f'preferences.{key}': value
            })
        except Exception as e:
            logger.error(f"Error setting preference {key} for user {user_id}: {e}")
            return False
    
    @staticmethod
    def get_user_preference(user_id: str, key: str, default: Any = None) -> Any:
        """
        Get a single user preference.
        
        Args:
            user_id: User ID
            key: Preference key
            default: Default value if not found
            
        Returns:
            The preference value or default
        """
        context = ContextService._get_context(user_id)
        preferences = context.get('preferences', {})
        return preferences.get(key, default)
    
    @staticmethod
    def get_user_preferences(user_id: str) -> Dict:
        """
        Get all user preferences.
        
        Returns:
            Dict of all preferences
        """
        context = ContextService._get_context(user_id)
        return context.get('preferences', {})

