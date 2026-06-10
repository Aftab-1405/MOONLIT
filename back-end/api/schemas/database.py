"""Database and schema API contract models."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


DbType = Literal["mysql", "postgresql", "sqlserver", "oracle"]


class DatabaseConfigPublic(BaseModel):
    """Frontend-safe database connection configuration."""

    model_config = ConfigDict(populate_by_name=True)

    db_type: DbType
    database: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    is_remote: bool = False
    schema_name: str | None = Field(
        default=None, validation_alias="schema", serialization_alias="schema"
    )
    service_name: str | None = None


class ConnectDatabaseData(BaseModel):
    """Data returned after a successful database connection."""

    db_config: DatabaseConfigPublic
    db_type: DbType
    selected_database: str | None = None
    schemas: list[str] = Field(default_factory=list)
    current_schema: str | None = None
    databases: list[str] = Field(default_factory=list)
    tables: list[str] = Field(default_factory=list)
    is_remote: bool = False


class DisconnectDatabaseData(BaseModel):
    """Data returned after disconnecting from the current database."""

    disconnected: bool


class DatabaseStatusData(BaseModel):
    """Current database connection status."""

    connected: bool
    db_type: DbType | None = None
    current_database: str | None = None
    is_remote: bool = False
    databases: list[str] = Field(default_factory=list)
    schemas: list[str] = Field(default_factory=list)
    current_schema: str | None = None


class DatabaseListData(BaseModel):
    """Available databases for the current connection."""

    databases: list[str] = Field(default_factory=list)
    db_type: DbType | None = None
    is_remote: bool = False


class DatabaseSelectionData(BaseModel):
    """Data returned after switching or selecting a database."""

    db_config: DatabaseConfigPublic
    selected_database: str
    tables: list[str] = Field(default_factory=list)
    db_type: DbType
    is_remote: bool = False
    schemas: list[str] = Field(default_factory=list)
    current_schema: str | None = None


class SchemaListData(BaseModel):
    """Available schemas for the current database."""

    schemas: list[str] = Field(default_factory=list)
    current_schema: str | None = None


class SelectSchemaData(BaseModel):
    """Data returned after selecting a PostgreSQL schema."""

    schema_name: str = Field(serialization_alias="schema")
    tables: list[str] = Field(default_factory=list)
    db_config: DatabaseConfigPublic
    schemas: list[str] = Field(default_factory=list)
    current_schema: str | None = None


class TableListData(BaseModel):
    """Tables in the current database/schema."""

    model_config = ConfigDict(populate_by_name=True)

    tables: list[str] = Field(default_factory=list)
    database: str | None = None
    schema_name: str | None = Field(
        default=None, validation_alias="schema", serialization_alias="schema"
    )


class TableColumnData(BaseModel):
    """Column metadata for a table."""

    name: str
    data_type: str
    nullable: bool | None = None
    key: str | None = None
    default: Any | None = None
    extra: str | None = None
    max_length: int | None = None
    numeric_precision: int | None = None
    numeric_scale: int | None = None


class TableSchemaData(BaseModel):
    """Schema metadata for one table."""

    model_config = ConfigDict(populate_by_name=True)

    table_name: str
    columns: list[TableColumnData] = Field(default_factory=list)
    row_count: int | None = None
    database: str | None = None
    schema_name: str | None = Field(
        default=None, validation_alias="schema", serialization_alias="schema"
    )
