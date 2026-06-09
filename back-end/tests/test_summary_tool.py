import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from repositories.conversation_repository import ConversationRepository
from agent.agent import stream_conversation
from agent.checkpointing import init_checkpointer
from config import Config

def mock_get_for_user(conversation_id, user_id):
    return {
        "user_id": user_id,
        "summaries": [
            "--- Block 1 ---\nUser's name is Aftab. The user is a developer."
        ]
    }
ConversationRepository.get_for_user = staticmethod(mock_get_for_user)

async def test():
    await init_checkpointer(app_env=Config.APP_ENV, redis_url=os.getenv("UPSTASH_REDIS_URL"))
    
    print("Sending prompt: 'Do you remember my name?'")
    print("--------------------------------------------------")
    
    async for event in stream_conversation(
        conversation_id="test_conv_999",
        message="Do you remember my name?",
        user_id="test_user_999",
        db_config=None,
        model="moonshot.kimi-k2-thinking"
    ):
        print(event, end="")

if __name__ == "__main__":
    asyncio.run(test())
