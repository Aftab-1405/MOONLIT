# AI Context Segmented Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant outer background from the AI Context Databases/Queries control by making it consume Moonlit's established Settings segmented-control style.

**Architecture:** Keep view state, toolbar layout, labels, icons, and count badges local to `UserDBContextManagerForAI`. Replace only the component's duplicated `ToggleButtonGroup` chrome with the existing `getPreferenceToggleGroupSx(theme)` helper, and protect that contract with the existing Vite-backed UI style audit.

**Tech Stack:** React 19, Material UI 7, Vite SSR audit scripts, ESLint, Knip

## Global Constraints

- The group wrapper must be transparent, padding-free, borderless, and shadowless.
- Selected, hover, and keyboard-focus treatment must remain button-level behavior supplied by the shared helper.
- Preserve labels, icons, counts, selection logic, responsive wrapping, and the surrounding toolbar layout.
- Do not change global MUI overrides or unrelated `ToggleButtonGroup` instances.
- Add no dependencies.
- Work in the approved current checkout and do not commit the user's existing dirty worktree.

---

## File Map

- Modify `front-end/scripts/audit-input-focus.mjs`: add a regression contract for the shared Settings segmented-control styles.
- Modify `front-end/src/features/overlays/settings/UserDBContextManagerForAI.jsx`: replace the bespoke segmented-control `sx` block with the shared preference helper.
- Reference only `front-end/src/features/overlays/preference-surface/preferenceSurfaceStyles.js`: this already exports the approved `getPreferenceToggleGroupSx(theme)` interface and needs no production change.

### Task 1: Add the segmented-control regression contract

**Files:**
- Modify: `front-end/scripts/audit-input-focus.mjs`
- Reference: `front-end/src/features/overlays/preference-surface/preferenceSurfaceStyles.js:121-122`
- Test: `front-end/scripts/audit-input-focus.mjs`

**Interfaces:**
- Consumes: `getPreferenceToggleGroupSx(theme) -> MUI SystemStyleObject`
- Produces: an automated contract that prevents the shared helper from regaining wrapper chrome or losing button-level selection styling

- [x] **Step 1: Load the shared toggle helper in the existing Vite SSR audit**

Extend the fourth destructured module result so the audit receives both preference helpers:

```js
    {
      getPreferenceControlSx,
      getPreferenceToggleGroupSx,
    },
```

- [x] **Step 2: Assert the shared wrapper and selected-button contract**

After the existing preference-control assertions, add:

```js
  const preferenceToggleGroup = getPreferenceToggleGroupSx(theme);
  expectValue('preference toggle wrapper background', preferenceToggleGroup.backgroundColor, 'transparent');
  expectValue('preference toggle wrapper padding', preferenceToggleGroup.p, 0);
  expectValue('preference toggle wrapper border', preferenceToggleGroup.border, 'none');
  expectValue('preference toggle wrapper shadow', preferenceToggleGroup.boxShadow, 'none');

  const preferenceToggleButton =
    preferenceToggleGroup['& .MuiToggleButtonGroup-grouped'];
  expectValue(
    'preference toggle idle background',
    preferenceToggleButton?.backgroundColor,
    'transparent',
  );
  if (!preferenceToggleButton?.['&.Mui-selected']?.backgroundColor) {
    fail('preference toggle selected state must retain a button-level background.');
  }
```

- [x] **Step 3: Run the automated helper contract**

Run:

```bash
cd front-end && npm run audit:input-focus
```

Expected: PASS. The helper already has the desired behavior; this new automated assertion protects that behavior without coupling the test to component source text.

- [x] **Step 4: Confirm the rendered bug as the RED test**

In the existing local app, open Settings > AI Context and read the live `ToggleButtonGroup` computed styles before changing production code.

```text
background-color = rgba(255, 255, 255, 0.04)
padding = 4px
```

Expected: the rendered control fails the acceptance contract because its wrapper is neither transparent nor padding-free. This is the behavior-level RED proof; replacing the local styling with the shared helper is the production change that must make it pass.

- [x] **Step 5: Review the test diff**

Run:

```bash
git diff --check -- front-end/scripts/audit-input-focus.mjs
git diff -- front-end/scripts/audit-input-focus.mjs
```

Expected: no whitespace errors; the diff contains only the new helper load and the targeted regression assertions. Do not commit because this checkout contains user-owned changes.

### Task 2: Adopt the shared segmented-control styling

**Files:**
- Modify: `front-end/src/features/overlays/settings/UserDBContextManagerForAI.jsx:1-30,163-166,269-305`
- Test: `front-end/scripts/audit-input-focus.mjs`

**Interfaces:**
- Consumes: `getPreferenceToggleGroupSx(theme) -> MUI SystemStyleObject`
- Produces: `toggleGroupSx`, memoized for the current MUI theme and passed directly to the AI Context `ToggleButtonGroup`

- [x] **Step 1: Import the established Settings helper**

Add the existing preference-surface import without altering `getUtilityIconButtonSx`:

```js
import { getPreferenceToggleGroupSx } from '@/features/overlays/preference-surface/preferenceSurfaceStyles';
```

- [x] **Step 2: Memoize the theme-derived style object**

Immediately after the existing `utilityIconButtonSx` declaration, add:

```js
  const toggleGroupSx = useMemo(() => getPreferenceToggleGroupSx(theme), [theme]);
```

- [x] **Step 3: Replace only the duplicated group styling**

Replace the `ToggleButtonGroup`'s complete inline `sx={{ ... }}` object with:

```jsx
          sx={toggleGroupSx}
```

Keep `value`, `exclusive`, `onChange`, `size`, both `ToggleButton` children, icons, badges, and the surrounding toolbar unchanged.

- [x] **Step 4: Run the focused audit and confirm GREEN**

Run:

```bash
cd front-end && npm run audit:input-focus
```

Expected: PASS with the audit's success message and no failures.

- [x] **Step 5: Run static and production regression validation**

Run each command from `front-end`:

```bash
npm run lint
npm run knip
npm run build
```

Expected: all commands exit 0. If any command fails, distinguish a new failure from the dirty checkout's existing state before changing additional files.

- [x] **Step 6: Perform the browser sanity check**

With the existing local app open, navigate to Settings > AI Context and inspect the Databases/Queries control in both selected states. Verify:

```text
ToggleButtonGroup: background-color = transparent; padding = 0px; box-shadow = none
Selected ToggleButton: retains a visible selected background
Databases/Queries switching: unchanged
Count badges: unchanged
Keyboard focus: visible on the focused button
Narrow viewport: buttons still wrap without overflow
```

- [x] **Step 7: Clean and self-review the complete diff**

Run:

```bash
git diff --check -- front-end/scripts/audit-input-focus.mjs front-end/src/features/overlays/settings/UserDBContextManagerForAI.jsx
git diff -- front-end/scripts/audit-input-focus.mjs front-end/src/features/overlays/settings/UserDBContextManagerForAI.jsx
```

Confirm there are no unused imports, debug statements, commented-out styles, unrelated formatting changes, or modifications to labels and behavior. Do not commit the user's existing dirty worktree.
