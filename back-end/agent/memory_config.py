"""
Shared episodic-memory tuning for LangGraph trimming and Firestore summarization.
"""

# LangGraph messages kept in the agent's active checkpoint window.
ACTIVE_MESSAGE_WINDOW = 20

# Firestore messages (user + AI entries) per scheduled summary block.
SUMMARY_BLOCK_SIZE = 20

# Recent Firestore messages left unsummarized while the checkpoint window is trimmed.
# Roughly ~5 user turns — still visible directly or via recent checkpoint context.
HOT_FIRESTORE_MESSAGES = 10
