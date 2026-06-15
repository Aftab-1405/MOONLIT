"""
Model factory — provider-agnostic ChatModel instantiation.

Now explicitly uses AWS Bedrock via ChatBedrockConverse for robust tool calling.
"""

import os
import logging
from functools import lru_cache
from typing import Optional

from langchain_core.language_models.chat_models import BaseChatModel

logger = logging.getLogger(__name__)

def get_default_model(provider: str) -> str:
    """Return the configured default model for *provider*."""
    provider = provider.strip().lower()
    env_key = f"{provider.upper()}_MODEL"
    return os.getenv(env_key, "")

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
        provider: Expected to be 'bedrock'.
        model: Model ID (e.g. anthropic.claude-3-5-sonnet-20240620-v1:0).
        api_key: Ignored for Bedrock (uses AWS environment variables).
        enable_reasoning: Toggle for future use.
        reasoning_effort: Token budget control.
        temperature: Sampling temperature.
        
    Returns:
        A LangChain ``BaseChatModel`` ready for ``.bind_tools()``.
    """
    provider = provider.strip().lower()
    if provider != "bedrock":
        logger.warning(f"Provider {provider} requested, but only 'bedrock' is supported. Falling back to bedrock.")
        provider = "bedrock"

    model = model or get_default_model(provider)
        
    from app.infrastructure.bedrock.client import init_chat_bedrock
    return init_chat_bedrock(
        model=model,
        temperature=temperature,
    )

@lru_cache(maxsize=1)
def get_supported_providers() -> tuple[str, ...]:
    """Return provider names that are configured."""
    return ("bedrock",)

def get_provider_models(provider: str) -> list[str]:
    """Return the comma-separated model list from env, or the single default."""
    provider = provider.strip().lower()
    env_key = f"{provider.upper()}_MODELS"
    raw = os.getenv(env_key, "")
    if raw.strip():
        return [m.strip() for m in raw.split(",") if m.strip()]
    default = get_default_model(provider)
    return [default] if default else []

def get_provider_api_keys(provider: str) -> list[str]:
    """
    Return API keys configured for *provider*.
    For Bedrock, this returns a dummy key if AWS_ACCESS_KEY_ID is set
    so that rate limiting and key-check logic doesn't break.
    """
    if provider.strip().lower() == "bedrock":
        if os.getenv("AWS_ACCESS_KEY_ID"):
            return ["aws_credentials_present"]
    return []
