---
name: web-research
description: Research current external documentation, releases, errors, drivers, and database practices.
when_to_use: The answer depends on current internet knowledge, official docs, release notes, driver behavior, error codes, external best practices, or non-database facts.
avoid_when: The user's connected database, active conversation, or local app code can answer the question without external sources.
---

# Web Research

Use `web_search(query)` to ground answers in current external knowledge. Run the fewest queries that produce verified, citable evidence — then synthesize without fabrication.

## When to use `web_search`

Call `web_search` when the answer depends on information that lives outside the connected database and the active conversation:

- **Official documentation for a specific DB version or feature** — e.g., "How does PostgreSQL 16 handle `MERGE ... RETURNING`?".
- **Error code meanings** — e.g., MySQL `1215`, PostgreSQL `42P01`, Oracle `ORA-00942`, SQL Server `8152`.
- **Driver and connection-string formats** — JDBC URLs, psycopg2/psycopg3, oracledb, pymssql, node-mssql, Prisma schema.
- **Release notes and version-specific behavior changes** — e.g., "Did MySQL 8.0 change `GROUP BY` default ordering?".
- **External best practices** — indexing strategy, schema design, partitioning, connection pooling.
- **Security advisories and CVEs** — e.g., "Is psycopg2 affected by CVE-2024-XXXX?".
- **Third-party tool compatibility** — e.g., "Does pgvector work on Amazon RDS PostgreSQL 16?".
- **Non-database facts** that the conversation cannot answer (geography, currency, public-API semantics).

## When NOT to use `web_search`

- The user's connected database can answer it (schema, rows, indexes, query plans) — use the `database-querying` skill instead.
- The question is about the user's own app code or local config — read the code, do not search the web.
- The answer is already visible in the active conversation — scroll up and reuse it.
- The question is a stable general concept ("what is a foreign key?", "what does ACID mean?") — answer from internal knowledge.
- The user asks for an opinion or a recommendation with no factual basis to verify.

## Multi-query strategy

For any non-trivial topic, run **2–3 targeted queries** rather than one. A single source is rarely enough to confirm version-specific behavior.

1. **Query 1 — pinpoint**: the specific error code / feature / driver with the version number.
2. **Query 2 — official source**: the official docs URL surfaced by Query 1, fetched directly if a `web_reader`/fetch tool exists, otherwise re-queried with `site:` scoping.
3. **Query 3 — corroboration**: a contrasting or complementary source (release notes, reputable engineering blog) to confirm or qualify the official docs.

Stop after 2 queries if they agree and one is an official source. Run a 3rd only when they conflict or the topic is high-stakes (security, data loss, breaking change).

## Query formulation guide

Write specific, versioned, scoped queries. Include DB type, version, driver, feature name, or exact error code whenever known.

| Scenario | Good query | Bad query |
|---|---|---|
| Error code | `MySQL 8 error 1215 foreign key constraint causes` | `database error` |
| Feature docs | `PostgreSQL 16 JSONB GIN index performance` | `postgresql help` |
| Driver format | `psycopg2 vs psycopg3 async support differences` | `python postgres driver` |
| Version change | `MySQL 8.0 CHECK constraint behavior vs 5.7` | `how to fix mysql` |
| Performance | `SQL Server 2022 columnstore index star join bitmap` | `sql server fast` |
| Security | `PostgreSQL 16 CVE-2024-7348 logical replication` | `postgres security bug` |
| Compatibility | `pgvector RDS PostgreSQL 16 availability` | `pgvector rds` |
| Connection string | `oracledb thin mode connection string EZConnect format` | `oracle connect string` |

Avoid unscoped natural-language questions ("how do I…", "why does my…"). They surface SEO content farms, not authoritative sources.

## Source credibility hierarchy

Weight sources as follows. When two sources conflict, the higher-tier source wins unless it is materially outdated.

| Tier | Source type | Examples | Trust |
|---|---|---|---|
| 1 | Official docs | postgresql.org/docs, dev.mysql.com, docs.microsoft.com, docs.oracle.com | Highest — authoritative for the product |
| 2 | Release notes / changelogs | Per-version release notes, security advisories from the vendor | Authoritative for version-specific behavior |
| 3 | Reputable tech publications | Stripe blog, Cloudflare blog, Uber Engineering, GitHub engineering | High — verify claims against tier 1 |
| 4 | Stack Overflow | Answers with ≥50 upvotes and activity in the last 2 years | Medium — always verify against official docs |
| 5 | Personal blogs / forums | Dev.to, Medium, Reddit threads | Low — use only as a lead, verify before citing |
| 6 | AI-generated content farms | Sites that republish LLM output without review | Avoid entirely — never cite |

## Synthesis framework

1. **Lead with the direct answer** in 1–2 sentences.
2. **Support** with 1–2 specific details drawn from sources (a setting name, a default value, a version number).
3. **If sources conflict, say so explicitly** and explain the discrepancy: *"The PostgreSQL 16 docs say X, but a 2023 blog post says Y — the docs are current as of version 16, the blog predates the fix in 16.2."*
4. **If the answer is version-specific, call out the version** it applies to and note when behavior changed across versions.
5. **For long docs**, extract only the section relevant to the user's question — do not summarize the whole page.

## Version awareness

- Always include the DB version in the query when version matters. Behavior for indexes, SQL syntax, defaults, and error codes routinely changes between major versions.
- When the user's connected DB version is known from session state, include it in every query that could be version-sensitive.
- Flag cross-version differences explicitly: *"MySQL 8.0+ enforces `CHECK` constraints; MySQL 5.7 parsed and silently ignored them."*

## Citation format

- **Inline**: "According to the [PostgreSQL 16 docs](URL), `JSONB` stores data in a decomposed binary format…".
- **Footer**: when 2+ sources are used, list them at the end as `## Sources` with one bullet per URL and a 1-line label.
- Cite only URLs that `web_search` (or a fetch tool) actually returned. **Never fabricate URLs.** If you are unsure whether a URL was returned, do not cite it.

## Anti-fabrication rules

- Never invent URLs, version numbers, error codes, feature names, default values, or CVE IDs.
- Never present AI-generated blog content as authoritative — treat it as a lead only, and verify against tier 1–3 before stating it as fact.
- If `web_search` returns nothing relevant, say so: *"I couldn't find authoritative sources for this — I'd suggest checking the official docs at <vendor site> directly."*
- Do not paraphrase a source so aggressively that the paraphrase no longer matches the source. If unsure, quote the key sentence.

## Failure handling

- **First query returns nothing useful** → reformulate with different keywords (drop the version, add the vendor, swap synonyms). Retry once.
- **Topic is too obscure** → tell the user, share what little you found, and point them at the official docs URL to investigate directly.
- **Sources are outdated** (>3 years old for rapidly-evolving tech like vector indexes, LLM-related DB extensions, cloud managed services) → explicitly note the staleness and prefer a newer source if one exists.
- **Sources conflict and you cannot resolve it** → present both positions, label which is more recent and which is more authoritative, and let the user decide.
