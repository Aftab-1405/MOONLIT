# Sidebar and Conversation History Compliance Design

## Objective

Align the desktop sidebar, collapsed rail, mobile drawer, conversation history, search, and row
actions with `front-end/DESIGN.md` while preserving the existing navigation and conversation CRUD
behavior.

The implementation must remain a targeted compliance pass. It must not replace the sidebar
architecture, add dependencies, modify `DESIGN.md`, or alter conversation data merely to create
visual fixtures.

## Current Architecture

`features/sidebar-left/index.jsx` composes the desktop navigation, collapsed rail, mobile drawer,
history list, footer, and the anchors for database, search, and history popovers. Shared geometry is
centralized in `styles/sidebarStyles.js`; conversation, navigation, rename, and row-menu primitives
live in `components/SidebarPrimitives.jsx`; floating sidebar surfaces live in
`components/SidebarOverlays.jsx` and reuse `AppPopover`.

`useConversations` owns conversation loading and CRUD operations. `useConversationDialogs` owns the
delete-confirmation state. `useChatPageController` adapts those operations into sidebar props. The
custom `components/ui/Drawer.jsx` owns the mobile drawer animation and dismissal behavior.

This separation remains intact. Presentation components do not call conversation APIs directly,
and the conversation hook does not gain presentation logic.

## Verified Compliance Gaps

### Conversation-row semantics

The main history row is a `div` with `role="button"` containing an `IconButton`. The popover row is a
`ListItemButton` containing another `IconButton`. Both produce nested button semantics and competing
keyboard targets.

Active conversation rows use a selected background but omit the canonical white active indicator
specified by the `ex-app-shell-row` design primitive.

### Responsive geometry

Desktop rows correctly use compact 36px geometry. At a 390px viewport, navigation and conversation
rows remain 36px and row-option buttons remain 28px because touch sizing depends on pointer media
capability rather than the canonical `< 768px` mobile boundary. `DESIGN.md` requires mobile controls
to reach 44×44px.

Inline rename uses a 6px field radius and 26–28px action controls. The canonical input radius is
8px, and its mobile actions must also meet the 44px touch target.

### Floating-surface focus

Search and collapsed-history popovers initially focus the popover paper. Search does not place
focus in its field, and history does not place focus on its first conversation. Escape dismissal
and return focus already work and must be preserved.

The displayed `Ctrl+K` and `Ctrl+Shift+O` hints have no keyboard handlers. They must be removed in
this phase instead of introducing new global application shortcuts.

### Mobile drawer accessibility

The mobile drawer animates and dismisses through Escape/backdrop interaction, but it does not act as
an accessible modal: opening leaves focus on the background trigger, background content remains in
the accessibility tree, focus is not trapped, and closing does not return focus to the opener. The
animation also does not honor reduced-motion preferences.

### Conversation-list error state

When fetching conversations fails, the hook logs the failure and finishes loading with an empty
array. The sidebar therefore displays `No conversations yet`, conflating a network/server failure
with a successful empty result.

## Approved Interaction Design

### Navigation and conversation rows

- Navigation rows and conversation rows retain 8px row chrome and the existing icon alignment.
- Desktop pointer geometry remains 36px high.
- Below the canonical 768px breakpoint, every row and independently actionable icon control is at
  least 44×44px, regardless of pointer media-query reporting.
- The active conversation receives a 2px white leading indicator in addition to the existing
  selected background. State is never communicated by color alone.
- Conversation selection and conversation options become sibling controls inside a noninteractive
  row container. The selection control owns the title, `aria-current`, and navigation action. The
  options control owns only the rename/delete menu.
- The same semantic structure is used for the main list and search/history popovers.
- Title overflow animation, reduced-motion handling, inline rename, and menu anchoring remain
  behaviorally unchanged.

### Inline rename

- Rename remains an in-row edit rather than a global dialog.
- The field uses the semantic input surface, one hairline border, an 8px radius, and no extra focus
  outline or shadow.
- Enter commits, Escape cancels, empty titles cannot be saved, and the 80-character limit remains.
- Save and Cancel remain separate labeled buttons; both become 44px targets below 768px and retain
  compact desktop geometry.
- Failed saves keep the editor open and preserve the typed title while the existing snackbar
  reports the failure.

### Search and history popovers

- Search opens with focus in the search field and its contents available for immediate typing.
- Collapsed history opens with focus on the first conversation when one exists.
- Empty search results remain a polite status message.
- Popover lists receive explicit accessible labels; rows keep distinct selection and options
  controls.
- Escape closes only the topmost popover/menu and restores focus to the trigger.
- No search query is persisted after the popover closes.

### Mobile drawer

- The existing `Drawer`, `DrawerOverlay`, and `DrawerContent` public composition API is preserved.
- Internally, the open drawer uses MUI's existing modal focus-management capability rather than a
  new dependency or a hand-written focus trap.
- The surface is exposed as a modal dialog labeled `Sidebar`.
- Opening moves focus to `Close sidebar`; Tab and Shift+Tab remain within the drawer while it is
  open.
- Background content is hidden from assistive technology by the modal owner.
- Escape and backdrop dismissal remain supported. A nested MUI popover/menu consumes Escape first,
  leaving the drawer open.
- Closing through the close button, backdrop, or Escape restores focus to the `Open sidebar`
  trigger captured when the drawer opened.
- Reduced-motion preference removes the slide/fade transition without changing layout.
- The drawer remains 320px maximum width, safe-area aware, and free of horizontal overflow.

### Loading, empty, and error states

- Loading continues to show the existing skeleton with a named status region.
- A successful empty response continues to show `No conversations yet`.
- A failed initial or explicit refresh shows `Couldn’t load conversations` and a `Retry` button.
- Retry invokes the existing `fetchConversations` operation with a forced refresh; it does not add
  a new API contract.
- A background refresh failure must not discard or cover already loaded conversations. Existing
  rows remain usable and the established notification mechanism reports the refresh failure.
- A successful retry clears the error state.

## State and Data Flow

`useConversations` adds a serializable conversation-list error value and a retry callback derived
from the existing fetch function. The error is set only for the latest non-aborted request and is
cleared when a new visible load begins or succeeds. Abort errors remain silent.

The controller passes `conversationListError` and `onRetryConversations` through the existing
memoized sidebar-props boundary. `Sidebar` selects exactly one list state in this order:

1. Loading skeleton when a visible load is active and there are no usable rows.
2. Error state when the latest visible load failed and there are no usable rows.
3. Empty state when the request succeeded with no rows.
4. Conversation rows when data is available.

Rename and delete data flow is unchanged. Delete still requires the existing confirmation dialog,
and this phase does not automatically trigger either operation during browser validation.

When the drawer transitions from closed to open, it captures the currently focused element before
the modal moves focus. When the drawer finishes closing, it restores focus to that captured element
if it is still connected. This keeps focus ownership inside the shared drawer without querying the
DOM by selector or expanding the shell callback API.

## Accessibility Contract

- No interactive control contains another interactive control.
- Conversation selection uses a native button with a descriptive accessible name.
- Options uses a separate native button with `aria-haspopup="menu"` and accurate expanded state.
- Active conversation selection exposes `aria-current="page"`.
- Mobile navigation, profile/settings, conversation, rename, and retry controls meet 44×44px.
- Popovers, menus, and dialogs establish predictable initial focus and restore it when dismissed.
- Drawer background isolation, focus trapping, Escape order, and opener restoration are required
  behavior, not visual enhancements.
- Loading, empty, and error states use text and live/status semantics rather than color alone.

## Files Expected to Change

- `front-end/src/features/sidebar-left/index.jsx`
- `front-end/src/features/sidebar-left/components/SidebarPrimitives.jsx`
- `front-end/src/features/sidebar-left/components/SidebarOverlays.jsx`
- `front-end/src/features/sidebar-left/styles/sidebarStyles.js`
- `front-end/src/components/ui/Drawer.jsx`
- `front-end/src/hooks/chat-page/useConversations.js`
- `front-end/src/hooks/chat-page/useChatPageController.js`
- Focused Node tests and the relevant interaction/theme audit scripts
- `front-end/knip.json` only if a new executable test entry requires registration
- `docs/frontend-ui-audit/memory.md` and `docs/frontend-ui-audit/phases.md` after implementation

Search-field and first-history-row focus are expressed through refs and MUI props at the sidebar
overlay call site. `AppPopover.jsx` and its other consumers remain unchanged.

## Testing and Validation

### Automated

- Red-first focused tests for conversation-list state selection and fetch-error lifecycle.
- Source/runtime interaction assertions for sibling row controls, active indicator, responsive
  geometry, drawer modal semantics, reduced motion, and removal of unsupported shortcut hints.
- Existing profile/settings model and authentication-profile tests.
- Dark-theme, theme-contrast, interaction-contrast, and input-focus audits.
- ESLint, Knip, focused Node tests, and production build.

### Authenticated browser matrix

- 1302×926 expanded desktop: navigation geometry, active row indicator, row/options semantics,
  search focus, rename cancellation, delete cancellation, and no overflow.
- 1302×926 collapsed desktop: rail geometry, tooltips, history initial focus, menu dismissal, and
  focus restoration.
- 390×844 and 767px: 44px controls, drawer modal semantics, focus trap, nested-popover Escape order,
  opener restoration, safe-area layout, and no overflow.
- 768px: desktop boundary retains compact 36px geometry and does not render the mobile drawer.
- Loading/empty/error browser states are verified only if safe, repeatable fixtures exist. Otherwise
  their source contracts and tests are reported as fixture limitations rather than claimed visual
  evidence.

Browser validation must not send a message, rename or delete a conversation, connect or switch a
database, change settings, or sign out.

## Risks and Mitigations

- **Row semantic refactor:** It can regress marquee titles or menu anchoring. Keep the existing title
  and menu components and change only their parent control topology.
- **Shared drawer behavior:** Focus management can conflict with nested MUI portals. Use MUI's modal
  ownership and explicitly verify that the topmost overlay handles Escape first.
- **Responsive density:** Applying 44px by viewport could accidentally affect desktop. Bind the
  override to the established 768px theme breakpoint and test both 767px and 768px.
- **Fetch races:** A stale failure must not replace a newer success. Reuse the existing request
  sequence guard for both error and loading updates.
- **Dirty worktree:** Preserve all unrelated and user-owned changes; do not commit or reformat
  outside the approved files.

## Scope Boundaries

- No sidebar rewrite or new navigation architecture.
- No new global state store, event bus, or dependency.
- No new keyboard shortcuts in this phase.
- No conversation sorting, grouping, pagination, or server-side search change.
- No change to conversation API payloads or backend persistence.
- No profile/settings redesign; the completed separation remains intact.
- No visual deviation from `front-end/DESIGN.md`.
- No automatic commit, push, or pull request.
