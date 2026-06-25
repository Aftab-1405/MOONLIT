import os

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    if 'datetime.now()' not in content:
        return

    # Add 'from datetime import timezone' if missing
    lines = content.split('\n')
    has_timezone = any('import timezone' in line for line in lines)
    if not has_timezone:
        for i, line in enumerate(lines):
            if 'from datetime import' in line and 'datetime' in line:
                lines[i] = line + ', timezone'
                break
            elif line == 'import datetime':
                lines[i] = 'import datetime\nfrom datetime import timezone'
                break
            elif 'from datetime import datetime' in line:
                lines[i] = 'from datetime import datetime, timezone'
                break

    new_content = '\n'.join(lines)
    new_content = new_content.replace('datetime.now()', 'datetime.now(timezone.utc)')

    with open(filepath, 'w') as f:
        f.write(new_content)
    print(f"Fixed {filepath}")

for root, _, files in os.walk('/home/aftab-1405/Desktop/Moonlit-AI-Agent/back-end'):
    for file in files:
        if file.endswith('.py'):
            fix_file(os.path.join(root, file))
