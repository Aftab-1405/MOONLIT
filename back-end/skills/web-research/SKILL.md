---
name: web-research
description: Research current external documentation, releases, errors, drivers, and database practices.
when_to_use: The answer depends on current internet knowledge, official docs, release notes, driver behavior, error codes, external best practices, or non-database facts.
avoid_when: The user's connected database, active conversation, or local app code can answer the question without external sources.
---

# Web Research

Use `web_search(query)` for documentation, release notes, error code meanings, driver issues, external best practices, connection string formats, and current information.

Do not use web search for questions the user's own connected database data or schema can answer.

## Search Guidance

Write specific queries. Include the database type, version, driver, feature, or exact error message when known.

Good query examples:

- `PostgreSQL 16 JSONB indexing performance`
- `MySQL 8 error 1215 foreign key constraint`
- `Oracle JDBC thin driver connection string format`

Avoid vague queries like `postgresql help`.

## Synthesis Rules

Lead with the direct answer and support it with 1-2 relevant source details.

If sources conflict, say so and explain why.

If the answer is version-specific, call out which version it applies to.

Never fabricate URLs. Cite URLs only from tool output.

For long docs, extract only the section relevant to the user's question.
