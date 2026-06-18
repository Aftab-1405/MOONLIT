import boto3
from langchain_aws import ChatBedrockConverse

from app.core.config import get_config

Config = get_config()

def get_aws_credentials() -> dict:
    """Resolve AWS credentials from centralized application configuration."""
    return {
        "aws_access_key_id": Config.AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": Config.AWS_SECRET_ACCESS_KEY,
        "aws_session_token": Config.AWS_SESSION_TOKEN,
        "region_name": Config.AWS_REGION,
    }

def get_bedrock_client():
    """Get a boto3 Bedrock runtime client with resolved credentials."""
    creds = get_aws_credentials()
    # Remove region_name from kwargs and pass it to client explicitly
    region = creds.pop("region_name")
    return boto3.client("bedrock-runtime", region_name=region, **creds)

def init_chat_bedrock(model: str, temperature: float, **kwargs) -> ChatBedrockConverse:
    """Initialize LangChain's ChatBedrockConverse with credentials and region."""
    creds = get_aws_credentials()
    region = creds["region_name"]
    
    return ChatBedrockConverse(
        model=model,
        temperature=temperature,
        region_name=region,
        aws_access_key_id=creds["aws_access_key_id"],
        aws_secret_access_key=creds["aws_secret_access_key"],
        aws_session_token=creds["aws_session_token"],
        disable_streaming=False,
        **kwargs
    )
