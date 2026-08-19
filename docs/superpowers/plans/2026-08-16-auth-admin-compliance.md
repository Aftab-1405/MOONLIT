# Authentication and Administration Compliance Implementation Plan

Date: 2026-08-16
Status: Complete — 2026-08-17

## Task 1 — Establish the executable Phase 4 baseline

**Files:** `front-end/scripts/audit-auth-admin.mjs`, `front-end/package.json`

- [x] Add failing contracts for shared auth loading, one-operation busy state, reset dialog
  semantics, nonfunctional persistence-control removal, guard invariants, admin responsive controls,
  semantic telemetry states, and reduced motion.
- [x] Register `npm run audit:auth-admin` and prove each intended assertion fails before code edits.
- [x] Keep Firebase/provider APIs unmocked; source/SSR contracts must not perform authentication.

## Task 2 — Make account entry states deterministic

**Files:** `front-end/src/pages/Auth.jsx`; shared dialog primitives only if an existing prop is
insufficient.

- [x] Replace the duplicate initial spinner with `PageLoader`.
- [x] Add a single auth-operation state and small stable callbacks for email, Google, GitHub, and
  reset. Disable conflicting actions and expose named busy copy/spinners without duplicate submits.
- [x] Remove the nonfunctional “Remember me” control. Do not change Firebase persistence.
- [x] Move password reset onto shared dialog/action geometry; preserve validation, entered focus,
  cancellation, success toast, and error handling.
- [x] Verify sign-in/sign-up field reset, mode switching, server errors, disabled states, and 390/767/
  768 geometry through safe source/browser fixtures.

## Task 3 — Preserve and contract-test route guards

**Files:** `front-end/src/guards/ProtectedRoute.jsx`, `front-end/src/guards/AdminRoute.jsx`, a small
pure guard-decision helper/test only if needed.

- [x] Contract-test loading, anonymous, authenticated, non-admin, configured admin, and missing
  admin-configuration decisions.
- [x] Preserve `/auth`, `/chat`, and `/admin` destinations and `replace` navigation.
- [x] Keep `PageLoader` as the loading state and do not expose protected children before resolution.

## Task 4 — Enforce admin authorization on the backend

**Files:** backend auth dependency/config, `context_controller.py`, focused backend tests, environment
documentation.

- [x] Add failing tests for 401 unauthenticated, 403 authenticated non-admin, 403 missing admin
  configuration, and success for the configured admin.
- [x] Implement one server-owned, fail-closed admin dependency; do not consume `VITE_ADMIN_UID`.
- [x] Apply it to metrics, metrics stream, and metrics reset endpoints.
- [x] Confirm ordinary authenticated application endpoints remain unchanged.
- [x] Document the server configuration and migration impact.

## Task 5 — Align the admin dashboard without changing telemetry logic

**Files:** `front-end/src/pages/AdminDashboard.jsx`

- [x] Replace verified local typography/spacing duplicates with canonical theme tokens.
- [x] Make refresh/disclosure controls pill-shaped and 44px through 767px, compact from 768px.
- [x] Name loading/offline/error/live regions and make refresh busy state explicit.
- [x] Respect reduced motion for page fade, disclosure rotation, and Collapse duration.
- [x] Preserve fetch URLs, SSE credentials and cleanup, timer cleanup, metric transforms, and data.

## Task 6 — Validate, self-review, and document Phase 4

- [x] Run targeted frontend and approved backend tests.
- [x] Run `audit:auth-admin`, all existing audits, ten Node tests, lint, Knip, build, and
  `git diff --check`.
- [x] Browser-test only reachable safe states; do not sign out, submit auth forms, start OAuth,
  reset passwords, or bypass admin authorization.
- [x] Update `docs/frontend-ui-audit/phases.md` and `memory.md` with exact evidence and fixture gaps.
- [x] Review security, auth state races, focus, duplicate submissions, route flashes, responsive
  behavior, SSE cleanup, performance, and scope before completion.
