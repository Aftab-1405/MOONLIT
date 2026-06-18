"""
Model factory — provider-agnostic ChatModel instantiation.

Now explicitly uses AWS Bedrock via ChatBedrockConverse for robust tool calling.
"""

import logging
from functools import lru_cache
from typing import Optional

from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import get_config

logger = logging.getLogger(__name__)

def get_default_model(provider: str) -> str:
    """Return the configured default model for *provider*."""
    config = get_config()
    provider = provider.strip().lower()
    return getattr(config, f"{provider.upper()}_MODEL", "")

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
    config = get_config()
    provider = provider.strip().lower()
    models = getattr(config, f"{provider.upper()}_MODELS", [])
    if models:
        return list(models)
    default = get_default_model(provider)
    return [default] if default else []

def get_provider_api_key(provider: str) -> str | None:
    """
    Return the API key configured for *provider*.
    For Bedrock, this returns a dummy key if AWS_ACCESS_KEY_ID is set
    so that rate limiting and credentials-check logic doesn't break.
    """
    config = get_config()
    if provider.strip().lower() == "bedrock":
        if config.AWS_ACCESS_KEY_ID:
            return "aws_credentials_present"
    return None

