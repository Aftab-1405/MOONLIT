# Moonlit

> **Web-based Agentic AI Platform** for autonomous database operations on local and remote relational databases.

![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Flask](https://img.shields.io/badge/Flask-2.2+-green?logo=flask&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Overview

Moonlit is an **agentic AI platform** that empowers database engineers to work with relational databases through natural language. Unlike simple chatbots, Moonlit operates as an **autonomous agent** that:

1. **Reasons** about your request and database context
2. **Plans** multi-step workflows to accomplish complex tasks
3. **Executes** tool calls (schema introspection, query execution, constraint analysis)
4. **Iterates** based on results until the task is complete

### What Makes It Agentic?

| Traditional Assistant | Moonlit Agent |
|----------------------|----------------|
| Single-turn responses | Multi-turn reasoning loops |
| User drives every step | Agent autonomously orchestrates tools |
| Static prompt/response | Dynamic tool selection based on context |
| Manual SQL writing | Agent writes, validates, executes SQL |

### Capabilities

- **Autonomous Query Generation** — Describe what you need; agent figures out the SQL
- **Schema Discovery** — Agent explores tables, columns, relationships, constraints
- **Multi-Database Support** — PostgreSQL, MySQL, SQLite, Oracle, SQL Server (local & remote)
- **Result Visualization** — Charts, diagrams, and formatted tables
- **Conversation History** — Chat threads stored in Firestore, accessible across sessions

### How It Works

The agent orchestrates multi-turn LLM ↔ Tool interactions until the task is complete:

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant FE as Frontend
    participant API as Flask API
    participant LLM as Cerebras LLM
    participant Tools as AI Tools
    participant DB as Database

    U->>FE: "Show me top 5% customers by avg orders"
    FE->>API: POST /api/chat (message + history)
    API->>LLM: System prompt + user message + tool definitions
    
    Note over LLM: Reasoning: Need schema first
    LLM->>API: tool_call: get_connection_status
    API->>Tools: Execute get_connection_status
    Tools-->>API: {connected: true, db: "ecommerce", type: "postgresql"}
    API-->>FE: [[TOOL:get_connection_status:done:...]]
    API->>LLM: Tool result → context
    
    Note over LLM: Reasoning: Need table structure
    LLM->>API: tool_call: get_table_schema(customers)
    API->>Tools: Execute get_table_schema
    Tools->>DB: Query information_schema
    DB-->>Tools: Column definitions
    Tools-->>API: {columns: [customer_id, name, ...]}
    API-->>FE: [[TOOL:get_table_schema:done:...]]
    API->>LLM: Tool result → context
    
    Note over LLM: Reasoning: Build SQL with NTILE()
    LLM->>API: tool_call: execute_query(SQL)
    API->>Tools: Execute query
    Tools->>DB: SELECT with NTILE(20)...
    DB-->>Tools: Result rows
    Tools-->>API: {data: [...], row_count: 50}
    API-->>FE: [[TOOL:execute_query:done:...]]
    API->>LLM: Tool result (preview only)
    
    Note over LLM: All data gathered, generate response
    LLM-->>API: Stream final response
    API-->>FE: Stream chunks + [[THINKING:...]]
    FE-->>U: Formatted response + data table + chart option
```

**Example Flow:**
1. User asks for "top 5% customers by average orders"
2. Agent checks connection → confirms PostgreSQL/ecommerce
3. Agent inspects `customers` and `orders` tables for schema
4. Agent crafts SQL using `NTILE(20)` for percentile calculation
5. Agent executes query → returns top performers
6. Agent streams natural language summary
7. Frontend renders table + optional chart visualization

---

## Architecture

```
moonlit/
├── back-end/               # Flask API server
│   ├── api/                # REST routes and request schemas
│   ├── auth/               # Firebase authentication
│   ├── database/           # Connection management & adapters
│   │   └── adapters/       # DBMS-specific adapters
│   ├── services/           # Business logic (LLM, AI tools, Firestore)
│   ├── app.py              # Application factory
│   └── config.py           # Environment-based configuration
│
└── front-end/              # React SPA (Vite)
    └── src/
        ├── components/     # UI components (Sidebar, ChatInput, etc.)
        ├── contexts/       # React contexts (Auth, Database, Settings)
        ├── pages/          # Route pages (Chat, Auth, Landing)
        └── hooks/          # Custom React hooks
```

---

## Features

### Backend
| Feature | Description |
|---------|-------------|
| **Multi-Database Support** | PostgreSQL, MySQL, SQLite, Oracle, SQL Server via adapter pattern |
| **Connection Pooling** | Thread-safe singleton manager with automatic cleanup |
| **LLM Integration** | Cerebras SDK with reasoning models and function calling |
| **AI Tools** | Schema introspection, query execution, constraint analysis |
| **Authentication** | Firebase Admin SDK with ID token verification |
| **Session Storage** | Redis (Upstash) for production, in-memory for development |
| **Rate Limiting** | Configurable via Flask-Limiter |
| **Query Security** | Read-only guard, result limits, timeout protection |

### Frontend
| Feature | Description |
|---------|-------------|
| **Material UI** | Modern component library with custom theming |
| **Monaco Editor** | Full-featured SQL editor with syntax highlighting |
| **Markdown Rendering** | AI responses with code blocks, tables, mermaid diagrams |
| **Chart Visualization** | Chart.js integration for data visualization |
| **Conversation History** | Persistent chat threads with Firestore |
| **Starfield Animation** | Ambient background effect when user is idle |
| **Connection Persistence** | Configurable auto-disconnect on tab close |
| **Dark/Light Themes** | User-selectable appearance modes |

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **Redis** (optional, for production sessions)
- **Firebase Project** (for authentication)
- **Cerebras API Key** (for LLM)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd moonlit
```

### 2. Backend Setup

```bash
cd back-end

# Install dependencies
pip install pipenv
pipenv install

# Configure environment
cp .env.example .env  # Create from template or manually

# Run development server
pipenv run python app.py
```

### 3. Frontend Setup

```bash
cd front-end

# Install dependencies
npm install

# Run development server
npm run dev
```

### 4. Access Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

---

## Configuration

### Backend Environment Variables

Create a `.env` file in `back-end/`:

```env
# Application
FLASK_ENV=development
SECRET_KEY=your-secure-secret-key

# LLM (Cerebras)
LLM_API_KEY=your-cerebras-api-key
LLM_MODEL=gpt-oss-120b

# Firebase Admin SDK
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# Firebase Web SDK
FIREBASE_WEB_API_KEY=your-web-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_WEB_PROJECT_ID=your-project-id

# Optional
CORS_ORIGINS=http://localhost:5173
UPSTASH_REDIS_URL=redis://your-redis-url
RATELIMIT_ENABLED=true
RATELIMIT_DEFAULT=200 per day, 50 per hour
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth` | Clear session |
| POST | `/set_session` | Verify Firebase token, create session |
| GET | `/check_session` | Check session status |
| POST | `/logout` | Clear user session |
| GET | `/firebase-config` | Get Firebase web config |

### Database Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/connect` | Connect to database |
| POST | `/api/disconnect` | Disconnect from database |
| GET | `/api/db-status` | Get connection status |
| GET | `/api/heartbeat` | Health check for connection |
| GET | `/api/databases` | List available databases |
| POST | `/api/switch-database` | Switch to different database |

### Schema & Tables
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schemas` | List PostgreSQL schemas |
| POST | `/api/select-schema` | Select a schema |
| GET | `/api/tables` | List tables in database |
| POST | `/api/table-schema` | Get table structure |

### Chat & Queries
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message to AI (streaming) |
| GET | `/api/conversations` | Get user's conversations |
| GET | `/api/conversation/<id>` | Get specific conversation |
| POST | `/api/new-conversation` | Create new conversation |
| DELETE | `/api/conversation/<id>` | Delete conversation |
| POST | `/api/run-sql` | Execute SQL query |

---

## AI Tools

The LLM can invoke these tools during conversations:

| Tool | Description |
|------|-------------|
| `get_connection_status` | Check database connection state |
| `get_database_list` | List available databases |
| `get_database_schema` | Get tables and columns |
| `get_table_schema` | Get detailed table structure |
| `execute_query` | Run SELECT queries safely |
| `get_recent_queries` | User's query history |
| `get_table_indexes` | Table index information |
| `get_table_constraints` | PRIMARY/FOREIGN/UNIQUE/CHECK constraints |
| `get_foreign_keys` | Foreign key relationships |

---

## Development

### Backend

```bash
cd back-end

# Run with hot reload
pipenv run python app.py

# Lint code
pipenv run ruff check .
```

### Frontend

```bash
cd front-end

# Development server
npm run dev

# Lint code
npm run lint

# Production build
npm run build
```

---

## Production Deployment

### Backend (Gunicorn)

```bash
cd back-end
pipenv run gunicorn app:app --bind 0.0.0.0:5000 --workers 4
```

### Frontend (Vite Build)

```bash
cd front-end
npm run build
# Deploy dist/ to static hosting (Vercel, Netlify, etc.)
```

### Environment Requirements

- Set `FLASK_ENV=production`
- Use strong `SECRET_KEY` (32+ characters)
- Configure `CORS_ORIGINS` explicitly
- Enable `RATELIMIT_ENABLED=true`
- Set `UPSTASH_REDIS_URL` for session storage

---

## Security

- **Read-only Query Guard**: Only SELECT statements allowed (AI & users); future RBAC planned
- **Query Timeout**: Configurable execution limits
- **Result Limits**: Prevents excessive data retrieval
- **Firebase Token Verification**: Cryptographic auth validation
- **Rate Limiting**: Protects against abuse
- **CORS**: Explicit origin allowlist in production

---

## Tech Stack

### Backend
- **Framework**: Flask 2.3.3
- **LLM SDK**: Cerebras Cloud SDK 1.59.0
- **Auth**: Firebase Admin SDK 6.9.0
- **Databases**: psycopg2-binary, mysql-connector-python, sqlite3, oracledb, pyodbc
- **Session**: Flask-Session 0.8.0 + Redis
- **Rate Limiting**: Flask-Limiter 3.12
- **WSGI Server**: Gunicorn 20.1.0

### Frontend
- **Build Tool**: Vite 7
- **Framework**: React 19
- **UI Library**: Material UI 7
- **Editor**: Monaco Editor
- **Diagrams**: Mermaid
- **Charts**: Chart.js
- **Auth**: Firebase SDK
- **Markdown**: react-markdown + remark-gfm

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Acknowledgments

- [Cerebras](https://cerebras.ai/) for LLM inference
- [Flask](https://flask.palletsprojects.com/) for backend framework
- [Firebase](https://firebase.google.com/) for authentication & Firestore
- [Upstash](https://upstash.com/) for serverless Redis session storage
- [Material UI](https://mui.com/) for React components
