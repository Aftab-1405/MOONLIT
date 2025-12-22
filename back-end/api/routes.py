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

@api_bp.route('/pass_userinput_to_gemini', methods=['POST'])
@login_required
def pass_userinput_to_gemini():
    """Handle user input and stream AI response."""
    from database.session_utils import get_db_config_from_session
    
    data = request.get_json()
    prompt = data.get('prompt')
    
    # Extract reasoning settings from request (frontend settings)
    enable_reasoning = data.get('enable_reasoning', True)
    reasoning_effort = data.get('reasoning_effort', 'medium')
    
    conversation_id = ConversationService.create_or_get_conversation_id(data.get('conversation_id'))
    user_id = session.get('user')
    
    # Capture database config at request start - pass it explicitly to the generator
    try:
        db_config = get_db_config_from_session()
        logger.debug(f'Captured db_config for AI tools: {db_config.get("database") if db_config else "None"}')
    except Exception as e:
        db_config = None
        logger.debug(f'No db_config available: {e}')
    
    logger.debug(f'Received prompt for conversation: {conversation_id}, reasoning={enable_reasoning}')
    
    try:
        # Pass db_config and reasoning settings to the generator
        generator = ConversationService.create_streaming_generator(
            conversation_id, prompt, user_id, 
            db_config=db_config,
            enable_reasoning=enable_reasoning,
            reasoning_effort=reasoning_effort
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
    except Exception as e:
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
    data = request.get_json()
    schema_name = data.get('schema')
    
    if not schema_name:
        return jsonify({'status': 'error', 'message': 'Schema name is required'}), 400
    
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
    data = request.get_json()
    table_name = data.get('table_name')
    
    if not table_name:
        return jsonify({'status': 'error', 'message': 'Table name is required'}), 400
    
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
    data = request.get_json()
    sql_query = data.get('sql_query')
    max_rows = data.get('max_rows', 1000)
    timeout = data.get('timeout', 30)
    conversation_id = session.get('conversation_id')
    
    result = DatabaseService.execute_query_with_notification(
        sql_query, 
        conversation_id, 
        max_rows=max_rows, 
        timeout=timeout
    )
    return jsonify(result)
