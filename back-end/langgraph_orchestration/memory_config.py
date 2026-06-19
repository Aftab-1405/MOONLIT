"""
Shared episodic-memory tuning for LangGraph trimming and Firestore summarization.
"""

from config import get_config

Config = get_config()

# LangGraph messages kept in the agent's active checkpoint window.
ACTIVE_MESSAGE_WINDOW = Config.ACTIVE_MESSAGE_WINDOW

# Firestore messages (user + AI entries) per scheduled summary block.
SUMMARY_BLOCK_SIZE = Config.SUMMARY_BLOCK_SIZE

# Recent Firestore messages left unsummarized while the checkpoint window is trimmed.
# Roughly ~5 user turns — still visible directly or via recent checkpoint context.
HOT_FIRESTORE_MESSAGES = Config.HOT_FIRESTORE_MESSAGES
