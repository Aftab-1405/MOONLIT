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

# Default models per provider
_DEFAULT_MODELS = {
    "bedrock": "",
}

def get_default_model(provider: str) -> str:
    """Return the configured default model for *provider*."""
    provider = provider.strip().lower()
    env_key = f"{provider.upper()}_MODEL"
    return os.getenv(env_key) or _DEFAULT_MODELS.get(provider, "")

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

    from langchain_aws import ChatBedrockConverse
    
    # Explicitly pass credentials to avoid conflicts with ~/.aws/credentials
    aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    aws_session_token = os.getenv("AWS_SESSION_TOKEN")
    aws_region = os.getenv("AWS_DEFAULT_REGION") or os.getenv("AWS_REGION") or "us-east-1"
    
    # Bedrock region overrides for models not available in the default region (us-east-1)
    _MODEL_REGION_OVERRIDES = {
        "qwen.qwen3-235b-a22b-2507-v1:0": "us-west-2",
    }
    if model in _MODEL_REGION_OVERRIDES:
        aws_region = _MODEL_REGION_OVERRIDES[model]
        
    model_kwargs = {}
    
    from app.core.config import Config
    is_native_reasoning = any(m in model.lower() for m in Config.BEDROCK_NATIVE_THINKING_MODELS)
    
    if is_native_reasoning:
        # Anthropic requires explicit thinking configuration in request fields
        if "anthropic" in model.lower() or "claude" in model.lower():
            temperature = 1.0
            if reasoning_effort == "high":
                budget = 16000
            elif reasoning_effort == "medium":
                budget = 5000
            else:
                budget = 1024
            model_kwargs["additionalModelRequestFields"] = {
                "thinking": {
                    "type": "enabled",
                    "budget_tokens": budget
                }
            }
        # Other native models (e.g., Moonshot) use reasoning automatically without extra parameters

        
    return ChatBedrockConverse(
        model=model,
        temperature=temperature,
        region_name=aws_region,
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        aws_session_token=aws_session_token,
        disable_streaming=False,
        **model_kwargs
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
