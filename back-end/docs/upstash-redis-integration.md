# Upstash Redis Integration

Documentation for Upstash Redis usage in DB Genie backend.

## Overview

Upstash is a serverless Redis provider used for persistent session storage that survives server restarts and supports horizontal scaling.

## Connection Configuration

```env
# .env file
UPSTASH_REDIS_URL=redis://default:PASSWORD@HOST:6379
```

**Note:** The backend automatically converts `redis://` to `rediss://` for TLS encryption (required by Upstash).

---

## Use Case: Flask Session Storage

**Location:** `app.py`

**Purpose:** Store user sessions persistently instead of in-memory.

**How it works:**
```python
from flask_session import Session
import redis

app.config['SESSION_TYPE'] = 'redis'
app.config['SESSION_REDIS'] = redis.from_url(redis_url)
Session(app)
```

**Key Format:**
```
session:<session_id>  →  MessagePack encoded session data
```

**Session Data Structure:**
```json
{
  "_permanent": true,
  "user": {
    "uid": "Mx0s5HR2P...",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://...",
    "verified": true
  },
  "conversation_id": "uuid-..."
}
```

**Why Redis for Sessions:**
- Sessions must persist across server restarts
- Multiple server instances must share session state
- Prevents "all users logged out" on every deploy

---

## What About Query Result Cache?

**REMOVED** - We previously had a query result cache but removed it for simplicity.

### Why We Removed It

| Factor | With Cache | Without Cache (Current) |
|--------|------------|------------------------|
| Architecture | Complex (extra API call) | Simple (embedded in stream) |
| Cost at scale | Expensive (Upstash bandwidth) | Free |
| API calls | 2 per query | 1 per query |
| Code complexity | Higher | Lower |

### Current Flow (Embedded Data)

```
1. LLM runs execute_query tool
2. Backend returns:
   - preview: 5 rows → for LLM context (token-efficient)
   - data: all rows → for frontend SQL Editor
3. Frontend parses full data directly from tool result
4. No extra API call needed
```

### Why This Works

- LLM only sees `preview` (via result_summary in llm_service.py)
- Full `data` is embedded in the streamed tool marker
- Frontend parses `data` directly from the stream
- No cache, no extra fetch, simpler architecture

---

## Fallback Behavior

If Redis is unavailable:

| Scenario | Behavior |
|----------|----------|
| `UPSTASH_REDIS_URL` not set | Uses in-memory sessions (warning logged) |
| Redis connection fails | Falls back to in-memory |

---

## Monitoring

### View Keys in Upstash Console

1. Go to [console.upstash.com](https://console.upstash.com)
2. Select your database
3. Go to **Data Browser**
4. Filter by prefix: `session:*`

---

## Cost Estimation

| Tier | Commands/Day | Cost |
|------|--------------|------|
| Free | 10,000 | $0 |
| Pay-as-you-go | 100,000+ | ~$0.2 per 100K |

Session usage is minimal:
- Login: 1 write
- Each API call: 1 read

---

## Files Modified for Upstash Integration

| File | Change |
|------|--------|
| `app.py` | Flask-Session with Redis backend |
| `services/context_service.py` | `_normalize_user_id()` helper for new auth format |
| `.env` | `UPSTASH_REDIS_URL` variable |
| `Pipfile` | Added `flask-session`, `redis` dependencies |

---

## Removed Files/Code

| File | What Was Removed |
|------|------------------|
| `services/result_cache.py` | **DEPRECATED** - Still exists but unused |
| `api/routes.py` | Removed `/query-result/<id>` endpoint |
| `vite.config.js` | Removed `/query-result` proxy |
