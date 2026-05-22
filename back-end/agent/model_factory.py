"""
Model factory — provider-agnostic ChatModel instantiation.

Maps provider names to LangChain ChatModel classes. Cerebras uses
the OpenAI-compatible endpoint so no dedicated SDK is needed.
"""

import os
import logging
from functools import lru_cache
from typing import Optional

from langchain_core.language_models.chat_models import BaseChatModel

logger = logging.getLogger(__name__)

_PROVIDER_KEY_ENVS = {
    "gemini": {
        "keys": ("GEMINI_API_KEYS",),
        "single": ("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    },
    "cerebras": {
        "keys": ("CEREBRAS_API_KEYS",),
        "single": ("CEREBRAS_API_KEY",),
    },
    "anthropic": {
        "keys": ("ANTHROPIC_API_KEYS",),
        "single": ("ANTHROPIC_API_KEY",),
    },
    "openai": {
        "keys": ("OPENAI_API_KEYS",),
        "single": ("OPENAI_API_KEY",),
    },
}

# Default models per provider (overridden by env vars)
_DEFAULT_MODELS = {
    "gemini": "gemini-2.5-flash-lite",
    "cerebras": "llama3.1-8b",
    "anthropic": "claude-sonnet-4-20250514",
    "openai": "gpt-4o-mini",
}

CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1"


def get_default_model(provider: str) -> str:
    """Return the configured default model for *provider*."""
    provider = provider.strip().lower()
    env_key = f"{provider.upper()}_MODEL"
    return os.getenv(env_key) or _DEFAULT_MODELS.get(provider, "")


# Reasoning budget tokens per effort level
_REASONING_BUDGET = {"low": 1024, "medium": 8000, "high": 16000}


def get_chat_model(
    provider: str,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    *,
    enable_reasoning: bool = True,
    reasoning_effort: str = "medium",
    temperature: float = 0.2,
) -> BaseChatModel:
    """
    Instantiate the correct ChatModel for *provider*.

    Args:
        provider: One of 'gemini', 'cerebras', 'anthropic', 'openai'.
        model: Model name. Falls back to env / default when ``None``.
        api_key: Explicit API key (from rate-limiter key rotation).
        enable_reasoning: Whether to enable extended thinking/reasoning.
        reasoning_effort: 'low' | 'medium' | 'high' — maps to token budget.
        temperature: Sampling temperature.

    Returns:
        A LangChain ``BaseChatModel`` ready for ``.bind_tools()`` / ``.ainvoke()``.
    """
    provider = provider.strip().lower()
    model = model or get_default_model(provider)
    budget = _REASONING_BUDGET.get(reasoning_effort, 8000)

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        key = api_key or _resolve_provider_key(provider)
        kwargs = dict(model=model, google_api_key=key, temperature=temperature)
        if enable_reasoning:
            # thinking_budget: positive int enables thinking on Gemini 2.5+ models.
            # Non-thinking models ignore this. include_thoughts=True makes the
            # thinking content visible in the streamed content blocks.
            kwargs["thinking_budget"] = budget
            kwargs["include_thoughts"] = True
        return ChatGoogleGenerativeAI(**kwargs)

    if provider == "cerebras":
        from langchain_openai import ChatOpenAI

        key = api_key or _resolve_provider_key(provider)
        # Cerebras does not support reasoning/thinking — parameter ignored.
        return ChatOpenAI(
            model=model,
            api_key=key,
            base_url=CEREBRAS_BASE_URL,
            temperature=temperature,
        )

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        key = api_key or _resolve_provider_key(provider)
        kwargs = dict(model=model, anthropic_api_key=key)
        if enable_reasoning:
            # Anthropic requires temperature=1 when thinking is enabled.
            kwargs["thinking"] = {"type": "enabled", "budget_tokens": budget}
            kwargs["temperature"] = 1
        else:
            kwargs["temperature"] = temperature
        return ChatAnthropic(**kwargs)

    if provider == "openai":
        from langchain_openai import ChatOpenAI

        key = api_key or _resolve_provider_key(provider)
        # o1/o3/o4-mini have built-in reasoning — no extra config needed.
        # For standard GPT models, reasoning toggle has no effect.
        return ChatOpenAI(
            model=model,
            api_key=key,
            temperature=temperature,
        )

    raise ValueError(
        f"Unknown provider: {provider!r}. Supported: gemini, cerebras, anthropic, openai"
    )


@lru_cache(maxsize=1)
def get_supported_providers() -> tuple[str, ...]:
    """Return provider names that have at least one API key configured."""
    available: list[str] = []
    for name in _PROVIDER_KEY_ENVS:
        if get_provider_api_keys(name):
            available.append(name)
    return tuple(available)


def get_provider_api_keys(provider: str) -> list[str]:
    """Return API keys configured for *provider* in key-rotation order."""
    provider = provider.strip().lower()
    config = _PROVIDER_KEY_ENVS.get(provider)
    if not config:
        return []

    keys: list[str] = []
    for env_key in config["keys"]:
        keys.extend(_split_keys(os.getenv(env_key, "")))
    for env_key in config["single"]:
        value = os.getenv(env_key, "").strip()
        if value:
            keys.append(value)

    default_provider = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    if provider == default_provider:
        keys.extend(_split_keys(os.getenv("LLM_API_KEYS", "")))
        generic_key = os.getenv("LLM_API_KEY", "").strip()
        if generic_key:
            keys.append(generic_key)

    return _dedupe(keys)


def get_provider_models(provider: str) -> list[str]:
    """Return the comma-separated model list from env, or the single default."""
    provider = provider.strip().lower()
    env_key = f"{provider.upper()}_MODELS"
    raw = os.getenv(env_key, "")
    if raw.strip():
        return [m.strip() for m in raw.split(",") if m.strip()]
    default = get_default_model(provider)
    return [default] if default else []


# -- helpers -----------------------------------------------------------


def _resolve_provider_key(provider: str) -> str:
    keys = get_provider_api_keys(provider)
    if keys:
        return keys[0]

    config = _PROVIDER_KEY_ENVS.get(provider, {})
    single_envs = config.get("single", ())
    keys_envs = config.get("keys", ())
    raise ValueError(
        f"No API key found for provider {provider!r}. Set one of: "
        f"{', '.join([*single_envs, *keys_envs])}"
    )


def _split_keys(raw: str) -> list[str]:
    return [key.strip() for key in raw.split(",") if key.strip()]


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered
