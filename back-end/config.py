# File: config.py
"""Application configuration settings"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    # Secret key - should always be set in environment
    SECRET_KEY = os.getenv('SECRET_KEY')
    if not SECRET_KEY or SECRET_KEY == 'your_secret_key_here':
        raise ValueError("SECRET_KEY environment variable must be set to a real value (not the placeholder)")
    
    # MySQL Configuration (defaults only, credentials to be set at runtime)
    MYSQL_CONFIG = {
        'user': None,      # To be set after user input
        'password': None,  # To be set after user input
        'host': None,      # To be set after user input
        'port': None,      # To be set after user input
        'database': None   # To be set after user input
    }
    
    # Gemini API Configuration
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    
    # Firebase credentials from environment variables
    @staticmethod
    def get_firebase_credentials():
        """Get Firebase credentials from environment variables"""
        required_env_vars = [
            'FIREBASE_TYPE',
            'FIREBASE_PROJECT_ID', 
            'FIREBASE_PRIVATE_KEY_ID',
            'FIREBASE_PRIVATE_KEY',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_CLIENT_ID',
            'FIREBASE_AUTH_URI',
            'FIREBASE_TOKEN_URI'
        ]
        
        # Check if all required environment variables are present
        missing_vars = [var for var in required_env_vars if not os.getenv(var)]
        if missing_vars:
            raise ValueError(f"Missing Firebase environment variables: {', '.join(missing_vars)}")
        
        # Process the private key to handle newlines correctly
        private_key = os.getenv('FIREBASE_PRIVATE_KEY')
        if private_key:
            # Replace literal \n with actual newlines
            private_key = private_key.replace('\\n', '\n')
        
        return {
            "type": os.getenv('FIREBASE_TYPE'),
            "project_id": os.getenv('FIREBASE_PROJECT_ID'),
            "private_key_id": os.getenv('FIREBASE_PRIVATE_KEY_ID'),
            "private_key": private_key,
            "client_email": os.getenv('FIREBASE_CLIENT_EMAIL'),
            "client_id": os.getenv('FIREBASE_CLIENT_ID'),
            "auth_uri": os.getenv('FIREBASE_AUTH_URI'),
            "token_uri": os.getenv('FIREBASE_TOKEN_URI')
        }
    
    # Validation method to check Firebase credentials at startup
    @staticmethod
    def validate_firebase_credentials():
        """Validate Firebase credentials are properly configured"""
        try:
            credentials = Config.get_firebase_credentials()
            
            # Basic validation
            if not credentials['project_id']:
                raise ValueError("Firebase project_id is empty")
            
            if not credentials['private_key'].startswith('-----BEGIN PRIVATE KEY-----'):
                raise ValueError("Firebase private_key format is invalid")
                
            if '@' not in credentials['client_email']:
                raise ValueError("Firebase client_email format is invalid")
                
            print("✅ Firebase credentials validation passed")
            return True
            
        except Exception as e:
            print(f"❌ Firebase credentials validation failed: {e}")
            return False
    
    # Thread Pool Configuration
    MAX_WORKERS = int(os.getenv('MAX_WORKERS', 32))
    
    # Logging Configuration
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

    # Firebase Web/Client SDK Configuration (for frontend)
    @staticmethod
    def get_firebase_web_config():
        """Get Firebase web client configuration from environment variables"""
        return {
            "apiKey": os.getenv('FIREBASE_WEB_API_KEY', ''),
            "authDomain": os.getenv('FIREBASE_AUTH_DOMAIN', ''),
            "projectId": os.getenv('FIREBASE_WEB_PROJECT_ID', ''),
            "storageBucket": os.getenv('FIREBASE_STORAGE_BUCKET', ''),
            "messagingSenderId": os.getenv('FIREBASE_MESSAGING_SENDER_ID', ''),
            "appId": os.getenv('FIREBASE_APP_ID', '')
        }

    # Validation method to ensure Firebase project consistency
    @staticmethod
    def validate_firebase_project_consistency():
        """Validate that Admin SDK and Client SDK use the same Firebase project"""
        admin_project_id = os.getenv('FIREBASE_PROJECT_ID', '')
        web_project_id = os.getenv('FIREBASE_WEB_PROJECT_ID', '')

        if not admin_project_id or not web_project_id:
            print("⚠️  Warning: Firebase project IDs not configured")
            return False

        if admin_project_id != web_project_id:
            raise ValueError(
                f"Firebase project ID mismatch!\n"
                f"  Admin SDK (FIREBASE_PROJECT_ID): {admin_project_id}\n"
                f"  Client SDK (FIREBASE_WEB_PROJECT_ID): {web_project_id}\n"
                f"Both must use the SAME Firebase project for authentication to work correctly."
            )

        print(f"✅ Firebase project consistency validated: {admin_project_id}")
        return True

    # CORS Configuration
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')

    # Rate Limiting Configuration
    RATELIMIT_ENABLED = os.getenv('RATELIMIT_ENABLED', 'True').lower() == 'true'
    RATELIMIT_STORAGE_URL = os.getenv('RATELIMIT_STORAGE_URL', 'memory://')
    RATELIMIT_DEFAULT = os.getenv('RATELIMIT_DEFAULT', '200 per day, 50 per hour')

    # SQL Query Security Configuration
    MAX_QUERY_RESULTS = int(os.getenv('MAX_QUERY_RESULTS', 10000))  # Max rows to return
    QUERY_TIMEOUT_SECONDS = int(os.getenv('QUERY_TIMEOUT_SECONDS', 30))  # Query timeout
    MAX_QUERY_LENGTH = int(os.getenv('MAX_QUERY_LENGTH', 10000))  # Max characters in query

class DevelopmentConfig(Config):
    """Development-specific configuration"""
    DEBUG = True
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'DEBUG')

class ProductionConfig(Config):
    """Production-specific configuration"""
    DEBUG = False
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'WARNING')

# Configuration selection based on environment
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}