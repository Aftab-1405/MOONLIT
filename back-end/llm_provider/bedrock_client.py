import logging
from functools import lru_cache

import boto3
from langchain_aws import ChatBedrockConverse

from config import get_config

logger = logging.getLogger(__name__)
Config = get_config()

_GEOGRAPHY_PREFIXES = ("us.", "eu.", "apac.", "ap.")


def _retry_config():
    from botocore.config import Config as BotocoreConfig

    return BotocoreConfig(
        retries={
            "max_attempts": 10,
            "mode": "adaptive",
        }
    )


def _strip_geography_prefix(model: str) -> str:
    for prefix in _GEOGRAPHY_PREFIXES:
        if model.startswith(prefix):
            return model[len(prefix) :]
    return model


def _model_suffix_from_arn(value: str) -> str:
    return value.rsplit("/", 1)[-1] if "/" in value else value


def _model_match_key(model: str) -> str:
    return _model_suffix_from_arn(_strip_geography_prefix(str(model or "").strip()))


@lru_cache(maxsize=2)
def get_bedrock_control_client(region_name: str | None = None):
    """Get a boto3 Bedrock control-plane client for model/profile discovery."""
    creds = get_aws_credentials()
    region = region_name or creds.pop("region_name")
    creds.pop("region_name", None)
    return boto3.client("bedrock", region_name=region, config=_retry_config(), **creds)


@lru_cache(maxsize=16)
def _list_inference_profiles(region: str) -> tuple[dict, ...]:
    """List Bedrock inference profiles available in the configured region."""
    client = get_bedrock_control_client(region)
    profiles: list[dict] = []
    kwargs = {}

    while True:
        response = client.list_inference_profiles(**kwargs)
        profiles.extend(response.get("inferenceProfileSummaries", []))
        next_token = response.get("nextToken")
        if not next_token:
            break
        kwargs["nextToken"] = next_token

    return tuple(profiles)


def _profile_matches_model(profile: dict, requested_model: str) -> bool:
    requested_key = _model_match_key(requested_model)
    if not requested_key:
        return False

    direct_values = (
        profile.get("inferenceProfileId"),
        profile.get("inferenceProfileName"),
        profile.get("inferenceProfileArn"),
    )
    for value in direct_values:
        if value and _model_match_key(str(value)) == requested_key:
            return True

    for model in profile.get("models") or []:
        model_arn = model.get("modelArn") if isinstance(model, dict) else str(model)
        if _model_match_key(model_arn) == requested_key:
            return True

    return False


def _find_inference_profile_id(model: str) -> str | None:
    region = Config.AWS_REGION
    if not region:
        return None

    try:
        for profile in _list_inference_profiles(region):
            if _profile_matches_model(profile, model):
                return profile.get("inferenceProfileId") or profile.get(
                    "inferenceProfileArn"
                )
    except Exception as exc:
        logger.warning(
            "Could not discover Bedrock inference profiles for region=%s: %s",
            region,
            exc,
        )
    return None


def _resolve_model_id(model: str) -> str:
    """Resolve a configured Bedrock model ID without hardcoded model mappings."""
    model = str(model or "").strip()
    if not model or model.startswith("arn:"):
        return model

    resolved = _find_inference_profile_id(model)
    if resolved:
        if resolved != model:
            logger.info(
                "Resolved Bedrock model '%s' to inference profile '%s' for region '%s'.",
                model,
                resolved,
                Config.AWS_REGION,
            )
        return resolved

    return model


def get_aws_credentials() -> dict:
    """Resolve AWS credentials from centralized application configuration."""
    return {
        "aws_access_key_id": Config.AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": Config.AWS_SECRET_ACCESS_KEY,
        "aws_session_token": Config.AWS_SESSION_TOKEN,
        "region_name": Config.AWS_REGION,
    }

@lru_cache(maxsize=1)
def get_bedrock_client():
    """Get a boto3 Bedrock runtime client with resolved credentials."""
    creds = get_aws_credentials()
    # Remove region_name from kwargs and pass it to client explicitly
    region = creds.pop("region_name")
    return boto3.client(
        "bedrock-runtime", region_name=region, config=_retry_config(), **creds
    )

def init_chat_bedrock(model: str, temperature: float, **kwargs) -> ChatBedrockConverse:
    """Initialize LangChain's ChatBedrockConverse with credentials and region."""
    resolved_model = _resolve_model_id(model)
    creds = get_aws_credentials()
    region = creds["region_name"]

    return ChatBedrockConverse(
        model=resolved_model,
        base_model=resolved_model,
        temperature=temperature,
        region_name=region,
        aws_access_key_id=creds["aws_access_key_id"],
        aws_secret_access_key=creds["aws_secret_access_key"],
        aws_session_token=creds["aws_session_token"],
        config=_retry_config(),
        max_retries=10,
        disable_streaming="tool_calling",
        **kwargs
    )
