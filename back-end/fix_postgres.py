import re

with open("database/adapters/postgresql_adapter.py", "r") as f:
    content = f.read()

# Add _sanitize_schema method if not exists
if "_sanitize_schema" not in content:
    sanitize_method = """
    def _sanitize_schema(self, schema: str) -> str:
        if not schema: return "public"
        import re
        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", schema):
            raise ValueError(f"Invalid schema name: {schema}")
        return schema
"""
    content = content.replace('class PostgreSQLAdapter(BaseDatabaseAdapter):', 'class PostgreSQLAdapter(BaseDatabaseAdapter):\n' + sanitize_method)

# Regex to find any def ... schema: str = "public" ...:
# and insert schema = self._sanitize_schema(schema) right after it.
pattern = re.compile(r'(def [a-zA-Z0-9_]+\(.*?(?:schema:\s*str\s*=\s*(?:None|"public"|\'public\')).*?\):\s*(?:"""[\s\S]*?""")?\s*)', re.MULTILINE)
def repl(m):
    return m.group(1) + "\n        schema = self._sanitize_schema(schema)\n"

content = pattern.sub(repl, content)

with open("database/adapters/postgresql_adapter.py", "w") as f:
    f.write(content)

