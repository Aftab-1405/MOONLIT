"""Main Flask application entry point"""

import os
import logging
from flask import Flask
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_session import Session
import redis
from config import get_config, ProductionConfig
from auth.routes import auth_bp
from api.routes import api_bp
from services.firestore_service import FirestoreService

def create_app():
    """Application factory pattern"""
    app = Flask(__name__)
    
    # Get environment-specific configuration
    AppConfig = get_config()
    app.config.from_object(AppConfig)

    # Set up logging based on environment
    logging.basicConfig(level=getattr(logging, AppConfig.LOG_LEVEL))
    logger = logging.getLogger(__name__)
    
    # Log current environment
    logger.info(f"🚀 Starting application in {AppConfig.FLASK_ENV.upper()} mode")
    logger.info(f"   Debug: {AppConfig.DEBUG}, Testing: {AppConfig.TESTING}")
    
    # Production-specific validation
    if isinstance(AppConfig, type) and issubclass(AppConfig, ProductionConfig):
        ProductionConfig.validate_production_settings()

    # Validate Firebase configuration consistency
    try:
        AppConfig.validate_firebase_project_consistency()
    except ValueError as e:
        logger.error(f"Firebase configuration error: {e}")
        raise

    # Initialize CORS
    if AppConfig.CORS_ORIGINS:
        CORS(app, origins=AppConfig.CORS_ORIGINS, supports_credentials=True)
        logger.info(f"CORS enabled for origins: {AppConfig.CORS_ORIGINS}")

    # Initialize Rate Limiting
    if AppConfig.RATELIMIT_ENABLED:
        limiter = Limiter(
            app=app,
            key_func=get_remote_address,
            storage_uri=AppConfig.RATELIMIT_STORAGE_URL,
            default_limits=[AppConfig.RATELIMIT_DEFAULT]
        )
        logger.info(f"Rate limiting enabled: {AppConfig.RATELIMIT_DEFAULT}")

        # Store limiter for use in routes
        app.limiter = limiter

    # Initialize Redis Session Storage (Upstash)
    redis_url = os.getenv('UPSTASH_REDIS_URL')
    if redis_url:
        # Convert redis:// to rediss:// for TLS (Upstash requires TLS)
        if redis_url.startswith('redis://'):
            redis_url = redis_url.replace('redis://', 'rediss://', 1)
        
        app.config['SESSION_TYPE'] = 'redis'
        app.config['SESSION_PERMANENT'] = True
        app.config['SESSION_USE_SIGNER'] = True
        app.config['SESSION_REDIS'] = redis.from_url(redis_url)
        Session(app)
        logger.info("✅ Redis session storage enabled (Upstash)")
    else:
        logger.warning("⚠️ UPSTASH_REDIS_URL not set, using in-memory sessions (not recommended for production)")

    # Initialize services
    FirestoreService.initialize()

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)

    logger.info("✅ Application initialized successfully")
    return app


# Application instance - created at module level for WSGI servers (Gunicorn, uWSGI)
# For testing, use create_app() directly to get isolated instances
app = create_app()

if __name__ == '__main__':
    app.run(debug=app.config.get('DEBUG', True))
