"""Combined API router - aggregates all domain-specific routers."""

from fastapi import APIRouter

from app.features.conversations.api.routes import router as conversation_router
from app.features.database.api.routes import router as database_router
from app.features.database.api.schema_routes import router as schema_router
from app.features.context.api.routes import router as context_router
from app.features.quota.api.routes import router as quota_router

# Combined router that aggregates all domain routers
combined_router = APIRouter(tags=["api"])

# =============================================================================
# HEALTH CHECK ROUTES (kept here as they're minimal)
# =============================================================================

@combined_router.get("/")
async def landing():
    """API health check."""
    return {"status": "success", "message": "API is running"}

# Include domain routers
combined_router.include_router(conversation_router)
combined_router.include_router(database_router)
combined_router.include_router(schema_router)
combined_router.include_router(context_router)
combined_router.include_router(quota_router)
