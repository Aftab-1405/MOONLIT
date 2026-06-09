import os
import boto3
from dotenv import load_dotenv

load_dotenv('.env')

client = boto3.client(
    'bedrock-runtime',
    region_name=os.getenv('AWS_DEFAULT_REGION'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
)

models_to_test = [
    "us.anthropic.claude-3-5-haiku-20241022-v1:0",
    "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    "anthropic.claude-3-5-sonnet-20240620-v1:0"
]

for model in models_to_test:
    try:
        response = client.converse(
            modelId=model,
            messages=[{"role": "user", "content": [{"text": "Hello"}]}]
        )
        print(f"SUCCESS: {model}")
    except Exception as e:
        print(f"ERROR for {model}: {e}")
