"""
query_history — Skill for retrieving and reusing past SQL queries.

Injected when the user references a past query, asks to modify something
they ran before, or uses phrases that imply prior context outside the
active conversation window.
"""

SKILL_NAME = "query_history"
SKILL_DESCRIPTION = "get_query_history tool usage rules for referencing past SQL queries."

SKILL_TRIGGERS: list = [
    r"\bpast.?quer(y|ies)\b",
    r"\bprevious.?quer(y|ies)\b",
    r"\bearli(er|er.?quer)\b",
    r"\bwe.?ran\b",
    r"\bwe.?used\b",
    r"\bmodify.?what\b",
    r"\bthat.?quer(y|ies)\b",
    r"\blast.?select\b",
    r"\blast.?sql\b",
    r"\bsame.?quer(y|ies)\b",
    r"\bfrom.?before\b",
    r"\bhistor(y|ical).?quer(y|ies)\b",
    r"\bdo.?again\b",
    r"\brepeat.?that\b",
    r"\breuse\b",
]

SKILL_PROMPT = """
<skill name="query_history">
<query_history_guide>
get_query_history
WHEN: User references a past query — "that query from earlier", "the last SELECT we ran", "modify what we did before", "do it again". Call this BEFORE guessing or asking them to repeat themselves. They already told you once.
WHEN NOT: If the query they're referring to is visible in the current active conversation — use it directly without a tool call.
AFTER: Pull the relevant query and use it directly. No need to announce you retrieved it.

USAGE PATTERN:
1. Detect the reference ("earlier query", "last SQL", "what we ran").
2. Call get_query_history immediately.
3. Scan the results for the most likely match based on context.
4. Adapt and use it — don't ask the user to repeat themselves.

If no relevant query is found in history, acknowledge clearly:
"I don't see a matching query in your recent history — can you share it again?"
Never fabricate a query that wasn't in the output.
</query_history_guide>
</skill>
"""
