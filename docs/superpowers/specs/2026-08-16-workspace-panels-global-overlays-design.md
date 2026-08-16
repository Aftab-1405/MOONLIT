# Workspace Panels and Global Overlays Compliance Design

## Objective

Align the authenticated chat journey's preference surfaces, global dialogs, notifications,
artifact panel, SQL workspace, diagrams, and data-visualization chrome with
`front-end/DESIGN.md` while preserving their existing data flow, lazy-loading boundaries, and
third-party renderer state.

Phase 3 is intentionally split into three reviewable subphases:

1. **Phase 3A — Shared overlays and preferences**
2. **Phase 3B — Artifact shell and panel behavior**
3. **Phase 3C — SQL, diagram, and visualization renderer internals**

Each subphase must pass its focused validation before the next begins. This is a compliance and
accessibility pass, not an architectural rewrite.

## Current Architecture

`features/shell/GlobalOverlays.jsx` is the single shell-level mount point for the Database and
Settings preference surfaces, the schema mindmap, confirmation dialogs, and transient
notifications. Settings and Database compose the shared
`features/overlays/preference-surface/**` layout and styling primitives through
`components/common/DialogShell.jsx`. Confirmation flows reuse `ConfirmDialog.jsx`.

The preference surfaces intentionally occupy the main-content region while leaving the persistent
desktop sidebar available. They currently opt out of MUI's default automatic focus, focus
enforcement, and focus restoration. This partial-modal topology must remain supported; Phase 3A
must coordinate focus explicitly rather than blindly turning every preference surface into a
whole-application focus trap.

`features/sidebar-right/artifact-loader/ArtifactLoader.jsx` selects a lazy renderer from the
artifact registry and preserves one renderer instance while toggling fullscreen through CSS. The
shared `ArtifactLayout.jsx` primitives own panel headers, action controls, toolbars, bodies,
footers, and empty states. `AppShell` owns column width and the shared `ResizeHandle` owns keyboard
and pointer resizing.

Renderer-specific UI remains under:

- `features/sidebar-right/artifacts/sql-workspace/**` for CodeMirror, query tabs, schema browsing,
  execution status, and results.
- `features/sidebar-right/artifacts/diagram-flow/**` and
  `features/overlays/database/SchemaFlowDiagram.jsx` for React Flow diagrams.
- `features/sidebar-right/artifacts/data-visualization/**` for Perspective-backed results.

These third-party integrations and their lazy boundaries remain intact.

## Verified Compliance Gaps

### Shared preferences and dialogs

- Preference selects, segmented items, and action buttons use fixed 32–34px geometry at narrow
  viewports. The canonical mobile requirement is a minimum 44×44px target below 768px.
- Preference and confirmation actions use 8–10px radii even though actionable buttons use the
  canonical pill radius; cards, rows, fields, and grouped surfaces retain 8px radii.
- `DatabaseModal` installs a document-level Escape listener in addition to the MUI dialog close
  path. This can bypass topmost-overlay ordering and duplicate close handling.
- Opening a main-content preference surface from the mobile drawer can unmount the original
  trigger while its tooltip or focus state remains visible. Focus restoration then falls back to
  the document instead of a stable shell control.
- Database-type navigation applies provider-specific cyan/red text to general navigation. The
  canonical system reserves accent color for meaningful product/status moments; preference
  navigation should use the established neutral selected/unselected treatment.
- `DialogShell` icon actions and schema-mindmap Close remain 34px on mobile.
- `ConfirmDialog` actions remain 38px and rectangular on mobile.

### Notifications and motion

- Notifications do not expose status/alert live-region semantics, so transient results may not be
  announced.
- The notification dismiss control is substantially smaller than the 44px mobile target.
- Toast entry, progress, loading rotation, schema overlay transitions, and artifact fullscreen
  transitions do not consistently honor reduced-motion preferences.

### Artifact shell and fullscreen

- Shared artifact actions use fixed compact geometry without a viewport-based 44px override.
- Fullscreen preserves renderer state correctly, but it has no shell-owned Escape exit, initial
  focus target, or deterministic focus restoration.
- The fullscreen backdrop animates unconditionally.
- Loading, unsupported-renderer, and renderer-error states exist, but their shared status semantics
  and responsive action geometry are not enforced as one executable contract.

### Renderer internals

- SQL query tabs render a focusable close control inside a focusable toggle button. Nested
  interactive semantics create ambiguous keyboard and assistive-technology behavior.
- Several SQL and diagram utility controls rely on pointer-capability media queries for touch
  sizing instead of the canonical 768px viewport boundary.
- The full-screen schema mindmap disables all default dialog focus behaviors and gives its Close
  action compact rectangular geometry at mobile widths.
- Renderer loading, empty, and error treatments are implemented independently and can drift from
  the shared artifact shell.
- Database-dependent SQL and visualization states are not safely repeatable in the current local
  fixture. Unreachable states must be verified through focused source/runtime contracts and
  reported as fixture limitations, not claimed as visual evidence.

## Phase 3A — Shared Overlays and Preferences

### Responsive control contract

- Preference rows, fields, and cards retain the canonical 8px radius.
- Buttons and independently actionable icon controls use the canonical pill radius.
- Desktop controls retain the established compact density where it remains usable.
- Below 768px, selects, segmented items, Close, Reset, Connect/Disconnect, confirmation actions,
  toast dismissal, and other independently actionable controls reach at least 44×44px.
- Responsive sizing is driven by the established viewport breakpoint rather than pointer type.

The implementation should extend the existing preference and shared-interaction helpers instead
of duplicating per-component mobile overrides. Shared changes must be scoped so unrelated
completed chat/sidebar geometry does not change.

### Preference-surface focus and dismissal

- Settings and Database retain their main-content-region topology and do not block intentional
  desktop sidebar access.
- Each surface receives deterministic initial focus on its own first meaningful heading or
  control, without forcing focus into a credential field.
- Escape closes only the topmost MUI-managed menu, popover, or dialog layer.
- `DatabaseModal` removes its document-level Escape listener and uses the controlled dialog close
  path.
- When a preference surface opens from the mobile drawer, the drawer and any tooltip/popover close
  before the preference surface becomes interactive.
- Closing restores focus to a connected stable trigger. If the original mobile trigger unmounted,
  focus moves to the current `Open sidebar` control rather than the document body.
- No focus trap is introduced across the persistent desktop sidebar unless the overlay is a true
  whole-application modal such as a confirmation dialog.

### Neutral navigation and surfaces

- Settings and Database navigation use the same neutral primary/secondary text and selected-row
  treatment.
- Database engine identity may remain in meaningful icons or technical content, but general nav
  labels do not use arbitrary provider colors.
- Existing corrected input surfaces remain `#191919` with one hairline and no nested focus outline
  or shadow.
- Existing transparent segmented-control wrappers and the Connection mode row's single-surface
  treatment remain unchanged.
- Preference-row alternation remains subtle and may not create nested or dual-tone control
  backgrounds.

### Notifications and confirmation dialogs

- Error notifications use `role="alert"`/assertive announcement behavior.
- Success, information, warning, and loading notifications use polite status semantics unless the
  caller explicitly represents an urgent failure.
- Announced text includes the title and message without announcing decorative icons.
- Dismiss controls are native buttons with visible keyboard focus and responsive touch geometry.
- Confirmation dialogs retain loading guards and duplicate-submission protection while adopting
  responsive pill actions.
- Reduced motion removes nonessential toast, progress, dialog, and loading rotations without
  changing duration, state transitions, or dismissal behavior.

## Phase 3B — Artifact Shell and Panel Behavior

### Shared panel chrome

- `ArtifactLayout` remains the owner of header, toolbar, body, footer, action, and empty-state
  presentation.
- Headers and toolbars use canonical canvas/paper/code surfaces, hairline dividers, and no shadows.
- Icon actions remain compact on desktop and become 44×44px below 768px.
- Action hover, active, disabled, and focus-visible states remain distinguishable without relying
  on color alone.
- Loading, empty, unsupported, and error states share consistent spacing, typography, status
  semantics, and responsive behavior.

### Resize and responsive layout

- The existing resizable desktop column, min/max width constraints, pointer cleanup, and arrow-key
  resizing remain unchanged unless a verified defect requires a targeted correction.
- The separator keeps its semantic role and accessible value/orientation metadata.
- At narrow widths the artifact occupies the intended single-column/full-width topology, contains
  long content, and does not create document-level horizontal overflow.
- No change is made to chat message ordering or artifact selection data flow.

### Fullscreen interaction

- Preserve the single mounted renderer instance and its editor/viewer state.
- Entering fullscreen records the invoking action, exposes a clear Exit fullscreen control, and
  places focus on that control or the fullscreen artifact region.
- Escape exits fullscreen before affecting the underlying chat or sidebar.
- Exiting returns focus to the connected fullscreen trigger when possible.
- Closing an artifact while fullscreen exits fullscreen first and follows the established panel
  close path.
- Reduced motion removes the fullscreen fade/backdrop animation while preserving the state change.

## Phase 3C — Renderer Internals

### SQL workspace

- Query selection and query closing become sibling native controls inside a noninteractive tab
  item wrapper; no focusable element contains another focusable element.
- The selected query exposes accurate tab/selection semantics, and Close has a descriptive name.
- Dirty-state indication remains visible and is not conveyed by color alone.
- Closing, adding, selecting, and horizontally scrolling query tabs preserve existing editor
  state and callbacks.
- Schema explorer, editor actions, result actions, and status controls follow the shared responsive
  control contract.
- CodeMirror theme, SQL execution, confirmation, database prerequisites, result data, and query
  persistence are not redesigned.

### Diagram and schema surfaces

- Diagram headers and controls reuse artifact-shell geometry and neutral chrome.
- React Flow nodes may retain meaningful diagram differentiation, while surrounding navigation and
  controls use canonical neutral surfaces.
- The schema mindmap receives deterministic initial focus, topmost Escape behavior, focus
  restoration, mobile 44px actions, and reduced-motion handling.
- Loading and no-schema states are named status regions with canonical spacing.
- Panning, zooming, node expansion, layout calculation, and schema data remain functionally
  unchanged.

### Data visualization

- Perspective remains lazy-loaded and is not replaced, reconfigured, or restyled through private
  internals without a verified need.
- The surrounding header, action controls, loading, empty, and error states use the shared artifact
  contract.
- Narrow layouts contain the viewer within the artifact region and avoid document-level overflow.
- Visualization data, source-query metadata, and viewer configuration remain intact across
  resize/fullscreen transitions.

## State and Data Flow

No new global store, API, or backend contract is introduced.

Overlay open state remains owned by the existing chat-page controller and shell. Focus-return
targets may be passed through existing shell callbacks/refs or captured at the shared overlay
boundary, but raw document queries and new global event buses are out of scope. MUI remains the
owner of dialog/menu stacking and Escape ordering.

Artifact selection and column geometry remain owned by the current shell. Fullscreen remains local
to `ArtifactLoader`; it adds only interaction bookkeeping for Escape and focus restoration.
Renderer callbacks continue to flow through the artifact registry's `common` props.

SQL tab topology may change to correct semantics, but tab data, active ID, dirty state, and
add/select/close callbacks remain unchanged.

## Accessibility Contract

- No interactive control contains another interactive control.
- Every independently actionable control has a descriptive accessible name and visible
  focus-visible state.
- Controls below 768px meet the 44×44px minimum; desktop may remain compact.
- True modal dialogs trap focus and restore it; main-content preference surfaces coordinate focus
  without blocking intentional persistent-sidebar interaction.
- Escape is handled by the topmost active layer: menu/popover, confirmation or preference dialog,
  artifact fullscreen, then underlying shell.
- Notifications and asynchronous renderer states expose suitable alert/status live semantics.
- Motion respects `prefers-reduced-motion` without changing functional timing guarantees such as
  toast auto-dismissal.
- Selected, dirty, warning, and error states are not communicated by color alone.

## Files Expected to Change

The implementation plan will narrow each subphase to the smallest required set. Expected areas are:

- `front-end/src/features/overlays/preference-surface/**`
- `front-end/src/features/overlays/settings/SettingsModal.jsx`
- `front-end/src/features/overlays/database/DatabaseModal.jsx`
- `front-end/src/features/overlays/mindmap/SchemaMindmapDialog.jsx`
- `front-end/src/features/shell/GlobalOverlays.jsx`
- `front-end/src/components/common/DialogShell.jsx`
- `front-end/src/components/common/ConfirmDialog.jsx`
- `front-end/src/components/ui/toast.jsx`
- `front-end/src/features/sidebar-right/artifact-loader/**`
- `front-end/src/features/sidebar-right/artifacts/sql-workspace/**`
- `front-end/src/features/sidebar-right/artifacts/diagram-flow/**`
- `front-end/src/features/sidebar-right/artifacts/data-visualization/**`
- Directly shared interaction/style helpers only where a scoped helper extension avoids
  duplication
- Focused model/runtime tests and relevant design audit scripts
- Phase audit documentation after each completed subphase

`front-end/DESIGN.md` remains unchanged.

## Testing and Validation

### Test-first automated validation

- Add focused failing tests or executable runtime/source contracts before each behavior change.
- Cover responsive preference geometry, neutral nav treatment, topmost Escape behavior, focus
  restoration fallback, notification semantics, reduced motion, fullscreen focus/Escape, and SQL
  tab sibling semantics.
- Run affected existing Node/component tests after every subphase.
- Run dark-theme, theme-contrast, interaction-contrast, and input-focus audits.
- Run ESLint, Knip, and the production build.
- Keep the existing Perspective chunk-size warning visible and distinguish it from regressions.

### Authenticated browser matrix

- **Desktop 1302×926:** Settings and Database navigation, focus entry/exit, menus, confirmation
  cancellation, toast behavior when safely triggerable, artifact open/close/resize/fullscreen, SQL
  tabs when a fixture exists, and no overflow.
- **Mobile 390×844 and boundary 767px:** full-width preference surfaces, 44px controls, drawer to
  modal coordination, stable focus restoration, topmost Escape order, artifact topology, and zero
  document overflow.
- **Desktop boundary 768px:** compact desktop controls and persistent-sidebar topology begin exactly
  at the established breakpoint.
- **Reduced motion:** preference, toast, fullscreen, and diagram behavior remain functional with
  motion suppressed.
- **Renderer states:** exercise existing conversation/database fixtures only. Do not connect,
  switch, query, mutate, or disconnect a database solely to manufacture visual evidence.

Unavailable SQL execution, Perspective, schema, toast, error, and loading fixtures are recorded as
limitations and covered by executable contracts where possible. They are never reported as visual
passes without reachable evidence.

## Risks and Mitigations

- **Shared-helper blast radius:** Responsive geometry changes can affect completed phases. Add
  scoped helper options or preference/artifact helpers and rerun Phase 1/2 audits.
- **Partial-modal focus:** Enabling MUI defaults indiscriminately could make the persistent sidebar
  unusable. Preserve the main-content topology and test focus entry, Escape, nested menus, and
  fallback restoration explicitly.
- **Escape conflicts:** Document listeners can close multiple layers. Remove local global listeners
  and let the owning layer handle Escape in defined priority order.
- **Renderer state loss:** Changing fullscreen or tab markup can remount third-party components.
  Preserve renderer identity and stable keys; verify editor/viewer state across transitions where
  fixtures exist.
- **Third-party CSS:** CodeMirror, React Flow, and Perspective may resist generic overrides. Limit
  changes to public theme/configuration hooks and surrounding chrome.
- **Dirty worktree:** Preserve unrelated and user-owned changes, avoid broad formatting, and do not
  commit automatically.

## Scope Boundaries

- No backend, API, authentication, authorization, database-schema, or persistence changes.
- No new dependency, global state store, event bus, or replacement UI framework.
- No redesign of CodeMirror, React Flow, or Perspective behavior.
- No database connection, query execution, conversation mutation, settings reset, account change,
  or sign-out during visual validation.
- No speculative redesign of unreachable renderer states.
- No change to completed chat, transcript, or sidebar behavior except a narrowly required shared
  primitive correction backed by regression checks.
- No change to `front-end/DESIGN.md`.
- No automatic commit, push, or pull request.

## Exit Criteria

Phase 3 is complete only when:

1. Phase 3A, 3B, and 3C have each passed their focused automated checks and reachable browser
   matrix.
2. Mobile controls meet 44px through 767px and desktop density begins at 768px.
3. Preference surfaces, dialogs, notifications, fullscreen artifacts, and SQL tabs meet the
   documented focus, Escape, semantics, and reduced-motion contracts.
4. Existing overlay, artifact, editor, diagram, and visualization data flow remains unchanged.
5. Unreachable states and the existing Perspective build warning are reported honestly.
6. Audit documentation records exact validation evidence and remaining fixture limitations.
