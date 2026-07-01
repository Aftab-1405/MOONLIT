from config import get_config

DEFAULT_EMBEDDING_MODEL = get_config().VAMP_EMBEDDING_MODEL


def default_embedding_provider(text: str) -> list[float]:
    """
    Generate an embedding using Bedrock Titan Text Embeddings V2.

    This function is intentionally lazy-imported so unit tests and deployments
    without embedding credentials can import the service safely.
    """
    import json
    from llm_provider.bedrock_client import get_bedrock_client

    client = get_bedrock_client()
    model_id = get_config().VAMP_EMBEDDING_MODEL
    if not model_id:
        raise ValueError("VAMP_EMBEDDING_MODEL is not configured in settings/environment")
        
    request_body = {"inputText": text}
    if "titan-embed-text-v2" in model_id:
        request_body.update(
            {
                "dimensions": get_config().VAMP_EMBEDDING_DIMENSIONS,
                "normalize": True,
            }
        )

    response = client.invoke_model(
        modelId=model_id,
        body=json.dumps(request_body),
        accept="application/json",
        contentType="application/json",
    )
    body = json.loads(response["body"].read())
    embedding = body.get("embedding")
    if not isinstance(embedding, list):
        raise ValueError("Bedrock embedding response did not include an embedding")
    return embedding
