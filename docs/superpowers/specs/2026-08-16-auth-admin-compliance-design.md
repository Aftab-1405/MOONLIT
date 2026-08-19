# Authentication and Administration Compliance Design

Date: 2026-08-16
Status: Implemented — 2026-08-17

## Goal

Bring account entry, auth loading/error states, guards, and the administration dashboard into the
canonical dark UI system without changing Firebase sign-in semantics or weakening authorization.

## Current Architecture

- `AuthContext` owns Firebase initialization, provider/email authentication, backend-session
  establishment, password reset, logout, normalized user state, and user-facing auth errors.
- `Auth.jsx` owns sign-in/sign-up/reset form state and redirects authenticated users to `/chat`.
- `ProtectedRoute` requires an authenticated user. `AdminRoute` additionally compares the current
  UID to the client-exposed `VITE_ADMIN_UID`.
- `AdminDashboard` reads `/api/v1/context/metrics`, opens an authenticated metrics event stream,
  and performs a read-only API health check.
- `PageLoader` is the shared named, reduced-motion-safe route loader.

## Verified Findings

### Account entry

- The auth card, neutral fields, labels, validation text, provider icons, and responsive one/two
  column provider layout broadly match the design.
- The initial auth-loading branch duplicates a bare spinner instead of using `PageLoader`.
- Email submission disables only the submit button. Provider buttons and mode switches can still
  start overlapping auth actions, and provider operations have no visible busy state.
- The password-reset dialog duplicates dialog/action geometry instead of using the shared Phase 3
  dialog primitives. Its success/error path should retain the existing Firebase behavior.
- The existing “Remember me” checkbox has no state or persistence effect. Firebase persistence is
  not controlled by it, so the control currently promises behavior it does not implement.

### Guards and authorization

- The dummy account is authenticated but not an administrator; `/admin` correctly redirects to
  `/chat` after auth initialization. The admin dashboard therefore has no safe live browser fixture.
- `ProtectedRoute` and `AdminRoute` correctly wait for auth initialization through `PageLoader`.
- Client-side `AdminRoute` is navigation UX, not authoritative authorization.
- The backend metrics, stream, and reset endpoints require authentication but do not require an
  administrator/operator role. The repository's existing security audit already records that the
  payload includes shared Redis/infrastructure telemetry ordinary users should not receive.

## Implemented Design

### Phase 4A — account entry and guards

- Reuse `PageLoader` for auth initialization.
- Introduce one explicit auth-operation state (`email`, `google`, `github`, or `reset`) so all
  conflicting actions are disabled during a request and the initiating action has named progress.
- Keep client validation immediate and Firebase/backend validation authoritative.
- Move reset-password chrome onto the shared dialog/action geometry, preserving deterministic focus,
  validation, cancellation, success notification, and MUI focus restoration.
- Remove the nonfunctional “Remember me” row. Implementing configurable Firebase persistence is a
  separate product/security decision and is not implied by a UI compliance pass.
- Preserve redirect destinations and guard decisions. Add executable pure/source contracts rather
  than mocking Firebase internals.

### Phase 4B — authoritative admin boundary

- Add a server-owned admin UID/role check and apply it to metrics, stream, and reset endpoints.
- Return 403 for authenticated non-admin users and fail closed when server admin configuration is
  absent. Never trust `VITE_ADMIN_UID` as backend authority.
- Keep the client route check as early navigation UX, aligned with—but not substituting for—the
  server rule.
- Add backend authorization tests for unauthenticated, non-admin, configured admin, and missing
  configuration cases before changing dashboard presentation.

This backend behavior change was explicitly approved and now limits these telemetry endpoints to
the configured server-side administrator.

### Phase 4C — admin presentation

- Replace local font/spacing duplicates with theme typography and spacing where this is mechanical.
- Normalize interactive controls to pill geometry and 44px sub-768 targets while retaining 8px
  cards/rows.
- Name loading, refresh, stream-disconnected, offline, and empty telemetry states.
- Respect reduced motion for the page fade, collapsible telemetry, and rotating disclosure icon.
- Preserve metrics fetching, SSE cleanup, cache calculations, health checks, and read-only data.

## Security and Data Safety

- No credentials, provider tokens, Firebase configuration, or admin UID values are logged or added
  to source.
- Browser validation must not submit sign-up, reset-password, provider OAuth, or admin actions.
- Admin browser verification is skipped unless an already-authorized safe fixture exists.
- Backend authorization tests must be isolated and must not contact Firebase or live telemetry.

## Validation

- New `audit:auth-admin` executable contract for responsive geometry, semantic state ownership,
  shared loader/dialog use, and guard invariants.
- Existing seven frontend Node tests, all design audits, ESLint, Knip, and production build.
- Targeted backend authorization tests if Phase 4B is approved.
- Browser: existing authenticated admin redirect, public auth screenshots/source fixtures, 390px,
  767px, and 768px geometry when a safe unauthenticated session is available. Do not sign out the
  user's current session merely to manufacture a fixture.
