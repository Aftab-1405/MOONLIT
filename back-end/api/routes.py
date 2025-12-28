# File: api/routes.py
"""API routes for the application.

This file contains ONLY HTTP route handlers.
All business logic is delegated to service classes.
"""

from flask import Blueprint, request, jsonify, session, Response
from auth.decorators import login_required
from services.conversation_service import ConversationService
from services.database_service import DatabaseService
from services.connection_service import ConnectionService
from api.request_schemas import (
    validate_request, ChatRequest, RunQueryRequest, 
    SelectSchemaRequest, GetTableSchemaRequest
)
import logging

logger = logging.getLogger(__name__)
api_bp = Blueprint('api_bp', __name__)


# =============================================================================
# HEALTH CHECK ROUTES
# =============================================================================

@api_bp.route('/')
def landing():
    """API health check."""
    return jsonify({'status': 'success', 'message': 'API is running'})


@api_bp.route('/index')
@login_required
def index():
    """Authenticated health check."""
    return jsonify({'status': 'success', 'message': 'Authenticated'})


# =============================================================================
# CONVERSATION ROUTES
# =============================================================================

@api_bp.route('/pass_user_prompt_to_llm', methods=['POST'])
@login_required
def pass_user_prompt_to_llm():
    """Handle user input and stream AI response."""
    from database.session_utils import get_db_config_from_session
    
    # Validate request data
    data, error = validate_request(ChatRequest, request.get_json())
    if error:
        return jsonify(error), 400
    
    prompt = data['prompt']
    enable_reasoning = data['enable_reasoning']
    reasoning_effort = data['reasoning_effort']
    response_style = data['response_style']
    max_rows = data.get('max_rows')  # None = no limit (use server config)
    
    conversation_id = ConversationService.create_or_get_conversation_id(data.get('conversation_id'))
    user_id = session.get('user')
    
    # Capture database config at request start - pass it explicitly to the generator
    try:
        db_config = get_db_config_from_session()
        logger.debug(f'Captured db_config for AI tools: {db_config.get("database") if db_config else "None"}')
    except Exception as e:
        db_config = None
        logger.debug(f'No db_config available: {e}')
    
    logger.debug(f'Received prompt for conversation: {conversation_id}, reasoning={enable_reasoning}, style={response_style}, max_rows={max_rows}')
    
    try:
        # Pass db_config, reasoning settings, response style, and max_rows to the generator
        generator = ConversationService.create_streaming_generator(
            conversation_id, prompt, user_id, 
            db_config=db_config,
            enable_reasoning=enable_reasoning,
            reasoning_effort=reasoning_effort,
            response_style=response_style,
            max_rows=max_rows
        )
        headers = ConversationService.get_streaming_headers(conversation_id)
        return Response(generator, mimetype='text/plain', headers=headers)
    except Exception as e:
        logger.error(f'Error initializing chat request: {e}')
        if ConversationService.check_quota_error(str(e)):
            return jsonify({
                'status': 'error', 
                'message': 'API rate limit exceeded. Please wait a moment and try again.',
                'error_type': 'quota_exceeded'
            }), 429
        return jsonify({
            'status': 'error', 
            'message': 'Failed to connect to AI service. Please try again.',
            'error_type': 'api_error'
        }), 500


@api_bp.route('/get_conversations', methods=['GET'])
@login_required
def get_conversations():
    """Get all conversations for current user."""
    user_id = session['user']
    conversations = ConversationService.get_user_conversations(user_id)
    return jsonify({'status': 'success', 'conversations': conversations})


@api_bp.route('/get_conversation/<conversation_id>', methods=['GET'])
@login_required
def get_conversation(conversation_id):
    """Get a specific conversation and initialize AI session."""
    conv_data = ConversationService.get_conversation_data(conversation_id)
    if conv_data:
        return jsonify({'status': 'success', 'conversation': conv_data})
    return jsonify({'status': 'error', 'message': 'Conversation not found'})


@api_bp.route('/new_conversation', methods=['POST'])
@login_required
def new_conversation():
    """Create a new conversation."""
    conversation_id = ConversationService.create_or_get_conversation_id()
    ConversationService.initialize_conversation(conversation_id)
    return jsonify({'status': 'success', 'conversation_id': conversation_id})


@api_bp.route('/delete_conversation/<conversation_id>', methods=['DELETE'])
@login_required
def delete_conversation(conversation_id):
    """Delete a conversation."""
    try:
        user_id = session['user']
        ConversationService.delete_user_conversation(conversation_id, user_id)
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f'Error deleting conversation: {e}')
        return jsonify({'status': 'error', 'message': str(e)}), 500


# =============================================================================
# DATABASE CONNECTION ROUTES
# =============================================================================

@api_bp.route('/connect_db', methods=['POST'])
def connect_db():
    """Connect to a database (local or remote)."""
    data = request.get_json()
    # ConnectionService returns Flask Response directly from connection_handlers
    return ConnectionService.connect_database(data)


@api_bp.route('/disconnect_db', methods=['POST'])
def disconnect_db():
    """Disconnect from the current database."""
    result = DatabaseService.disconnect_database()
    if result['status'] == 'error':
        return jsonify(result), 500
    return jsonify(result)


@api_bp.route('/db_status', methods=['GET'])
def db_status():
    """Get current database connection status."""
    try:
        result = ConnectionService.get_connection_status()
        return jsonify(result)
    except Exception as e:
        logger.exception('Error checking DB status')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@api_bp.route('/db_heartbeat', methods=['GET'])
def db_heartbeat():
    """Lightweight database connection health check."""
    try:
        result = ConnectionService.check_connection_health()
        return jsonify(result)
    except Exception:
        logger.exception('Error in heartbeat check')
        return jsonify({'status': 'error', 'connected': False}), 500


@api_bp.route('/get_databases', methods=['GET'])
def get_databases_route():
    """Get list of available databases."""
    result = DatabaseService.get_databases_with_remote_flag()
    return jsonify(result)


@api_bp.route('/switch_remote_database', methods=['POST'])
def switch_remote_database():
    """Switch to a different database on remote server."""
    try:
        data = request.get_json(force=True) or {}
    except Exception:
        data = {}
    
    new_db_name = data.get('database')
    if not new_db_name:
        return jsonify({'status': 'error', 'message': 'Database name is required'}), 400
    
    conversation_id = session.get('conversation_id')
    result = DatabaseService.switch_remote_database(new_db_name, conversation_id)
    
    if result['status'] == 'error':
        return jsonify(result), 400
    return jsonify(result)


# =============================================================================
# SCHEMA ROUTES
# =============================================================================

@api_bp.route('/get_schemas', methods=['GET'])
def get_schemas():
    """Get all schemas in connected PostgreSQL database."""
    try:
        result = DatabaseService.get_schemas()
        if result['status'] == 'error':
            return jsonify(result), 400
        return jsonify(result)
    except Exception as e:
        logger.exception('Error fetching schemas')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@api_bp.route('/select_schema', methods=['POST'])
def select_schema():
    """Select a PostgreSQL schema."""
    # Validate request data
    data, error = validate_request(SelectSchemaRequest, request.get_json())
    if error:
        return jsonify(error), 400
    
    schema_name = data['schema']
    
    try:
        conversation_id = session.get('conversation_id')
        result = DatabaseService.select_schema_with_notification(schema_name, conversation_id)
        if result['status'] == 'error':
            return jsonify(result), 400
        return jsonify(result)
    except Exception as e:
        logger.exception('Error selecting schema')
        return jsonify({'status': 'error', 'message': str(e)}), 500


# =============================================================================
# TABLE ROUTES
# =============================================================================

@api_bp.route('/get_tables', methods=['GET'])
def get_tables():
    """Get all tables in the current database/schema."""
    try:
        result = DatabaseService.get_tables()
        if result['status'] == 'error':
            return jsonify(result), 400
        return jsonify(result)
    except Exception as e:
        logger.exception('Error fetching tables')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@api_bp.route('/get_table_schema', methods=['POST'])
def get_table_schema_route():
    """Get schema information for a specific table."""
    # Validate request data
    data, error = validate_request(GetTableSchemaRequest, request.get_json())
    if error:
        return jsonify(error), 400
    
    table_name = data['table_name']
    
    try:
        result = DatabaseService.get_table_info_with_schema(table_name)
        if result['status'] == 'error':
            return jsonify(result), 400
        return jsonify(result)
    except Exception as e:
        logger.exception('Error fetching table schema')
        return jsonify({'status': 'error', 'message': str(e)}), 500


# =============================================================================
# QUERY ROUTES
# =============================================================================

@api_bp.route('/run_sql_query', methods=['POST'])
def run_sql_query():
    """Execute a SQL query."""
    from config import Config
    
    # Validate request data
    data, error = validate_request(RunQueryRequest, request.get_json())
    if error:
        return jsonify(error), 400
    
    sql_query = data['sql_query']
    # If max_rows is None (No Limit), use server config as safety net
    max_rows = data.get('max_rows') or Config.MAX_QUERY_RESULTS
    timeout = data['timeout']
    conversation_id = session.get('conversation_id')
    
    result = DatabaseService.execute_query_with_notification(
        sql_query, 
        conversation_id, 
        max_rows=max_rows, 
        timeout=timeout
    )
    return jsonify(result)


# =============================================================================
# USER SETTINGS ROUTES
# =============================================================================

@api_bp.route('/user/settings', methods=['POST'])
@login_required
def save_user_settings():
    """
    Save user preferences to Firestore.
    
    This is used for settings that the backend needs to know about,
    such as connectionPersistenceMinutes which controls how long
    a connection stays valid after tab close.
    """
    from services.context_service import ContextService
    
    user_id = session.get('user', {}).get('uid', 'anonymous')
    data = request.get_json() or {}
    
    # Store the connection persistence setting if provided
    if 'connectionPersistenceMinutes' in data:
        value = data['connectionPersistenceMinutes']
        # Validate: must be a number in allowed range
        if isinstance(value, (int, float)) and value in [0, 5, 15, 30, 60]:
            ContextService.set_user_preference(user_id, 'connection_persistence_minutes', int(value))
            logger.info(f"User {user_id} set connection persistence to {value} minutes")
        else:
            return jsonify({'status': 'error', 'message': 'Invalid value'}), 400
    
    return jsonify({'status': 'success'})


@api_bp.route('/user/settings', methods=['GET'])
@login_required
def get_user_settings():
    """Get user preferences from Firestore."""
    from services.context_service import ContextService
    
    user_id = session.get('user', {}).get('uid', 'anonymous')
    prefs = ContextService.get_user_preferences(user_id)
    
    return jsonify({
        'status': 'success',
        'settings': prefs
    })


# =============================================================================
# USER CONTEXT MANAGEMENT ROUTES
# =============================================================================

@api_bp.route('/user/context', methods=['GET'])
@login_required
def get_user_context():
    """
    Get user's stored context data for UI display.
    
    Returns full schema data (tables, columns) and actual queries for granular control.
    """
    from services.context_service import ContextService
    
    # Pass full user dict so _normalize_user_id can extract email (backward compat)
    user_id = session.get('user', 'anonymous')
    
    # Get full schema data (not just summary)
    full_schemas = ContextService.get_all_cached_schemas(user_id)
    queries = ContextService.get_recent_queries(user_id)
    
    # Transform schemas for UI (include tables and columns)
    schemas_for_ui = []
    for db_name, schema_data in full_schemas.items():
        schemas_for_ui.append({
            'database': db_name,
            'tables': schema_data.get('tables', []),
            'columns': schema_data.get('columns', {}),
            'table_count': len(schema_data.get('tables', [])),
            'cached_at': schema_data.get('cached_at')
        })
    
    # Sort by cached_at descending (most recent first)
    schemas_for_ui.sort(key=lambda x: x.get('cached_at') or '', reverse=True)
    
    return jsonify({
        'status': 'success',
        'schemas': schemas_for_ui,
        'queries': queries  # Return actual queries, not just count
    })


@api_bp.route('/user/context/schema/<database>', methods=['DELETE'])
@login_required
def delete_schema_context(database):
    """Delete cached schema for a specific database."""
    from services.context_service import ContextService
    
    user_id = session.get('user', 'anonymous')
    
    try:
        success = ContextService.invalidate_schema_cache(user_id, database)
        if success:
            logger.info(f"User {user_id} deleted schema context for {database}")
            return jsonify({'status': 'success'})
        return jsonify({'status': 'error', 'message': 'Schema not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting schema context: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@api_bp.route('/user/context/schemas', methods=['DELETE'])
@login_required
def delete_all_schemas():
    """Delete all cached schemas for user."""
    from services.context_service import ContextService
    
    user_id = session.get('user', 'anonymous')
    
    try:
        # Get all schemas and delete each
        context = ContextService._get_context(user_id)
        schemas = context.get('database_schemas', {})
        
        for db_name in list(schemas.keys()):
            ContextService.invalidate_schema_cache(user_id, db_name)
        
        logger.info(f"User {user_id} cleared all schema context")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"Error clearing all schemas: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@api_bp.route('/user/context/queries', methods=['DELETE'])
@login_required
def delete_query_history():
    """Clear query history for user."""
    from services.context_service import ContextService
    
    user_id = session.get('user', 'anonymous')
    
    try:
        ContextService.clear_query_history(user_id)
        logger.info(f"User {user_id} cleared query history")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"Error clearing query history: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

