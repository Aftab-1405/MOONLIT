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
    """
    Handle user input and pass it to Gemini for processing.
    Returns streaming response for real-time AI output.
    
    Error handling:
    - Quota exceeded: Returns friendly message, doesn't store in Firebase
    - Other API errors: Returns friendly message, doesn't store in Firebase
    """
    data = request.get_json()
    prompt = data.get('prompt')
    
    # If the front-end doesn't send a conversation_id (i.e., the user started fresh or
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
    
    user_id = session.get('user')
    
    # Try to get the AI response first - don't store anything until we know it works
    try:
        # Test the connection first (non-streaming) to catch quota errors early
        from google.api_core.exceptions import ResourceExhausted, GoogleAPIError
        
        def generate():
            prompt_stored = False
            full_response_content = []
            
            try:
                responses = GeminiService.send_message(conversation_id, prompt)
                
                for chunk in responses:
                    # Store user prompt only when we get the first successful chunk
                    if not prompt_stored:
                        FirestoreService.store_conversation(conversation_id, 'user', prompt, user_id)
                        prompt_stored = True
                    
                    text_chunk = chunk.text
                    full_response_content.append(text_chunk)
                    yield text_chunk

                # Store the complete AI response after streaming
                if prompt_stored and full_response_content:
                    FirestoreService.store_conversation(conversation_id, 'ai', "".join(full_response_content), user_id)
                    
            except ResourceExhausted as quota_err:
                # Handle quota exceeded - don't store anything
                logger.warning(f'Gemini quota exceeded: {quota_err}')
                error_msg = "⚠️ **API Rate Limit Exceeded**\n\nThe AI service is temporarily unavailable due to high usage. Please wait a moment and try again.\n\n_This message was not saved to your conversation._"
                yield error_msg
                
            except GoogleAPIError as api_err:
                # Handle other Google API errors
                logger.error(f'Gemini API error: {api_err}')
                error_msg = f"⚠️ **AI Service Error**\n\nThere was a problem connecting to the AI service. Please try again.\n\n_This message was not saved to your conversation._"
                yield error_msg
                
            except Exception as stream_err:
                # Handle any other streaming errors
                logger.error(f'Streaming error: {stream_err}')
                error_msg = "⚠️ **Unexpected Error**\n\nSomething went wrong. Please try again.\n\n_This message was not saved to your conversation._"
                yield error_msg

        # Attach helpful headers to encourage immediate streaming through proxies
        headers = {
            'X-Conversation-Id': conversation_id,
            'Cache-Control': 'no-cache, no-transform',
            # Some reverse proxies buffer streamed responses; this header helps disable that behavior
            'X-Accel-Buffering': 'no'
        }
        return Response(generate(), mimetype='text/plain', headers=headers)
        
    except Exception as e:
        logger.error(f'Error initializing Gemini request: {e}')
        # Check if it's a quota error
        error_str = str(e).lower()
        if 'quota' in error_str or '429' in error_str or 'rate' in error_str:
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
    """Get list of databases using adapter pattern from operations.py."""
    from database.session_utils import is_remote_connection
    
    result = get_databases()
    
    # Add is_remote flag for frontend
    if is_remote_connection():
        result['is_remote'] = True
        
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
    connection_string = data.get('connection_string')  # For remote databases
    conversation_id = session.get('conversation_id')

    # For SQLite, only db_name (file path) is required
    if db_type == 'sqlite':
        if db_name:
            return _handle_server_connection(None, None, None, None, db_type, db_name)
        else:
            return jsonify({'status': 'error', 'message': 'Database file path is required for SQLite connection.'})

    # For PostgreSQL with connection string (Neon, Supabase, etc.)
    if connection_string and db_type == 'postgresql':
        return _handle_connection_string(connection_string, db_type)

    # For MySQL/PostgreSQL, all connection fields are required
    if all([host, port, user, password]):
        return _handle_server_connection(host, port, user, password, db_type)

    # If only db_name present -> treat as selecting a database on the server
    if db_name:
        return _handle_db_selection(db_name, conversation_id)

    # Invalid request
    return jsonify({'status': 'error', 'message': 'All fields are required for server connection, or db_name for database selection.'})


def _handle_connection_string(connection_string, db_type='postgresql'):
    """
    Connect to database using a connection string (DSN).
    Supports remote databases like Neon, Supabase, Railway, etc.
    
    Args:
        connection_string: Full connection string (e.g., postgresql://user:pass@host/db?sslmode=require)
        db_type: Database type ('postgresql')
    """
    import re
    
    # Clear any cached DB metadata from previous connections
    try:
        from database.operations import DatabaseOperations
        DatabaseOperations.clear_cache()
    except Exception:
        logger.debug('Failed to clear DatabaseOperations cache before applying connection string config')
    
    # Parse connection string to extract database name for display
    db_match = re.search(r'/([^/?]+)(\?|$)', connection_string)
    db_name = db_match.group(1) if db_match else 'remote_db'
    
    # Parse host for logging
    host_match = re.search(r'@([^/:]+)', connection_string)
    host = host_match.group(1) if host_match else 'remote'
    
    # Store connection string config in session
    from database.session_utils import set_connection_string_in_session, get_db_cursor
    set_connection_string_in_session(connection_string, db_type, db_name)
    
    # Test connection
    try:
        conn = get_db_connection()
        
        # Validate connection based on database type
        from database.adapters import get_adapter
        adapter = get_adapter(db_type)
        
        if adapter.validate_connection(conn):
            logger.info(f"User connected to remote {db_type.upper()} database: {db_name} at {host}")
            
            # Get list of all databases on this server using adapter
            all_databases = []
            try:
                with get_db_cursor() as cursor:
                    cursor.execute(adapter.get_databases_for_remote())
                    all_databases = [row[0] for row in cursor.fetchall()]
                    logger.info(f"Found {len(all_databases)} databases on remote server: {all_databases}")
            except Exception as db_list_err:
                logger.warning(f"Could not list databases: {db_list_err}")
                all_databases = [db_name]  # Fallback to current database only
            
            # Fetch schema info using adapter and notify Gemini
            schema_info = ""
            tables = []
            try:
                from services.gemini_service import GeminiService
                conversation_id = session.get('conversation_id')
                
                # Get schema queries from adapter
                schema_queries = adapter.get_schema_info_for_ai('public')
                
                with get_db_cursor() as cursor:
                    # Get all tables in public schema
                    cursor.execute(schema_queries['tables'])
                    tables = [row[0] for row in cursor.fetchall()]
                    
                    if tables:
                        schema_info = f"Connected to PostgreSQL database: {db_name}\n\n"
                        schema_info += f"Database contains {len(tables)} tables in the 'public' schema:\n\n"
                        
                        # Get all columns using adapter query
                        cursor.execute(schema_queries['columns'])
                        columns_data = cursor.fetchall()
                        
                        # Group columns by table
                        from collections import defaultdict
                        table_columns = defaultdict(list)
                        for table_name, col_name, col_type in columns_data:
                            table_columns[table_name].append((col_name, col_type))
                        
                        for table in tables:
                            schema_info += f"Table: {table}\n"
                            for col_name, col_type in table_columns.get(table, []):
                                schema_info += f"  - {col_name}: {col_type}\n"
                            schema_info += "\n"
                        
                        # Notify Gemini about the database schema
                        if schema_info:
                            GeminiService.notify_gemini(conversation_id, schema_info)
                            logger.info(f"Notified Gemini about {len(tables)} tables in {db_name}")
                    else:
                        schema_info = f"Connected to PostgreSQL database: {db_name}. No tables found in public schema."
                        GeminiService.notify_gemini(conversation_id, schema_info)
                        
            except Exception as schema_err:
                logger.warning(f"Failed to fetch/notify schema for remote DB: {schema_err}")
            
            # Build success message with table count
            message = f'Connected to remote {db_type.upper()} database: {db_name}'
            if tables:
                message += f' ({len(tables)} tables found)'
            if len(all_databases) > 1:
                message += f'. {len(all_databases)} databases available on this server.'
            
            return jsonify({
                'status': 'connected',
                'message': message,
                'schemas': all_databases,  # All databases on this server
                'selectedDatabase': db_name,  # Currently connected database
                'is_remote': True,
                'tables': tables
            })
        return jsonify({'status': 'error', 'message': 'Failed to connect to the remote database.'})
    except Exception as err:
        logger.exception('Error while testing remote DB connection')
        # Clear config from session if connection failed
        clear_db_config_from_session()
        return jsonify({'status': 'error', 'message': str(err)})


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


@api_bp.route('/switch_remote_database', methods=['POST'])
def switch_remote_database():
    """
    Switch to a different database on the same remote PostgreSQL server.
    Modifies the connection string to connect to the new database.
    """
    import re
    
    try:
        data = request.get_json(force=True) or {}
    except Exception:
        data = {}
    
    new_db_name = data.get('database')
    
    if not new_db_name:
        return jsonify({'status': 'error', 'message': 'Database name is required'}), 400
    
    # Get current config from session
    from database.session_utils import get_db_config_from_session, set_connection_string_in_session, get_db_cursor
    
    config = get_db_config_from_session()
    if not config:
        return jsonify({'status': 'error', 'message': 'No database connected'}), 400
    
    connection_string = config.get('connection_string')
    if not connection_string:
        return jsonify({'status': 'error', 'message': 'This feature is only for connection string based connections'}), 400
    
    # Modify connection string to use new database
    # Pattern: postgresql://user:pass@host/OLD_DB?params -> postgresql://user:pass@host/NEW_DB?params
    new_connection_string = re.sub(
        r'(/[^/?]+)(\?|$)',  # Match /database_name followed by ? or end
        f'/{new_db_name}\\2',  # Replace with /new_database_name
        connection_string
    )
    
    # Clear old connection pool
    try:
        from database.operations import DatabaseOperations
        DatabaseOperations.clear_cache()
        close_user_pool()
    except Exception:
        pass
    
    # Store new connection string in session
    set_connection_string_in_session(new_connection_string, 'postgresql', new_db_name)
    
    # Test new connection and get schema info
    try:
        conn = get_db_connection()
        
        from database.adapters import get_adapter
        adapter = get_adapter('postgresql')
        
        if adapter.validate_connection(conn):
            # Fetch schema info and notify Gemini
            tables = []
            try:
                from services.gemini_service import GeminiService
                conversation_id = session.get('conversation_id')
                
                with get_db_cursor() as cursor:
                    cursor.execute("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                        ORDER BY table_name
                    """)
                    tables = [row[0] for row in cursor.fetchall()]
                    
                    if tables:
                        schema_info = f"Switched to PostgreSQL database: {new_db_name}\n\n"
                        schema_info += f"Database contains {len(tables)} tables in the 'public' schema:\n\n"
                        
                        for table in tables:
                            cursor.execute("""
                                SELECT column_name, data_type, is_nullable
                                FROM information_schema.columns
                                WHERE table_schema = 'public' AND table_name = %s
                                ORDER BY ordinal_position
                            """, (table,))
                            columns = cursor.fetchall()
                            
                            schema_info += f"Table: {table}\n"
                            for col_name, col_type, nullable in columns:
                                null_str = "NULL" if nullable == 'YES' else "NOT NULL"
                                schema_info += f"  - {col_name}: {col_type} ({null_str})\n"
                            schema_info += "\n"
                        
                        GeminiService.notify_gemini(conversation_id, schema_info)
                    else:
                        schema_info = f"Switched to PostgreSQL database: {new_db_name}. No tables found in public schema."
                        GeminiService.notify_gemini(conversation_id, schema_info)
                        
            except Exception as schema_err:
                logger.warning(f"Failed to fetch schema after switch: {schema_err}")
            
            logger.info(f"User switched to database: {new_db_name}")
            return jsonify({
                'status': 'connected',
                'message': f'Switched to database: {new_db_name}',
                'selectedDatabase': new_db_name,
                'tables': tables
            })
        
        return jsonify({'status': 'error', 'message': 'Failed to connect to the new database'})
    except Exception as err:
        logger.exception('Error switching remote database')
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
    sql_query = data.get('sql_query')
    max_rows = data.get('max_rows', 1000)  # Default 1000 rows
    timeout = data.get('timeout', 30)  # Default 30 seconds
    conversation_id = session.get('conversation_id')

    result = execute_sql_query(sql_query, max_rows=max_rows, timeout_seconds=timeout)

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


@api_bp.route('/get_schemas', methods=['GET'])
def get_schemas():
    """Get all schemas in the currently connected PostgreSQL database.

    Multi-user safe: Uses session-based database configuration.
    """
    try:
        from database.session_utils import get_db_config_from_session, get_db_cursor
        
        config = get_db_config_from_session()
        if not config:
            return jsonify({'status': 'error', 'message': 'No database connected'}), 400
        
        db_type = config.get('db_type', 'mysql')
        if db_type != 'postgresql':
            return jsonify({'status': 'error', 'message': 'Schema selection is only available for PostgreSQL'}), 400
        
        from database.adapters import get_adapter
        adapter = get_adapter(db_type)
        
        schemas = []
        with get_db_cursor() as cursor:
            cursor.execute(adapter.get_schemas_query())
            schemas = [row[0] for row in cursor.fetchall()]
        
        return jsonify({
            'status': 'success', 
            'schemas': schemas,
            'current_schema': config.get('schema', 'public')
        })
    except Exception as e:
        logger.exception('Error fetching schemas')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@api_bp.route('/select_schema', methods=['POST'])
def select_schema():
    """Select a PostgreSQL schema and notify Gemini about its tables.

    Multi-user safe: Uses session-based configuration.
    """
    try:
        from database.session_utils import get_db_config_from_session, set_schema_in_session, get_db_cursor
        from database.adapters import get_adapter
        from services.gemini_service import GeminiService
        
        data = request.get_json()
        schema_name = data.get('schema')
        
        if not schema_name:
            return jsonify({'status': 'error', 'message': 'Schema name is required'}), 400
        
        config = get_db_config_from_session()
        if not config:
            return jsonify({'status': 'error', 'message': 'No database connected'}), 400
        
        db_type = config.get('db_type', 'mysql')
        if db_type != 'postgresql':
            return jsonify({'status': 'error', 'message': 'Schema selection is only available for PostgreSQL'}), 400
        
        # Update session with selected schema
        set_schema_in_session(schema_name)
        
        # Get tables in the selected schema
        adapter = get_adapter(db_type)
        tables = []
        with get_db_cursor() as cursor:
            cursor.execute(adapter.get_tables_query(schema_name))
            tables = [row[0] for row in cursor.fetchall()]
        
        # Notify Gemini about the schema and its tables
        conversation_id = session.get('conversation_id')
        db_name = config.get('database', 'unknown')
        schema_info = f"User selected PostgreSQL schema: {schema_name} in database {db_name}. Tables in this schema: {', '.join(tables) if tables else 'No tables found'}."
        GeminiService.notify_gemini(conversation_id, schema_info)
        
        logger.info(f"User selected schema: {schema_name} with {len(tables)} tables")
        
        return jsonify({
            'status': 'success',
            'message': f'Selected schema: {schema_name}',
            'schema': schema_name,
            'tables': tables
        })
    except Exception as e:
        logger.exception('Error selecting schema')
        return jsonify({'status': 'error', 'message': str(e)}), 500


@api_bp.route('/get_tables', methods=['GET'])
def get_tables():
    """Get all tables in the currently selected database/schema.

    Multi-user safe: Uses session-based database selection.
    """
    try:
        from database.operations import DatabaseOperations
        from database.session_utils import get_db_config_from_session

        db_name = get_current_database()  # Uses session-based config
        if not db_name:
            return jsonify({'status': 'error', 'message': 'No database selected'}), 400

        config = get_db_config_from_session()
        schema = config.get('schema', 'public') if config else 'public'
        
        tables = DatabaseOperations.get_tables(db_name, schema=schema)
        return jsonify({'status': 'success', 'tables': tables, 'database': db_name, 'schema': schema})
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

        # Check if connected via remote connection string
        try:
            from database.session_utils import is_remote_connection
            result['is_remote'] = is_remote_connection()
        except Exception:
            result['is_remote'] = False

        # Provide database type for frontend feature detection (e.g., schema selector)
        try:
            from database.session_utils import get_db_type
            db_type = get_db_type()
            result['db_type'] = db_type or 'unknown'
        except Exception:
            result['db_type'] = 'unknown'

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
