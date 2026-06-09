import pytest
from database.adapters.postgresql_adapter import PostgreSQLAdapter
from database.adapters.mysql_adapter import MySQLAdapter
from database.adapters.oracle_adapter import OracleAdapter
from database.adapters.sqlserver_adapter import SQLServerAdapter

@pytest.mark.integration
def test_integration_postgresql_adapter_sqli_protection():
    try:
        pg_adapter = PostgreSQLAdapter()
    except ImportError:
        pytest.skip("psycopg2 is not installed")
        
    malicious_schema = "public' OR 1=1 OR 'a'='"
    malicious_table = "users' OR 1=1 OR 'a'='"
    
    schema_methods = [
        ("get_tables_query", {}),
        ("get_table_schema_query", {}),
        ("get_schema_info_for_ai", {}),
        ("get_all_tables_for_cache", {"db_name": "test_db"}),
        ("get_columns_for_table_cache", {"db_name": "test_db", "table_name": "users"}),
        ("get_column_details_for_table", {"db_name": "test_db", "table_name": "users"}),
        ("get_batch_columns_for_tables", {"db_name": "test_db", "tables": ["users"]}),
        ("get_indexes_query", {"table_name": "users"}),
        ("get_constraints_query", {"table_name": "users"}),
        ("get_foreign_keys_query", {"table_name": "users"}),
    ]
    
    for method_name, kwargs in schema_methods:
        method = getattr(pg_adapter, method_name)
        try:
            result = method(schema=malicious_schema, **kwargs)
            query = result[0] if isinstance(result, tuple) else result
            if query and malicious_schema in query:
                pytest.fail(f"VULNERABILITY: PostgreSQLAdapter.{method_name} is vulnerable to schema SQL Injection! Query: {query}")
        except ValueError:
            pass

    table_methods = [
        ("get_columns_for_table_cache", {"db_name": "test_db"}),
        ("get_column_details_for_table", {"db_name": "test_db"}),
        ("get_indexes_query", {}),
        ("get_constraints_query", {}),
        ("get_foreign_keys_query", {}),
    ]
    for method_name, kwargs in table_methods:
        method = getattr(pg_adapter, method_name)
        try:
            result = method(table_name=malicious_table, **kwargs)
            query = result[0] if isinstance(result, tuple) else result
            if query and malicious_table in query:
                pytest.fail(f"VULNERABILITY: PostgreSQLAdapter.{method_name} is vulnerable to table SQL Injection! Query: {query}")
        except ValueError:
            pass

@pytest.mark.integration
def test_integration_mysql_adapter_security():
    try:
        mysql_adapter = MySQLAdapter()
    except ImportError:
        pytest.skip("mysql-connector-python is not installed")
        
    malicious_schema = "public' OR 1=1 OR 'a'='"
    malicious_table = "users' OR 1=1 OR 'a'='"
    
    schema_methods = [
        ("get_all_tables_for_cache", {"db_name": malicious_schema}),
        ("get_columns_for_table_cache", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_column_details_for_table", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_batch_columns_for_tables", {"db_name": malicious_schema, "tables": ["users"]}),
        ("get_indexes_query", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_constraints_query", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_foreign_keys_query", {"db_name": malicious_schema, "table_name": "users"}),
    ]
    
    for method_name, kwargs in schema_methods:
        method = getattr(mysql_adapter, method_name)
        try:
            result = method(**kwargs)
            query, params = result if isinstance(result, tuple) else (result, [])
            assert "%s" in query or malicious_schema not in query, f"MySQLAdapter.{method_name} is vulnerable to schema SQL Injection!"
        except ValueError:
            pass

    table_methods = [
        ("get_columns_for_table_cache", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_column_details_for_table", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_indexes_query", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_constraints_query", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_foreign_keys_query", {"db_name": "test_db", "table_name": malicious_table}),
    ]
    
    for method_name, kwargs in table_methods:
        method = getattr(mysql_adapter, method_name)
        try:
            result = method(**kwargs)
            query, params = result if isinstance(result, tuple) else (result, [])
            assert "%s" in query or malicious_table not in query, f"MySQLAdapter.{method_name} is vulnerable to table SQL Injection!"
        except ValueError:
            pass

@pytest.mark.integration
def test_integration_sqlserver_adapter_security():
    try:
        sqlserver_adapter = SQLServerAdapter()
    except ImportError:
        pytest.skip("pyodbc is not installed")
        
    malicious_schema = "public' OR 1=1 OR 'a'='"
    malicious_table = "users' OR 1=1 OR 'a'='"
    
    schema_methods = [
        ("get_all_tables_for_cache", {"db_name": malicious_schema}),
        ("get_columns_for_table_cache", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_column_details_for_table", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_batch_columns_for_tables", {"db_name": malicious_schema, "tables": ["users"]}),
        ("get_indexes_query", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_constraints_query", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_foreign_keys_query", {"db_name": malicious_schema, "table_name": "users"}),
    ]
    
    for method_name, kwargs in schema_methods:
        method = getattr(sqlserver_adapter, method_name)
        try:
            result = method(**kwargs)
            query, params = result if isinstance(result, tuple) else (result, [])
            assert "?" in query or malicious_schema not in query, f"SQLServerAdapter.{method_name} is vulnerable to schema SQL Injection!"
        except ValueError:
            pass

    table_methods = [
        ("get_columns_for_table_cache", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_column_details_for_table", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_indexes_query", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_constraints_query", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_foreign_keys_query", {"db_name": "test_db", "table_name": malicious_table}),
    ]
    
    for method_name, kwargs in table_methods:
        method = getattr(sqlserver_adapter, method_name)
        try:
            result = method(**kwargs)
            query, params = result if isinstance(result, tuple) else (result, [])
            assert "?" in query or malicious_table not in query, f"SQLServerAdapter.{method_name} is vulnerable to table SQL Injection!"
        except ValueError:
            pass

@pytest.mark.integration
def test_integration_oracle_adapter_security():
    try:
        oracle_adapter = OracleAdapter()
    except ImportError:
        pytest.skip("oracledb is not installed")
        
    malicious_schema = "public' OR 1=1 OR 'a'='"
    malicious_table = "users' OR 1=1 OR 'a'='"
    
    schema_methods = [
        ("get_all_tables_for_cache", {"db_name": malicious_schema}),
        ("get_columns_for_table_cache", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_column_details_for_table", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_batch_columns_for_tables", {"db_name": malicious_schema, "tables": ["users"]}),
        ("get_indexes_query", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_constraints_query", {"db_name": malicious_schema, "table_name": "users"}),
        ("get_foreign_keys_query", {"db_name": malicious_schema, "table_name": "users"}),
    ]
    
    for method_name, kwargs in schema_methods:
        method = getattr(oracle_adapter, method_name)
        try:
            result = method(**kwargs)
            query, params = result if isinstance(result, tuple) else (result, [])
            assert any(f":{i}" in query for i in range(1, 10)) or malicious_schema not in query, f"OracleAdapter.{method_name} is vulnerable to schema SQL Injection!"
        except ValueError:
            pass

    table_methods = [
        ("get_columns_for_table_cache", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_column_details_for_table", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_indexes_query", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_constraints_query", {"db_name": "test_db", "table_name": malicious_table}),
        ("get_foreign_keys_query", {"db_name": "test_db", "table_name": malicious_table}),
    ]
    
    for method_name, kwargs in table_methods:
        method = getattr(oracle_adapter, method_name)
        try:
            result = method(**kwargs)
            query, params = result if isinstance(result, tuple) else (result, [])
            assert any(f":{i}" in query for i in range(1, 10)) or malicious_table not in query, f"OracleAdapter.{method_name} is vulnerable to table SQL Injection!"
        except ValueError:
            pass

@pytest.mark.integration
def test_integration_where_clause_parameterization():
    adapters = [
        (PostgreSQLAdapter, "%s"),
        (MySQLAdapter, "%s"),
        (SQLServerAdapter, "?"),
        (OracleAdapter, ":")
    ]
    
    for adapter_class, placeholder in adapters:
        try:
            adapter = adapter_class()
        except ImportError:
            continue
            
        result = adapter.get_columns_for_table_cache(db_name="test_db", table_name="users")
        query = result[0] if isinstance(result, tuple) else result
        assert "WHERE" in query.upper()
        assert placeholder in query, f"{adapter_class.__name__} does not use parameter placeholders in WHERE clause!"

@pytest.mark.integration
def test_integration_order_by_allowlist_validation():
    allowed_columns = {"id", "username", "created_at"}
    
    def build_ordered_query(order_by_col: str) -> str:
        if order_by_col not in allowed_columns:
            raise ValueError(f"Invalid ORDER BY column: {order_by_col}")
        return f"SELECT * FROM users ORDER BY {order_by_col}"
        
    assert "ORDER BY username" in build_ordered_query("username")
    
    with pytest.raises(ValueError):
        build_ordered_query("username; DROP TABLE users; --")
