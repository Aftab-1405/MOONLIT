from langgraph_orchestration.prompt_builder import PromptBuilder
from skills.skill_registry import SkillRegistry


def test_business_analytics_requests_activate_database_skill():
    registry = SkillRegistry()

    assert "database_querying" in registry.match_skills(
        "Now provide me top 3 products which have more sales."
    )
    assert "database_querying" in registry.match_skills(
        "Now provide me top performing employees list."
    )


def test_system_prompt_contains_result_integrity_guardrails():
    prompt = PromptBuilder.get_system_prompt()

    assert "Evidence ladder for factual database claims" in prompt
    assert "Never invent sample rows and present them as real data" in prompt
    assert "RESULT INTEGRITY" in prompt


def test_diagram_skill_requires_complete_grounded_schema():
    context = SkillRegistry().build_skill_context("generate visualization of my db schema")

    assert "react_flow_diagram" in context
    assert "include every table returned by get_schema_overview" in context
    assert "Never invent row counts" in context
