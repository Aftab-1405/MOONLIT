"""FastAPI application entry point"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import redis.asyncio as redis

from config import get_config, ProductionConfig
from services.firestore_service import FirestoreService
from services.rate_limiting import create_rate_limiter, create_user_quota_service
from agent.checkpointing import init_checkpointer, shutdown_checkpointer
from api.schemas.common import ApiError


# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("backend.log"),
        logging.StreamHandler()
    ]
)
logging.getLogger("watchfiles.main").setLevel(logging.WARNING)
logging.getLogger("watchfiles").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

# Get environment-specific configuration
AppConfig = get_config()

# Rate limiter - uses storage from config (memory:// for dev, redis:// for prod)
limiter = Limiter(
    key_func=get_remote_address, storage_uri=AppConfig.RATELIMIT_STORAGE_URL
)

# Redis client for sessions (initialized in lifespan)
redis_client: redis.Redis | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    global redis_client

    logger.info(f"🚀 Starting application in {AppConfig.APP_ENV.upper()} mode")
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

    # Initialize Firebase/Firestore
    FirestoreService.initialize()

    # Initialize Redis for sessions
    redis_url = os.getenv("UPSTASH_REDIS_URL")
    env = (AppConfig.APP_ENV or "development").lower()
    is_prod_like = env in ("staging", "production")

    if is_prod_like:
        if not redis_url:
            logger.error(
                "UPSTASH_REDIS_URL is required for staging/production (multi-worker safe sessions)"
            )
            raise RuntimeError("UPSTASH_REDIS_URL must be set for staging/production")
        if AppConfig.RATELIMIT_ENABLED and str(
            AppConfig.RATELIMIT_STORAGE_URL
        ).lower().startswith("memory"):
            logger.error(
                "RATELIMIT_STORAGE_URL must not use memory storage in staging/production"
            )
            raise RuntimeError(
                "RATELIMIT_STORAGE_URL must be a shared backend (e.g., Redis) in staging/production"
            )
    checkpoint_redis_url: str | None = None
    if redis_url:
        # Convert redis:// to rediss:// for TLS (Upstash requires TLS)
        if redis_url.startswith("redis://"):
            redis_url = redis_url.replace("redis://", "rediss://", 1)

        checkpoint_redis_url = redis_url
        redis_client = redis.from_url(redis_url, decode_responses=True)
        logger.info("✅ Redis application state storage enabled (Upstash)")
    else:
        logger.warning(
            "⚠️ UPSTASH_REDIS_URL not set, using in-memory application state"
        )

    # LangGraph thread persistence (Redis in staging/production; in-memory in dev)
    await init_checkpointer(
        app_env=env,
        redis_url=checkpoint_redis_url if is_prod_like else None,
    )

    # Initialize per-user quota service (needs Redis)
    app.state.user_quota = create_user_quota_service(redis_client, AppConfig)
    logger.info(
        f"User quota: {AppConfig.USER_QUOTA_PER_MINUTE}/min, "
        f"enabled={AppConfig.USER_QUOTA_ENABLED}"
    )

    logger.info("✅ Application initialized successfully")

    yield

    # Shutdown
    await shutdown_checkpointer()
    if redis_client:
        await redis_client.close()
        logger.info("Redis connection closed")


def create_app() -> FastAPI:
    """Application factory pattern."""
    app = FastAPI(
        title="Moonlit API",
        description="AI-powered database assistant API",
        version="2.0.0",
        lifespan=lifespan,
        docs_url="/docs" if AppConfig.DEBUG else None,
        redoc_url="/redoc" if AppConfig.DEBUG else None,
        openapi_url="/openapi.json" if AppConfig.DEBUG else None,
    )

    # Configure CORS
    if AppConfig.CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=AppConfig.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        logger.info(f"CORS enabled for origins: {AppConfig.CORS_ORIGINS}")

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        logger.debug(f"Incoming request: {request.method} {request.url}")
        
        # Redact sensitive headers
        sensitive_headers = {"cookie", "authorization", "x-csrf-token"}
        safe_headers = {
            k: ("***REDACTED***" if k.lower() in sensitive_headers else v)
            for k, v in request.headers.items()
        }
        logger.debug(f"Headers: {safe_headers}")
        
        try:
            body = await request.body()
            if body:
                body_str = body.decode('utf-8')
                # Truncate large bodies to prevent log bombing / disk exhaustion
                if len(body_str) > 200:
                    body_str = body_str[:200] + f"... [TRUNCATED {len(body_str) - 200} bytes]"
                logger.debug(f"Body: {body_str}")
        except Exception:
            pass
        
        response = await call_next(request)
        logger.debug(f"Response status: {response.status_code}")
        return response

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "no-referrer-when-downgrade"
        response.headers["Permissions-Policy"] = "geolocation=()"
        
        # Mask server header to prevent information disclosure
        response.headers["Server"] = "Moonlit"
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]
            
        return response

    @app.middleware("http")
    async def csrf_middleware(request: Request, call_next):
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            if request.url.path not in {"/api/v1/user/session/close"}:
                try:
                    from dependencies import verify_csrf
    
                    verify_csrf(request)
                except HTTPException as exc:
                    return JSONResponse(
                        status_code=exc.status_code,
                        content={
                            "error": "FORBIDDEN",
                            "message": str(exc.detail),
                            "details": {},
                        },
                    )

        return await call_next(request)

    # Configure rate limiting
    if AppConfig.RATELIMIT_ENABLED:
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        logger.info(f"Rate limiting enabled: {AppConfig.RATELIMIT_DEFAULT}")

    # Configure LLM rate limiter (multi-key load balancing)
    app.state.llm_rate_limiter = create_rate_limiter(AppConfig)
    logger.info(
        f"LLM provider: {AppConfig.LLM_PROVIDER}; "
        f"LLM rate limiter: "
        f"{app.state.llm_rate_limiter.configured_provider_count()} providers, "
        f"enabled={AppConfig.LLM_RATELIMIT_ENABLED}"
    )

    # Note: UserQuotaService is initialized in lifespan() after Redis connects
    app.state.user_quota = None  # Placeholder, set in lifespan

    # Register error handlers
    _register_error_handlers(app)

    # Register routers
    from auth.routes import router as auth_router
    from api.routes import combined_router as api_router

    app.include_router(auth_router)
    app.include_router(api_router, prefix="/api/v1")

    return app


def _register_error_handlers(app: FastAPI):
    """Register centralized error handlers for consistent JSON responses."""

    def error_code_for_status(status_code: int) -> str:
        return {
            status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
            status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
            status.HTTP_403_FORBIDDEN: "FORBIDDEN",
            status.HTTP_404_NOT_FOUND: "NOT_FOUND",
            status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
            status.HTTP_422_UNPROCESSABLE_ENTITY: "VALIDATION_ERROR",
            status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMITED",
            status.HTTP_500_INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
        }.get(status_code, "REQUEST_FAILED")

    def api_error_response(
        *,
        status_code: int,
        error: str,
        message: str,
        details: dict | None = None,
        headers: dict | None = None,
    ):
        return JSONResponse(
            status_code=status_code,
            content=ApiError(
                error=error,
                message=message,
                details=details or {},
            ).model_dump(),
            headers=headers,
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        detail = exc.detail
        error = error_code_for_status(exc.status_code)
        message = str(detail) if detail else error.replace("_", " ").title()
        details = {}

        if isinstance(detail, dict):
            error = str(detail.get("error") or detail.get("error_type") or error)
            message = str(detail.get("message") or detail.get("detail") or message)
            details = {
                key: value
                for key, value in detail.items()
                if key not in {"error", "error_type", "message", "detail"}
            }

        return api_error_response(
            status_code=exc.status_code,
            error=error.upper(),
            message=message,
            details=details,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        return api_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error="VALIDATION_ERROR",
            message="Request validation failed.",
            details={"errors": jsonable_encoder(exc.errors())},
        )

    @app.exception_handler(Exception)
    async def internal_error_handler(request: Request, exc: Exception):
        logger.exception(f"Internal server error: {exc}")
        return api_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error="INTERNAL_SERVER_ERROR",
            message="Internal server error",
        )


def get_redis_client() -> redis.Redis | None:
    """Get the Redis client instance."""
    return redis_client


# Application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        reload=AppConfig.DEBUG,
        log_level="debug" if AppConfig.DEBUG else "info",
    )
