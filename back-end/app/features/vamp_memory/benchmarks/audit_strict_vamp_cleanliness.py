#!/usr/bin/env python3
import os
import sys
import re

# Resolve the project root relative to the script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

PRODUCTION_FILES = [
    "app/features/vamp_memory/application/vamp_memory_service.py",
    "app/features/vamp_memory/application/historical_context_builder.py",
    "app/features/conversations/application/conversation_service.py",
    "app/features/vamp_memory/infrastructure/summary_block_repository.py",
    "app/features/agent_orchestration/application/stream_conversation.py",
    "app/features/agent_orchestration/graph/react_graph.py",
]

def clean_comments(code: str) -> str:
    """Remove single-line comments (#...) and multiline docstrings from Python code."""
    # Remove single line comments
    code_no_comments = re.sub(r'#.*$', '', code, flags=re.MULTILINE)
    # Remove triple-quoted multiline strings/docstrings
    code_no_comments = re.sub(r'"""[\s\S]*?"""', '', code_no_comments)
    code_no_comments = re.sub(r"'''[\s\S]*?'''", '', code_no_comments)
    return code_no_comments

def extract_function_body(code: str, func_name: str) -> str:
    """Extract the body of a specific function definition."""
    match = re.search(rf"async\s+def\s+{func_name}\b|def\s+{func_name}\b", code)
    if not match:
        return ""
    start_idx = match.start()
    # Find next def or class to bound the function body
    next_def = re.search(r"\n\s*(async\s+def\s+|def\s+|class\s+)", code[start_idx + 1:])
    if next_def:
        end_idx = start_idx + 1 + next_def.start()
        return code[start_idx:end_idx]
    return code[start_idx:]

def audit():
    failures = []

    for rel_path in PRODUCTION_FILES:
        full_path = os.path.join(PROJECT_ROOT, rel_path)
        if not os.path.exists(full_path):
            failures.append((rel_path, 0, f"File does not exist at path: {full_path}"))
            continue

        with open(full_path, "r", encoding="utf-8") as f:
            raw_content = f.read()

        # Clean the content for string-matching of active code references
        cleaned_content = clean_comments(raw_content)

        # 1. Check for forbidden terms in active code
        forbidden_terms = [
            "extract_memory_terms", 
            "search_blocks_by_terms", 
            "array_contains_any"
        ]
        for term in forbidden_terms:
            if term in cleaned_content:
                # Find the line number in raw content for reporting
                for line_idx, line in enumerate(raw_content.splitlines(), start=1):
                    # Only report if it's not a comment line
                    if term in line and not line.strip().startswith("#"):
                        failures.append((rel_path, line_idx, f"Forbidden reference to '{term}' found in active code"))

        # 2. Check for identifiers field being written or referenced in summary_block_repository
        if rel_path == "app/features/vamp_memory/infrastructure/summary_block_repository.py":
            create_block_body = extract_function_body(cleaned_content, "create_block")
            if "identifiers" in create_block_body:
                failures.append((rel_path, 0, "Reference to 'identifiers' found in create_block body"))

        # 3. Check for identifiers passed in conversation_service
        if rel_path == "app/features/conversations/application/conversation_service.py":
            if "identifiers" in cleaned_content:
                failures.append((rel_path, 0, "Reference to 'identifiers' found in conversation_service"))

        # 4. Check vamp_memory_service for VAMP v2 stricter rules
        if rel_path == "app/features/vamp_memory/application/vamp_memory_service.py":
            retrieve_body = extract_function_body(cleaned_content, "retrieve_blocks")
            index_body = extract_function_body(cleaned_content, "index_summary_block")
            
            if "get_latest_block" in retrieve_body:
                failures.append((rel_path, 0, "get_latest_block fallback call found inside retrieve_blocks"))
            if "latest" in retrieve_body:
                failures.append((rel_path, 0, "Reference to 'latest' block found inside retrieve_blocks"))
            if "identifiers" in retrieve_body:
                failures.append((rel_path, 0, "Reference to 'identifiers' found inside retrieve_blocks"))
                
            # VAMP v2 strict rule: pointer_type="summary_block" is forbidden
            if '"pointer_type": "summary_block"' in cleaned_content or "'pointer_type': 'summary_block'" in cleaned_content:
                failures.append((rel_path, 0, "Forbidden 'summary_block' pointer_type found"))
                
        if rel_path == "app/features/vamp_memory/application/historical_context_builder.py":
            format_body = extract_function_body(cleaned_content, "format_historical_context")
            # format_historical_context must not fall back to parent text
            if "parent" in format_body and not "is_parent" in format_body: # is_parent was removed but let's be safer
                 pass
            if "base_unit = parent" in format_body or "elif parent:" in format_body:
                failures.append((rel_path, 0, "Full block fallback injection found in format_historical_context"))
            if 'block.get("text")' in format_body and not 'b.get(\'text\'' in format_body:
                pass # Already handled by avoiding `elif parent:` checking

    if failures:
        print("\nSTRICT VAMP V2 AUDIT: FAIL\n")
        print("Detailed failures:")
        for file, line, msg in failures:
            line_str = f":L{line}" if line > 0 else ""
            print(f"  - [{file}{line_str}] {msg}")
        sys.exit(1)
    else:
        print("\nSTRICT VAMP V2 AUDIT: PASS\n")
        sys.exit(0)

if __name__ == "__main__":
    audit()
