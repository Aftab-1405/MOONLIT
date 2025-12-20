"""Authentication routes"""

from flask import Blueprint, request, jsonify, session
import uuid
import logging
from config import Config

auth_bp = Blueprint('auth_bp', __name__)
logger = logging.getLogger(__name__)

@auth_bp.route('/auth')
def auth():
    session.clear()
    logger.debug('Session cleared on /auth')
    # React frontend handles the UI, just return JSON
    return jsonify({'status': 'success', 'message': 'Session cleared'})

@auth_bp.route('/set_session', methods=['POST'])
def set_session():
    data = request.get_json()
    session['user'] = data['user']
    session['conversation_id'] = str(uuid.uuid4())
    logger.debug(f'Session set for user: {session["user"]} with conversation_id: {session["conversation_id"]}')
    return jsonify({'status': 'success', 'conversation_id': session['conversation_id']})

@auth_bp.route('/check_session', methods=['GET'])
def check_session():
    if 'user' in session:
        return jsonify({'status': 'session_active', 'conversation_id': session.get('conversation_id')})
    else:
        return jsonify({'status': 'no_session'})

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Clear user session and cleanup"""
    session.clear()
    logger.debug('User session cleared on /logout')
    return jsonify({'status': 'success', 'message': 'Logged out successfully'})

@auth_bp.route('/firebase-config', methods=['GET'])
def get_firebase_config():
    """Serve Firebase web client configuration"""
    try:
        config = Config.get_firebase_web_config()
        return jsonify({'status': 'success', 'config': config})
    except Exception as e:
        logger.error(f'Error getting Firebase config: {e}')
        return jsonify({'status': 'error', 'message': 'Failed to retrieve Firebase configuration'}), 500