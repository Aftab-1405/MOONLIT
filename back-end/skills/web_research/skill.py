"""
web_research — Skill for web search tool usage.

Injected when the user's message implies they want external information:
documentation, release notes, error codes, driver issues, best practices,
or anything not answerable from the connected database.
"""

SKILL_NAME = "web_research"
SKILL_DESCRIPTION = "Web search tool usage rules and synthesis guidelines."

SKILL_TRIGGERS: list = [
    r"\bsearch\b",
    r"\blook.?up\b",
    r"\bdocumentation\b",
    r"\bdocs\b",
    r"\brelease.?notes?\b",
    r"\bchangelog\b",
    r"\berror.?code\b",
    r"\bdriver\b",
    r"\bconnection.?string\b",
    r"\bbest.?practice\b",
    r"\bofficial\b",
    r"\blatest.?version\b",
    r"\bwhat.?is.*(postgres|mysql|oracle|sql.?server)\b",
    r"\bhow.?to\b",
    r"\btutorial\b",
    r"\bexternal\b",
    r"\bweb\b",
    r"\bonline\b",
    r"\binternet\b",
    r"\bstack.?overflow\b",
]

SKILL_PROMPT = """
<skill name="web_research">
<web_search_guide>
web_search(query)
WHEN: Documentation, error code meanings, PostgreSQL/MySQL release notes, driver issues, external best practices, connection string formats — anything not answerable from the connected database itself.
WHEN NOT: Questions the user's own database data or schema can answer.
HOW: Write a specific search query. Target the exact version, database type, and error message when known. After results come back, synthesize in your own words. Don't dump URLs and snippets at the user.
AFTER: "Found it — [your synthesis of what's relevant]." Include the source URL only when it meaningfully helps the user verify or explore further.

SYNTHESIS RULES:
- Lead with the direct answer, then support it with 1–2 key details from the sources.
- If multiple sources agree, state the consensus. If they conflict, say so and explain why.
- If the result is version-specific, call out which version it applies to.
- Never fabricate URLs. If a URL is not in the tool output, don't cite it.
- For long documentation pages: extract only the section relevant to the user's question; don't summarize the whole page.

GOOD QUERY PATTERNS:
- "PostgreSQL 16 JSONB indexing performance" (specific version + feature)
- "MySQL 8 error 1215 foreign key constraint" (error code + context)
- "connection string format Oracle JDBC thin driver" (driver + format)
- Avoid vague queries like "postgresql help" — they return noisy results.
</web_search_guide>
</skill>
"""
