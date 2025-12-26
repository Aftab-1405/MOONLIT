"""
Oracle Database Adapter

Implements database operations for Oracle using oracledb (python-oracledb).
Supports local Oracle instances and cloud providers (AWS RDS Oracle).

Note: Oracle Cloud Autonomous DB requires wallet-based authentication which
is not supported in this simple connection string approach.
"""

import logging
from typing import Any, Dict, List, Optional
from contextlib import contextmanager
from .base_adapter import BaseDatabaseAdapter

logger = logging.getLogger(__name__)


class OracleAdapter(BaseDatabaseAdapter):
    """Oracle database adapter using oracledb."""

    @property
    def db_type(self) -> str:
        return 'oracle'

    @property
    def default_port(self) -> Optional[int]:
        return 1521

    @property
    def requires_server(self) -> bool:
        return True

    def create_connection_pool(self, config: Dict) -> Any:
        """
        Create Oracle connection pool.
        
        Supports:
        1. Connection string (Easy Connect format for AWS RDS, local)
        2. Individual parameters (host, port, user, password, service_name/sid)
        
        Note: Oracle Cloud Autonomous DB with wallet is NOT supported.
        """
        import oracledb
        
        try:
            connection_string = config.get('connection_string')
            
            if connection_string:
                # Remote connection via connection string
                # Expected format: user/password@host:port/service_name
                logger.info(f"Creating Oracle connection using connection string")
                config['_connection_string'] = connection_string
            else:
                # Local connection via individual parameters
                host = config.get('host', 'localhost')
                port = config.get('port', 1521)
                user = config.get('user', '')
                password = config.get('password', '')
                service_name = config.get('service_name') or config.get('database', 'ORCL')
                
                # Easy Connect string format
                dsn = f"{host}:{port}/{service_name}"
                
                config['_dsn'] = dsn
                config['_user'] = user
                config['_password'] = password
                
                logger.info(f"Creating Oracle connection for {user}@{host}:{port}/{service_name}")
            
            # Return config as "pool" - we'll create connections on demand
            return config
                
        except Exception as err:
            logger.error(f"Failed to create Oracle connection config: {err}")
            raise

    def get_connection_from_pool(self, pool: Any) -> Any:
        """Get Oracle connection from pool (creates new connection)."""
        import oracledb
        
        try:
            connection_string = pool.get('_connection_string')
            
            if connection_string:
                # Parse connection string: user/password@host:port/service
                # or use oracledb.connect directly
                connection = oracledb.connect(connection_string)
            else:
                dsn = pool.get('_dsn')
                user = pool.get('_user')
                password = pool.get('_password')
                
                if not dsn:
                    raise ValueError("No DSN found in pool config")
                
                connection = oracledb.connect(user=user, password=password, dsn=dsn)
            
            return connection
        except Exception as err:
            logger.error(f"Failed to get Oracle connection: {err}")
            raise

    def close_pool(self, pool: Any) -> bool:
        """Close Oracle connection pool (no-op for simple connections)."""
        logger.info("Oracle pool closed")
        return True

    def return_connection_to_pool(self, pool: Any, connection: Any) -> None:
        """Return Oracle connection back to pool (closes connection)."""
        try:
            if connection:
                connection.close()
        except Exception as err:
            logger.warning(f"Failed to close Oracle connection: {err}")

    @contextmanager
    def get_cursor(self, connection: Any, dictionary: bool = False, buffered: bool = True):
        """Get Oracle cursor from connection."""
        cursor = None
        try:
            cursor = connection.cursor()
            yield cursor
            connection.commit()
        except Exception as e:
            if connection:
                connection.rollback()
            raise e
        finally:
            if cursor:
                cursor.close()

    def get_databases_query(self) -> str:
        """SQL query to list Oracle databases (actually schemas/users)."""
        # Oracle doesn't have "databases" like MySQL/PostgreSQL
        # We list user schemas instead
        return """
            SELECT username 
            FROM all_users 
            WHERE username NOT IN ('SYS', 'SYSTEM', 'ORACLE_OCM', 'XDB', 'WMSYS', 
                                   'CTXSYS', 'MDSYS', 'OLAPSYS', 'ORDDATA', 'ORDSYS',
                                   'OUTLN', 'DBSNMP', 'APPQOSSYS', 'ANONYMOUS')
            ORDER BY username
        """

    def get_tables_query(self) -> str:
        """SQL query to list Oracle tables."""
        return """
            SELECT table_name
            FROM all_tables
            WHERE owner = :1
            ORDER BY table_name
        """

    def get_table_schema_query(self) -> str:
        """SQL query to get Oracle table schema."""
        return """
            SELECT 
                column_name,
                data_type,
                nullable,
                data_default
            FROM all_tab_columns
            WHERE owner = :1 AND table_name = :2
            ORDER BY column_id
        """

    def get_system_databases(self) -> set:
        """Oracle system schemas to filter out."""
        return {
            'sys', 'system', 'oracle_ocm', 'xdb', 'wmsys', 
            'ctxsys', 'mdsys', 'olapsys', 'orddata', 'ordsys',
            'outln', 'dbsnmp', 'appqossys', 'anonymous'
        }

    def validate_connection(self, connection: Any) -> bool:
        """Validate Oracle connection is alive."""
        try:
            if connection:
                cursor = connection.cursor()
                cursor.execute("SELECT 1 FROM DUAL")
                cursor.fetchone()
                cursor.close()
                return True
        except Exception as e:
            logger.debug(f"Oracle connection validation failed: {e}")
        return False

    def format_column_info(self, raw_column: Any) -> Dict:
        """Format Oracle column information."""
        if isinstance(raw_column, dict):
            return {
                'name': raw_column.get('COLUMN_NAME', ''),
                'type': raw_column.get('DATA_TYPE', ''),
                'nullable': raw_column.get('NULLABLE', 'N') == 'Y',
                'key': '',
                'default': raw_column.get('DATA_DEFAULT'),
                'extra': ''
            }
        else:
            # Tuple format: (name, type, nullable, default)
            return {
                'name': raw_column[0],
                'type': raw_column[1],
                'nullable': raw_column[2] == 'Y',
                'key': '',
                'default': raw_column[3] if len(raw_column) > 3 else None,
                'extra': ''
            }

    # =========================================================================
    # Schema Caching Methods (for AI context)
    # =========================================================================
    
    def get_all_tables_for_cache(self, db_name: str, schema: str = None) -> tuple:
        """Return SQL query and params to get all tables for schema caching."""
        # In Oracle, db_name is actually the schema/owner
        query = """
            SELECT table_name 
            FROM all_tables 
            WHERE owner = :1
            ORDER BY table_name
        """
        return query, (db_name.upper(),)
    
    def get_columns_for_table_cache(self, db_name: str, table_name: str, schema: str = None) -> tuple:
        """Return SQL query and params to get column names for a table."""
        query = """
            SELECT column_name
            FROM all_tab_columns
            WHERE owner = :1 AND table_name = :2
            ORDER BY column_id
        """
        return query, (db_name.upper(), table_name.upper())
    
    def get_column_details_for_table(self, db_name: str, table_name: str, schema: str = None) -> tuple:
        """Return SQL query and params to get full column details for a table."""
        query = """
            SELECT column_name, data_type, nullable, data_default
            FROM all_tab_columns
            WHERE owner = :1 AND table_name = :2
            ORDER BY column_id
        """
        return query, (db_name.upper(), table_name.upper())
    
    def get_set_timeout_sql(self, timeout_seconds: int) -> Optional[str]:
        """Return Oracle query timeout SQL."""
        # Oracle doesn't support query-level timeout in the same way
        return None
    
    def get_column_names_from_cursor(self, cursor: Any) -> List[str]:
        """Extract column names from Oracle cursor."""
        if hasattr(cursor, 'description') and cursor.description:
            return [desc[0] for desc in cursor.description]
        return []
    
    def get_databases_for_cache(self) -> tuple:
        """Return SQL query and params to get all schemas for caching."""
        return self.get_databases_query(), ()
    
    def get_batch_columns_for_tables(self, db_name: str, tables: List[str], schema: str = None) -> tuple:
        """Return SQL query and params to batch fetch columns for multiple tables."""
        if not tables:
            return None, []
        
        # Oracle uses different placeholder syntax (:1, :2, etc.)
        # Building IN clause with positional params
        table_placeholders = ','.join([f":{i+2}" for i in range(len(tables))])
        query = f"""
            SELECT table_name, column_name
            FROM all_tab_columns
            WHERE owner = :1
            AND table_name IN ({table_placeholders})
            ORDER BY table_name, column_id
        """
        params = [db_name.upper()] + [t.upper() for t in tables]
        return query, params
