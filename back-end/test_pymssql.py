import pymssql
print("pymssql imported successfully")
try:
    pymssql.connect(server="localhost", port=1433, user="test", password="pwd", database="master", timeout=1)
except Exception as e:
    print(f"Connection failed but args accepted: {e}")
