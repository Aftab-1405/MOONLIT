# Neutral Input Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cool `#1a1c20` fill on Moonlit input surfaces with the approved neutral `#191919` semantic input color across Chat, Auth, Settings, Preferences, and sidebar controls.

**Architecture:** Add a dedicated `background.input` role to the existing dark semantic palette and make MUI's outlined-input fallback plus the existing shared/local `sx` helpers consume it. Extend the current Vite-powered input audit before production edits so the token, state matrix, documentation, and all exceptional local input surfaces are enforced from one regression command.

**Tech Stack:** React 19, MUI 7, Emotion `sx`, Vite SSR module loading, Node audit scripts

## Global Constraints

- Input idle, hover, focused, and focused-hover fills must resolve to `#191919`.
- Existing hover borders, error styling, disabled styling, checked/selected behavior, and functional DOM focus must remain.
- Do not change `canvas-soft` or unrelated cards, dialogs, tooltips, navigation hover states, or code surfaces.
- Do not force a filled background onto intentionally underlined MUI `standard` fields.
- Add no dependency and introduce no raw color in application component styles.
- Do not restore light mode.
- Do not commit; preserve the existing inline working-tree workflow.

---

### Task 1: Add failing neutral-input surface assertions

**Files:**
- Modify: `front-end/scripts/audit-input-focus.mjs`
- Modify: `front-end/scripts/audit-interaction-contrast.mjs:52-57,142-150`

**Interfaces:**
- Consumes: `createDarkTheme()`, `getOutlinedFieldStateSx(theme)`, `getComposerSurfaceSx(theme)`, `getPreferenceControlSx(theme)`, and source files read through `readFile()`.
- Produces: `npm run audit:input-focus`, which exits nonzero unless all input surfaces use `theme.palette.background.input === '#191919'` across the required states.

- [x] **Step 1: Extend the input audit with the semantic token and global fallback assertions**

After creating `theme`, define the approved token and assert the global outlined field fallback:

```js
const inputSurface = theme.palette.background.input;
expectValue('semantic input surface', inputSurface, '#191919');
expectValue(
  'MuiTextField outlined background',
  textFieldRoot?.['& .MuiOutlinedInput-root']?.backgroundColor,
  inputSurface,
);
expectValue('MuiOutlinedInput background', outlinedInput?.backgroundColor, inputSurface);
```

Keep every existing focus-neutrality and border assertion.

- [x] **Step 2: Assert the shared and component state matrix**

Add exact background checks after resolving `outlined`, `composer`, and `preferenceControl`:

```js
for (const [label, state] of [
  ['shared outlined idle', outlined],
  ['shared outlined hover', outlined?.['&:hover']],
  ['shared outlined focused', outlined?.['&.Mui-focused']],
  ['shared outlined focused hover', outlined?.['&.Mui-focused:hover']],
]) {
  expectValue(`${label} background`, state?.backgroundColor, inputSurface);
}

expectValue('chat composer background', composer.backgroundColor, inputSurface);

for (const [label, state] of [
  ['preference idle', preferenceControl],
  ['preference hover', preferenceControl?.['&:hover']],
  ['preference focused', preferenceControl?.['&.Mui-focused']],
  ['preference focused hover', preferenceControl?.['&.Mui-focused:hover']],
]) {
  expectValue(`${label} background`, state?.backgroundColor, inputSurface);
}
```

Replace the current preference-focused-hover expectation against
`theme.palette.background.hover` with the loop above.

- [x] **Step 3: Add documentation and local `sx` source assertions**

Read `DESIGN.md`, `SidebarOverlays.jsx`, and `SidebarPrimitives.jsx`, then add:

```js
if (!design.includes('input-surface: "#191919"')) {
  fail('DESIGN.md must define the approved neutral input surface.');
}
if (!design.includes('backgroundColor: "{colors.input-surface}"')) {
  fail('DESIGN.md text-input must consume the neutral input surface.');
}
if (!sidebarOverlays.includes('backgroundColor: theme.palette.background.input')) {
  fail('sidebar search must consume the semantic input surface.');
}
if (!sidebarPrimitives.includes('backgroundColor: theme.palette.background.input')) {
  fail('sidebar inline rename must consume the semantic input surface.');
}
```

Retain the existing source assertions that prohibit `focus-within` and enforce
neutral inline-rename focus.

- [x] **Step 4: Update the interaction audit contract**

Replace the old hard-coded composer token assertion:

```js
if (darkSemanticTokens.background.composer !== '#1a1c20') {
  failures.push(...);
}
```

with:

```js
if (darkSemanticTokens.background.input !== '#191919') {
  failures.push(
    `Input surface must be #191919; received ${darkSemanticTokens.background.input}.`,
  );
}
```

Change the composer surface assertion to:

```js
if (composer.backgroundColor !== tokens.background.input) {
  failures.push(`${mode}/composer: surface must use the semantic input tone.`);
}
```

- [x] **Step 5: Run both audits to verify RED**

Run:

```bash
cd front-end
npm run audit:input-focus
npm run audit:interaction
```

Expected: both commands exit 1. The input audit reports the missing
`background.input` token plus global/shared/local surface mismatches. The
interaction audit reports that the semantic input surface is missing and the
composer still uses `background.composer`.

---

### Task 2: Add the semantic and documented input surface

**Files:**
- Modify: `front-end/src/theme/tokens/semantic.js:4-16`
- Modify: `front-end/src/theme/createMoonlitTheme.js:280-326`
- Modify: `front-end/DESIGN.md:6-24,136-142,270-286,386-390`
- Test: `front-end/scripts/audit-input-focus.mjs`

**Interfaces:**
- Consumes: `primitives.neutral[900]` (`#191919`).
- Produces: `darkSemanticTokens.background.input` and `theme.palette.background.input`, both resolving to `#191919`.

- [x] **Step 1: Add the semantic input role**

Add the role to `DARK_BACKGROUND` without changing any existing mapping:

```js
const DARK_BACKGROUND = Object.freeze({
  default: primitives.neutral[950],
  paper: primitives.neutral[900],
  input: primitives.neutral[900],
  composer: primitives.neutral[850],
  sunken: primitives.neutral[850],
  // existing roles unchanged
});
```

- [x] **Step 2: Apply the token to MUI's outlined-input fallback**

In `MuiTextField.styleOverrides.root`, change only the outlined-input fill:

```js
'& .MuiOutlinedInput-root': {
  borderRadius: cardRadius,
  backgroundColor: S.background.input,
  // existing fieldset rules
},
```

In `MuiOutlinedInput.styleOverrides.root`, add the global fallback before the
existing focus rules:

```js
root: {
  backgroundColor: S.background.input,
  '&.Mui-focused': { outline: 'none', boxShadow: 'none' },
  // existing focused-border rules
},
```

Do not set a background on `MuiInputBase`; doing so would incorrectly fill
underlined `standard` fields and the inner textarea inside the chat composer.

- [x] **Step 3: Update the design source of truth**

Add the dedicated color beside the surface tokens:

```yaml
input-surface: "#191919"
```

Change the `components.text-input.backgroundColor` reference to:

```yaml
backgroundColor: "{colors.input-surface}"
```

In the Colors / Surface prose, document **Input Surface** as neutral charcoal
`#191919` dedicated to form controls. In the Inputs & Forms section, replace the
`canvas-soft` reference with `input-surface` and `#191919`.

- [x] **Step 4: Run the focused audit and inspect the expected remaining failures**

Run:

```bash
cd front-end
npm run audit:input-focus
```

Expected: the semantic token, documentation, and global outlined-input checks
pass. Failures remain for the shared outlined helper, chat composer,
Preferences, sidebar search, and inline rename until Task 3.

---

### Task 3: Route shared and local MUI `sx` input surfaces through the token

**Files:**
- Modify: `front-end/src/styles/shared.js:141-188`
- Modify: `front-end/src/features/styles/interfaceChrome.js:126-140`
- Modify: `front-end/src/features/overlays/preference-surface/preferenceSurfaceStyles.js:59-79`
- Modify: `front-end/src/features/sidebar-left/components/SidebarOverlays.jsx:97-123`
- Modify: `front-end/src/features/sidebar-left/components/SidebarPrimitives.jsx:178-204`
- Test: `front-end/scripts/audit-input-focus.mjs`
- Test: `front-end/scripts/audit-interaction-contrast.mjs`

**Interfaces:**
- Consumes: `theme.palette.background.input: string` from Task 2.
- Produces: a common `#191919` fill for shared outlined controls, Chat composer, Settings/Preferences, Auth, sidebar search, and inline rename.

- [x] **Step 1: Update the shared outlined-field state matrix**

Change the default option and both hover states in `getOutlinedFieldStateSx`:

```js
backgroundColor = theme.palette.background.input,
```

```js
'&:hover': {
  backgroundColor,
},
```

```js
'&.Mui-focused:hover': {
  backgroundColor,
},
```

Keep the focused state on `backgroundColor`, the disabled/error behavior, and
all existing border rules unchanged. Auth and all outlined helper consumers now
inherit the neutral state matrix without page-specific edits.

- [x] **Step 2: Update the chat composer**

In `getComposerSurfaceSx`, replace only the fill:

```js
backgroundColor: theme.palette.background.input,
```

Keep geometry, border, shadow, and focus behavior unchanged.

- [x] **Step 3: Update Preferences and Settings controls**

Because the helper spread already provides the neutral idle/hover state, update
the two locally overridden focus states:

```js
'&.Mui-focused': {
  backgroundColor: theme.palette.background.input,
  outline: 'none',
  boxShadow: 'none',
},
'&.Mui-focused:hover': {
  backgroundColor: theme.palette.background.input,
},
```

Leave the disabled `theme.palette.layer.faint` fill unchanged.

- [x] **Step 4: Update the sidebar-local MUI input surfaces**

In `SidebarOverlays.jsx`, replace the search TextField wrapper fill with:

```js
backgroundColor: theme.palette.background.input,
```

In `SidebarPrimitives.jsx`, replace the inline rename `InputBase` fill with the
same semantic role. Keep its border, focus neutrality, and typography intact.

- [x] **Step 5: Run focused audits to verify GREEN**

Run:

```bash
cd front-end
npm run audit:input-focus
npm run audit:interaction
```

Expected: both commands exit 0. The input audit reports that input surfaces and
focus behavior conform; the interaction audit reports the composer uses the
semantic neutral input tone.

---

### Task 4: Runtime, cleanup, and regression verification

**Files:**
- Review: every file modified in Tasks 1-3
- Verify: Chat, Settings, and Auth/shared helper behavior in the running app

**Interfaces:**
- Consumes: the final theme and MUI `sx` objects.
- Produces: direct evidence that rendered input surfaces are neutral and no existing behavior regressed.

- [x] **Step 1: Verify Chat computed styles**

In the authenticated in-app browser, capture the composer surface before and
after focusing its visible textarea.

Expected in both states:

```json
{
  "backgroundColor": "rgb(25, 25, 25)",
  "borderWidth": "1px",
  "outline": "none",
  "boxShadow": "none"
}
```

Confirm the textarea becomes `document.activeElement` after interaction.

- [x] **Step 2: Verify Settings Select computed styles**

Open Settings without changing any preference. Capture the first closed Select
root at idle and focused, then close the dialog.

Expected: idle and focused backgrounds both equal `rgb(25, 25, 25)`; focus does
not alter the border width, outline, or shadow.

- [x] **Step 3: Verify Auth and remaining local surfaces structurally**

Do not sign the user out solely to reach `/auth`. Confirm through the resolved
shared helper audit that Auth fields inherit `background.input`. Confirm source
assertions cover sidebar search and inline rename. If an unauthenticated session
is already available, additionally inspect an Auth field without changing user
state.

- [x] **Step 4: Run the complete frontend validation suite**

Run:

```bash
cd front-end
node --test src/config/userSettings.test.js src/theme/mode.test.js src/pages/Landing/landingContent.test.js
npm run audit:input-focus
npm run audit:interaction
npm run audit:dark
npm run audit:theme
npm run lint
npm run knip
npm run build
```

Expected: 3 tests pass; every audit exits 0; ESLint and Knip are clean; Vite
builds successfully. Report the existing large `vendor-perspective` chunk
advisory separately if it remains.

- [x] **Step 5: Perform cleanup and self-review**

Review every changed file for unused imports, duplicate style rules, raw
component colors, stale `#1a1c20` input assertions, debug output, unrelated
formatting, and accidental changes to non-input `canvas-soft` consumers.

Run:

```bash
rg -n "#1a1c20|background\.(composer|sunken|hover|input)" \
  front-end/DESIGN.md \
  front-end/scripts/audit-input-focus.mjs \
  front-end/scripts/audit-interaction-contrast.mjs \
  front-end/src/theme \
  front-end/src/styles/shared.js \
  front-end/src/features/styles/interfaceChrome.js \
  front-end/src/features/overlays/preference-surface/preferenceSurfaceStyles.js \
  front-end/src/features/sidebar-left/components/SidebarOverlays.jsx \
  front-end/src/features/sidebar-left/components/SidebarPrimitives.jsx
git diff --check
```

Expected: input-related matches consume `background.input`; `#1a1c20` remains
only in the intentionally unchanged `canvas-soft` design/primitive roles and
other non-input consumers; `git diff --check` exits 0.
