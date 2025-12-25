# File: auth/decorators.py
"""Authentication decorators with Firebase token verification"""

from functools import wraps
from flask import session, redirect, url_for, current_app, request, jsonify, g

def login_required(f):
    """
    Verify Firebase ID token for authenticated requests.
    
    Supports two auth methods (for backward compatibility during migration):
    1. Authorization: Bearer <firebase_id_token> (preferred, stateless)
    2. Flask session (legacy, will be deprecated)
    
    Sets g.user with verified user data for use in route handlers.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Method 1: Check Authorization header for Firebase ID token
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.replace('Bearer ', '')
            try:
                from firebase_admin import auth
                # Verify token cryptographically with Firebase
                decoded_token = auth.verify_id_token(token)
                g.user = {
                    'uid': decoded_token['uid'],
                    'email': decoded_token.get('email'),
                    'name': decoded_token.get('name'),
                    'verified': True  # Token was verified
                }
                current_app.logger.debug(f'Token verified for user: {g.user["uid"]}')
                return f(*args, **kwargs)
            except Exception as e:
                current_app.logger.warning(f'Token verification failed: {e}')
                return jsonify({'status': 'error', 'message': 'Invalid or expired token'}), 401
        
        # Method 2: Fallback to session (legacy support)
        if 'user' in session:
            g.user = session['user']
            g.user['verified'] = False  # Session-based, not token-verified
            current_app.logger.debug(f'Session auth for user: {g.user}')
            return f(*args, **kwargs)
        
        # No valid auth found
        current_app.logger.debug('No valid authentication found')
        return jsonify({'status': 'error', 'message': 'Authentication required'}), 401
    
    return decorated_function


def get_current_user():
    """Get the current authenticated user from g.user"""
    return getattr(g, 'user', None)


def get_user_id():
    """Get the current user's ID (uid)"""
    user = get_current_user()
    if user:
        return user.get('uid') or user  # Handle both dict and string formats
    return None
