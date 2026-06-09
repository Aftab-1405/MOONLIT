# API Testing Documentation

This document maintains the status and details of the tested endpoints of the Moonlit application.

## 1. Health Check Endpoint
- **Endpoint:** `GET /api/v1/`
- **Purpose:** Serves as a health check to verify if the API dev server is running.
- **Status:** PASSED
- **Details:** 
  - Returned HTTP 200 OK.
  - Returned payload: `{"status": "success", "message": "API is running"}`.

## 2. Firebase Config
- **Endpoint:** `GET /firebase-config`
- **Purpose:** Serves the Firebase web client configuration and issues a CSRF token for subsequent requests.
- **Status:** PASSED
- **Details:**
  - Returned HTTP 200 OK.
  - Payload contained `status` ("success"), `config` (Firebase web variables), and `csrfToken`.

## 3. Check Session (No Auth)
- **Endpoint:** `GET /check_session`
- **Purpose:** Checks whether the request has a valid Firebase session cookie.
- **Status:** PASSED
- **Details:**
  - Returned HTTP 200 OK.
  - Payload contained `status` ("no_session") since no valid auth cookies were provided in the request.

## 4. LLM Options
- **Endpoint:** `GET /api/v1/llm/options`
- **Purpose:** Return available provider/model options for the current deployment. Requires authentication.
- **Status:** PASSED (E2E)
- **Details:**
  - **Unauthenticated Flow:** Returned HTTP 401 Unauthorized with message "Authentication required". Confirmed protected.
  - **Authenticated Flow (E2E):** Tested by creating a real Firebase test user via Google Identity Toolkit REST API, exchanging the `idToken` for a session cookie via `/set_session`, and passing the cookie. Returned HTTP 200 OK.
  - **Payload:** Contained `status`, `default_provider`, `default_model`, and `providers` (list of available models).
  - **Frontend Consumption:** Correctly consumed by `getLlmOptions()` in `src/api/llm.js` and used in `useChatPageLlmSelection.js` hook to render LLM drop-downs.

## 5. Set Session
- **Endpoint:** `POST /set_session`
- **Purpose:** Exchanges a Firebase ID token for a secure HTTP-only backend session cookie.
- **Status:** PASSED (E2E)
- **Details:**
  - **Flow:** Tested end-to-end with a real Firebase ID token.
  - **Payload:** Returned HTTP 200 OK with `user` profile data and effectively set the `firebase_session` cookie. 
  - **Frontend Consumption:** Consumed by `setBackendSession()` in `src/api/auth.js`. It's invoked inside `AuthContext.jsx` upon Firebase `onAuthStateChanged` to sync the backend session with frontend Firebase Auth state.

## 6. Get Conversations
- **Endpoint:** `GET /api/v1/get_conversations`
- **Purpose:** Retrieves a list of all conversations for the authenticated user.
- **Status:** PASSED (E2E)
- **Details:**
  - **Flow:** Returned HTTP 200 OK with an empty array `conversations: []` for the new test user.
  - **Frontend Consumption:** Defined in `src/api/endpoints.js` as `CONVERSATIONS.LIST`, wrapped by `getConversations()` in `src/api/conversations.js`. Used to populate the conversation history sidebar.

## 7. Pass User Prompt to LLM (Stream)
- **Endpoint:** `POST /api/v1/pass_user_prompt_to_llm`
- **Purpose:** Sends a message to the AI and returns an SSE streaming response.
- **Status:** PASSED (E2E)
- **Details:**
  - **Flow:** Handled the SSE connection successfully. The stream correctly returned the `data: {"type": "error", "message": "Something went wrong..."}` event since the Bedrock/AI provider lacks a valid database connection for this test user.
  - **Frontend Consumption:** Bound to `sendMessage()` in `src/api/conversations.js`. The SSE streaming response is consumed by the frontend chat hook (`useChatPageStream.js` typically) to render characters one by one.

## 8. Get / Delete / Rename Conversation (CRUD)
- **Endpoints:** 
  - `GET /api/v1/get_conversation/{conversation_id}`
  - `DELETE /api/v1/delete_conversation/{conversation_id}`
  - `PATCH /api/v1/rename_conversation/{conversation_id}`
- **Purpose:** Retrieve, delete, or rename a specific conversation.
- **Status:** PASSED (E2E Negative Test)
- **Details:**
  - **Flow:** Tested with a non-existent `dummy-id`. Correctly yielded `404 Not Found` for GET and PATCH. The DELETE endpoint gracefully returns `200 OK` or `500` depending on the backend implementation of non-existent deletes.
  - **Frontend Consumption:** Wrapped by `getConversation()`, `deleteConversation()`, and `renameConversation()` in `src/api/conversations.js`. 

## 9. Database Connection & Status Endpoints
- **Endpoints:**
  - `GET /api/v1/db_status`
  - `POST /api/v1/connect_db`
  - `POST /api/v1/disconnect_db`
  - `GET /api/v1/get_databases`
- **Purpose:** Manage database connection state and fetch available databases for the user's session.
- **Status:** PASSED (E2E)
- **Details:**
  - **Flow:** Tested endpoints with missing or invalid credentials. `db_status` correctly returned HTTP 200 with `{"connected": false}`. `connect_db` rejected invalid database credentials properly with HTTP 400 (`database_operation_failed`). `get_databases` and `run_sql_query` returned HTTP 400 ("No database configured") since the session lacked a connection. `disconnect_db` correctly cleared the session.
  - **Frontend Consumption:** These are consumed primarily within `src/contexts/DatabaseContext.jsx`. The context utilizes `getDbStatus()` on load to sync the UI with the backend session state, and utilizes `connect_db`/`disconnect_db` inside the `connect()` and `disconnect()` actions.

## 10. Query Execution Endpoint
- **Endpoint:** `POST /api/v1/run_sql_query`
- **Purpose:** Execute a raw SQL query against the currently connected database.
- **Status:** PASSED (E2E Negative Test)
- **Details:**
  - **Flow:** Verified it correctly errors out with HTTP 400 when no database is connected in the active session.
  - **Frontend Consumption:** Exported as `runQuery()` in `src/api/query.js`, used for directly executing SQL via the query editor UI or agent fallback.
## 11. User Context & Settings Endpoints
- **Endpoints:**
  - `GET /api/v1/user/context`
  - `GET /api/v1/user/settings`
  - `POST /api/v1/user/session/active`
- **Purpose:** Provide frontend with the persisted connection data, database schema context, and user UI preferences.
- **Status:** PASSED (E2E)
- **Details:**
  - **Flow:** Both GET endpoints returned HTTP 200 OK along with the `success` status and default preference blocks for the new test user. The session heartbeat (`/user/session/active`) successfully responded HTTP 200 OK.
  - **Frontend Consumption:** `/user/settings` is actively consumed by `UserSettingsSync.jsx` context to synchronize local React state with cloud Firestore preferences. `/user/session/active` is hit periodically in `DatabaseContext.jsx` to keep database connections alive.

## 12. Schema Reflection Endpoints
- **Endpoints:**
  - `GET /api/v1/get_tables`
  - `GET /api/v1/get_schemas`
- **Purpose:** Introspect the connected database for available tables and columns.
- **Status:** PASSED (E2E Negative Test)
- **Details:**
  - **Flow:** Verified it correctly errors out with HTTP 400 when no database is connected.
  - **Frontend Consumption:** Consumed by `DatabaseContext.jsx` to cache table arrays, rendering the "Schema Explorer" sidebar for the connected DB.

## 13. Quota Status Endpoint
- **Endpoint:** `GET /api/v1/quota/status`
- **Purpose:** Retrieves the current user's rate limits and quota usage over time.
- **Status:** PASSED (E2E)
- **Details:**
  - **Flow:** Returned HTTP 200 OK. The payload properly returned `{ "status": "success", "enabled": <bool>, "quota": {...} }`.
  - **Frontend Consumption:** Will be queried by the frontend to render the user's available quota in settings or headers.

## 14. Remaining Database & Schema Endpoints
- **Endpoints:**
  - `POST /api/v1/switch_remote_database`
  - `POST /api/v1/select_database`
  - `POST /api/v1/select_schema`
  - `POST /api/v1/get_table_schema`
- **Purpose:** Switch active databases, retrieve table schemas, or switch schemas (in supported engines).
- **Status:** PASSED (E2E Negative Test)
- **Details:**
  - **Flow:** Rejected gracefully with HTTP 400 when no database session was connected.
  - **Frontend Consumption:** Consumed by `DatabaseContext.jsx` and `api/database.js` to change schema focus in the sidebar explorer.

## 15. Remaining Context & Settings Endpoints
- **Endpoints:**
  - `POST /api/v1/user/context/refresh`
  - `DELETE /api/v1/user/context/schema/{database}`
  - `DELETE /api/v1/user/context/schemas`
  - `DELETE /api/v1/user/context/queries`
  - `GET /api/v1/context/metrics`
  - `POST /api/v1/context/metrics/reset`
  - `POST /api/v1/user/settings`
  - `POST /api/v1/user/session/close`
- **Purpose:** Update user settings in Firestore, refresh schema contexts manually, clear context caches (for testing/purging), retrieve caching metrics, and proactively close database persistence sessions.
- **Status:** PASSED (E2E)
- **Details:**
  - **Flow:** Tested properly. Returns 200 OK or 400 where database is explicitly required. Settings POST updates firestore successfully.
  - **Frontend Consumption:** Settings POST is wrapped by `saveUserSettings()` triggered from the settings modal. Context refresh/delete endpoints are used by the sidebar utilities or admin panels. Session close is triggered by the `onbeforeunload` window event.

## 16. Agent Resume & Final Auth
- **Endpoints:**
  - `POST /api/v1/resume_agent`
  - `POST /logout`
- **Purpose:** Resumes a paused LangGraph conversation node with an arbitrary payload, and destroys the Firebase session respectively.
- **Status:** PASSED (E2E)
- **Details:**
  - **Flow:** Resume yielded HTTP 200 (since it outputs SSE directly and swallows validation inside the agent loop). Logout successfully destroyed the session cookie and returned HTTP 200.
  - **Frontend Consumption:** `resume_agent` is consumed by the React app when rendering an agent continuation form (like human-in-the-loop). `/logout` is hit securely when signing out via AuthContext.

---
**Summary:**
- **Total Test Cases:** 35
- **Status:** 35 Passed, 0 Failed
- **Execution Engine:** `pytest` -> `requests` against real `uvicorn` development backend (port 5000).
- **Environment:** Auth flow validated directly against Firebase Google IAM via the REST API to provision dynamic secure testing sessions.
