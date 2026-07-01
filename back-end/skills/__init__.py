"""
skills — Agent-loadable domain instructions for Moonlit.

Each skill lives in a kebab-case directory with a ``SKILL.md`` file:

    database-querying/SKILL.md

``SKILL.md`` starts with YAML frontmatter containing ``name`` and
``description``. The SkillRegistry discovers these assets, injects only compact
metadata into the system prompt, and the agent loads full instructions through
the ``read_skill`` tool when needed.
"""
