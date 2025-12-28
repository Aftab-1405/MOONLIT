"""
API Request Schemas

Pydantic models for validating incoming API requests.
Provides type safety, automatic validation, and clear error messages.
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator


# =============================================================================
# CONVERSATION SCHEMAS
# =============================================================================

class ChatRequest(BaseModel):
    """Schema for chat request"""
    prompt: str = Field(..., min_length=1, max_length=50000)
    conversation_id: Optional[str] = Field(None, max_length=100)
    enable_reasoning: bool = Field(default=True)
    reasoning_effort: Literal['low', 'medium', 'high'] = Field(default='medium')
    response_style: Literal['concise', 'balanced', 'detailed'] = Field(default='balanced')
    max_rows: Optional[int] = Field(default=1000, ge=1, le=100000)  # None = no limit (use server config)
    
    @field_validator('prompt')
    @classmethod
    def prompt_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Prompt cannot be empty')
        return v.strip()


# =============================================================================
# DATABASE CONNECTION SCHEMAS
# =============================================================================

class ConnectDBRequest(BaseModel):
    """Schema for /connect_db"""
    db_type: Literal['mysql', 'postgresql', 'sqlite'] = Field(...)
    database: Optional[str] = Field(None, max_length=255)
    host: Optional[str] = Field(None, max_length=255)
    port: Optional[int] = Field(None, ge=1, le=65535)
    username: Optional[str] = Field(None, max_length=255)
    password: Optional[str] = Field(None)  # No max length for password
    is_remote: bool = Field(default=False)
    connection_string: Optional[str] = Field(None, max_length=2000)
    
    @field_validator('database')
    @classmethod
    def sanitize_database(cls, v):
        if v:
            # Basic sanitization - remove dangerous characters
            return v.replace(';', '').replace('--', '').strip()
        return v


class SwitchDatabaseRequest(BaseModel):
    """Schema for /switch_remote_database"""
    database: str = Field(..., min_length=1, max_length=255)
    
    @field_validator('database')
    @classmethod
    def sanitize_database(cls, v):
        if not v or not v.strip():
            raise ValueError('Database name is required')
        return v.replace(';', '').replace('--', '').strip()


# =============================================================================
# SCHEMA ROUTES
# =============================================================================

class SelectSchemaRequest(BaseModel):
    """Schema for /select_schema"""
    schema: str = Field(..., min_length=1, max_length=255)
    
    @field_validator('schema')
    @classmethod
    def sanitize_schema(cls, v):
        if not v or not v.strip():
            raise ValueError('Schema name is required')
        return v.replace(';', '').replace('--', '').strip()


# =============================================================================
# TABLE ROUTES
# =============================================================================

class GetTableSchemaRequest(BaseModel):
    """Schema for /get_table_schema"""
    table_name: str = Field(..., min_length=1, max_length=255)
    
    @field_validator('table_name')
    @classmethod
    def sanitize_table_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Table name is required')
        return v.replace(';', '').replace('--', '').strip()


# =============================================================================
# QUERY ROUTES
# =============================================================================

class RunQueryRequest(BaseModel):
    """Schema for /run_sql_query"""
    sql_query: str = Field(..., min_length=1, max_length=100000)
    max_rows: Optional[int] = Field(default=1000, ge=1, le=100000)  # None = no limit (use server config)
    timeout: int = Field(default=30, ge=1, le=300)
    
    @field_validator('sql_query')
    @classmethod
    def validate_query(cls, v):
        if not v or not v.strip():
            raise ValueError('SQL query cannot be empty')
        return v.strip()


# =============================================================================
# USER SETTINGS ROUTES
# =============================================================================

class SaveUserSettingsRequest(BaseModel):
    """Schema for /api/user/settings"""
    connectionPersistenceMinutes: Optional[Literal[0, 5, 15, 30, 60]] = None


# =============================================================================
# HELPER FUNCTION
# =============================================================================

def validate_request(schema_class: type[BaseModel], data: dict):
    """
    Validate request data against a Pydantic schema.
    
    Returns:
        Tuple of (validated_data, error_response)
        If valid: (data_dict, None)
        If invalid: (None, error_dict)
    """
    try:
        validated = schema_class(**(data or {}))
        return validated.model_dump(), None
    except Exception as e:
        error_message = str(e)
        # Clean up Pydantic error messages
        if hasattr(e, 'errors'):
            errors = e.errors()
            if errors:
                error_message = '; '.join(
                    f"{'.'.join(str(x) for x in err['loc'])}: {err['msg']}" 
                    for err in errors
                )
        return None, {'status': 'error', 'message': f'Validation error: {error_message}'}
