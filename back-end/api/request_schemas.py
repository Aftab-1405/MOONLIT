"""
API Request Schemas

Pydantic models for validating incoming API requests.
Provides type safety, automatic validation, and clear error messages.
"""

from typing import Any, Optional, Literal
from pydantic import BaseModel, Field, field_validator


# =============================================================================
# CONVERSATION SCHEMAS
# =============================================================================


class ChatRequest(BaseModel):
    """Schema for chat request"""

    prompt: str = Field(..., min_length=1, max_length=50000)
    conversation_id: Optional[str] = Field(None, max_length=100)
    enable_reasoning: bool = Field(default=True)
    reasoning_effort: Literal["low", "medium", "high"] = Field(default="medium")
    response_style: Literal["concise", "balanced", "detailed"] = Field(
        default="balanced"
    )
    max_rows: Optional[int] = Field(
        default=1000, ge=1, le=100000
    )  # None = no limit (use server config)
    provider: Optional[str] = Field(default=None, max_length=50)
    model: Optional[str] = Field(default=None, max_length=150)

    @field_validator("prompt")
    @classmethod
    def prompt_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Prompt cannot be empty")
        return v.strip()

    @field_validator("provider")
    @classmethod
    def sanitize_provider(cls, v):
        if v is None:
            return None
        provider = v.strip().lower()
        return provider or None

    @field_validator("model")
    @classmethod
    def sanitize_model(cls, v):
        if v is None:
            return None
        model = v.strip()
        return model or None


class AgentResumeRequest(BaseModel):
    """Schema for resuming a paused LangGraph conversation."""

    conversation_id: str = Field(..., min_length=1, max_length=100)
    resume: dict[str, Any] = Field(...)
    enable_reasoning: bool = Field(default=True)
    reasoning_effort: Literal["low", "medium", "high"] = Field(default="medium")
    response_style: Literal["concise", "balanced", "detailed"] = Field(
        default="balanced"
    )
    max_rows: Optional[int] = Field(default=1000, ge=1, le=100000)
    provider: Optional[str] = Field(default=None, max_length=50)
    model: Optional[str] = Field(default=None, max_length=150)

    @field_validator("resume")
    @classmethod
    def resume_not_empty(cls, v):
        if not isinstance(v, dict) or not v:
            raise ValueError("Resume payload cannot be empty")
        return v

    @field_validator("provider")
    @classmethod
    def sanitize_provider(cls, v):
        if v is None:
            return None
        provider = v.strip().lower()
        return provider or None

    @field_validator("model")
    @classmethod
    def sanitize_model(cls, v):
        if v is None:
            return None
        model = v.strip()
        return model or None


# =============================================================================
# DATABASE CONNECTION SCHEMAS
# =============================================================================


class ConnectDBRequest(BaseModel):
    """Schema for /connect_db"""

    db_type: Literal["mysql", "postgresql", "sqlserver", "oracle"] = Field(...)
    database: Optional[str] = Field(None, max_length=255, validation_alias="db_name")
    host: Optional[str] = Field(None, max_length=255)
    port: Optional[int] = Field(None, ge=1, le=65535)
    username: Optional[str] = Field(None, max_length=255, validation_alias="user")
    password: Optional[str] = Field(None)  # No max length for password
    is_remote: bool = Field(default=False)
    connection_string: Optional[str] = Field(None, max_length=2000)

    model_config = {"populate_by_name": True}

    @field_validator("database")
    @classmethod
    def sanitize_database(cls, v):
        if v:
            # Basic sanitization - remove dangerous characters
            return v.replace(";", "").replace("--", "").strip()
        return v


class SwitchDatabaseRequest(BaseModel):
    """Schema for /switch_remote_database"""

    database: str = Field(..., min_length=1, max_length=255)

    @field_validator("database")
    @classmethod
    def sanitize_database(cls, v):
        if not v or not v.strip():
            raise ValueError("Database name is required")
        return v.replace(";", "").replace("--", "").strip()


# =============================================================================
# SCHEMA ROUTES
# =============================================================================


class SelectSchemaRequest(BaseModel):
    """Schema for /select_schema"""

    schema_name: str = Field(..., min_length=1, max_length=255)

    @field_validator("schema_name")
    @classmethod
    def sanitize_schema(cls, v):
        if not v or not v.strip():
            raise ValueError("Schema name is required")
        return v.replace(";", "").replace("--", "").strip()


# =============================================================================
# TABLE ROUTES
# =============================================================================


class GetTableSchemaRequest(BaseModel):
    """Schema for /get_table_schema"""

    table_name: str = Field(..., min_length=1, max_length=255)

    @field_validator("table_name")
    @classmethod
    def sanitize_table_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Table name is required")
        return v.replace(";", "").replace("--", "").strip()


# =============================================================================
# QUERY ROUTES
# =============================================================================


class RunQueryRequest(BaseModel):
    """Schema for /run_sql_query"""

    sql_query: str = Field(..., min_length=1, max_length=100000)
    max_rows: Optional[int] = Field(
        default=1000, ge=1, le=100000
    )  # None = no limit (use server config)
    timeout: int = Field(default=30, ge=1, le=300)

    @field_validator("sql_query")
    @classmethod
    def validate_query(cls, v):
        if not v or not v.strip():
            raise ValueError("SQL query cannot be empty")
        return v.strip()


# =============================================================================
# USER SETTINGS ROUTES
# =============================================================================


class SaveUserSettingsRequest(BaseModel):
    """Schema for /api/user/settings — partial update; stored per user in Firestore."""

    theme: Optional[Literal["light", "dark"]] = None
    confirmBeforeRun: Optional[bool] = None
    queryTimeout: Optional[int] = Field(None, ge=10, le=300)
    maxRows: Optional[int] = Field(None, ge=0, le=100000)
    nullDisplay: Optional[str] = Field(None, max_length=32)
    rememberConnection: Optional[bool] = None
    defaultDbType: Optional[
        Literal["mysql", "postgresql", "sqlserver", "oracle"]
    ] = None
    connectionPersistence: Optional[Literal[0, 5, 15, 30, 60]] = None
    connectionPersistenceMinutes: Optional[Literal[0, 5, 15, 30, 60]] = None
    enableReasoning: Optional[bool] = None
    reasoningEffort: Optional[Literal["low", "medium", "high"]] = None
    responseStyle: Optional[Literal["concise", "balanced", "detailed"]] = None
    llmProvider: Optional[str] = Field(None, max_length=50)
    llmModel: Optional[str] = Field(None, max_length=150)

    @field_validator("llmProvider")
    @classmethod
    def sanitize_llm_provider(cls, v):
        if v is None:
            return None
        provider = v.strip().lower()
        return provider or None

    @field_validator("llmModel")
    @classmethod
    def sanitize_llm_model(cls, v):
        if v is None:
            return None
        model = v.strip()
        return model or None


class CloseSessionRequest(BaseModel):
    """Schema for /api/user/session/close"""

    connectionPersistenceMinutes: Optional[Literal[0, 5, 15, 30, 60]] = None
    sessionInstanceId: Optional[str] = Field(default=None, max_length=200)


class SessionActiveRequest(BaseModel):
    """Schema for /api/user/session/active"""

    sessionInstanceId: Optional[str] = Field(default=None, max_length=200)


# =============================================================================
# NOTE: FastAPI handles validation automatically when you use Pydantic models
# as function parameters. The model is validated before your route code runs.
#
# Example:
#   async def my_route(data: ChatRequest):
#       # data is already validated
# =============================================================================
