# Connection Method Row Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant inner background from the Connect Database dialog's lone Connection mode row while preserving its section card and segmented-button states.

**Architecture:** Keep the shared `PreferenceRow` alternating treatment unchanged for multi-row Settings sections. Override only the Connection mode row at its `DatabaseModal.jsx` call site, then verify the user-visible surface hierarchy through computed styles in the running app.

**Tech Stack:** React 19, Material UI 7, Vite, ESLint, Knip

## Global Constraints

- The Connection mode row must compute to a transparent background.
- The Connection Method section must retain its existing `rgb(25, 25, 25)` surface and border.
- Selected, hover, and keyboard-focus treatment must remain button-level behavior from `getPreferenceToggleGroupSx(theme)`.
- Preserve labels, icons, switching behavior, spacing, and responsive layout.
- Do not change the shared `PreferenceRow` API or global alternating-row styling.
- Add no dependencies.
- Work in the approved current checkout and do not commit the user's existing dirty worktree.

---

## File Map

- Modify `front-end/src/features/overlays/database/DatabaseModal.jsx`: add one local transparent background override to the Connection mode `PreferenceRow`.
- Reference only `front-end/src/features/overlays/preference-surface/PreferenceSurface.jsx`: its shared row styling and `sx` merge order remain unchanged.
- Reference only `front-end/src/features/overlays/preference-surface/preferenceSurfaceStyles.js`: the segmented-control helper remains unchanged.

### Task 1: Flatten the Connection mode row surface

**Files:**
- Modify: `front-end/src/features/overlays/database/DatabaseModal.jsx:604-624`
- Reference: `front-end/src/features/overlays/preference-surface/PreferenceSurface.jsx:237-285`
- Browser test: Connect Database > PostgreSQL > Connection Method

**Interfaces:**
- Consumes: `PreferenceRow({ label, description, children, sx })`, where local `sx` is merged after shared row styling
- Produces: a transparent Connection mode row over the unchanged Connection Method section surface

- [x] **Step 1: Confirm the rendered RED reproduction**

In the existing local app, open Connect Database with PostgreSQL selected and inspect the element with `role="group"` and accessible name `Connection mode`. Record these computed styles before changing production code:

```text
PreferenceSection background-color: rgb(25, 25, 25)
PreferenceRow background-color: rgba(255, 255, 255, 0.024)
ToggleButtonGroup background-color: transparent
Selected ToggleButton background-color: rgba(255, 255, 255, 0.11)
```

Expected: FAIL against the acceptance contract because the row background is not transparent. The production change that must make this test pass is removal of the local row tint without removing the section or selected-button fills.

- [x] **Step 2: Apply the minimal local override**

Add the following prop to the Connection mode `PreferenceRow`, after `description` and before its closing `>`:

```jsx
            sx={{ backgroundColor: 'transparent' }}
```

The complete opening tag becomes:

```jsx
          <PreferenceRow
            label="Connection mode"
            description="Choose credentials or a full connection URI"
            sx={{ backgroundColor: 'transparent' }}
          >
```

Do not change the nested `ToggleButtonGroup`, either `ToggleButton`, or shared preference-surface files.

- [x] **Step 3: Confirm the rendered GREEN state and interaction behavior**

After Vite hot reloads, inspect the same elements and verify:

```text
PreferenceRow background-color: transparent (computed alpha = 0)
PreferenceSection background-color: rgb(25, 25, 25)
PreferenceSection border: unchanged and visible
Selected ToggleButton background-color: visible and non-transparent
ToggleButtonGroup background-color: transparent
```

Click Connection String, then Credentials. Confirm `aria-pressed="true"` moves to the selected button, the selected fill follows it, and the section/row backgrounds remain unchanged.

- [x] **Step 4: Run the complete available frontend validation**

Run each command from `front-end`:

```bash
npm run audit:interaction
npm run audit:input-focus
npm run audit:dark
npm run audit:theme
npm run lint
npm run knip
npm run build
```

Expected: every command exits 0. The build may retain its existing large-chunk advisory; distinguish that non-failing warning from errors.

- [x] **Step 5: Clean and self-review the scoped diff**

Run:

```bash
git diff --check -- front-end/src/features/overlays/database/DatabaseModal.jsx
git diff -- front-end/src/features/overlays/database/DatabaseModal.jsx
```

Confirm the task adds exactly the local `sx` override, introduces no debug statements or unrelated formatting, and leaves shared Settings behavior untouched. Do not commit because this checkout contains user-owned changes.
