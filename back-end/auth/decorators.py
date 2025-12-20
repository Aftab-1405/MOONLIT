# File: auth/decorators.py
"""Authentication decorators"""

from functools import wraps
from flask import session, redirect, url_for, current_app

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            current_app.logger.debug('User not in session, redirecting to auth.')
            return redirect(url_for('auth_bp.auth'))
        current_app.logger.debug(f'User in session: {session["user"]}')
        return f(*args, **kwargs)
    return decorated_function
