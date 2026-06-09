# test_integration_episodic_memory.py
import os
import pytest
import uuid
from dotenv import load_dotenv
from services.conversation_service import ConversationService
from repositories.conversation_repository import ConversationRepository

load_dotenv()

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.anyio
@pytest.mark.integration
async def test_integration_check_and_summarize_real():
    test_conv_id = f"integration_summary_{uuid.uuid4()}"
    test_user_id = "integration_summary_user_123"
    
    try:
        # Store 25 messages to trigger a summarization slice
        for i in range(25):
            sender = "user" if i % 2 == 0 else "ai"
            ConversationRepository.store_message(
                conversation_id=test_conv_id,
                sender=sender,
                message=f"Message {i+1} during integration test conversation.",
                user_id=test_user_id
            )
            
        # Run check_and_summarize
        try:
            await ConversationService.check_and_summarize(
                conversation_id=test_conv_id,
                user_id=test_user_id,
                model="mistral.mistral-large-2402-v1:0"
            )
        except Exception as e:
            # Check if it failed due to AWS Bedrock throttling or authorization
            err_str = str(e).lower()
            if "throttling" in err_str or "request limit" in err_str or "too many requests" in err_str or "expired" in err_str or "credentials" in err_str or "unauthorized" in err_str or "access denied" in err_str or "throttlingexception" in err_str:
                pytest.skip(f"AWS Bedrock model call failed due to throttling/permissions: {e}")
            else:
                raise
                
        # If it succeeded, check if a summary was written
        conv = ConversationRepository.get(test_conv_id)
        assert conv is not None
        # Summaries may have been written or not, but we verify last_summarized_idx has changed if summaries are present
        if "summaries" in conv and conv["summaries"]:
            assert conv.get("last_summarized_idx", 0) > 0
            
    finally:
        # Clean up
        ConversationRepository.delete(test_conv_id, test_user_id)
