"""
SkillRegistry — lightweight, zero-LLM runtime skill matching.

Usage
-----
    from skills.skill_registry import SkillRegistry

    registry = SkillRegistry()
    skill_context = registry.build_skill_context(user_message="visualize my schema")
    system_prompt = base_prompt + skill_context

Design principles
-----------------
- Pure keyword / regex matching.  No LLM calls, no async work.
- Skills declare their own triggers; the registry is dumb.
- Always-on skills (SKILL_TRIGGERS = []) are injected unconditionally.
- Thread-safe: the registry object is read-only after construction.
"""

from __future__ import annotations

import importlib
import logging
import re
from dataclasses import dataclass, field
from typing import Callable

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SkillDefinition:
    """Describes a single injectable skill."""

    name: str
    # Regex patterns OR callable(user_message)->bool.
    # If triggers is empty the skill is always injected.
    triggers: tuple[str | Callable[[str], bool], ...]
    prompt_fragment: str
    description: str = ""


# ---------------------------------------------------------------------------
# Internal: discover all registered skills by importing their skill.py modules
# ---------------------------------------------------------------------------

def _discover_skill_modules() -> list[str]:
    """Auto-discover skill modules in the skills package."""
    import pathlib
    skill_modules = []
    skills_dir = pathlib.Path(__file__).parent
    
    for skill_dir in skills_dir.iterdir():
        if skill_dir.is_dir() and not skill_dir.name.startswith('_'):
            skill_file = skill_dir / "skill.py"
            if skill_file.exists():
                skill_modules.append(f"skills.{skill_dir.name}.skill")
    
    return sorted(skill_modules)


def _load_skills() -> list[SkillDefinition]:
    """Import each skill module and return its SkillDefinition."""
    skills: list[SkillDefinition] = []
    skill_modules = _discover_skill_modules()
    
    for module_path in skill_modules:
        try:
            mod = importlib.import_module(module_path)
            skills.append(
                SkillDefinition(
                    name=mod.SKILL_NAME,
                    triggers=tuple(mod.SKILL_TRIGGERS),
                    prompt_fragment=mod.SKILL_PROMPT,
                    description=getattr(mod, "SKILL_DESCRIPTION", ""),
                )
            )
            logger.debug("Loaded skill: %s", mod.SKILL_NAME)
        except Exception as exc:
            logger.warning("Failed to load skill module %s: %s", module_path, exc)
    return skills


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


class SkillRegistry:
    """
    Registry of all available skills.

    Instantiate once at application start-up (or per request — it's fast).
    """

    def __init__(self) -> None:
        self._skills: list[SkillDefinition] = _load_skills()

    def match_skills(self, user_message: str) -> list[str]:
        """
        Return names of skills whose triggers match *user_message*.

        Always-on skills (empty triggers tuple) are always included.
        """
        msg_lower = user_message.lower() if user_message else ""
        matched: list[str] = []

        for skill in self._skills:
            if not skill.triggers:
                # Always-on skill
                matched.append(skill.name)
                continue

            for trigger in skill.triggers:
                if callable(trigger):
                    if trigger(msg_lower):
                        matched.append(skill.name)
                        break
                else:
                    # Treat as a regex pattern (case-insensitive already handled by msg_lower)
                    if re.search(trigger, msg_lower):
                        matched.append(skill.name)
                        break

        logger.debug("Skills matched for message: %s", matched)
        return matched

    def build_skill_context(self, user_message: str = "") -> str:
        """
        Return the concatenated skill prompt fragments to append to the
        base system prompt, wrapped in a <skills> XML block.

        Returns an empty string if no skills match.
        """
        matched_names = self.match_skills(user_message)
        if not matched_names:
            return ""

        fragments: list[str] = []
        skill_map = {s.name: s for s in self._skills}
        for name in matched_names:
            if name in skill_map:
                fragments.append(skill_map[name].prompt_fragment.strip())

        if not fragments:
            return ""

        joined = "\n\n".join(fragments)
        return f"\n\n<active_skills>\n{joined}\n</active_skills>"

    @property
    def all_skill_names(self) -> list[str]:
        return [s.name for s in self._skills]


# ---------------------------------------------------------------------------
# Module-level singleton (lazy, created on first import of this singleton)
# ---------------------------------------------------------------------------

_registry_instance: SkillRegistry | None = None


def get_skill_registry() -> SkillRegistry:
    """Return the module-level singleton SkillRegistry (created once)."""
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = SkillRegistry()
    return _registry_instance
