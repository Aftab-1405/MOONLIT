# Sidebar Profile and Settings Separation Design

## Objective

Separate user-profile inspection from application settings while preserving a clear Settings path
when the desktop sidebar is collapsed.

## Current Behavior

The sidebar footer is one button containing the avatar, display name, and gear. The entire row opens
`UserProfileMenu`, whose actions include Settings and Sign out. The single hit target conflates the
profile and Settings concepts, and the gear does not open Settings directly.

The normalized authentication user currently exposes only `uid`, `email`, `displayName`, and
`photoURL`, although Firebase also supplies provider, verification, creation, and last-sign-in
metadata.

## Interaction Model

### Expanded desktop and mobile drawer

- The avatar and display name form one semantic Profile button.
- A separate semantic Settings icon button sits at the trailing edge of the footer row.
- Activating Profile opens the user-profile popover.
- Activating Settings opens the existing Settings modal directly and does not open the profile
  popover.
- Mobile controls retain at least 44×44px touch targets. Desktop geometry follows the existing
  compact sidebar-row contract.

### Collapsed desktop sidebar

- Only the avatar Profile button remains visible in the rail.
- Activating it opens the same user-profile popover.
- In this state only, the popover includes a clearly labeled Settings menu item with the semantic
  gear icon. This is the collapsed-state route to Settings without adding a crowded second rail
  button or a small avatar badge.
- Activating the popover Settings item closes the popover and opens the existing Settings modal.

### Profile popover

The popover presents account identity and session information, followed by account actions:

- Avatar
- Display name
- Email
- Sign-in provider, using friendly labels such as Email, Google, or GitHub
- Email verification status
- Member-since date
- Last-sign-in date
- Settings action only while the desktop sidebar is collapsed
- Sign out in all sidebar states

Internal user IDs are never displayed. Missing optional metadata rows are omitted rather than
rendered with placeholder values. Email verification is shown whenever the normalized value is a
boolean. Dates use the user's locale and fail closed: invalid or missing timestamps omit the row.

## Architecture and Data Flow

### Authentication normalization

`AuthContext` will continue exposing a plain normalized user object, not the raw Firebase user. The
normalization boundary will additionally derive:

- `emailVerified`: boolean when available
- `providers`: a de-duplicated array of friendly provider labels
- `createdAt`: an ISO-compatible timestamp when available
- `lastSignInAt`: an ISO-compatible timestamp when available

Provider IDs are mapped at the normalization boundary (`password` → `Email`, `google.com` →
`Google`, `github.com` → `GitHub`). Unknown provider IDs receive a readable fallback rather than
being exposed verbatim. Backend values may supply the same fields, but Firebase remains the fallback
source.

Pure provider/date derivation will live in a small authentication-profile utility so it can be
tested without rendering React or initializing Firebase.

### Sidebar ownership

`Sidebar` owns only the two footer triggers and their responsive visibility. It receives separate
callbacks:

- `onProfileOpen(event)` anchors the profile popover.
- `onOpenSettings()` opens the Settings modal directly.

The profile trigger remains the only popover anchor. The Settings trigger never shares the profile
click handler. Sidebar memoization must include the new callback and the normalized user fields that
affect visible identity content.

### Shell and overlay ownership

`MainInterface` remains the composition owner. It passes the normalized `user` object and whether
the sidebar is expanded to `UserProfileMenu`. The existing controller/overlay state remains the only
owner of `settingsOpen`; both Settings entry points converge on the same handler that closes the
profile menu and conflicting overlays before opening Settings.

`UserProfileMenu` remains responsible for profile presentation, Sign out, and the conditional
collapsed-state Settings action. It receives an actual-surface `sidebarExpanded` value: mobile is
always expanded even if the persisted desktop preference is collapsed. It does not own Settings
modal state.

## Accessibility

- Profile and Settings are separate native buttons with distinct accessible names.
- The profile button uses `aria-haspopup="menu"` and reflects its expanded state.
- The gear button is labeled `Open settings` and does not claim popup ownership.
- The profile popover remains keyboard navigable and closes with Escape.
- Closing the popover returns focus through MUI's existing menu behavior.
- Opening Settings from either entry point moves focus into the existing Settings modal.
- Information is conveyed with text, not icon or color alone.

## Error and Missing-Data Handling

- Optional provider and timestamp rows are omitted when unavailable or invalid.
- The display-name and avatar fallbacks remain unchanged.
- Settings and Sign out continue using the established handlers; no new network operation is added.
- No authentication token, raw provider object, or internal UID is passed into presentation code.

## Files Expected to Change

- `front-end/src/contexts/AuthContext.jsx`
- A focused authentication-profile utility and Node test under `front-end/src/`
- `front-end/src/features/sidebar-left/index.jsx`
- `front-end/src/features/shell/UserProfileMenu.jsx`
- `front-end/src/features/MainInterface.jsx`
- `front-end/src/hooks/chat-page/useChatPageController.js`
- `front-end/src/hooks/chat-page/useChatPageSidebar.js`
- `front-end/scripts/audit-interaction-contrast.mjs`
- `front-end/knip.json` only if the repository requires explicit test entry registration

## Validation

- Pure tests for provider mapping, de-duplication, and safe date normalization.
- Red-first interaction audit assertions for distinct Profile and Settings triggers, conditional
  collapsed Settings access, and preserved Sign out.
- ESLint, Knip, focused Node tests, design audits affected by the change, and production build.
- Authenticated browser verification:
  - Expanded sidebar: Profile opens details; gear opens Settings directly.
  - Collapsed sidebar: avatar opens details containing Settings; that action opens Settings.
  - Mobile drawer: separate Profile and 44px Settings controls.
  - Escape dismissal, focus behavior, no horizontal overflow, and no account/data mutation.

## Scope Boundaries

- No profile editing, avatar upload, account deletion, or password-management flow.
- No change to Settings modal content.
- No new backend endpoint or persistence schema.
- No unrelated Phase 2 sidebar/history redesign.
- No dependency addition.
