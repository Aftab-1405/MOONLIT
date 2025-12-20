"""Gemini AI service for chat functionality with DB-Genie identity"""
import logging
import textwrap
import google.generativeai as genai
from config import Config

logger = logging.getLogger(__name__)

# Configure Gemini API
genai.configure(api_key=Config.GEMINI_API_KEY)

# Load Gemini model (as per current best practices)
model = genai.GenerativeModel(model_name="models/gemini-2.5-flash")

# In-memory chat session store
chat_sessions = {}

class GeminiService:

    # Settings
    STRICT_MODE = True
    ENABLE_CONTEXT_ENHANCEMENT = True

    @staticmethod
    def get_system_prompt():
        
        """Returns DB-Genie’s identity, purpose, and rules for consistent behavior"""
        return textwrap.dedent("""
            You are DB-Genie, a data-first database assistant from ABN Alliance. Every response must be grounded in schema metadata or user input; never invent facts. If you’re unsure, ask for clarification rather than guessing.

            IDENTITY & PURPOSE
            - You are solely focused on database tasks: querying, design, optimization, troubleshooting.
            - Today you support MySQL; future support for other SQL/NoSQL is planned.

            ⚠️ CRITICAL: READ-ONLY MODE ⚠️
            - This system operates in READ-ONLY mode for security.
            - ONLY SELECT queries are permitted. INSERT, UPDATE, DELETE, DROP, CREATE, ALTER are BLOCKED.
            - If a user asks for data modification, explain that the system is read-only and suggest SELECT alternatives.
            - Never generate INSERT, UPDATE, DELETE, or any DDL/DML statements except SELECT.
            - When users need write operations, guide them on what SELECT queries can help them understand the data first.

            CORE PRINCIPLES
            1. Data Accuracy
            • Only draw on user-provided schemas and metadata.
            • If a detail is missing or ambiguous, request more info.
            2. Creative Clarity
            • Use concise analogies, stepwise breakdowns, and simple language.
            • Aim for “aha!” moments—help users grasp concepts fast.
            3. Actionable Guidance
            • Provide precise SQL snippets, annotated examples, or step-by-step instructions.
            • Highlight best practices and common pitfalls.

            VISUALIZATIONS
            - Whenever the user requests “visualize schema,” or similar, output accurate diagram code (specifically mermaid code) that can render:
            • Entity-relationship (ER) diagrams
            • Class-style diagrams
            • Hierarchies or network graphs
            • Any mix of the above
            - Do not mention the underlying diagram library or syntax by name—just supply the code block.
            - If user ask any diagram, then you can generate diagram for it, based on you diagram generation capability, no need to use mermaid code for that.

            FEATURES & UX
            - Zero-Trust: No persistent storage of user data; only use schema metadata to craft SQL.
            - Built-in SQL Editor & Results: Users run queries in the UI; you focus on generating and explaining them.
            - Chart Recommendations: For result sets, suggest appropriate chart types (bar, line, pie, scatter, doughnut, radar) and, when asked, emit chart-config code.

            INTERACTION GUIDELINES
            1. Stay on topic: If asked non-database questions, politely redirect to database assistance.
            2. Identity: If prompted, respond: “I’m DB-Genie from ABN Alliance.”
            3. Tone: Professional, friendly, and helpful—never robotic.
            4. Jargon: Favor simplicity unless the user signals deep technical expertise.
            5. Limits: Acknowledge unsupported features and note planned expansions.

            Remember: Be relentlessly accurate, data-driven, and creatively clear. Your mission is to make database work easier and more intuitive through concise, factual guidance and instantly renderable schema visuals.
        """)

    @staticmethod
    def get_or_create_chat_session(conversation_id, history=None):
        """Create a Gemini chat session if it doesn't exist"""
        if conversation_id not in chat_sessions:
            system_message = {
                "role": "user",
                "parts": [GeminiService.get_system_prompt()]
            }
            system_response = {
                "role": "model",
                "parts": [
                    "I understand. I am DB-Genie from ABN Alliance. How can I assist with your database tasks today?"
                ]
            }

            initial_history = [system_message, system_response]
            if history:
                initial_history.extend(history)

            chat_sessions[conversation_id] = model.start_chat(history=initial_history)

        return chat_sessions[conversation_id]

    @staticmethod
    def send_message(conversation_id, message, history=None, retry_attempts=3):
        """Send a message to Gemini and get response"""
        chat_session = GeminiService.get_or_create_chat_session(conversation_id, history)

        if GeminiService.ENABLE_CONTEXT_ENHANCEMENT:
            message = GeminiService._enhance_message_if_needed(message)

        for attempt in range(retry_attempts):
            try:
                responses = chat_session.send_message(message, stream=True)
                return responses
            except Exception as e:
                logger.error(f'Attempt {attempt + 1} failed: {e}')
                if attempt == retry_attempts - 1:
                    raise e

    @staticmethod
    def _enhance_message_if_needed(message):
        """Add context if message seems off-topic"""
        db_keywords = [
            'sql', 'query', 'database', 'table', 'mysql', 'select', 'insert',
            'update', 'delete', 'join', 'index', 'schema', 'primary key',
            'foreign key', 'constraint', 'normalize', 'optimize', 'performance'
        ]
        identity_keywords = [
            'who are you', 'what are you', 'your name', 'created by',
            'developed by', 'made by', 'creator', 'developer'
        ]
        off_topic_keywords = [
            'weather', 'news', 'sports', 'cooking', 'travel', 'movies',
            'music', 'politics', 'health', 'fitness', 'games'
        ]

        msg_lower = message.lower()

        if any(k in msg_lower for k in identity_keywords + db_keywords):
            return message

        if any(k in msg_lower for k in off_topic_keywords):
            return f"{message}\n\n[Context: Please focus on database-related assistance with DB-Genie.]"

        return message

    @staticmethod
    def notify_gemini(conversation_id, message):
        """Send message to Gemini silently (no response expected)"""
        logger.debug(f'Notifying Gemini: {message}')
        if conversation_id in chat_sessions:
            try:
                chat_sessions[conversation_id].send_message(message)
            except Exception as e:
                logger.error(f'Error notifying Gemini: {e}')
        else:
            logger.warning(f'No chat session found for conversation_id: {conversation_id}')

    @staticmethod
    def reset_chat_session(conversation_id):
        """Reset the chat session for reuse"""
        if conversation_id in chat_sessions:
            del chat_sessions[conversation_id]
            logger.info(f'Chat session reset for conversation_id: {conversation_id}')

    @staticmethod
    def get_session_info(conversation_id):
        """Return info about a given session"""
        session = chat_sessions.get(conversation_id)
        return {
            'exists': bool(session),
            'history_length': len(session.history) if session and hasattr(session, 'history') else 0
        }
