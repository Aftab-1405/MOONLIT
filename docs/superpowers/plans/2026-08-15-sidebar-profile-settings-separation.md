# Sidebar Profile and Settings Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Profile and Settings independent sidebar actions while providing a clear Settings route from the collapsed desktop rail.

**Architecture:** Normalize safe account metadata once at the authentication boundary, keep the sidebar responsible only for separate Profile/Settings triggers, and keep Settings modal state in the existing controller/overlay owner. The existing profile menu becomes an informational account popover with Sign out and a Settings action only when the desktop sidebar is collapsed.

**Tech Stack:** React, Material UI, Firebase Authentication, Node test runner, existing design audits, Vite

## Global Constraints

- Do not expose authentication tokens, raw Firebase/provider objects, or internal user IDs in presentation code.
- Profile and Settings must remain separate native buttons in the expanded desktop sidebar and mobile drawer.
- The collapsed desktop rail shows only Profile; its popover provides the explicit Settings fallback.
- Preserve the existing Settings modal, Sign out handler, profile-menu anchoring, and overlay ownership.
- Mobile interactive targets must remain at least 44×44px.
- Add no dependency and make no unrelated Phase 2 sidebar/history changes.
- Work inline without commits, as requested by the user.

---

### Task 1: Safe normalized account metadata

**Files:**
- Create: `front-end/src/utils/authUserProfile.js`
- Create: `front-end/src/utils/authUserProfile.test.js`
- Modify: `front-end/src/contexts/AuthContext.jsx`

**Interfaces:**
- Consumes: Firebase user fields (`uid`, `email`, `displayName`, `photoURL`, `emailVerified`, `providerData`, `metadata`) and the existing backend session user object.
- Produces: `normalizeAuthUser(firebaseUser, backendUser)` returning `{ uid, email, displayName, photoURL, emailVerified, providers, createdAt, lastSignInAt }` with no raw auth objects.

- [ ] **Step 1: Write the failing normalization tests**

Create `src/utils/authUserProfile.test.js` with real inputs:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAuthTimestamp, normalizeAuthUser } from './authUserProfile.js';

test('normalizes safe account metadata and de-duplicates friendly providers', () => {
  const user = normalizeAuthUser(
    {
      uid: 'firebase-user',
      email: 'disha@example.com',
      displayName: 'Disha Patani',
      photoURL: 'https://example.com/avatar.png',
      emailVerified: true,
      providerData: [
        { providerId: 'password' },
        { providerId: 'google.com' },
        { providerId: 'google.com' },
      ],
      metadata: {
        creationTime: '2024-01-15T10:00:00.000Z',
        lastSignInTime: '2026-08-15T08:30:00.000Z',
      },
    },
    {},
  );

  assert.deepEqual(user.providers, ['Email', 'Google']);
  assert.equal(user.emailVerified, true);
  assert.equal(user.createdAt, '2024-01-15T10:00:00.000Z');
  assert.equal(user.lastSignInAt, '2026-08-15T08:30:00.000Z');
  assert.equal('providerData' in user, false);
  assert.equal('metadata' in user, false);
});

test('prefers explicit backend metadata and safely omits invalid dates', () => {
  const user = normalizeAuthUser(
    {
      uid: 'firebase-user',
      email: 'disha@example.com',
      emailVerified: true,
      providerData: [{ providerId: 'password' }],
      metadata: { creationTime: 'not-a-date' },
    },
    {
      emailVerified: false,
      providers: ['github.com', 'microsoft.com'],
      lastSignInAt: '2026-08-14T12:00:00.000Z',
    },
  );

  assert.equal(user.emailVerified, false);
  assert.deepEqual(user.providers, ['GitHub', 'Microsoft', 'Email']);
  assert.equal(user.createdAt, null);
  assert.equal(user.lastSignInAt, '2026-08-14T12:00:00.000Z');
  assert.equal(normalizeAuthTimestamp('invalid'), null);
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
node --test src/utils/authUserProfile.test.js
```

Expected: FAIL because `authUserProfile.js` does not exist yet.

- [ ] **Step 3: Implement the pure normalization utility**

Create `src/utils/authUserProfile.js` with these public functions and precedence rules:

```js
const PROVIDER_LABELS = Object.freeze({
  password: 'Email',
  'google.com': 'Google',
  'github.com': 'GitHub',
});

function getProviderId(value) {
  return typeof value === 'string' ? value : value?.providerId;
}

function getProviderLabel(value) {
  const providerId = getProviderId(value)?.trim();
  if (!providerId) return null;
  if (PROVIDER_LABELS[providerId]) return PROVIDER_LABELS[providerId];
  return providerId
    .replace(/\.com$/i, '')
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

export function normalizeAuthTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeAuthUser(firebaseUser, backendUser = {}) {
  const backendProviders = Array.isArray(backendUser.providers)
    ? backendUser.providers
    : [backendUser.provider, backendUser.providerId];
  const providers = [...backendProviders, ...(firebaseUser.providerData || [])]
    .map(getProviderLabel)
    .filter(Boolean)
    .filter((provider, index, list) => list.indexOf(provider) === index);

  return {
    uid: backendUser.uid || firebaseUser.uid,
    email: backendUser.email || firebaseUser.email,
    displayName:
      backendUser.displayName ||
      backendUser.name ||
      firebaseUser.displayName ||
      firebaseUser.email?.split('@')[0],
    photoURL: backendUser.photoURL || backendUser.picture || firebaseUser.photoURL,
    emailVerified:
      typeof backendUser.emailVerified === 'boolean'
        ? backendUser.emailVerified
        : typeof firebaseUser.emailVerified === 'boolean'
          ? firebaseUser.emailVerified
          : null,
    providers,
    createdAt: normalizeAuthTimestamp(
      backendUser.createdAt || backendUser.created_at || firebaseUser.metadata?.creationTime,
    ),
    lastSignInAt: normalizeAuthTimestamp(
      backendUser.lastSignInAt ||
        backendUser.last_sign_in_at ||
        firebaseUser.metadata?.lastSignInTime,
    ),
  };
}
```

- [ ] **Step 4: Move AuthContext to the tested normalization boundary**

Import `normalizeAuthUser` from `@/utils/authUserProfile` and remove the private duplicate function
from `AuthContext.jsx`. Do not change authentication requests, state transitions, or error mapping.

- [ ] **Step 5: Run the focused tests to verify GREEN**

Run:

```bash
node --test src/utils/authUserProfile.test.js src/theme/mode.test.js src/config/userSettings.test.js src/pages/Landing/landingContent.test.js
```

Expected: 5 or more tests pass, 0 fail. `knip.json` already includes `src/**/*.test.js`, so no Knip
change is expected.

---

### Task 2: Independent Profile and Settings sidebar triggers

**Files:**
- Create: `front-end/src/features/sidebar-left/profileSettingsModel.js`
- Create: `front-end/src/features/sidebar-left/profileSettingsModel.test.js`
- Modify: `front-end/src/features/sidebar-left/index.jsx`
- Modify: `front-end/src/hooks/chat-page/useChatPageSidebar.js`
- Modify: `front-end/src/hooks/chat-page/useChatPageController.js`
- Modify: `front-end/src/features/MainInterface.jsx`

**Interfaces:**
- Consumes: `onProfileOpen(event)`, `onOpenSettings()`, `profileMenuOpen`, the shared `buildNavRowSx` geometry, and the existing controller overlay setters.
- Produces: `getProfileSettingsMode(sidebarExpanded)` returning complementary direct/popover Settings visibility, separate Profile and Settings buttons in expanded/mobile layouts, and one convergent Settings-opening handler.

- [ ] **Step 1: Add a failing responsive-mode test**

Create `profileSettingsModel.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { getProfileSettingsMode } from './profileSettingsModel.js';

test('expanded surfaces expose direct Settings without duplicating it in Profile', () => {
  assert.deepEqual(getProfileSettingsMode(true), {
    showDirectSettings: true,
    showPopoverSettings: false,
  });
});

test('the collapsed desktop rail moves Settings into the Profile popover', () => {
  assert.deepEqual(getProfileSettingsMode(false), {
    showDirectSettings: false,
    showPopoverSettings: true,
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
node --test src/features/sidebar-left/profileSettingsModel.test.js
```

Expected: FAIL because `profileSettingsModel.js` does not exist yet.

- [ ] **Step 3: Implement the responsive-mode view model**

Create:

```js
export function getProfileSettingsMode(sidebarExpanded) {
  return {
    showDirectSettings: Boolean(sidebarExpanded),
    showPopoverSettings: !sidebarExpanded,
  };
}
```

- [ ] **Step 4: Clarify Settings ownership in the sidebar hook**

Change `useChatPageSidebar({ isDesktop, onCloseModals })` to
`useChatPageSidebar({ isDesktop, onOpenSettings })`. Keep one stable handler:

```js
const handleOpenSettings = useCallback(() => {
  handleMenuClose();
  onOpenSettings?.();
}, [handleMenuClose, onOpenSettings]);
```

The controller callback passed as `onOpenSettings` must continue to close the database modal and
open the Settings modal.

- [ ] **Step 5: Add a stable direct-sidebar Settings handler in the controller**

Extract `handleOpenSettings` from the sidebar hook beside `openProfileMenu`, then add:

```js
const handleSidebarOpenSettings = useCallback(() => {
  setSidebarMobileOpen(false);
  handleOpenSettings();
}, [handleOpenSettings, setSidebarMobileOpen]);
```

Return both `handleOpenSettings` (for the profile popover fallback) and
`handleSidebarOpenSettings` (for the footer gear). Keep `handleSidebarMenuOpen` dedicated to profile
anchoring.

- [ ] **Step 6: Split the sidebar footer into two semantic buttons**

Rename the Sidebar prop `onMenuOpen` to `onProfileOpen` and add `onOpenSettings` and
`profileMenuOpen`. The footer structure must follow this model:

```jsx
<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
  <Box
    component="button"
    type="button"
    onClick={handleProfileClick}
    aria-label={`Open ${user?.displayName || 'Profile'} profile`}
    aria-haspopup="menu"
    aria-expanded={profileMenuOpen || undefined}
    sx={{
      ...buildNavRowSx(theme, { collapsed }),
      width: collapsed ? 36 : 'auto',
      flex: collapsed ? '0 0 36px' : '1 1 auto',
      minWidth: 0,
      px: 0,
    }}
  >
    {/* Existing avatar and display-name content, unchanged. */}
  </Box>

  {getProfileSettingsMode(!collapsed).showDirectSettings && (
    <Tooltip title="Settings" placement="top">
      <Box
        component="button"
        type="button"
        onClick={onOpenSettings}
        aria-label="Open settings"
        sx={{
          ...buildNavRowSx(theme, { collapsed: true }),
          justifyContent: 'center',
          px: 0,
          flex: '0 0 auto',
        }}
      >
        <SettingsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
      </Box>
    </Tooltip>
  )}
</Box>
```

`handleProfileClick` must call only `onProfileOpen`. Update `arePropsEqual` for
`onProfileOpen`, `onOpenSettings`, and `profileMenuOpen`; remove the old `onMenuOpen` comparison.

- [ ] **Step 7: Wire the shell composition**

In `MainInterface`, pass:

```jsx
<Sidebar
  ...
  onProfileOpen={handleSidebarMenuOpen}
  onOpenSettings={handleSidebarOpenSettings}
  profileMenuOpen={Boolean(anchorEl)}
/>
```

Continue mounting one `UserProfileMenu`; its prop changes are completed in Task 3.

- [ ] **Step 8: Run focused checks to verify GREEN**

Run `node --test src/features/sidebar-left/profileSettingsModel.test.js` and
`npm run audit:interaction`; expect both to exit 0. The existing audit continues to prohibit the
caret and require the semantic Settings icon.

---

### Task 3: Informational profile popover and collapsed Settings fallback

**Files:**
- Modify: `front-end/src/features/shell/UserProfileMenu.jsx`
- Modify: `front-end/src/features/MainInterface.jsx`

**Interfaces:**
- Consumes: normalized `user`, actual-surface `sidebarExpanded`, `onOpenSettings`, `onLogout`, `getProfileSettingsMode`, and the existing MUI Menu anchor/open/close props.
- Produces: An informational profile popover with conditional metadata rows, conditional collapsed Settings access, and persistent Sign out.

- [ ] **Step 1: Add failing profile-popover assertions**

Before production edits, use the signed-in browser to record the failing behavior: the combined
footer button opens the old email-only menu, and the gear does not open Settings directly. This is
the consumer-visible RED baseline for the component interaction.

- [ ] **Step 2: Replace the email-only header with account identity**

Replace the `userEmail` prop with `user` and replace the positioning prop with the actual-surface
`sidebarExpanded`. Derive:

```js
const providers = user?.providers?.join(', ');
const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};
const createdAt = formatDate(user?.createdAt);
const lastSignInAt = formatDate(user?.lastSignInAt);
```

Render the existing avatar fallback beside display name and email, then render compact labeled rows
only when their values exist. Render verification whenever `typeof user?.emailVerified ===
'boolean'`, with text `Verified` or `Not verified`; do not rely on color alone.

- [ ] **Step 3: Separate account actions**

Keep Sign out as the final menu item. Render the existing Settings menu item only when the tested
mode exposes the popover fallback:

```jsx
{getProfileSettingsMode(sidebarExpanded).showPopoverSettings && (
  <MenuItem onClick={onOpenSettings} data-ui-target="settings_button" sx={getPopoverMenuItemSx(theme)}>
    <SettingsIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
    <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary' }}>
      Settings
    </Typography>
  </MenuItem>
)}
```

Maintain a separator before account actions and keep Sign out available in both sidebar states.

- [ ] **Step 4: Pass the complete normalized user and collapsed condition**

Update `MainInterface`:

```jsx
<UserProfileMenu
  anchorEl={anchorEl}
  open={Boolean(anchorEl)}
  onClose={handleMenuClose}
  onOpenSettings={handleOpenSettings}
  onLogout={handleLogout}
  user={user}
  sidebarExpanded={isNarrowLayout || sidebarOpen}
  theme={theme}
/>
```

- [ ] **Step 5: Run focused automated validation**

Run:

```bash
node --test src/utils/authUserProfile.test.js src/theme/mode.test.js src/config/userSettings.test.js src/pages/Landing/landingContent.test.js
npm run audit:interaction
npm run audit:theme
npm run audit:dark
npm run audit:input-focus
npm run lint
npm run knip
npm run build
```

Expected: every command exits 0. The existing oversized Perspective chunk warning may remain.

---

### Task 4: Authenticated interaction and responsive verification

**Files:**
- Modify if evidence changes: `docs/frontend-ui-audit/memory.md`

**Interfaces:**
- Consumes: the signed-in local chat session and the completed Tasks 1–3.
- Produces: Browser evidence for every reachable interaction and an updated audit handoff if needed.

- [ ] **Step 1: Verify expanded desktop separation**

At 1302×926, confirm the Profile and Settings buttons have distinct accessible names. Open Profile
and verify available account rows plus Sign out, with no Settings row. Close with Escape. Activate
the gear and verify the existing Settings modal opens directly; close it without changing settings.

- [ ] **Step 2: Verify collapsed desktop fallback**

Collapse the sidebar, open Profile from the avatar, confirm the popover contains Settings and Sign
out, activate Settings, and verify the modal opens. Close the modal and restore the expanded sidebar.

- [ ] **Step 3: Verify the mobile drawer**

At 390×844, open the drawer and confirm separate Profile and Settings controls are at least 44×44px.
Verify Profile details and direct Settings behavior, then close all overlays and restore 1302×926.

- [ ] **Step 4: Review and record final state**

Confirm zero horizontal overflow, no account or settings mutation, no debug statements, and
`git diff --check`. Update the frontend audit memory only if this focused pre-Phase-2 correction
changes the next handoff or known limitations.
