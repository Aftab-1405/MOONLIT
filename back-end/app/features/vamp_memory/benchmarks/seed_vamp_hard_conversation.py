#!/usr/bin/env python3
"""
Seed a hard repeatable test conversation with known facts across multiple domains.
Ensures 500 messages minimum, 25-50 summary blocks, and facts spread across early, middle, and late sections.
"""

import sys
import os
import argparse
import asyncio
import json
import random
from datetime import datetime, timedelta

# Add parent directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import project services/repositories
from app.infrastructure.firestore.firestore_service import FirestoreService, get_firestore_db
from app.features.conversations.infrastructure.conversation_repository import ConversationRepository
from app.features.vamp_memory.application.vamp_memory_service import VampMemoryService, get_default_vector_store
from app.features.conversations.application.conversation_service import ConversationService
from app.features.vamp_memory.infrastructure.summary_block_repository import SummaryBlockRepository

# The 36 hard facts divided into categories.
TURNS_DATA = [
    # --- EARLY SECTION (Blocks 0-8, database/API/testing fundamentals) ---
    {
        "id": "hard_001",
        "question": "What database did we finally choose for the backend?",
        "expected_answer": "PostgreSQL",
        "acceptable_answers": ["PostgreSQL", "postgres"],
        "expected_terms": ["postgresql", "postgres", "database"],
        "simplified": [
            {"sender": "user", "content": "What database did we decide to use for the main storage?"},
            {"sender": "ai", "content": "We finally chose PostgreSQL for the main backend database."}
        ],
        "full": [
            {"sender": "user", "content": "What database did we decide to use for the main storage?"},
            {"sender": "ai", "content": "We originally discussed using MySQL."},
            {"sender": "user", "content": "Let's change it to PostgreSQL for better JSON query performance."},
            {"sender": "ai", "content": "Good call. The final database chosen is PostgreSQL."}
        ]
    },
    {
        "id": "hard_002",
        "question": "What is the name of the main orders table?",
        "expected_answer": "sales_orders",
        "acceptable_answers": ["sales_orders"],
        "expected_terms": ["sales_orders", "table"],
        "simplified": [
            {"sender": "user", "content": "What table name did we select for customer purchases?"},
            {"sender": "ai", "content": "The main table for customer purchases is sales_orders."}
        ]
    },
    {
        "id": "hard_003",
        "question": "What is the final database connection pool size?",
        "expected_answer": "50",
        "acceptable_answers": ["50", "fifty"],
        "expected_terms": ["pool", "connection", "size"],
        "simplified": [
            {"sender": "user", "content": "How large should we make our database connection pool?"},
            {"sender": "ai", "content": "We approved a database connection pool size of 50 for concurrency limits."}
        ],
        "full": [
            {"sender": "user", "content": "How large should we make our database connection pool?"},
            {"sender": "ai", "content": "Let's start with a small pool size of 10 connections."},
            {"sender": "user", "content": "During load tests, that was too low. Raise the pool size to 50."},
            {"sender": "ai", "content": "Acknowledged. The final database connection pool size is 50."}
        ]
    },
    {
        "id": "hard_004",
        "question": "What is the maximum limit of rows returned in a single query?",
        "expected_answer": "1000",
        "acceptable_answers": ["1000", "one thousand"],
        "expected_terms": ["limit", "rows", "query"],
        "simplified": [
            {"sender": "user", "content": "What query row limit should we enforce on the database?"},
            {"sender": "ai", "content": "The maximum limit of rows returned in a single query is set to 1000."}
        ]
    },
    {
        "id": "hard_005",
        "question": "What index did we create on the user settings JSON column?",
        "expected_answer": "idx_users_settings_json",
        "acceptable_answers": ["idx_users_settings_json"],
        "expected_terms": ["idx_users_settings_json", "index"],
        "simplified": [
            {"sender": "user", "content": "What index was created for the JSON column in the settings table?"},
            {"sender": "ai", "content": "We created the idx_users_settings_json index on that column."}
        ]
    },
    {
        "id": "hard_006",
        "question": "What authentication method was finally decided for the API?",
        "expected_answer": "JWT Bearer token",
        "acceptable_answers": ["JWT Bearer token", "JWT Bearer"],
        "expected_terms": ["jwt", "bearer", "auth"],
        "simplified": [
            {"sender": "user", "content": "What is the API authentication system?"},
            {"sender": "ai", "content": "The final authentication method decided for the API is JWT Bearer token."}
        ],
        "full": [
            {"sender": "user", "content": "What is the API authentication system?"},
            {"sender": "ai", "content": "We planned to use static API keys for client authentication."},
            {"sender": "user", "content": "We should use JWT Bearer tokens instead to secure individual user sessions."},
            {"sender": "ai", "content": "Yes, we'll implement that. The final API auth method is JWT Bearer token."}
        ]
    },
    {
        "id": "hard_007",
        "question": "What is the final API route prefix?",
        "expected_answer": "/api/v1",
        "acceptable_answers": ["/api/v1"],
        "expected_terms": ["api/v1", "prefix", "route"],
        "simplified": [
            {"sender": "user", "content": "What base prefix did we agree on for routes?"},
            {"sender": "ai", "content": "We agreed on using /api/v1 as our route prefix."}
        ],
        "full": [
            {"sender": "user", "content": "What base prefix did we agree on for routes?"},
            {"sender": "ai", "content": "We initially put everything directly under /api."},
            {"sender": "user", "content": "Let's namespace it under version one as /api/v1."},
            {"sender": "ai", "content": "Okay, the final API route prefix is /api/v1."}
        ]
    },
    {
        "id": "hard_008",
        "question": "What is the final refund endpoint?",
        "expected_answer": "/api/v1/refunds/create",
        "acceptable_answers": ["/api/v1/refunds/create"],
        "expected_terms": ["refunds", "create", "endpoint"],
        "simplified": [
            {"sender": "user", "content": "Where do we POST refund requests?"},
            {"sender": "ai", "content": "The final endpoint for POSTing refund requests is /api/v1/refunds/create."}
        ],
        "full": [
            {"sender": "user", "content": "Where do we POST refund requests?"},
            {"sender": "ai", "content": "We had it at /api/v1/refund/new."},
            {"sender": "user", "content": "We should make it plural refunds and use create suffix."},
            {"sender": "ai", "content": "Confirmed, the final refund endpoint is /api/v1/refunds/create."}
        ]
    },
    {
        "id": "hard_009",
        "question": "What is the final refund amount field in the payload?",
        "expected_answer": "refund_amount",
        "acceptable_answers": ["refund_amount"],
        "expected_terms": ["refund_amount", "field"],
        "simplified": [
            {"sender": "user", "content": "What key is used to send the refund value?"},
            {"sender": "ai", "content": "The final payload field key for the refund value is refund_amount."}
        ],
        "full": [
            {"sender": "user", "content": "What key is used to send the refund value?"},
            {"sender": "ai", "content": "We used refund_val in the request body."},
            {"sender": "user", "content": "Let's name it refund_amount to match standard naming schemas."},
            {"sender": "ai", "content": "Agreeable. The final refund amount field is refund_amount."}
        ]
    },
    {
        "id": "hard_010",
        "question": "What status code and message do we return when rate limited?",
        "expected_answer": "429 Too Many Requests",
        "acceptable_answers": ["429 Too Many Requests", "429"],
        "expected_terms": ["429", "requests", "rate"],
        "simplified": [
            {"sender": "user", "content": "How do we report rate limiting to the client?"},
            {"sender": "ai", "content": "When rate limited, we return 429 Too Many Requests."}
        ],
        "full": [
            {"sender": "user", "content": "How do we report rate limiting to the client?"},
            {"sender": "ai", "content": "The rate limiter returns a 503 Service Unavailable code."},
            {"sender": "user", "content": "No, standard rate limiting response should be 429 Too Many Requests."},
            {"sender": "ai", "content": "Correct, we will return 429 Too Many Requests."}
        ]
    },
    {
        "id": "hard_011",
        "question": "What is the final idempotency header?",
        "expected_answer": "X-Idempotency-Key",
        "acceptable_answers": ["X-Idempotency-Key"],
        "expected_terms": ["idempotency", "x-idempotency-key", "header"],
        "simplified": [
            {"sender": "user", "content": "What header ensures API requests are idempotent?"},
            {"sender": "ai", "content": "We check the X-Idempotency-Key header for idempotent processing."}
        ],
        "full": [
            {"sender": "user", "content": "What header ensures API requests are idempotent?"},
            {"sender": "ai", "content": "We intended to use Idempotency-Key."},
            {"sender": "user", "content": "Let's prepend it with X to make it X-Idempotency-Key."},
            {"sender": "ai", "content": "Sure, the final idempotency header is X-Idempotency-Key."}
        ]
    },
    {
        "id": "hard_012",
        "question": "What compression format is used for large API payloads?",
        "expected_answer": "gzip",
        "acceptable_answers": ["gzip", "zip"],
        "expected_terms": ["gzip", "compression"],
        "simplified": [
            {"sender": "user", "content": "What compression method do we support for payloads?"},
            {"sender": "ai", "content": "We compress large API payloads using the gzip format."}
        ]
    },

    # --- MIDDLE SECTION (Blocks 9-16, testing, security, and React/Vite) ---
    {
        "id": "hard_013",
        "question": "What test runner framework did we choose for Python?",
        "expected_answer": "pytest",
        "acceptable_answers": ["pytest"],
        "expected_terms": ["pytest", "runner"],
        "simplified": [
            {"sender": "user", "content": "Which testing runner should we install?"},
            {"sender": "ai", "content": "We chose pytest as our Python test runner framework."}
        ]
    },
    {
        "id": "hard_014",
        "question": "What marker is used for VAMP smoke tests?",
        "expected_answer": "@pytest.mark.smoke",
        "acceptable_answers": ["@pytest.mark.smoke", "mark.smoke"],
        "expected_terms": ["smoke", "marker"],
        "simplified": [
            {"sender": "user", "content": "How do we tag our integration smoke tests?"},
            {"sender": "ai", "content": "We tag VAMP smoke tests with the @pytest.mark.smoke decorator."}
        ]
    },
    {
        "id": "hard_015",
        "question": "What is the final code coverage threshold target?",
        "expected_answer": "90%",
        "acceptable_answers": ["90%", "90"],
        "expected_terms": ["coverage", "threshold", "target"],
        "simplified": [
            {"sender": "user", "content": "What coverage percentage are we targeting?"},
            {"sender": "ai", "content": "Our final code coverage threshold target is 90%."}
        ],
        "full": [
            {"sender": "user", "content": "What coverage percentage are we targeting?"},
            {"sender": "ai", "content": "We should enforce an 80% coverage threshold limit."},
            {"sender": "user", "content": "Let's increase the requirement to 90% to prevent regressive bugs."},
            {"sender": "ai", "content": "Acknowledged. The final code coverage threshold target is 90%."}
        ]
    },
    {
        "id": "hard_016",
        "question": "What database name is used for running integration tests?",
        "expected_answer": "test_moonlit_db",
        "acceptable_answers": ["test_moonlit_db"],
        "expected_terms": ["test_moonlit_db", "test"],
        "simplified": [
            {"sender": "user", "content": "Where do integration tests write temporary records?"},
            {"sender": "ai", "content": "Integration tests use a separate database called test_moonlit_db."}
        ]
    },
    {
        "id": "hard_017",
        "question": "What library is used to mock external HTTP requests in tests?",
        "expected_answer": "responses",
        "acceptable_answers": ["responses"],
        "expected_terms": ["responses", "mock"],
        "simplified": [
            {"sender": "user", "content": "How do we mock requests calls in unit tests?"},
            {"sender": "ai", "content": "We use the responses library to mock external HTTP requests in tests."}
        ]
    },
    {
        "id": "hard_018",
        "question": "Where are JWT tokens stored on the frontend?",
        "expected_answer": "localStorage",
        "acceptable_answers": ["localStorage"],
        "expected_terms": ["localstorage", "token", "storage"],
        "simplified": [
            {"sender": "user", "content": "Where is the client-side JWT kept?"},
            {"sender": "ai", "content": "The JWT tokens are stored in the browser localStorage."}
        ],
        "full": [
            {"sender": "user", "content": "Where is the client-side JWT kept?"},
            {"sender": "ai", "content": "We store it inside HTTP-only cookies."},
            {"sender": "user", "content": "Vite client requests need direct JS access. Let's write to localStorage."},
            {"sender": "ai", "content": "Understood. The frontend now stores JWT tokens in localStorage."}
        ]
    },
    {
        "id": "hard_019",
        "question": "What is the security rule for logging personal data?",
        "expected_answer": "mask email and phone number",
        "acceptable_answers": ["mask email and phone number", "mask email", "phone number"],
        "expected_terms": ["mask", "email", "phone"],
        "simplified": [
            {"sender": "user", "content": "What is our log security policy for client data?"},
            {"sender": "ai", "content": "The security rule is that we must mask email and phone number details in all logs."}
        ]
    },
    {
        "id": "hard_020",
        "question": "What CORS allowed origin was finally approved for production?",
        "expected_answer": "https://app.moonlit.ai",
        "acceptable_answers": ["https://app.moonlit.ai"],
        "expected_terms": ["cors", "origin", "approved"],
        "simplified": [
            {"sender": "user", "content": "What domain should be in our CORS whitelist?"},
            {"sender": "ai", "content": "The approved origin whitelist for CORS in production is https://app.moonlit.ai."}
        ],
        "full": [
            {"sender": "user", "content": "What domain should be in our CORS whitelist?"},
            {"sender": "ai", "content": "Let's keep the CORS origin as wildcard '*' for ease of testing."},
            {"sender": "user", "content": "That is a security vulnerability for production. Allow only https://app.moonlit.ai."},
            {"sender": "ai", "content": "Agreed. The final approved CORS origin in production is https://app.moonlit.ai."}
        ]
    },
    {
        "id": "hard_021",
        "question": "What algorithm is used to hash user passwords?",
        "expected_answer": "bcrypt",
        "acceptable_answers": ["bcrypt"],
        "expected_terms": ["bcrypt", "hash", "password"],
        "simplified": [
            {"sender": "user", "content": "What algorithm do we use to encrypt credentials?"},
            {"sender": "ai", "content": "We use the bcrypt hashing algorithm to secure user passwords."}
        ]
    },
    {
        "id": "hard_022",
        "question": "What certificate authority is chosen for SSL/TLS?",
        "expected_answer": "Let's Encrypt",
        "acceptable_answers": ["Let's Encrypt", "letsencrypt"],
        "expected_terms": ["ssl", "certificate", "encrypt"],
        "simplified": [
            {"sender": "user", "content": "Which certificate provider are we using?"},
            {"sender": "ai", "content": "We chose Let's Encrypt as our SSL/TLS certificate authority."}
        ]
    },
    {
        "id": "hard_023",
        "question": "What frontend framework and tool did we select?",
        "expected_answer": "React with Vite",
        "acceptable_answers": ["React with Vite", "React", "Vite"],
        "expected_terms": ["react", "vite", "frontend"],
        "simplified": [
            {"sender": "user", "content": "What build setup did we choose for UI?"},
            {"sender": "ai", "content": "We selected React with Vite for our frontend UI development."}
        ]
    },
    {
        "id": "hard_024",
        "question": "What CSS approach did we finally approve for styling?",
        "expected_answer": "Vanilla CSS",
        "acceptable_answers": ["Vanilla CSS", "vanilla"],
        "expected_terms": ["vanilla", "css", "styling"],
        "simplified": [
            {"sender": "user", "content": "Which CSS library should we import?"},
            {"sender": "ai", "content": "We approved using Vanilla CSS for styling in our components."}
        ],
        "full": [
            {"sender": "user", "content": "Which CSS library should we import?"},
            {"sender": "ai", "content": "Let's install TailwindCSS for CSS utilities."},
            {"sender": "user", "content": "Let's stick to Vanilla CSS to keep bundle size minimal and styling custom."},
            {"sender": "ai", "content": "Confirmed, we approved Vanilla CSS for styling."}
        ]
    },

    # --- LATE SECTION (Blocks 17-24, node/runtime and VAMP parameters) ---
    {
        "id": "hard_025",
        "question": "What is the name of the reusable password component?",
        "expected_answer": "PasswordInput",
        "acceptable_answers": ["PasswordInput"],
        "expected_terms": ["passwordinput", "component"],
        "simplified": [
            {"sender": "user", "content": "What component renders the password input fields?"},
            {"sender": "ai", "content": "The reusable password component is named PasswordInput."}
        ]
    },
    {
        "id": "hard_026",
        "question": "What state management library did we choose for React?",
        "expected_answer": "Zustand",
        "acceptable_answers": ["Zustand"],
        "expected_terms": ["zustand", "state"],
        "simplified": [
            {"sender": "user", "content": "What library handles frontend global state?"},
            {"sender": "ai", "content": "We chose Zustand for React global state management."}
        ]
    },
    {
        "id": "hard_027",
        "question": "What package manager did we select for the frontend project?",
        "expected_answer": "npm",
        "acceptable_answers": ["npm"],
        "expected_terms": ["npm", "package", "manager"],
        "simplified": [
            {"sender": "user", "content": "What tool manages node packages on frontend?"},
            {"sender": "ai", "content": "We selected npm as our package manager."}
        ]
    },
    {
        "id": "hard_028",
        "question": "What is the final runtime version for deployment?",
        "expected_answer": "Node.js 22.15.0",
        "acceptable_answers": ["Node.js 22.15.0", "Node 22.15.0", "22.15.0"],
        "expected_terms": ["node", "22.15.0", "runtime"],
        "simplified": [
            {"sender": "user", "content": "Which node runtime is in production?"},
            {"sender": "ai", "content": "The final runtime version is Node.js 22.15.0."}
        ],
        "full": [
            {"sender": "user", "content": "Which node runtime is in production?"},
            {"sender": "ai", "content": "The server runs on Node.js 18.0.0."},
            {"sender": "user", "content": "We need ES module support natively. Let's upgrade to Node.js 22.15.0."},
            {"sender": "ai", "content": "Okay, the final runtime version is Node.js 22.15.0."}
        ]
    },
    {
        "id": "hard_029",
        "question": "What base Docker image is used for runtime containerization?",
        "expected_answer": "node:22-alpine",
        "acceptable_answers": ["node:22-alpine"],
        "expected_terms": ["docker", "image", "alpine"],
        "simplified": [
            {"sender": "user", "content": "What is the Dockerfile FROM base image?"},
            {"sender": "ai", "content": "We use node:22-alpine as the base Docker image."}
        ],
        "full": [
            {"sender": "user", "content": "What is the Dockerfile FROM base image?"},
            {"sender": "ai", "content": "Let's build on node:22 standard image."},
            {"sender": "user", "content": "Standard image is too large. Switch to node:22-alpine instead."},
            {"sender": "ai", "content": "Approved, the base image is node:22-alpine."}
        ]
    },
    {
        "id": "hard_030",
        "question": "What environment variable configuration limits Node memory?",
        "expected_answer": "--max-old-space-size=4096",
        "acceptable_answers": ["--max-old-space-size=4096", "4096"],
        "expected_terms": ["node_options", "max-old-space-size", "4096"],
        "simplified": [
            {"sender": "user", "content": "How do we restrict memory allocation on node process?"},
            {"sender": "ai", "content": "We pass NODE_OPTIONS='--max-old-space-size=4096' to control memory allocation."}
        ],
        "full": [
            {"sender": "user", "content": "How do we restrict memory allocation on node process?"},
            {"sender": "ai", "content": "Let's configure --max-old-space-size=2048."},
            {"sender": "user", "content": "No, our workload is heavy. Make it 4096."},
            {"sender": "ai", "content": "Done. The final setting is --max-old-space-size=4096."}
        ]
    },
    {
        "id": "hard_031",
        "question": "What port does the backend service run on?",
        "expected_answer": "7800",
        "acceptable_answers": ["7800"],
        "expected_terms": ["7800", "port", "backend"],
        "simplified": [
            {"sender": "user", "content": "What port does our backend listen to?"},
            {"sender": "ai", "content": "The backend service runs on port 7800."}
        ]
    },
    {
        "id": "hard_032",
        "question": "What format is used for backend server logs?",
        "expected_answer": "JSON",
        "acceptable_answers": ["JSON", "json"],
        "expected_terms": ["logger", "format", "json"],
        "simplified": [
            {"sender": "user", "content": "What log formatting is active on the server?"},
            {"sender": "ai", "content": "Our backend server outputs logs in JSON format."}
        ]
    },
    {
        "id": "hard_033",
        "question": "What is the vector backend database for VAMP?",
        "expected_answer": "Qdrant",
        "acceptable_answers": ["Qdrant"],
        "expected_terms": ["qdrant", "vector", "backend"],
        "simplified": [
            {"sender": "user", "content": "Which vector store index do we use in VAMP?"},
            {"sender": "ai", "content": "We use Qdrant as the vector database for VAMP pointers."}
        ]
    },
    {
        "id": "hard_034",
        "question": "What is the source-of-truth store for VAMP?",
        "expected_answer": "Firestore",
        "acceptable_answers": ["Firestore"],
        "expected_terms": ["firestore", "source-of-truth", "store"],
        "simplified": [
            {"sender": "user", "content": "Where are authoritative summaries stored?"},
            {"sender": "ai", "content": "Firestore is the authoritative source-of-truth store for VAMP blocks."}
        ]
    },
    {
        "id": "hard_035",
        "question": "What is the VAMP context budget in characters?",
        "expected_answer": "12000",
        "acceptable_answers": ["12000", "12000 characters"],
        "expected_terms": ["budget", "chars", "12000"],
        "simplified": [
            {"sender": "user", "content": "How many characters is our memory budget context capped at?"},
            {"sender": "ai", "content": "The VAMP context budget is set to 12000 characters maximum."}
        ],
        "full": [
            {"sender": "user", "content": "How many characters is our memory budget context capped at?"},
            {"sender": "ai", "content": "We had it configured at 5000 characters initially."},
            {"sender": "user", "content": "Let's increase it to 12000 characters to fit up to 10 full blocks."},
            {"sender": "ai", "content": "Agreed. The VAMP context budget is now 12000 characters."}
        ]
    },
    {
        "id": "hard_036",
        "question": "What is the VAMP adaptive top-k formula?",
        "expected_answer": "max(7, min(10, floor(total_summaries / 7)))",
        "acceptable_answers": ["max(7, min(10, floor(total_summaries / 7)))", "max(7, min(10"],
        "expected_terms": ["adaptive", "top-k", "formula"],
        "simplified": [
            {"sender": "user", "content": "What equation scales retrieve top-k dynamically?"},
            {"sender": "ai", "content": "The VAMP adaptive top-k formula is max(7, min(10, floor(total_summaries / 7))) (where floor division by 7 determines size)."}
        ],
        "full": [
            {"sender": "user", "content": "What equation scales retrieve top-k dynamically?"},
            {"sender": "ai", "content": "We scaled with the formula: max(3, min(10, floor(total_summaries / 10)))."},
            {"sender": "user", "content": "Let's update it to min pool of 7 and divide by 7 to expand context for younger conversations."},
            {"sender": "ai", "content": "Sure, the final adaptive top-k formula is max(7, min(10, floor(total_summaries / 7)))."}
        ]
    }
]

# Padding dialogues for realistic developers discussion
PADDING_DIALOGUES = [
    ("Did we push the local build to registry?", "Yes, the Docker image was pushed and verified."),
    ("Is the developer documentation ready?", "I updated the README and AGENTS.md files with instructions."),
    ("Should we run linting checks?", "Running npm run lint locally checks formatting conventions."),
    ("How do we check the logs for dev server?", "Check uvicorn output or tail the backend.log file."),
    ("Did we resolve the Firebase key path?", "Yes, the env variables point to valid GCP credentials."),
    ("Should we create a PR for connection pooling changes?", "Yes, I will open a PR and run regression tests first."),
    ("What port is uvicorn listening on?", "Uvicorn is configured to port 5000 in development."),
    ("Are any packages unused in dependencies?", "We can run npm run knip to audit unused front-end exports."),
    ("Has the client validated the refund flow?", "Yes, the client successfully invoked the refund API endpoints."),
    ("Are we writing logs in JSON to local files?", "No, uvicorn outputs text logs to stdout; JSON logging is for staging."),
    ("Is the git branch up to date?", "Yes, I merged main branch into current workspace task branch."),
    ("Should we run tests on dev server directly?", "Yes, env/bin/pytest covers integration tests offline."),
    ("How long does Qdrant index take to build?", "It takes less than 10 milliseconds to insert or update."),
    ("Did the QA engineer find any bug?", "There is a slight layout overflow on login modal under small screens."),
    ("What tailwind components did we refactor?", "We completely bypassed Tailwind and used Vanilla CSS instead."),
    ("Are there any security warnings in npm audit?", "All high-severity alerts have been auto-fixed in package.json."),
    ("Should we add indices on created_at fields?", "Firestore indices are created automatically on collection schemas."),
    ("Did we add CORS origins for production?", "Yes, only the main app domain is permitted on API headers."),
    ("Is the bcrypt round count default correct?", "The package defaults to 10 rounds for password hashing strength."),
    ("Did the team approve the node container base?", "Yes, the alpine image was preferred to keep footprint low."),
    ("Does the client see memory context injected?", "No, VAMP context is loaded in system prompts before LLM runs."),
]

def generate_hard_messages():
    """
    Generate exactly 25 chunks * 20 messages = 500 messages.
    Distribute the 36 facts across the 25 blocks.
    - 11 blocks will contain 2 facts (simplified 2-message turns = 4 messages total).
    - 14 blocks will contain 1 fact. (To interleave corrections, we can make some 4-message full mode turns).
    """
    chunks = []
    fact_index = 0
    padding_turn_idx = 0
    
    # 25 chunks total
    for chunk_idx in range(25):
        chunk_messages = []
        chunk_facts = []
        
        # Decide how many facts to place in this chunk
        # 11 chunks get 2 facts, 14 chunks get 1 fact
        num_facts = 2 if chunk_idx < 11 else 1
        
        # Pull facts from TURNS_DATA
        for _ in range(num_facts):
            if fact_index < len(TURNS_DATA):
                fact = TURNS_DATA[fact_index]
                fact_index += 1
                
                # Alternate simplified vs full turns
                # If chunk has 2 facts, keep them simplified to avoid exceeding chunk capacity (20 messages)
                if num_facts == 2 or "full" not in fact:
                    msgs = fact["simplified"]
                else:
                    msgs = fact["full"]
                
                chunk_messages.append((fact, msgs))
                chunk_facts.append(fact)
                
        # Shuffle the fact turns to avoid predictable offsets, but preserve order within turn
        # Here we just interleave them with padding turns
        # Let's count message capacity needed:
        fact_msgs_total = sum(len(msgs) for _, msgs in chunk_messages)
        remaining_msgs_needed = 20 - fact_msgs_total
        
        # Generate padding turns of 2 messages each
        padding_turns = []
        for _ in range(remaining_msgs_needed // 2):
            p_user, p_ai = PADDING_DIALOGUES[padding_turn_idx % len(PADDING_DIALOGUES)]
            padding_turn_idx += 1
            padding_turns.append([
                {"sender": "user", "content": p_user},
                {"sender": "ai", "content": p_ai}
            ])
            
        # Interleave fact turns and padding turns
        all_turns = []
        # Add fact turns
        for fact_obj, msgs in chunk_messages:
            all_turns.append((True, fact_obj, msgs))
        # Add padding turns
        for p_msgs in padding_turns:
            all_turns.append((False, None, p_msgs))
            
        # Shuffle turns but keep facts reasonably scattered
        random.seed(chunk_idx * 42)
        random.shuffle(all_turns)
        
        # Flatten turns to message list
        flat_messages = []
        for is_fact, fact_obj, msgs in all_turns:
            flat_messages.extend(msgs)
            
        chunks.append({
            "messages": flat_messages,
            "facts": chunk_facts
        })
        
    # Assemble final conversation message list
    messages_list = []
    base_time = datetime.now() - timedelta(days=1)
    
    turn_mappings = []
    
    for chunk_idx, chunk in enumerate(chunks):
        start_idx = len(messages_list)
        for msg in chunk["messages"]:
            messages_list.append({
                "sender": msg["sender"],
                "content": msg["content"],
                "timestamp": base_time + timedelta(minutes=len(messages_list) * 2)
            })
        end_idx = len(messages_list) - 1
        
        turn_mappings.append({
            "start": start_idx,
            "end": end_idx,
            "facts": chunk["facts"]
        })
        
    return messages_list, turn_mappings

async def main():
    parser = argparse.ArgumentParser(description="Seed hard conversation with VAMP benchmark facts.")
    parser.add_argument("--conversation-id", default="vamp-hard-seed-001", help="Conversation ID in Firestore")
    parser.add_argument("--user-id", default="test-user-vamp", help="User ID owning the conversation")
    parser.add_argument("--messages", type=int, default=500, help="Number of messages (for compatibility)")
    parser.add_argument("--out-eval-file", default="data/vamp_eval_cases.hard_seeded.json", help="Path to write evaluation cases JSON")
    parser.add_argument("--summarize", action="store_true", help="Trigger real LLM-based VAMP summarization via ConversationService")
    parser.add_argument("--direct-summary-blocks", action="store_true", help="Directly generate and write synthetic summaries (readiness/offline debug)")
    
    args = parser.parse_args()
    
    print("Initializing Firebase Service...")
    FirestoreService.initialize()
    db = get_firestore_db()
    
    # 1. Reset conversation in Firestore
    print(f"Resetting Firestore conversation '{args.conversation_id}' for user '{args.user_id}'...")
    conv_ref = db.collection(ConversationRepository.COLLECTION_NAME).document(args.conversation_id)
    
    # Delete existing summary blocks
    summary_blocks_ref = conv_ref.collection(SummaryBlockRepository.SUMMARY_COLLECTION)
    summary_docs = summary_blocks_ref.get()
    if summary_docs:
        print(f"Deleting {len(summary_docs)} existing summary blocks...")
        for doc in summary_docs:
            doc.reference.delete()
            
    # Reset conversation document
    conv_ref.delete()
    
    # 2. Reset Qdrant vector index for this conversation
    vector_store = get_default_vector_store()
    if hasattr(vector_store, "client") and hasattr(vector_store, "collection_name") and hasattr(vector_store, "models"):
        try:
            print(f"Clearing existing Qdrant vector points for '{args.conversation_id}'...")
            vector_store.client.delete(
                collection_name=vector_store.collection_name,
                points_selector=vector_store.models.Filter(
                    must=[
                        vector_store.models.FieldCondition(
                            key="conversation_id",
                            match=vector_store.models.MatchValue(value=args.conversation_id),
                        )
                    ]
                )
            )
            print("Qdrant vector index cleared.")
        except Exception as e:
            print(f"Warning: Qdrant deletion failed: {e}")
            
    # 3. Generate messages
    print("Generating 500 messages with 36 seeded hard facts...")
    messages_list, turn_mappings = generate_hard_messages()
    
    print(f"Total messages generated: {len(messages_list)}")
    
    # Save conversation messages to Firestore
    print(f"Writing {len(messages_list)} messages to Firestore...")
    conv_ref.set({
        "user_id": args.user_id,
        "timestamp": datetime.now(),
        "messages": messages_list,
        "last_summarized_idx": 0,
        "summary_count": 0,
    })
    print("Conversation seeded successfully in Firestore.")
    
    # 4. Generate eval cases JSON file
    eval_cases = []
    for mapping in turn_mappings:
        for fact in mapping["facts"]:
            eval_cases.append({
                "id": fact["id"],
                "question": fact["question"],
                "expected_answer": fact["expected_answer"],
                "acceptable_answers": fact["acceptable_answers"],
                "expected_terms": fact["expected_terms"]
            })
            
    os.makedirs(os.path.dirname(args.out_eval_file), exist_ok=True)
    with open(args.out_eval_file, "w") as f:
        json.dump(eval_cases, f, indent=2)
    print(f"Seeded {len(eval_cases)} evaluation cases written to: {args.out_eval_file}")
    
    # 5. Handle summarization flags
    if args.summarize:
        print("Triggering real LLM-based VAMP summarization (25 blocks)...")
        try:
            from app.features.agent_orchestration.infrastructure.checkpointing import init_checkpointer, shutdown_checkpointer
            from app.core.config import Config
            await init_checkpointer(app_env=Config.APP_ENV, redis_url=os.getenv("UPSTASH_REDIS_URL"))
            await ConversationService.check_and_summarize(args.conversation_id, args.user_id, model="amazon.nova-pro-v1:0")
            await shutdown_checkpointer()
            print("Real VAMP summarization complete.")
        except Exception as e:
            print(f"Error executing real VAMP summarization: {e}")
            print("Make sure your LLM provider and AWS credentials are correct in your .env.")
            
    elif args.direct_summary_blocks:
        print("Generating and writing synthetic summary blocks directly (offline debug)...")
        vamp_service = VampMemoryService()
        
        # Group messages into chunks of 20 (mimicking SUMMARY_BLOCK_SIZE)
        chunk_size = 20
        num_chunks = (len(messages_list) + chunk_size - 1) // chunk_size
        
        for i in range(num_chunks):
            start_idx = i * chunk_size
            end_idx = min(start_idx + chunk_size, len(messages_list))
            
            # Find facts within this chunk
            chunk_facts = []
            for mapping in turn_mappings:
                if start_idx <= mapping["start"] < end_idx:
                    chunk_facts.extend(mapping["facts"])
            
            # Construct a high-quality synthetic summary block
            entities_lines = []
            decisions_lines = []
            
            for fact in chunk_facts:
                ans = fact["expected_answer"]
                q = fact["question"]
                
                # Format entity/decision
                if "database" in q.lower() and "pool" not in q.lower() and "test" not in q.lower():
                    entities_lines.append(f"- `{ans}` (database)")
                    decisions_lines.append(f"- Use `{ans}` as the final database.")
                elif "table" in q.lower():
                    entities_lines.append(f"- `{ans}` (table)")
                    decisions_lines.append(f"- Set table name to `{ans}`.")
                elif "pool" in q.lower():
                    decisions_lines.append(f"- Database connection pool size is `{ans}`.")
                elif "limit" in q.lower():
                    decisions_lines.append(f"- Query row limit is set to `{ans}`.")
                elif "index" in q.lower():
                    entities_lines.append(f"- `{ans}` (index)")
                    decisions_lines.append(f"- Created settings index `{ans}`.")
                elif "authentication" in q.lower() or "auth" in q.lower():
                    entities_lines.append(f"- `{ans}` (auth)")
                    decisions_lines.append(f"- API authentication uses `{ans}`.")
                elif "prefix" in q.lower():
                    decisions_lines.append(f"- API base route prefix is `{ans}`.")
                elif "endpoint" in q.lower():
                    entities_lines.append(f"- `{ans}` (endpoint)")
                    decisions_lines.append(f"- Set refund endpoint to `{ans}`.")
                elif "field" in q.lower():
                    decisions_lines.append(f"- Refund payload field key is `{ans}`.")
                elif "rate limited" in q.lower():
                    decisions_lines.append(f"- Rate limiting response is `{ans}`.")
                elif "idempotency" in q.lower():
                    entities_lines.append(f"- `{ans}` (header)")
                    decisions_lines.append(f"- Idempotency header key is `{ans}`.")
                elif "compression" in q.lower():
                    decisions_lines.append(f"- Payloads compressed using `{ans}`.")
                elif "runner" in q.lower():
                    entities_lines.append(f"- `{ans}` (runner)")
                    decisions_lines.append(f"- Test runner is `{ans}`.")
                elif "marker" in q.lower():
                    decisions_lines.append(f"- Smoke tests marked with `{ans}`.")
                elif "coverage" in q.lower():
                    decisions_lines.append(f"- Code coverage target is `{ans}`.")
                elif "test" in q.lower() and "database" in q.lower():
                    entities_lines.append(f"- `{ans}` (test database)")
                elif "mock" in q.lower():
                    decisions_lines.append(f"- Mock HTTP responses using `{ans}` library.")
                elif "stored" in q.lower() and "tokens" in q.lower():
                    decisions_lines.append(f"- Tokens are saved in `{ans}`.")
                elif "logging" in q.lower() or "log" in q.lower():
                    decisions_lines.append(f"- Log security masking rule: `{ans}`.")
                elif "cors" in q.lower():
                    decisions_lines.append(f"- CORS origin approved for production is `{ans}`.")
                elif "hash" in q.lower():
                    decisions_lines.append(f"- Passwords are encrypted with `{ans}` hashing.")
                elif "authority" in q.lower() or "ssl" in q.lower():
                    entities_lines.append(f"- `{ans}` (SSL provider)")
                elif "framework" in q.lower() and "tool" in q.lower():
                    entities_lines.append(f"- `{ans}` (UI setup)")
                elif "css" in q.lower():
                    decisions_lines.append(f"- CSS styling approach is `{ans}`.")
                elif "component" in q.lower():
                    entities_lines.append(f"- `{ans}` (password component)")
                elif "state" in q.lower():
                    decisions_lines.append(f"- React global state managed by `{ans}`.")
                elif "package manager" in q.lower():
                    decisions_lines.append(f"- JS package manager is `{ans}`.")
                elif "runtime" in q.lower():
                    entities_lines.append(f"- `{ans}` (node version)")
                elif "docker" in q.lower():
                    entities_lines.append(f"- `{ans}` (docker base)")
                elif "memory" in q.lower() or "node_options" in q.lower() or "max-old-space-size" in q.lower():
                    decisions_lines.append(f"- Memory limit configuration is `{ans}`.")
                elif "port" in q.lower():
                    decisions_lines.append(f"- Backend runs on port `{ans}`.")
                elif "logger" in q.lower() or "format" in q.lower():
                    decisions_lines.append(f"- Logger outputs logs in `{ans}` formatting.")
                elif "vector" in q.lower() and "vamp" in q.lower():
                    entities_lines.append(f"- `{ans}` (vector db)")
                elif "source-of-truth" in q.lower():
                    entities_lines.append(f"- `{ans}` (source of truth)")
                elif "budget" in q.lower():
                    decisions_lines.append(f"- VAMP budget is `{ans}` characters.")
                elif "formula" in q.lower():
                    decisions_lines.append(f"- Adaptive top-k formula is `{ans}`.")
                else:
                    decisions_lines.append(f"- Resolved detail: `{ans}` for {q}.")
            
            summary_text_parts = [f"[Messages {start_idx + 1}-{end_idx}]"]
            if entities_lines:
                summary_text_parts.append("## Entities & Values\n" + "\n".join(entities_lines))
            if decisions_lines:
                summary_text_parts.append("## Decisions & Context\n" + "\n".join(decisions_lines))
            
            summary_text = "\n\n".join(summary_text_parts)
            
            memory_bullets = []
            for b_idx, fact in enumerate(chunk_facts):
                ans = fact["expected_answer"]
                q = fact["question"]
                memory_bullets.append({
                    "bullet_id": f"b_{i}_{b_idx}",
                    "bullet_index": b_idx,
                    "text": f"Resolved detail: {ans} for {q}",
                    "type": "other"
                })

            print(f"Storing synthetic block {i} (messages {start_idx + 1} to {end_idx})...")
            await vamp_service.store_summary_block(
                args.conversation_id,
                args.user_id,
                text=summary_text,
                start_message_idx=start_idx,
                end_message_idx=end_idx - 1,
                memory_bullets=memory_bullets,
            )
        print("Synthetic summaries generation complete.")
        
    else:
        print("\n=== NEXT STEPS FOR SUMMARIZATION ===")
        print("To run the VAMP summarization flow using the real LLM, run:")
        print(f"  env/bin/python scripts/seed_vamp_hard_conversation.py --summarize")
        print("\nOr to write synthetic summaries directly to Firestore and index them in Qdrant offline:")
        print(f"  env/bin/python scripts/seed_vamp_hard_conversation.py --direct-summary-blocks")

if __name__ == "__main__":
    asyncio.run(main())
