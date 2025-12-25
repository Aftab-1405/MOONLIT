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
    """
    Verify Firebase ID token and establish session.
    
    Expects JSON body:
    {
        "user": {...},  // User data from Firebase Auth
        "idToken": "..."  // Firebase ID token for verification
    }
    """
    data = request.get_json()
    
    # Get the ID token for verification
    id_token = data.get('idToken')
    if not id_token:
        logger.warning('set_session called without idToken')
        return jsonify({'status': 'error', 'message': 'ID token required'}), 400
    
    try:
        from firebase_admin import auth
        # Verify the token cryptographically with Firebase
        decoded_token = auth.verify_id_token(id_token)
        
        # Token is valid - store verified user info in session
        session['user'] = {
            'uid': decoded_token['uid'],
            'email': decoded_token.get('email'),
            'name': decoded_token.get('name'),
            'picture': decoded_token.get('picture'),
            'verified': True
        }
        session['conversation_id'] = str(uuid.uuid4())
        
        logger.info(f'Session established for verified user: {decoded_token["uid"]}')
        return jsonify({
            'status': 'success', 
            'conversation_id': session['conversation_id'],
            'user': session['user']
        })
        
    except Exception as e:
        logger.error(f'Token verification failed: {e}')
        return jsonify({'status': 'error', 'message': 'Invalid or expired token'}), 401

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