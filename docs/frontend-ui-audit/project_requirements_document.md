# Moonlit Project Requirements

## Purpose and Evidence

This document records product requirements supported by the repository as of 2026-08-15. It
does not replace product specifications or the canonical frontend design specification. Product
claims are grounded in `README.md`, `back-end/README.md`, routes, frontend components, API
clients, and backend controllers.

## Product Overview

### CONFIRMED

Moonlit is a web application for interacting with relational databases through a streaming,
tool-using AI agent. A user authenticates, connects a supported remote database, asks questions
in natural language, observes agent/tool progress, and can inspect query results or generated
artifacts.

### IMPLEMENTED

- React 19 single-page frontend built with Vite and Material UI.
- FastAPI backend with authenticated REST and streaming conversation endpoints.
- Firebase authentication and Firestore-backed conversation persistence.
- LangGraph orchestration with streaming text, tool activity, pauses, and resumable work.
- PostgreSQL, MySQL, SQL Server, and Oracle connection workflows.
- Conversation history, rename/delete actions, model selection, schema context, SQL workspace,
  query tables, visualizations, and diagram artifacts.

### PARTIALLY IMPLEMENTED

- The frontend has centralized semantic tokens and MUI overrides, but some components bypass
  those roles with one-off geometry, spacing, and typography.
- The current theme system supports light and dark modes, but the authoritative `DESIGN.md`
  defines a dark-only product. Light mode is therefore implemented behavior that is outside the
  current approved design contract.
- Automated checks cover linting, production compilation, token contrast, interaction
  invariants, and one landing-content test. Chat component and end-to-end coverage is limited.

### INFERRED

- The primary target users are developers, analysts, and data-oriented teams that need database
  answers without writing every query manually.
- The chat workspace is the primary authenticated product journey because it orchestrates
  database context, model selection, agent streaming, history, and artifacts.

### PROPOSED

- Bring the existing frontend into exact compliance with `front-end/DESIGN.md` through the
  incremental phases in `phases.md`.
- Treat a future light theme as a separate design-system project requiring an approved update to
  the canonical design specification before implementation.

### UNKNOWN

- Supported browser/version matrix.
- Formal performance budgets and service-level objectives.
- Whether every backend-supported LLM provider is intended for all deployments.
- Whether product analytics, telemetry, or formal usability targets are planned.

## Problem Being Solved

Working with relational data normally requires SQL fluency, schema knowledge, and database-
specific syntax. Moonlit reduces that friction by letting an authenticated user express a goal,
then exposing the agent's reasoning/tool progress and results through a persistent conversation.

## Target Users and Roles

### CONFIRMED

- Authenticated user: uses chat, database connections, settings, history, and artifacts.
- Administrator: accesses the guarded administration route.

### INFERRED

- Developers who need quick schema and query assistance.
- Analysts or operators who understand desired data but may not know the exact SQL.

## Main User Journeys

1. Visit the landing page and continue to authentication.
2. Sign in or create an account through Firebase-backed authentication.
3. Open a new or existing conversation.
4. Optionally connect or switch a remote database and schema.
5. Select an available model and submit a natural-language request.
6. Observe streaming text, thinking/tool steps, query results, pauses, or failures.
7. Open SQL, visualization, or diagram artifacts in the workspace panel.
8. Resume, search, rename, or delete conversation history.
9. Adjust supported user settings or sign out.

## Functional Requirements

### CONFIRMED AND IMPLEMENTED

- Protect `/chat`, `/chat/:conversationId`, and `/admin` according to authentication/role.
- Persist and retrieve conversations through authenticated APIs.
- Stream agent responses and tool events without buffering the full response.
- Support loading, success, empty, paused, streaming, and error representations.
- Render Markdown, fenced code, tables, and recognized diagram artifacts.
- Keep the chat transcript and workspace panels independently scrollable.
- Provide accessible names for primary controls and status regions.
- Adapt the application shell for narrow viewports and touch targets.

## Non-Functional Requirements

### CONFIRMED

- Preserve backend behavior during the frontend design-compliance project.
- Keep external input and API failures safely handled.
- Maintain authenticated and authorized route boundaries.
- Respect reduced-motion preferences and keyboard focus visibility.
- Use the existing dependency stack; do not introduce a parallel styling system.
- Keep UI changes minimal, testable, and isolated by phase.

## Frontend/Backend Interaction

- The frontend uses a centralized `fetch` wrapper with cookie credentials and CSRF headers for
  mutating requests.
- Conversation prompts and resumes return raw streaming responses processed by chat hooks.
- Standard JSON endpoints provide authentication state, conversations, database state, schema
  information, user settings, model options, query results, and quotas.
- The frontend remains responsible for presentation state; the backend remains authoritative for
  authentication, authorization, database safety, persistence, and agent execution.

## Constraints

- `front-end/DESIGN.md` is authoritative and immutable for this project.
- The design is currently dark-canvas only.
- Universal Sans is proprietary; the approved implementation uses Inter as the documented open-
  source substitute and Geist Mono for technical labels.
- Existing user-owned staged changes must be preserved.
- Authenticated browser verification requires a usable local signed-in session.

## Assumptions

- Existing routes and user workflows should remain behaviorally stable unless a verified defect is
  separately approved for correction.
- Current staged changes represent the user's intended working state and must not be reverted.
- The repository's installed dependencies and scripts are the validation baseline for this work.
- A design requirement applies across authenticated and public surfaces unless `DESIGN.md`
  explicitly limits it to a particular context.

## Known Gaps

- Current light-mode functionality conflicts with the canonical design specification.
- Some chat controls use non-canonical radii and interaction chrome.
- The chat composer uses an undocumented surface value.
- The empty-chat heading uses a custom typography scale outside the documented ladder.
- The primary shell breakpoint differs from the 768px design breakpoint.
- Chat-specific automated tests are sparse.

## Open Questions

- When a light theme is revisited, what canonical palette, surfaces, code theme, and component
  states should be added to `DESIGN.md`?
- What local authentication fixture or test account should be used for repeatable visual and
  end-to-end chat verification?
