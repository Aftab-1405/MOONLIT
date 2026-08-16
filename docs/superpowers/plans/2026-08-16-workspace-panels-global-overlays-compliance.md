# Workspace Panels and Global Overlays Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not use subagents unless
> the user separately authorizes delegation.

**Goal:** Bring the authenticated chat journey's shared preference surfaces, dialogs,
notifications, artifact shell, fullscreen behavior, SQL tabs, diagrams, and visualization chrome
into compliance with `front-end/DESIGN.md` without changing application data flow or third-party
renderer behavior.

**Architecture:** Preserve `GlobalOverlays` as the shell-level overlay mount, the shared
preference-surface and dialog primitives as presentation owners, `ArtifactLoader` as the local
fullscreen/registry owner, and renderer-specific state inside the existing SQL, React Flow, and
Perspective modules. Add one focused executable audit for Phase 3 contracts. Extend existing
helpers and callback boundaries only where that prevents duplicated local fixes.

**Tech Stack:** React 19, MUI 7, Framer Motion 12, CodeMirror 6, React Flow 12, Perspective 4,
Vite 7, Node's built-in test runner, ESLint, Knip, and the repository's executable UI audits.

**Approved design:**
`docs/superpowers/specs/2026-08-16-workspace-panels-global-overlays-design.md`

## Global Constraints

- `front-end/DESIGN.md` is authoritative and must not be modified.
- Use canonical neutral surfaces, 8px cards/rows/inputs, pill action controls, hairline elevation,
  weight 400, and no shadows.
- Mobile is `< 768px` and independently actionable controls must be at least 44×44px. Compact
  desktop geometry begins at `>= 768px`.
- Preserve the completed neutral `#191919` input treatment and single-border focus behavior.
- Preserve the existing transparent segmented-control wrappers and the corrected Connection mode
  row surface.
- Preserve Settings/Database main-content-region topology and intentional desktop sidebar access.
- Preserve artifact renderer identity, lazy boundaries, editor/viewer state, query callbacks,
  database behavior, and shell-owned panel sizing.
- Do not connect, switch, query, disconnect, rename, delete, reset, sign out, or otherwise mutate
  application data merely to produce browser evidence.
- Do not add dependencies, backend contracts, global stores, event buses, or replacement UI
  frameworks.
- The worktree is dirty. Preserve unrelated and user-owned changes; do not broadly reformat files.
- The user selected inline execution: do not commit, push, or open a pull request.

---

## File Responsibility Map

### Test and contract layer

- Create `front-end/scripts/audit-workspace-overlays.mjs`: focused runtime/source contracts for
  Phase 3A/3B/3C.
- Modify `front-end/package.json`: add `audit:workspace`.
- Modify `front-end/scripts/audit-interaction-contrast.mjs` only when a contract is genuinely
  cross-phase and belongs in the established global interaction audit.

### Phase 3A — overlays and preferences

- Modify `front-end/src/features/overlays/preference-surface/preferenceSurfaceStyles.js`: compact
  desktop/44px-mobile geometry and pill action helpers.
- Modify `front-end/src/features/overlays/preference-surface/PreferenceSurface.jsx`: responsive
  navigation geometry, heading focus target support, and neutral nav behavior.
- Modify `front-end/src/features/overlays/settings/SettingsModal.jsx`: focus entry and responsive
  shared actions.
- Modify `front-end/src/features/overlays/database/DatabaseModal.jsx`: remove the document Escape
  listener, neutralize provider nav text, and consume shared actions/focus behavior.
- Modify `front-end/src/components/ui/Drawer.jsx`: expose a completion callback for coordinated
  drawer-to-preference transitions while preserving its public composition.
- Modify `front-end/src/features/sidebar-left/index.jsx`,
  `front-end/src/features/chat/ChatColumn.jsx`, `front-end/src/features/MainInterface.jsx`, and
  `front-end/src/hooks/chat-page/useChatPageController.js`: sequence mobile drawer dismissal,
  preference opening, and stable focus fallback.
- Modify `front-end/src/components/common/DialogShell.jsx`: responsive close action geometry.
- Modify `front-end/src/components/common/ConfirmDialog.jsx`: responsive pill actions.
- Modify `front-end/src/components/ui/toast.jsx` and
  `front-end/src/features/shell/GlobalOverlays.jsx`: live-region semantics, accessible dismissal,
  timer/motion separation, and reduced motion.

### Phase 3B — artifact shell

- Modify `front-end/src/features/sidebar-right/artifact-loader/artifactLayoutUtils.js`: responsive
  artifact action geometry.
- Modify `front-end/src/features/sidebar-right/artifact-loader/ArtifactLayout.jsx`: named shared
  states and action ref plumbing only where required.
- Modify `front-end/src/features/sidebar-right/artifact-loader/ArtifactLoader.jsx`: fullscreen
  keyboard/focus lifecycle and reduced motion without duplicating renderers.
- Modify `front-end/src/components/common/ResizeHandle.jsx` only if the focused audit exposes a
  verified contract gap; otherwise leave its existing semantic/keyboard implementation intact.

### Phase 3C — renderer internals

- Modify `front-end/src/features/sidebar-right/artifacts/sql-workspace/QueryTabs.jsx`: sibling tab
  selection/close controls and responsive geometry.
- Modify other files under `sql-workspace/**` only for a verified shared-control or overflow gap.
- Modify `front-end/src/features/overlays/mindmap/SchemaMindmapDialog.jsx`: focus, Escape, mobile
  action geometry, and reduced motion.
- Modify `front-end/src/features/overlays/database/SchemaFlowDiagram.jsx` and
  `features/sidebar-right/artifacts/diagram-flow/**` only for verified surrounding chrome/status
  gaps; preserve graph data/layout behavior.
- Modify `features/sidebar-right/artifacts/data-visualization/**` only for verified surrounding
  state/overflow gaps; preserve Perspective configuration and public APIs.
- Modify `docs/frontend-ui-audit/memory.md` and `docs/frontend-ui-audit/phases.md` after all three
  subphases and validation are complete.

---

## Phase 3A — Shared Overlays and Preferences

### Task 1: Establish the focused Phase 3 regression audit

**Files:**
- Create: `front-end/scripts/audit-workspace-overlays.mjs`
- Modify: `front-end/package.json`

**Produces:** `npm run audit:workspace`, an executable contract that fails before the approved
behavior exists and runs without a browser or application-data mutation.

- [ ] **Step 1: Create the audit harness with shared helpers**

Use Vite's middleware SSR loader, matching `audit-input-focus.mjs`, so the audit can load the real
dark theme and style helpers. Add `fail`, `expectValue`, `readSource`, `requireSource`, and
`requireSourceAbsent` helpers. Load:

```js
const [
  { createDarkTheme },
  preferenceStyles,
  artifactStyles,
] = await Promise.all([
  server.ssrLoadModule('/src/theme/darkTheme.js'),
  server.ssrLoadModule(
    '/src/features/overlays/preference-surface/preferenceSurfaceStyles.js',
  ),
  server.ssrLoadModule(
    '/src/features/sidebar-right/artifact-loader/artifactLayoutUtils.js',
  ),
]);
```

The harness must close the Vite server in `finally` and aggregate every failure before assigning a
nonzero exit code.

- [ ] **Step 2: Add failing Phase 3A assertions**

Assert:

- Preference control/select/action/nav geometry exposes 44px below `md` and compact desktop values.
- Preference action helpers use `theme.shape.radius.pill`; fields/rows remain 8px.
- `DatabaseModal.jsx` contains no document `keydown` listener and no `textColor` provider override.
- `DialogShell.jsx` and `ConfirmDialog.jsx` consume responsive action geometry.
- `toast.jsx` contains alert/status semantics, reduced-motion handling, a real dismissal timer, and
  responsive dismissal geometry.
- Drawer/preference coordination exposes an exit-completion callback and a stable fallback target.

- [ ] **Step 3: Add failing Phase 3B/3C assertions**

Assert:

- Artifact actions use `{ xs: 44, md: desktopSize }` geometry.
- `ArtifactLoader.jsx` has a focusable fullscreen region, local Escape handling, focus restoration,
  and reduced-motion handling while rendering only one `ArtifactRenderer`.
- SQL query tabs contain no `role="button"` close element nested inside a `ToggleButton`.
- Query selection and Close are sibling native controls with tab semantics/descriptive names.
- Schema mindmap uses a responsive pill Close action and reduced-motion behavior.
- Data visualization empty/error/truncation states remain semantic and its viewer wrapper is
  contained by `minWidth: 0`/`overflow: hidden`.

- [ ] **Step 4: Register and run the audit to verify the red state**

Add:

```json
"audit:workspace": "node scripts/audit-workspace-overlays.mjs"
```

Run:

```bash
cd front-end && npm run audit:workspace
```

Expected: FAIL on the new responsive, Escape, focus, notification, and SQL semantic contracts.
Record the exact failures so later tasks can show incremental progress.

---

### Task 2: Responsive preference geometry and neutral navigation

**Files:**
- Modify: `front-end/src/features/overlays/preference-surface/preferenceSurfaceStyles.js`
- Modify: `front-end/src/features/overlays/preference-surface/PreferenceSurface.jsx`
- Modify: `front-end/src/features/overlays/settings/SettingsModal.jsx`
- Modify: `front-end/src/features/overlays/database/DatabaseModal.jsx`

**Consumes:** Existing preference components and MUI breakpoint-aware `sx` values.

**Produces:** Compact desktop/44px-mobile controls, pill actions, 8px non-action surfaces, and one
neutral navigation treatment shared by Settings and Database.

- [ ] **Step 1: Confirm the focused audit fails only on expected pre-change contracts**

Run:

```bash
cd front-end && npm run audit:workspace
```

Expected: preference geometry/pill/nav assertions FAIL; the audit harness itself exits cleanly.

- [ ] **Step 2: Add explicit responsive preference geometry**

Keep the scalar compact values and add breakpoint-aware contracts:

```js
export const PREFERENCE_LAYOUT = Object.freeze({
  // existing layout values
  controlHeight: 34,
  responsiveControlHeight: { xs: 44, md: 34 },
  navHeight: { xs: 44, md: 36 },
});
```

Apply `responsiveControlHeight` to select/input roots, Select content, segmented items, and
preference action helpers. Use `theme.shape.radius.pill` only for independent buttons/toggle
items. Preserve `INTERFACE_RADIUS.control`/8px for input roots, cards, nav rows, and preference
row surfaces.

- [ ] **Step 3: Update preference navigation without provider color overrides**

Set `PreferenceNavItem` height/minHeight to `PREFERENCE_LAYOUT.navHeight`. Remove the `textColor`
prop and use `text.primary`/`text.secondary` from the existing interaction state.

In `DatabaseModal`, remove `getDatabaseTextColor` if it is now unused and stop passing provider
colors. Do not change database type values, labels, ports, validation, or selection callbacks.

- [ ] **Step 4: Route local Settings/Database actions through shared helpers**

Replace fixed local 34px/8px action styling for Reset, Connect, Disconnect, and Close with
`getPreferenceButtonSx`. Preserve contained/outlined variants, loading spinner, disabled state,
and exact callbacks. Do not alter input surfaces or the transparent Connection mode row.

- [ ] **Step 5: Run focused audits and lint**

Run:

```bash
cd front-end && npm run audit:workspace
cd front-end && npm run audit:input-focus
cd front-end && npx eslint \
  src/features/overlays/preference-surface/preferenceSurfaceStyles.js \
  src/features/overlays/preference-surface/PreferenceSurface.jsx \
  src/features/overlays/settings/SettingsModal.jsx \
  src/features/overlays/database/DatabaseModal.jsx
```

Expected: geometry/nav assertions PASS; unrelated pending Phase 3 assertions may still fail.
Input-focus audit and ESLint exit 0.

---

### Task 3: Drawer-to-preference sequencing, focus entry, and Escape ownership

**Files:**
- Modify: `front-end/src/components/ui/Drawer.jsx`
- Modify: `front-end/src/features/sidebar-left/index.jsx`
- Modify: `front-end/src/features/chat/ChatColumn.jsx`
- Modify: `front-end/src/features/MainInterface.jsx`
- Modify: `front-end/src/hooks/chat-page/useChatPageController.js`
- Modify: `front-end/src/features/overlays/preference-surface/PreferenceSurface.jsx`
- Modify: `front-end/src/features/overlays/settings/SettingsModal.jsx`
- Modify: `front-end/src/features/overlays/database/DatabaseModal.jsx`

**Produces:** One ordered transition from mobile drawer to preference surface, deterministic focus
entry, topmost Escape handling, and stable focus fallback.

- [ ] **Step 1: Add/confirm failing coordination assertions**

The focused audit must require:

- `Drawer` accepts and invokes `onExited` only after `present` becomes false.
- Sidebar forwards an `onMobileExited` callback.
- The controller defers a pending Settings/Database open until drawer exit when `mobileOpen` is
  true.
- `DatabaseModal` has no document-level Escape listener.
- Preference headers expose a ref-capable programmatic focus target.
- `ChatColumn` exposes the current `Open sidebar` button through a ref owned by `MainInterface`.

Run `npm run audit:workspace` and verify these assertions FAIL before implementation.

- [ ] **Step 2: Extend Drawer with an exit-completion callback**

Add optional `onExited` to `Drawer`. Invoke it exactly once after the closing animation completes
and `present` changes to false; invoke it on the reduced-motion close path as well. Do not change
MUI Modal Escape/focus ownership, backdrop dismissal, existing `onOpenChange`, or initial focus.

- [ ] **Step 3: Sequence mobile overlay opening through the existing controller**

Keep pending overlay intent local to `useChatPageController` (for example, a ref containing
`'settings' | 'database' | null`). When a mobile sidebar action requests Settings/Database:

1. Record the pending overlay.
2. Close profile/menu state as applicable.
3. Close the mobile drawer.
4. Open the requested preference surface only from `handleMobileDrawerExited`.

On desktop, open immediately. Clear pending intent after consumption. Do not introduce timeouts,
global DOM events, or a new store.

Forward `onMobileExited` through `MainInterface` and `Sidebar` to `Drawer`.

- [ ] **Step 4: Provide stable focus targets**

Forward a ref from `MainInterface` to the `ChatColumn` `Open sidebar` IconButton. Pass the same ref
to the overlay close coordination boundary as the fallback return target.

Make `PreferencePageHeader` accept `headingRef`; render its heading with `tabIndex={-1}` and focus
it after the surface opens. Settings/Database must not autofocus credential fields. On close,
restore focus to the connected original trigger when available, otherwise to the connected
`Open sidebar` button. Desktop preference surfaces must continue allowing intentional sidebar
interaction.

- [ ] **Step 5: Remove duplicate Escape ownership**

Delete `DatabaseModal`'s document `keydown` effect. Preserve `DialogShell`/MUI `onClose` reasons and
ensure nested menus/popovers consume Escape before the preference surface closes.

- [ ] **Step 6: Run focused tests and lint**

Run:

```bash
cd front-end && npm run audit:workspace
cd front-end && npm run audit:interaction
cd front-end && npx eslint \
  src/components/ui/Drawer.jsx \
  src/features/sidebar-left/index.jsx \
  src/features/chat/ChatColumn.jsx \
  src/features/MainInterface.jsx \
  src/hooks/chat-page/useChatPageController.js \
  src/features/overlays/preference-surface/PreferenceSurface.jsx \
  src/features/overlays/settings/SettingsModal.jsx \
  src/features/overlays/database/DatabaseModal.jsx
```

Expected: coordination/Escape/focus contracts PASS and existing drawer contracts remain green.

---

### Task 4: Dialog actions, notifications, and reduced motion

**Files:**
- Modify: `front-end/src/components/common/DialogShell.jsx`
- Modify: `front-end/src/components/common/ConfirmDialog.jsx`
- Modify: `front-end/src/components/ui/toast.jsx`
- Modify: `front-end/src/features/shell/GlobalOverlays.jsx`

**Produces:** Responsive pill dialog actions, semantic announcements, touch-safe dismissal, and
motion-independent toast timing.

- [ ] **Step 1: Confirm notification/dialog assertions fail**

Run `npm run audit:workspace` and verify the dialog geometry, notification role, dismissal target,
timer, and reduced-motion assertions FAIL.

- [ ] **Step 2: Make shared dialog actions responsive**

In `DialogShell`, use responsive `getInteractiveIconButtonSx` geometry for the Close action:
44px below `md`, compact 34px at/above `md`, pill radius.

In `ConfirmDialog`, replace fixed 38px height/radius with `{ xs: 44, md: 38 }` and
`theme.shape.radius.pill`. Preserve full-width mobile stacking, loading guards, disabled states,
intent colors, and duplicate-submission prevention.

- [ ] **Step 3: Separate toast duration from visual animation**

Use `useEffect` to schedule `onClose` when `duration` is finite and clear the timeout on unmount or
dependency change. Remove dismissal ownership from progress-bar `onAnimationComplete` so reduced
motion never prevents auto-dismissal.

Use `useReducedMotion` to suppress spring/scale/progress/loading rotation motion while preserving
the timer and close behavior.

- [ ] **Step 4: Add semantic announcement and dismissal behavior**

Expose error notifications as `role="alert"` with assertive live behavior. Expose other types as
`role="status"` with polite live behavior. Decorative status icons are `aria-hidden`.

Replace the inline compact close style with the shared responsive pill icon-button contract or an
equivalent native-button style that provides 44px below `md`, compact desktop size, and
`:focus-visible` rather than generic `onFocus` state mutation.

Give the toast stack an accessible region label without making the entire stack redundantly live.

- [ ] **Step 5: Run Phase 3A validation checkpoint**

Run:

```bash
cd front-end && npm run audit:workspace
cd front-end && npm run audit:dark
cd front-end && npm run audit:theme
cd front-end && npm run audit:interaction
cd front-end && npm run audit:input-focus
cd front-end && npm run lint
cd front-end && npm run knip
cd front-end && npm run build
```

Expected: all Phase 3A contracts and existing audits PASS. Build may retain only the documented
Perspective chunk warning. Do not continue to Phase 3B until new failures are resolved or clearly
shown to predate the Phase 3A diff.

- [ ] **Step 6: Browser-review Phase 3A before continuing**

At 1302×926, 390×844, 767px, and 768px verify Settings/Database geometry, neutral nav, zero
overflow, drawer-to-surface sequencing, focus entry/return, nested Escape order, and confirmation
Cancel. Use an existing safe toast trigger only if reachable without data mutation. Enable reduced
motion through browser emulation and repeat the safe overlay/notification checks.

Do not connect a database, reset settings, confirm a destructive action, or sign out. Restore the
authenticated conversation URL, desktop viewport, and expanded sidebar after the checkpoint.

---

## Phase 3B — Artifact Shell and Fullscreen

### Task 5: Responsive artifact actions and shared state semantics

**Files:**
- Modify: `front-end/src/features/sidebar-right/artifact-loader/artifactLayoutUtils.js`
- Modify: `front-end/src/features/sidebar-right/artifact-loader/ArtifactLayout.jsx`
- Modify: `front-end/src/features/sidebar-right/artifact-loader/ArtifactLoader.jsx`
- Modify: `front-end/src/components/common/ResizeHandle.jsx` only if a failing verified assertion
  requires it

**Produces:** One responsive artifact action contract and consistent named loading/empty/error
states without changing renderer registration or data.

- [x] **Step 1: Confirm artifact action/state assertions fail**

Run `npm run audit:workspace`. Expected: artifact mobile geometry and state contract assertions
FAIL while Phase 3A remains green.

- [x] **Step 2: Make artifact action geometry viewport-responsive**

Change `getArtifactActionButtonSx(theme, { active, size })` so `size` remains the desktop value and
its width/height/minWidth/minHeight are `{ xs: 44, md: size }`. Retain pill shape, transparent idle
surface, active/hover/disabled colors, and focus-visible outline. Do not add shadows.

Update any caller that hardcodes conflicting width/height after spreading the helper.

- [x] **Step 3: Normalize shared artifact states**

Give `ArtifactEmptyState` an optional `role`/`ariaLive` contract and default non-error empty states
to a named status region only when they represent asynchronous/availability feedback. Keep
renderer errors as alerts and loading fallbacks as named statuses. Avoid duplicate live regions
inside a parent that already announces the same text.

Preserve the unsupported-renderer and error-boundary messages and reset key.

- [x] **Step 4: Verify ResizeHandle before editing it**

Run the focused source/runtime checks for separator role, orientation, arrow-key resize, pointer
listener cleanup, and bounded `aria-valuenow`. If all pass, do not modify `ResizeHandle.jsx`.

- [x] **Step 5: Run focused validation**

Run:

```bash
cd front-end && npm run audit:workspace
cd front-end && npm run audit:interaction
cd front-end && npx eslint \
  src/features/sidebar-right/artifact-loader/artifactLayoutUtils.js \
  src/features/sidebar-right/artifact-loader/ArtifactLayout.jsx \
  src/features/sidebar-right/artifact-loader/ArtifactLoader.jsx \
  src/components/common/ResizeHandle.jsx
```

Expected: responsive artifact/state assertions PASS; fullscreen assertions may remain red.

---

### Task 6: Fullscreen Escape, focus restoration, and reduced motion

**Files:**
- Modify: `front-end/src/features/sidebar-right/artifact-loader/ArtifactLoader.jsx`

**Produces:** Local fullscreen interaction ownership that preserves one mounted renderer.

- [x] **Step 1: Confirm fullscreen assertions fail**

Require the focused audit to reject document-level Escape listeners and require a fullscreen root
ref, `tabIndex={-1}`, an accessible region label, local `onKeyDown`, previous-focus capture, and
`useReducedMotion`. Run the audit and verify failure.

- [x] **Step 2: Add focus bookkeeping without changing renderer identity**

Add `fullscreenRootRef` and `fullscreenReturnFocusRef`. Before entering fullscreen, capture
`document.activeElement` only when it is an `HTMLElement`. After `effectiveFullscreen` becomes
true, focus the fullscreen root on the next animation frame. On exit, restore focus to the saved
connected element and clear the ref.

The root remains the same rendered container and `ArtifactRenderer` remains mounted exactly once.

- [x] **Step 3: Handle Escape locally**

Attach `onKeyDown` to the focusable fullscreen root. When fullscreen and Escape arrives from within
that region, prevent default, stop propagation, and call `handleExitFullscreen`. A menu/popover
rendered in a portal is outside the region and therefore retains topmost Escape ownership.

Closing the artifact while fullscreen must clear fullscreen and use the existing panel close
callback.

- [x] **Step 4: Respect reduced motion**

Use `useReducedMotion`. Set fullscreen backdrop enter/exit duration to zero when motion is reduced;
otherwise retain the existing subtle fade. Do not change layout, z-index, or state timing.

- [x] **Step 5: Run Phase 3B validation checkpoint**

Run:

```bash
cd front-end && npm run audit:workspace
cd front-end && npm run audit:interaction
cd front-end && npm run lint
cd front-end && npm run knip
cd front-end && npm run build
```

Expected: all Phase 3A/3B automated checks PASS, with only the existing Perspective build warning.

- [x] **Step 6: Browser-review Phase 3B before continuing**

Using the existing diagram artifact fixture, verify desktop open/close, keyboard/pointer resize,
fullscreen entry, local Escape exit, focus restoration, state preservation, reduced motion, and
zero overflow. At 390×844 and 767px verify 44px actions and full-width topology; at 768px verify
compact desktop geometry. Do not mutate conversation or database data. Restore the browser state
afterward.

Completed with the authenticated diagram fixture. The available browser capability supports
viewport overrides but not reduced-motion media emulation, so reduced motion was verified through
the executable `useReducedMotion`/zero-duration contract; all remaining interactions were verified
in-browser. Browser review also exposed and fixed a narrow-overlay separator that consumed 10px.

---

## Phase 3C — Renderer Internals

### Task 7: Correct SQL query-tab semantics without changing editor state

**Files:**
- Modify: `front-end/src/features/sidebar-right/artifacts/sql-workspace/QueryTabs.jsx`
- Modify: other `sql-workspace/**` files only if the audit identifies a verified responsive or
  overflow conflict

**Produces:** Sibling tab-selection and Close controls with preserved query callbacks and state.

- [x] **Step 1: Confirm the nested-interaction audit fails**

Require absence of `role="button"` inside a query selection control and require a labeled
`role="tablist"`, native selection buttons with `role="tab"`/`aria-selected`, and sibling native
Close buttons. Run `npm run audit:workspace`; expected SQL semantic assertions FAIL.

- [x] **Step 2: Replace ToggleButton nesting with a noninteractive tab item wrapper**

Render the scrolling collection as a labeled tablist. For each tab, render a noninteractive
wrapper containing:

```jsx
<Button
  type="button"
  role="tab"
  aria-selected={active}
  aria-controls={`sql-query-panel-${tab.id}`}
  onClick={() => onTabChange(tab.id)}
>
  {/* existing icon, title, and dirty indicator */}
</Button>
{tabs.length > 1 ? (
  <IconButton
    aria-label={`Close ${tab.title}`}
    onClick={() => onTabClose(tab.id)}
  >
    <CloseIcon />
  </IconButton>
) : null}
```

Keep stable `tab.id` keys, title truncation, dirty indication, selected background, horizontal
scrolling, and add/select/close callback signatures. Do not remount `QueryWorkspace` or change
active-tab state ownership.

- [x] **Step 3: Apply responsive geometry and keyboard behavior**

The selection and Close controls are independently focusable. Below 768px each reaches 44px; at
desktop the tab retains compact height. Native buttons own Enter/Space activation. Arrow-key tab
navigation is optional only if an existing handler already supports it; do not add a partial custom
roving-tabindex implementation in this compliance pass.

- [x] **Step 4: Align panel IDs if required**

If `QueryWorkspace` exposes the active panel, add a matching stable `id` and `role="tabpanel"`.
Only add `aria-controls` when the target exists. Do not add dangling ARIA references.

- [x] **Step 5: Run focused validation**

Run:

```bash
cd front-end && npm run audit:workspace
cd front-end && npm run audit:interaction
cd front-end && npx eslint src/features/sidebar-right/artifacts/sql-workspace
```

Expected: SQL semantic/responsive contracts PASS. If no safe connected-database fixture exists,
record browser coverage as unavailable rather than manufacturing one.

---

### Task 8: Schema mindmap and diagram interaction compliance

**Files:**
- Modify: `front-end/src/features/overlays/mindmap/SchemaMindmapDialog.jsx`
- Modify: `front-end/src/features/overlays/database/SchemaFlowDiagram.jsx` only for verified gaps
- Modify: `front-end/src/features/sidebar-right/artifacts/diagram-flow/DiagramFlowRenderer.jsx`
  only for verified gaps

**Produces:** A focus-correct, reduced-motion, touch-safe whole-screen schema dialog and consistent
diagram surrounding chrome.

- [x] **Step 1: Confirm schema-dialog assertions fail**

Run `npm run audit:workspace`. Expected: schema Close geometry, focus ownership, and reduced-motion
assertions FAIL.

- [x] **Step 2: Restore true-modal focus behavior for the schema mindmap**

Because the schema mindmap covers the whole application, remove `disableAutoFocus`,
`disableEnforceFocus`, and `disableRestoreFocus` unless a verified React Flow regression requires a
narrower targeted exception. Focus the Close action or heading on entry, keep focus contained, and
allow MUI's dialog `onClose` to own Escape/restoration.

- [x] **Step 3: Make Close responsive and pill-shaped**

Use `{ xs: 44, md: 34 }` with `theme.shape.radius.pill`. Preserve the accessible name, current
header alignment, and full-screen layout.

- [x] **Step 4: Respect reduced motion and name asynchronous states**

Use `useReducedMotion` to set dialog/container/paper transition duration to zero when requested.
Give loading/Suspense fallback a named status region and the no-schema state suitable status text.
Do not alter React Flow panning, zoom, node expansion, Dagre layout, schema data, or node identity.

- [x] **Step 5: Inspect renderer chrome before changing it**

Verify the existing diagram artifact through `ArtifactShell`: neutral panel chrome, responsive
actions inherited from Phase 3B, meaningful node differentiation, and contained overflow. If it
passes, leave `DiagramFlowRenderer.jsx` unchanged. Only patch a verified local override that
defeats the shared contract.

- [x] **Step 6: Run focused validation**

Run:

```bash
cd front-end && npm run audit:workspace
cd front-end && npm run audit:interaction
cd front-end && npx eslint \
  src/features/overlays/mindmap/SchemaMindmapDialog.jsx \
  src/features/overlays/database/SchemaFlowDiagram.jsx \
  src/features/sidebar-right/artifacts/diagram-flow/DiagramFlowRenderer.jsx
```

Expected: schema/diagram contracts PASS without graph behavior changes.

---

### Task 9: Data-visualization state and containment verification

**Files:**
- Modify:
  `front-end/src/features/sidebar-right/artifacts/data-visualization/DataVisualizationPanel.jsx`
  only for verified gaps
- Modify:
  `front-end/src/features/sidebar-right/artifacts/data-visualization/PerspectiveDashboard.jsx`
  only for a verified public-wrapper containment gap

**Produces:** Shared artifact states and narrow containment around an unchanged Perspective viewer.

- [x] **Step 1: Run the focused visualization contracts before editing**

Verify:

- Empty data uses `ArtifactEmptyState`.
- Truncation is an alert with text, not color alone.
- Viewer containers use `flex: 1`, `minHeight: 0`, and `minWidth: 0`.
- The outer renderer owns `overflow: hidden`.
- Header/footer actions inherit Phase 3B responsive geometry.
- Perspective remains lazy-loaded and no private shadow-DOM CSS is introduced.

If all assertions pass, do not edit the visualization files.

- [x] **Step 2: Add only the missing surrounding contract**

If a focused assertion fails, patch only the public React wrapper or shared state call site. Do not
change `memoizedData`, schema inference, storage keys, saved viewer configuration, selection data,
exports/downloads, or Perspective plugin registration.

- [x] **Step 3: Run focused validation**

Run:

```bash
cd front-end && npm run audit:workspace
cd front-end && npx eslint src/features/sidebar-right/artifacts/data-visualization
```

Expected: visualization contracts PASS. Browser verification remains fixture-limited when no safe
existing result artifact is available.

---

### Task 10: Full regression validation, cleanup, and audit documentation

**Files:**
- Review: every file changed in Tasks 1–9
- Modify: `docs/frontend-ui-audit/phases.md`
- Modify: `docs/frontend-ui-audit/memory.md`

- [x] **Step 1: Review every changed file**

Inspect the scoped diff for dead imports, obsolete local style objects, document listeners,
duplicated responsive values, generic focus handlers, console/debug statements, stale comments,
unused props, and accidental formatting. Remove only code made obsolete by this phase.

Run:

```bash
git diff --check
git diff --stat
git status --short
```

Distinguish the Phase 3 diff from pre-existing/user-owned worktree changes.

- [x] **Step 2: Run focused and existing Node tests**

Run:

```bash
cd front-end && node --test \
  src/theme/mode.test.js \
  src/config/userSettings.test.js \
  src/pages/Landing/landingContent.test.js \
  src/utils/authUserProfile.test.js \
  src/features/sidebar-left/profileSettingsModel.test.js \
  src/features/sidebar-left/conversationListModel.test.js
```

Expected: all tests PASS.

- [x] **Step 3: Run the full automated regression suite**

Run:

```bash
cd front-end && npm run audit:workspace
cd front-end && npm run audit:dark
cd front-end && npm run audit:theme
cd front-end && npm run audit:interaction
cd front-end && npm run audit:input-focus
cd front-end && npm run lint
cd front-end && npm run knip
cd front-end && npm run build
```

Expected: every command exits 0. The build may retain the pre-existing oversized Perspective
vendor chunk warning; report any other warning or failure and investigate whether Phase 3 caused
it.

- [x] **Step 4: Run the final authenticated browser matrix**

Safely verify:

- 1302×926: Settings, Database, nested menus, confirmation cancellation, artifact
  open/close/resize/fullscreen, focus return, and available diagram/renderer states.
- 390×844 and 767px: 44px controls, drawer-to-preference ordering, full-width panels, topmost
  Escape, artifact topology, and zero document overflow.
- 768px: compact desktop controls and persistent-sidebar topology begin at the boundary.
- Reduced motion: drawer/preference/toast/fullscreen/schema transitions remain functional without
  nonessential animation.
- SQL, schema, Perspective, loading, error, and toast states only when reachable from existing safe
  fixtures.

Cancel dialogs; do not submit forms, connect/query/disconnect a database, mutate conversations,
change settings, sign out, or trigger downloads/clipboard writes merely for validation. Restore the
authenticated conversation URL, desktop viewport, expanded sidebar, and closed overlays/artifact
state after review.

- [x] **Step 5: Update audit documentation with exact evidence**

In `phases.md`, mark Phase 3 complete only if every exit criterion passes. Record exact automated
commands, viewport checks, reachable renderer evidence, unavailable fixtures, and the existing
Perspective warning.

In `memory.md`, add the Phase 3 completion summary, important decisions, files/areas changed, and
remaining fixture limitations. Advance Current Focus/Next Recommended Task to Phase 4 only after
Phase 3 is genuinely complete.

- [x] **Step 6: Perform the mandatory self-review**

Review correctness, focus/Escape order, modal topology, responsive boundary, renderer identity,
third-party state preservation, accessibility, security/data safety, performance, maintainability,
and scope. Fix discovered Phase 3 issues and rerun the smallest affected checks followed by the
full regression suite.

---

## Final Acceptance Checklist

- [x] Settings and Database controls are 44px through 767px and compact from 768px.
- [x] Preference action buttons are pill-shaped; cards, rows, nav rows, and fields retain 8px.
- [x] Database navigation is neutral and input/single-surface corrections remain intact.
- [x] Mobile drawer exits before Settings/Database opens; no orphaned tooltip/focus remains.
- [x] Preference entry/exit focus is deterministic without blocking intentional desktop sidebar
  use.
- [x] Topmost overlays own Escape; Database has no document-level Escape listener.
- [x] Confirmation actions and toast dismissal are responsive and keyboard-visible.
- [x] Notifications expose correct live semantics and auto-dismiss independently of motion.
- [x] Artifact actions are responsive; resize behavior remains semantic and bounded.
- [x] Fullscreen preserves one renderer, exits locally with Escape, restores focus, and reduces
  motion.
- [x] SQL query selection and Close are sibling native controls with accurate semantics.
- [x] Schema mindmap is a focus-managed full-screen dialog with responsive Close and reduced motion.
- [x] Diagram and Perspective data/layout/configuration behavior is unchanged.
- [x] Existing dark/theme/interaction/input-focus audits, tests, lint, Knip, and build pass.
- [x] Browser state is restored and no application data was changed during validation.
- [x] Documentation records verified evidence and honest fixture limitations.
