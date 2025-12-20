"""Main Flask application entry point"""

import logging
from flask import Flask
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import Config
from auth.routes import auth_bp
from api.routes import api_bp
from services.firestore_service import FirestoreService

def create_app():
    """Application factory pattern"""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Set up logging
    logging.basicConfig(level=getattr(logging, Config.LOG_LEVEL))
    logger = logging.getLogger(__name__)

    # Validate Firebase configuration consistency
    try:
        Config.validate_firebase_project_consistency()
    except ValueError as e:
        logger.error(f"Firebase configuration error: {e}")
        raise

    # Initialize CORS
    if Config.CORS_ORIGINS:
        CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)
        logger.info(f"CORS enabled for origins: {Config.CORS_ORIGINS}")

    # Initialize Rate Limiting
    if Config.RATELIMIT_ENABLED:
        limiter = Limiter(
            app=app,
            key_func=get_remote_address,
            storage_uri=Config.RATELIMIT_STORAGE_URL,
            default_limits=[Config.RATELIMIT_DEFAULT]
        )
        logger.info(f"Rate limiting enabled: {Config.RATELIMIT_DEFAULT}")

        # Store limiter for use in routes
        app.limiter = limiter

    # Initialize services
    FirestoreService.initialize()

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)

    logger.info("Application initialized successfully")
    return app

# Create the app instance
app = create_app()

if __name__ == '__main__':
    app.run(debug=True)