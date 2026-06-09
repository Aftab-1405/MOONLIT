import re
connection_string = "workstation id=xxxxx.mssql.somee.com;packet size=4096;user id=xxxx;pwd=xxxx;data source=xxxxx.mssql.somee.com;persist security info=False;initial catalog=xxxx"
db_match = re.search(r"(?:Database|Initial Catalog)=([^;]+)", connection_string, re.IGNORECASE)
server_match = re.search(r"(?:Server|Data Source)=([^;,]+)", connection_string, re.IGNORECASE)
user_match = re.search(r"(?:UID|User ID)=([^;]+)", connection_string, re.IGNORECASE)
pwd_match = re.search(r"(?:PWD|Password|pwd)=([^;]+)", connection_string, re.IGNORECASE)

print("DB:", db_match.group(1).strip() if db_match else None)
print("Server:", server_match.group(1).strip() if server_match else None)
print("User:", user_match.group(1).strip() if user_match else None)
print("Pwd:", pwd_match.group(1).strip() if pwd_match else None)
