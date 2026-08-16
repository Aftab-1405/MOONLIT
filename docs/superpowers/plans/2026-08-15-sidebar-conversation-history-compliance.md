# Sidebar and Conversation History Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the sidebar's conversation-row semantics, mobile touch geometry, popover focus,
drawer accessibility, and conversation-list error presentation without changing conversation CRUD
or the established visual language.

**Architecture:** Keep API/data ownership in `useConversations`, presentation state selection in a
small pure sidebar model, sidebar composition in `features/sidebar-left`, and modal focus ownership
inside the shared drawer. Reuse MUI Modal, existing theme tokens, AppPopover, row style builders,
and the current controller prop boundary; do not add dependencies or a second design abstraction.

**Tech Stack:** React 19, MUI 7, Framer Motion 12, React Router 7, Node's built-in test runner,
ESLint, Knip, Vite, and the repository's executable UI audit scripts.

## Global Constraints

- `front-end/DESIGN.md` is authoritative and must not be modified.
- Use `#0a0a0a` canvas, `#191919` input/paper surfaces, `#212327` hairlines, 8px row/input
  chrome, white active indicators, and pill/full geometry for independent icon controls.
- Mobile is `< 768px` and requires at least 44×44px independently actionable controls; desktop is
  `>= 768px` and retains compact 36px rows.
- Preserve conversation selection, rename, delete confirmation, database entry, profile/settings
  separation, title marquee behavior, and URL synchronization.
- Do not send messages, rename/delete conversations, change settings, switch/connect databases,
  or sign out during browser validation.
- Do not add dependencies, rewrite the sidebar, modify backend contracts, or refactor unrelated
  code.
- The worktree is dirty and user-owned changes must be preserved.
- The user selected inline execution: do not commit, push, or create a pull request.

---

## File Responsibility Map

- Create `front-end/src/features/sidebar-left/conversationListModel.js`: pure load-state reducer and
  display-state selector used by both the hook and sidebar.
- Create `front-end/src/features/sidebar-left/conversationListModel.test.js`: Node tests for error
  lifecycle and loading/error/empty/list precedence.
- Modify `front-end/src/hooks/chat-page/useConversations.js`: request-sequence-safe list status,
  retry callback, and returned error/failure revision.
- Modify `front-end/src/hooks/chat-page/useChatPageController.js`: sidebar error/retry props and
  background-refresh notification coordination.
- Modify `front-end/src/features/sidebar-left/index.jsx`: state rendering, retry UI, unsupported
  shortcut removal, mobile initial-focus ref, and responsive row composition.
- Modify `front-end/src/features/sidebar-left/components/SidebarPrimitives.jsx`: sibling selection
  and options controls, inline rename geometry, and optional initial focus.
- Modify `front-end/src/features/sidebar-left/components/SidebarOverlays.jsx`: explicit search and
  collapsed-history initial focus and labeled lists.
- Modify `front-end/src/features/sidebar-left/styles/sidebarStyles.js`: canonical active indicator
  and 44/36px responsive row geometry.
- Modify `front-end/src/components/ui/Drawer.jsx`: MUI Modal ownership, focus trapping/restoration,
  topmost-Escape behavior, and reduced-motion support while preserving the composition API.
- Modify the relevant files under `front-end/scripts/`: executable regression contracts.
- Modify `front-end/knip.json` only if Knip does not discover the new test from its existing
  `src/**/*.test.js` entry.
- Modify `docs/frontend-ui-audit/memory.md` and `docs/frontend-ui-audit/phases.md` only after all
  implementation and validation work is complete.

---

### Task 1: Conversation-list status model and fetch error lifecycle

**Files:**
- Create: `front-end/src/features/sidebar-left/conversationListModel.js`
- Create: `front-end/src/features/sidebar-left/conversationListModel.test.js`
- Modify: `front-end/src/hooks/chat-page/useConversations.js`
- Modify: `front-end/src/hooks/chat-page/useChatPageController.js`
- Modify: `front-end/src/features/sidebar-left/index.jsx`

**Interfaces:**
- Produces: `initialConversationListLoadState`, `conversationListLoadReducer(state, event)`, and
  `getConversationListView({ isLoading, error, conversationCount })`.
- Produces from `useConversations`: `conversationListError: string | null`,
  `conversationListFailureRevision: number`, and `retryConversations(): Promise<void>`.
- Produces for `Sidebar`: `conversationListError` and `onRetryConversations` props.

- [ ] **Step 1: Add failing lifecycle and view-precedence tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  conversationListLoadReducer,
  getConversationListView,
  initialConversationListLoadState,
} from './conversationListModel.js';

test('visible retry clears an error and success leaves the list ready', () => {
  const failed = conversationListLoadReducer(initialConversationListLoadState, {
    type: 'failed',
  });
  assert.deepEqual(failed, {
    error: 'Couldn’t load conversations',
    failureRevision: 1,
  });

  const retrying = conversationListLoadReducer(failed, {
    type: 'started',
    visible: true,
  });
  assert.equal(retrying.error, null);
  assert.equal(retrying.failureRevision, 1);

  assert.deepEqual(conversationListLoadReducer(retrying, { type: 'succeeded' }), {
    error: null,
    failureRevision: 1,
  });
});

test('background start preserves the last error until the request settles', () => {
  const failed = conversationListLoadReducer(initialConversationListLoadState, {
    type: 'failed',
  });
  assert.equal(
    conversationListLoadReducer(failed, { type: 'started', visible: false }).error,
    'Couldn’t load conversations',
  );
});

test('conversation rows take precedence over a background refresh error', () => {
  assert.equal(
    getConversationListView({
      isLoading: false,
      error: 'Couldn’t load conversations',
      conversationCount: 1,
    }),
    'list',
  );
  assert.equal(
    getConversationListView({ isLoading: true, error: null, conversationCount: 0 }),
    'loading',
  );
  assert.equal(
    getConversationListView({
      isLoading: false,
      error: 'Couldn’t load conversations',
      conversationCount: 0,
    }),
    'error',
  );
  assert.equal(
    getConversationListView({ isLoading: false, error: null, conversationCount: 0 }),
    'empty',
  );
});
```

- [ ] **Step 2: Run the new test and verify the missing module failure**

Run:

```bash
cd front-end && node --test src/features/sidebar-left/conversationListModel.test.js
```

Expected: FAIL because `conversationListModel.js` does not exist.

- [ ] **Step 3: Implement the pure reducer and display selector**

```js
export const CONVERSATION_LIST_ERROR = 'Couldn’t load conversations';

export const initialConversationListLoadState = Object.freeze({
  error: null,
  failureRevision: 0,
});

export function conversationListLoadReducer(state, event) {
  switch (event.type) {
    case 'started':
      return event.visible ? { ...state, error: null } : state;
    case 'succeeded':
      return state.error === null ? state : { ...state, error: null };
    case 'failed':
      return {
        error: CONVERSATION_LIST_ERROR,
        failureRevision: state.failureRevision + 1,
      };
    default:
      return state;
  }
}

export function getConversationListView({ isLoading, error, conversationCount }) {
  if (conversationCount > 0) return 'list';
  if (isLoading) return 'loading';
  if (error) return 'error';
  return 'empty';
}
```

- [ ] **Step 4: Run the model test and verify it passes**

Run:

```bash
cd front-end && node --test src/features/sidebar-left/conversationListModel.test.js
```

Expected: all three tests PASS.

- [ ] **Step 5: Integrate reducer events with the existing request-sequence guard**

In `useConversations.js`, use `useReducer` for the new model. Dispatch `started` before a visible
load. After `fetchQuery` resolves, return without mutating conversations or status when
`conversationsLoadSeqRef.current !== requestSeq`; otherwise update conversations and dispatch
`succeeded`. In `catch`, ignore aborts and stale failures, then dispatch `failed` and keep the
existing logger call. Add:

```js
const retryConversations = useCallback(
  () => fetchConversations(undefined, { force: true, showLoading: true }),
  [fetchConversations],
);
```

Return the reducer's `error`, `failureRevision`, and `retryConversations` with the existing hook
contract.

- [ ] **Step 6: Wire error, retry, and background failure notification through the controller**

Pass `conversationListError` and `retryConversations` through `commonSidebarProps`. Track the last
reported failure revision in a ref. When a new failure revision appears while conversations already
exist, call:

```js
showSnackbar('Couldn’t refresh conversations', 'error');
```

Update the ref after reporting so rerenders do not duplicate the notification.

- [ ] **Step 7: Render one deterministic history state**

In `Sidebar`, derive `conversationListView` with `getConversationListView`. Replace the current
loading/empty ternary with explicit branches. The error branch is a `role="alert"` 8px hairline
container containing `Couldn’t load conversations` and a native outline-pill `Retry` button that
calls `onRetryConversations`. Keep the existing skeleton, empty copy, and row list unchanged in
their corresponding branches.

- [ ] **Step 8: Run focused tests and lint the touched files**

Run:

```bash
cd front-end && node --test src/features/sidebar-left/conversationListModel.test.js
cd front-end && npx eslint src/features/sidebar-left/conversationListModel.js src/features/sidebar-left/conversationListModel.test.js src/hooks/chat-page/useConversations.js src/hooks/chat-page/useChatPageController.js src/features/sidebar-left/index.jsx
```

Expected: tests PASS and ESLint exits 0.

---

### Task 2: Semantic conversation rows, active indicator, and responsive geometry

**Files:**
- Modify: `front-end/src/features/sidebar-left/components/SidebarPrimitives.jsx`
- Modify: `front-end/src/features/sidebar-left/styles/sidebarStyles.js`
- Modify: `front-end/src/features/sidebar-left/index.jsx`
- Modify: `front-end/scripts/audit-interaction-contrast.mjs`

**Interfaces:**
- Consumes: existing `ConversationItem` and `HistoryPopoverItem` props without changing their CRUD
  callback signatures.
- Produces: `buildConversationRowSx(theme, { isActive, menuOpen, isRenaming })` for a noninteractive
  container and `buildConversationSelectSx(theme)` for its native selection button.
- Produces: row selection buttons with `aria-current="page"` and sibling options buttons.

- [ ] **Step 1: Add failing executable interaction assertions**

Extend `audit-interaction-contrast.mjs` to read the sidebar primitive/style files and assert these
source contracts:

```js
requireSource(
  'src/features/sidebar-left/components/SidebarPrimitives.jsx',
  /component="button"[\s\S]*aria-current=\{isActive \? 'page' : undefined\}/,
  'conversation selection must be a native button with page-current state.',
);
requireSource(
  'src/features/sidebar-left/styles/sidebarStyles.js',
  /backgroundColor:\s*theme\.palette\.primary\.main/,
  'the active conversation must expose the canonical white indicator.',
);
requireSource(
  'src/features/sidebar-left/styles/sidebarStyles.js',
  /height:\s*\{\s*xs:\s*UI_LAYOUT\.touchTarget,\s*md:\s*ROW_HEIGHT\s*\}/,
  'sidebar rows must use 44px mobile and 36px desktop geometry.',
);
```

Also reject `role={isRenaming ? 'group' : 'button'}` and reject a `ListItemButton` wrapper around
the row options control. Use the audit script's existing `fail`/read helpers rather than introducing
a second assertion framework.

- [ ] **Step 2: Run the interaction audit and verify the new assertions fail**

Run:

```bash
cd front-end && npm run audit:interaction
```

Expected: FAIL on the semantic-row and/or responsive-geometry assertions.

- [ ] **Step 3: Make the row style builder own only container visuals**

Update `buildConversationRowSx` to use responsive viewport geometry:

```js
height: { xs: UI_LAYOUT.touchTarget, md: ROW_HEIGHT },
minHeight: { xs: UI_LAYOUT.touchTarget, md: ROW_HEIGHT },
gridTemplateColumns: 'minmax(0, 1fr) auto',
```

Move cursor, focus, and keyboard styles to `buildConversationSelectSx`. Add the active indicator to
the container's `::before` using a 2px white bar, vertically inset by 9px on desktop and 11px on
mobile. Keep the existing selected background, 8px radius, marquee selectors, and no-shadow rule.

- [ ] **Step 4: Restructure the main conversation row into sibling controls**

Render a noninteractive grid container inside each `<li>`. In the non-renaming branch render:

```jsx
<Box
  component="button"
  type="button"
  onClick={handleClick}
  aria-current={isActive ? 'page' : undefined}
  aria-label={`Open ${title}`}
  sx={buildConversationSelectSx(theme)}
>
  <ConversationTitle title={displayTitle} theme={theme} />
</Box>
<IconButton
  aria-label={`Options for ${title}`}
  aria-haspopup="menu"
  aria-expanded={menuOpen}
  onClick={handleMenuOpen}
  sx={responsiveOptionsSx}
>
  <MoreIcon sx={{ fontSize: 16 }} />
</IconButton>
```

Remove the custom Enter/Space handler because the native selection button supplies keyboard
activation. Preserve menu state, menu anchoring, and title marquee classes.

- [ ] **Step 5: Apply the same sibling topology to popover history rows**

Replace the `ListItemButton` parent with the same noninteractive grid topology. Keep
`HistoryPopoverItem`'s `onClosePopover()` before selection navigation. Preserve selected styling,
rename/delete menu content, and popover-specific widths.

- [ ] **Step 6: Normalize inline rename geometry**

Set the rename field radius to `8px`. Use responsive Save/Cancel geometry:

```js
width: { xs: UI_LAYOUT.touchTarget, md: 26 },
height: { xs: UI_LAYOUT.touchTarget, md: 26 },
minWidth: { xs: UI_LAYOUT.touchTarget, md: 26 },
minHeight: { xs: UI_LAYOUT.touchTarget, md: 26 },
borderRadius: 9999,
```

Adjust the rename action column to fit two 44px buttons on mobile without horizontal overflow and
retain the 56px compact desktop column. Keep one neutral border and no focus shadow.

- [ ] **Step 7: Apply viewport-based 44/36px geometry to navigation and history rows**

Replace pointer-capability-only height overrides in `buildNavRowSx` and
`buildConversationRowSx` with MUI breakpoint objects using `xs: 44` and `md: 36`. Keep the already
compliant profile/settings geometry. Make independent conversation option buttons 44px below 768px
and 28px at/above 768px.

- [ ] **Step 8: Run the interaction audit, focused tests, and lint**

Run:

```bash
cd front-end && npm run audit:interaction
cd front-end && node --test src/features/sidebar-left/profileSettingsModel.test.js src/features/sidebar-left/conversationListModel.test.js
cd front-end && npx eslint src/features/sidebar-left/index.jsx src/features/sidebar-left/components/SidebarPrimitives.jsx src/features/sidebar-left/styles/sidebarStyles.js scripts/audit-interaction-contrast.mjs
```

Expected: all commands exit 0.

---

### Task 3: Search/history initial focus and truthful navigation labels

**Files:**
- Modify: `front-end/src/features/sidebar-left/index.jsx`
- Modify: `front-end/src/features/sidebar-left/components/SidebarOverlays.jsx`
- Modify: `front-end/src/features/sidebar-left/components/SidebarPrimitives.jsx`
- Modify: `front-end/scripts/audit-interaction-contrast.mjs`

**Interfaces:**
- Produces: `HistoryPopoverItem` optional `autoFocus` boolean applied to its selection button.
- Consumes: existing `AppPopover` `slotProps` forwarding; `AppPopover.jsx` remains unchanged.

- [ ] **Step 1: Add failing focus and shortcut assertions**

Extend the interaction audit to require `inputRef={searchInputRef}`, an `onEntered` focus callback,
`autoFocus={index === 0}`, and labeled Search/History lists. Reject the literal unsupported shortcut
strings `Ctrl+K` and `Ctrl+Shift+O` from `sidebar-left/index.jsx`.

- [ ] **Step 2: Run the interaction audit and verify it fails**

Run:

```bash
cd front-end && npm run audit:interaction
```

Expected: FAIL because explicit popover initial focus is absent and shortcut strings remain.

- [ ] **Step 3: Focus Search only after its popover transition enters**

Create `searchInputRef` in `SidebarOverlays`, pass it through `TextField.inputRef`, and pass this
transition slot to the search `AppPopover`:

```jsx
slotProps={{
  transition: {
    onEntered: () => searchInputRef.current?.focus(),
  },
}}
```

Keep `autoFocus` off the TextField so MUI Modal and React do not compete during mounting.

- [ ] **Step 4: Focus the first collapsed-history row and label both result lists**

Map history rows with `(conv, index)` and pass `autoFocus={index === 0}`. Apply that prop only to
the native selection button inside `HistoryPopoverItem`. Give the search result list
`role="list" aria-label="Search results"` and the collapsed history list
`role="list" aria-label="Conversation history"`.

- [ ] **Step 5: Remove unsupported shortcut hints**

Remove `shortcut` from the top navigation item definitions, `SidebarNavItem` props, and its visual
shortcut label. Do not add document-level key handlers in this phase.

- [ ] **Step 6: Run focused validation**

Run:

```bash
cd front-end && npm run audit:interaction
cd front-end && npm run audit:input-focus
cd front-end && npx eslint src/features/sidebar-left/index.jsx src/features/sidebar-left/components/SidebarOverlays.jsx src/features/sidebar-left/components/SidebarPrimitives.jsx scripts/audit-interaction-contrast.mjs
```

Expected: audits and ESLint exit 0.

---

### Task 4: Modal mobile drawer with focus trapping and reduced motion

**Files:**
- Modify: `front-end/src/components/ui/Drawer.jsx`
- Modify: `front-end/src/features/sidebar-left/index.jsx`
- Modify: `front-end/scripts/audit-interaction-contrast.mjs`

**Interfaces:**
- Preserves: `<Drawer open onOpenChange side>`, `<DrawerOverlay />`, and
  `<DrawerContent showCloseButton sx>` composition.
- Adds: optional `initialFocusRef` prop on `Drawer`; sidebar supplies a ref attached to the
  `Close sidebar` button.
- Produces: a MUI Modal-owned drawer surface with `role="dialog"`, `aria-modal="true"`, and
  `aria-label="Sidebar"`.

- [ ] **Step 1: Add failing drawer accessibility assertions**

Extend the interaction audit to require `Modal`, `useReducedMotion`, `initialFocusRef`,
`role="dialog"`, `aria-modal="true"`, and `aria-label="Sidebar"`. Reject the current unconditional
document-level Escape listener so nested MUI overlays remain topmost owners.

- [ ] **Step 2: Run the interaction audit and verify it fails**

Run:

```bash
cd front-end && npm run audit:interaction
```

Expected: FAIL on the missing modal/focus/reduced-motion contracts.

- [ ] **Step 3: Move open-state ownership to MUI Modal**

Import `Modal` from MUI and retain Framer Motion only for panel/backdrop animation. Render the
drawer children inside one ref-forwarding wrapper owned by a MUI Modal. Keep an internal `present`
boolean true from the start of opening until the panel's exit animation completes; this prevents
the Modal portal from hiding the Framer Motion exit frame. Configure `hideBackdrop` because the
existing `DrawerOverlay` remains the single visual/clickable backdrop:

```jsx
<Modal
  open={present}
  hideBackdrop
  onClose={(_event, reason) => {
    if (reason === 'escapeKeyDown') onOpenChange(false);
  }}
  aria-label="Sidebar"
>
  <Box>{children}</Box>
</Modal>
```

`DrawerContent` animates from its open transform to its side-specific closed transform whenever
`open` becomes false and invokes a context `onPanelExitComplete` callback from
`onAnimationComplete`; that callback sets `present` false. When reduced motion is active, finalize
on the next animation frame. Remove the document `keydown` listener. Let MUI's modal manager isolate
the background, trap focus, coordinate nested modals, and restore the element focused before
opening. `DrawerOverlay` continues calling `onOpenChange(false)` for backdrop dismissal.

- [ ] **Step 4: Establish explicit initial focus without selector queries**

Add `initialFocusRef` to Drawer context. After the modal content mounts, focus
`initialFocusRef.current` if it exists. In `Sidebar`, create `mobileCloseButtonRef`, pass it to
`CustomDrawer`, and attach it to the mobile header's `Close sidebar` native button. Do not change
the desktop header focus behavior.

- [ ] **Step 5: Add modal semantics to the panel surface**

Apply `role="dialog"`, `aria-modal="true"`, and `aria-label="Sidebar"` to `DrawerContent` for the
left mobile drawer. Keep its existing surface, safe-area padding, 320px maximum width, no shadow,
and hairline separation.

- [ ] **Step 6: Respect reduced motion**

Use Framer Motion's `useReducedMotion()`. For reduced motion, use zero-duration opacity/translation
transitions and no spring; otherwise retain the current 0.25s overlay fade and spring panel motion.
The open/close callback timing and final layout must remain identical.

- [ ] **Step 7: Run focused automated checks**

Run:

```bash
cd front-end && npm run audit:interaction
cd front-end && npx eslint src/components/ui/Drawer.jsx src/features/sidebar-left/index.jsx scripts/audit-interaction-contrast.mjs
```

Expected: audit and ESLint exit 0.

---

### Task 5: Integrated regression validation and audit documentation

**Files:**
- Review every file changed in Tasks 1–4
- Modify: `docs/frontend-ui-audit/memory.md`
- Modify: `docs/frontend-ui-audit/phases.md`

**Interfaces:**
- Consumes: all Task 1–4 behavior.
- Produces: completed Phase 2 validation evidence and the next-phase handoff.

- [ ] **Step 1: Run all focused Node tests**

Run:

```bash
cd front-end && node --test src/config/userSettings.test.js src/theme/mode.test.js src/pages/Landing/landingContent.test.js src/utils/authUserProfile.test.js src/features/sidebar-left/profileSettingsModel.test.js src/features/sidebar-left/conversationListModel.test.js
```

Expected: all tests PASS.

- [ ] **Step 2: Run the complete design-audit suite**

Run:

```bash
cd front-end && npm run audit:dark
cd front-end && npm run audit:theme
cd front-end && npm run audit:interaction
cd front-end && npm run audit:input-focus
```

Expected: all four audits exit 0.

- [ ] **Step 3: Run repository-wide static validation**

Run:

```bash
cd front-end && npm run lint
cd front-end && npm run knip
cd front-end && npm run build
```

Expected: lint and Knip exit 0; build succeeds. Record the existing oversized Perspective vendor
chunk warning separately if it remains unchanged.

- [ ] **Step 4: Perform desktop browser checks at 1302×926**

Verify expanded and collapsed sidebars without mutating data:

- Active conversation has a white leading indicator and `aria-current="page"`.
- Conversation selection and options are sibling native buttons with no nested button.
- Search opens focused in the field; Escape restores Search focus.
- Rename opens focused, retains 8px single-border geometry, and Escape cancels without saving.
- Delete opens the confirmation dialog; Cancel restores options-button focus.
- Collapsed History opens with its first conversation focused; Escape restores History focus.
- Row/menu/popover surfaces use canonical colors, 8px chrome, hairlines, and no shadows.
- Sidebar and document have zero horizontal overflow.

- [ ] **Step 5: Perform responsive browser checks at 390×844, 767px, and 768px**

At 390×844 and 767px verify:

- Mobile drawer opens as a labeled modal dialog and initially focuses Close sidebar.
- Background content is inaccessible while open; Tab and Shift+Tab remain inside the drawer.
- Navigation, conversation, option, profile/settings, rename, and retry controls are at least 44px.
- Search opens focused; one Escape closes Search but leaves the drawer open; the next Escape closes
  the drawer and restores Open sidebar focus.
- Drawer width is at most 320px, safe-area spacing is retained, and horizontal overflow is zero.

At 768px verify the desktop sidebar renders, rows are 36px, no mobile dialog exists, and horizontal
overflow remains zero. Restore the browser to 1302×926 with the sidebar expanded and no overlay.

- [ ] **Step 6: Verify state fixtures honestly**

Use the signed-in fixture to observe loading, empty, or error history only when the state occurs
naturally or a safe existing fixture exposes it. Do not delete the only conversation or disrupt the
API to manufacture evidence. Record unavailable states as source/test-verified fixture limitations.

- [ ] **Step 7: Review and clean every changed file**

Run `git diff --check`, inspect the scoped diff, and remove unused imports, duplicate styles,
temporary logging, commented-out code, stale comments, accidental formatting changes, and obsolete
branches. Confirm no code outside the approved Phase 2 surface changed.

- [ ] **Step 8: Update phase tracking documentation**

In `memory.md`, record the behavior delivered, exact validation commands/results, browser viewport
matrix, fixture limitations, the unchanged build warning, and that no user data was mutated. In
`phases.md`, mark Phase 2 complete only when every reachable state passes and inaccessible states
are explicitly documented. Set Current Focus to the next approved audit phase, not implementation.

- [ ] **Step 9: Deliver the inline completion report**

Report What Changed, Files Changed, Design Decisions, exact Validation, and Remaining Concerns.
State explicitly that `DESIGN.md` was unchanged and that no commit, push, or PR was created.
