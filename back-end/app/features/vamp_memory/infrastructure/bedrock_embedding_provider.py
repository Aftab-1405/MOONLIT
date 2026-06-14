DEFAULT_EMBEDDING_MODEL = "amazon.titan-embed-text-v2:0"

def default_embedding_provider(text: str) -> list[float]:
    """
    Generate an embedding using Bedrock Titan Text Embeddings V2.

    This function is intentionally lazy-imported so unit tests and deployments
    without embedding credentials can import the service safely.
    """
    import boto3
    import json

    client = boto3.client("bedrock-runtime")
    try:
        from app.core.config import Config

        model_id = Config.VAMP_EMBEDDING_MODEL
    except Exception:
        model_id = DEFAULT_EMBEDDING_MODEL
    response = client.invoke_model(
        modelId=model_id,
        body=json.dumps({"inputText": text}),
        accept="application/json",
        contentType="application/json",
    )
    body = json.loads(response["body"].read())
    embedding = body.get("embedding")
    if not isinstance(embedding, list):
        raise ValueError("Bedrock embedding response did not include an embedding")
    return embedding
