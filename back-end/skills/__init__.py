"""
skills — Runtime-injected domain expertise for the Moonlit agent.

Each sub-package is a self-contained skill:
  - skill.py      : exports SKILL_NAME, SKILL_TRIGGERS, SKILL_PROMPT
  - __init__.py   : optional re-exports

The SkillRegistry (skill_registry.py) discovers all registered skills,
matches them against the user's message at runtime, and returns the
concatenated prompt fragments to append to the lean base system prompt.
"""
