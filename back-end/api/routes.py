# File: api/routes.py
"""API routes for the application"""

from flask import Blueprint, request, jsonify, session, Response
from auth.decorators import login_required
from database.operations import get_databases, fetch_database_info, execute_sql_query
from database.session_utils import (
    set_db_config_in_session,
    update_database_in_session,
    get_current_database,
    get_db_connection,
    clear_db_config_from_session,
    close_user_pool
)
from services.gemini_service import GeminiService
from services.firestore_service import FirestoreService
import uuid
import logging

logger = logging.getLogger(__name__)
api_bp = Blueprint('api_bp', __name__)

@api_bp.route('/')
def landing():
    # React frontend handles the landing page
    return jsonify({'status': 'success', 'message': 'API is running'})

@api_bp.route('/index')
@login_required
def index():
    # React frontend handles the main app page
    return jsonify({'status': 'success', 'message': 'Authenticated'})

@api_bp.route('/pass_userinput_to_gemini', methods=['POST'])
@login_required
def pass_userinput_to_gemini():
    data = request.get_json()
    prompt = data['prompt']
    # Prefer the conversation_id explicitly provided by the client. If the
    # client omits it (null/undefined), create a fresh conversation id so the
    # prompt starts a new conversation instead of being attached to a prior
    # server-side session value.
    conversation_id = data.get('conversation_id')
    # If there's no conversation id provided by the client, create one and
    # store it in the server session so subsequent messages in this tab use it.
    if not conversation_id:
        conversation_id = str(uuid.uuid4())
        session['conversation_id'] = conversation_id
    logger.debug(f'Received prompt: {prompt} for conversation: {conversation_id}')
    
    try:
        user_id = session['user']
        FirestoreService.store_conversation(conversation_id, 'user', prompt, user_id)

        def generate():
            full_response_content = []
            responses = GeminiService.send_message(conversation_id, prompt)
            for chunk in responses:
                text_chunk = chunk.text
                full_response_content.append(text_chunk)
                yield text_chunk

            # Store the complete conversation in Firestore after streaming
            FirestoreService.store_conversation(conversation_id, 'ai', "".join(full_response_content), user_id)

        # Attach helpful headers to encourage immediate streaming through proxies
        headers = {
            'X-Conversation-Id': conversation_id,
            'Cache-Control': 'no-cache, no-transform',
            # Some reverse proxies buffer streamed responses; this header helps disable that behavior
            'X-Accel-Buffering': 'no'
        }
        return Response(generate(), mimetype='text/plain', headers=headers)
    except Exception as e:
        logger.error(f'Error querying Gemini: {e}')
        return jsonify({'status': 'error', 'message': str(e)}), 500

@api_bp.route('/get_conversations', methods=['GET'])
@login_required
def get_conversations():
    user_id = session['user']
    conversation_list = FirestoreService.get_conversations(user_id)
    return jsonify({'status': 'success', 'conversations': conversation_list})

@api_bp.route('/get_conversation/<conversation_id>', methods=['GET'])
@login_required
def get_conversation(conversation_id):
    conv_data = FirestoreService.get_conversation(conversation_id)
    if conv_data:
        session['conversation_id'] = conversation_id
        history = [
            {"role": "user" if msg["sender"] == "user" else "model", "parts": [msg["content"]]}
            for msg in conv_data.get('messages', [])
        ]
        GeminiService.get_or_create_chat_session(conversation_id, history)
        return jsonify({'status': 'success', 'conversation': conv_data})
    else:
        return jsonify({'status': 'error', 'message': 'Conversation not found'})

@api_bp.route('/new_conversation', methods=['POST'])
@login_required
def new_conversation():
    conversation_id = str(uuid.uuid4())
    session['conversation_id'] = conversation_id
    GeminiService.get_or_create_chat_session(conversation_id)
    return jsonify({'status': 'success', 'conversation_id': conversation_id})

@api_bp.route('/get_databases', methods=['GET'])
def get_databases_route():
    result = get_databases()
    return jsonify(result)

@api_bp.route('/connect_db', methods=['POST'])
def connect_db():
    data = request.get_json()
    host = data.get('host')
    port = data.get('port')
    user = data.get('user')
    password = data.get('password')
    db_name = data.get('db_name')
    db_type = data.get('db_type', 'mysql')  # Default to MySQL for backward compatibility
    conversation_id = session.get('conversation_id')

    # For SQLite, only db_name (file path) is required
    if db_type == 'sqlite':
        if db_name:
            return _handle_server_connection(None, None, None, None, db_type, db_name)
        else:
            return jsonify({'status': 'error', 'message': 'Database file path is required for SQLite connection.'})

    # For MySQL/PostgreSQL, all connection fields are required
    if all([host, port, user, password]):
        return _handle_server_connection(host, port, user, password, db_type)

    # If only db_name present -> treat as selecting a database on the server
    if db_name:
        return _handle_db_selection(db_name, conversation_id)

    # Invalid request
    return jsonify({'status': 'error', 'message': 'All fields are required for server connection, or db_name for database selection.'})


def _handle_server_connection(host, port, user, password, db_type='mysql', database=None):
    """
    Connect to database server and store config in session.
    Multi-user safe: Each user's config is isolated in their session.

    Args:
        host: Database host (None for SQLite)
        port: Database port (None for SQLite)
        user: Database user (None for SQLite)
        password: Database password (None for SQLite)
        db_type: Database type ('mysql', 'postgresql', 'sqlite')
        database: Database name or file path (for SQLite)
    """
    # Clear any cached DB metadata from previous connections
    try:
        from database.operations import DatabaseOperations
        DatabaseOperations.clear_cache()
    except Exception:
        logger.debug('Failed to clear DatabaseOperations cache before applying new server config')

    # Store config in session (per-user isolation)
    if db_type == 'sqlite':
        # For SQLite, store minimal config with file path
        set_db_config_in_session('', 0, '', '', database=database, db_type='sqlite')
    else:
        # For MySQL/PostgreSQL, store full server config
        set_db_config_in_session(host, int(port), user, password, database=database, db_type=db_type)

    # Test connection and fetch databases/schemas
    try:
        conn = get_db_connection()

        # Validate connection based on database type
        from database.adapters import get_adapter
        adapter = get_adapter(db_type)

        if adapter.validate_connection(conn):
            from database.operations import get_databases as _get_databases
            dbs_result = _get_databases()

            if dbs_result.get('status') == 'success':
                if db_type == 'sqlite':
                    logger.info(f"User connected to SQLite database at {database}")
                    return jsonify({
                        'status': 'connected',
                        'message': f'Connected to SQLite database',
                        'schemas': dbs_result['databases']
                    })
                else:
                    logger.info(f"User connected to {db_type.upper()} server {host}:{port} with {len(dbs_result.get('databases', []))} databases")
                    return jsonify({
                        'status': 'connected',
                        'message': f'Connected to {db_type.upper()} server at {host}:{port}',
                        'schemas': dbs_result['databases']
                })
            return jsonify({
                'status': 'connected',
                'message': 'Connected, but failed to fetch schemas',
                'schemas': []
            })
        return jsonify({'status': 'error', 'message': 'Failed to connect to the database server.'})
    except Exception as err:
        logger.exception('Error while testing DB connection')
        # Clear config from session if connection failed
        clear_db_config_from_session()
        return jsonify({'status': 'error', 'message': str(err)})


def _handle_db_selection(db_name, conversation_id=None):
    """
    Select a database and store in session.
    Multi-user safe: Each user's database selection is isolated in their session.
    """
    from database.operations import fetch_database_info
    from services.gemini_service import GeminiService

    # Update database in session
    try:
        update_database_in_session(db_name)
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)})

    # Fetch database info and notify Gemini
    try:
        db_info, detailed_info = fetch_database_info(db_name)
        conversation_id = session.get('conversation_id', conversation_id)
        if db_info and db_info.strip():
            GeminiService.notify_gemini(conversation_id, db_info)
        if detailed_info and detailed_info.strip():
            GeminiService.notify_gemini(conversation_id, detailed_info)

        logger.info(f"User selected database: {db_name}")
        return jsonify({'status': 'connected', 'message': f'Connected to database {db_name}'})
    except Exception as err:
        logger.exception('Error while selecting database %s', db_name)
        return jsonify({'status': 'error', 'message': str(err)})

@api_bp.route('/run_sql_query', methods=['POST'])
def run_sql_query():
    data = request.get_json()
    sql_query = data['sql_query']
    conversation_id = session.get('conversation_id')

    result = execute_sql_query(sql_query)

    # Notify Gemini about the query execution
    db_name = get_current_database()  # Uses session-based config
    if result['status'] == 'success':
        if 'result' in result:  # SELECT query
            notify_msg = f'SELECT query executed on {db_name}. Retrieved {result["row_count"]} rows.'
        else:  # Other queries
            notify_msg = f'Query executed on {db_name} in table {result.get("table_name", "unknown")}. Affected rows: {result["affected_rows"]}. Query: {sql_query}'
        GeminiService.notify_gemini(conversation_id, notify_msg)
    else:
        notify_msg = f'Error executing query on {db_name}: {result["message"]}. Query: {sql_query}'
        GeminiService.notify_gemini(conversation_id, notify_msg)

    return jsonify(result)


@api_bp.route('/disconnect_db', methods=['POST'])
def disconnect_db():
    """
    Disconnect user's database connection pool and clear session config.
    Multi-user safe: Only affects the current user's pool and session.
    """
    try:
        from database.operations import DatabaseOperations

        # Close this user's connection pool
        closed = close_user_pool()

        # Clear database config from session
        clear_db_config_from_session()

        # Clear any cached DB metadata
        try:
            DatabaseOperations.clear_cache()
        except Exception:
            logger.debug('Failed to clear DatabaseOperations cache after disconnect')

        logger.info(f"User disconnected from database (pool closed: {closed})")
        return jsonify({'status': 'success', 'message': 'Disconnected from database server.'})
    except Exception as e:
        logger.exception('Error disconnecting DB')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@api_bp.route('/get_tables', methods=['GET'])
def get_tables():
    """Get all tables in the currently selected database.

    Multi-user safe: Uses session-based database selection.
    """
    try:
        from database.operations import DatabaseOperations

        db_name = get_current_database()  # Uses session-based config
        if not db_name:
            return jsonify({'status': 'error', 'message': 'No database selected'}), 400

        tables = DatabaseOperations.get_tables(db_name)
        return jsonify({'status': 'success', 'tables': tables, 'database': db_name})
    except Exception as e:
        logger.exception('Error fetching tables')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@api_bp.route('/get_table_schema', methods=['POST'])
def get_table_schema_route():
    """Get schema information for a specific table.

    Multi-user safe: Uses session-based database selection.
    """
    try:
        from database.operations import DatabaseOperations

        data = request.get_json()
        table_name = data.get('table_name')

        if not table_name:
            return jsonify({'status': 'error', 'message': 'Table name is required'}), 400

        db_name = get_current_database()  # Uses session-based config
        if not db_name:
            return jsonify({'status': 'error', 'message': 'No database selected'}), 400

        schema = DatabaseOperations.get_table_schema(table_name, db_name)
        row_count = DatabaseOperations.get_table_row_count(table_name, db_name)

        return jsonify({
            'status': 'success',
            'table_name': table_name,
            'schema': schema,
            'row_count': row_count
        })
    except Exception as e:
        logger.exception('Error fetching table schema')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@api_bp.route('/db_status', methods=['GET'])
def db_status():
    """Return whether a DB connection exists and optionally the list of databases.

    This endpoint is intended for UI autodiscovery on page load. It will not
    expose credentials; only high-level connection state and an optional list
    of user databases (names) when available.

    Multi-user safe: Checks the current user's session for database configuration.
    """
    try:
        from database.session_utils import is_db_configured, is_database_selected

        # Check if user has database configuration in their session
        connected = is_db_configured()

        result = {'status': 'ok', 'connected': bool(connected)}

        # If connected, attempt to retrieve the database list (non-fatal)
        if connected:
            try:
                from database.operations import get_databases
                dbs = get_databases()
                if isinstance(dbs, dict) and dbs.get('status') == 'success':
                    result['databases'] = dbs.get('databases', [])
                else:
                    result['databases'] = []
            except Exception as e:
                logger.debug('db_status: failed to fetch databases: %s', e)
                result['databases'] = []

        # Provide current selected database name if present (do not expose secrets)
        try:
            current_db = get_current_database()  # Uses session-based config
            result['current_database'] = current_db
        except Exception:
            result['current_database'] = None

        return jsonify(result)
    except Exception as e:
        logger.exception('Error while checking DB status')
        return jsonify({'status': 'error', 'message': str(e)}), 500

@api_bp.route('/db_heartbeat', methods=['GET'])
def db_heartbeat():
    """Lightweight heartbeat endpoint to check database connection health.

    Returns minimal connection status without fetching databases.
    Used by frontend for periodic connection health checks.

    Multi-user safe: Checks the current user's session-based connection.
    """
    try:
        from database.session_utils import is_db_configured

        # Check if user has database configuration in their session
        if not is_db_configured():
            return jsonify({
                'status': 'ok',
                'connected': False,
                'timestamp': __import__('time').time()
            })

        # Try to ping the connection using user's session config
        connected = False
        try:
            conn = get_db_connection()  # Uses session-based config
            if conn and conn.is_connected():
                # Perform a lightweight query to verify connection
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                cursor.close()
                connected = True
        except Exception as e:
            logger.debug(f'Heartbeat check failed: {e}')
            connected = False

        return jsonify({
            'status': 'ok',
            'connected': connected,
            'timestamp': __import__('time').time()
        })
    except Exception as e:
        logger.exception('Error in heartbeat check')
        return jsonify({'status': 'error', 'connected': False}), 500

@api_bp.route('/delete_conversation/<conversation_id>', methods=['DELETE'])
@login_required
def delete_conversation(conversation_id):
    try:
        user_id = session['user']
        FirestoreService.delete_conversation(conversation_id, user_id)
        
        # If the deleted conversation is the current one, clear it from session
        if session.get('conversation_id') == conversation_id:
            session.pop('conversation_id', None)
            
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f'Error deleting conversation: {e}')
        return jsonify({'status': 'error', 'message': str(e)}), 500
