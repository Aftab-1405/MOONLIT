# Disable Input Focus Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every focus-driven visual state from Moonlit's MUI form controls while preserving functional focus and all non-focus states.

**Architecture:** Enforce the behavior in the centralized MUI theme and the existing shared/local `sx` helpers. Add a Vite-powered audit that inspects the actual resolved theme and helper objects, plus source checks for the one local sidebar search wrapper; keep non-input focus rules untouched.

**Tech Stack:** React 19, MUI 7, Emotion `sx`, Vite SSR module loading, Node audit scripts

## Global Constraints

- Actual DOM focus, typing, selection, validation, and keyboard operation must remain functional.
- Focus itself must add no border color, border width, outline, shadow, background, or label-color change.
- Hover, error, checked, selected, and disabled state styling must remain.
- Buttons, links, tabs, menus, dialogs, and other non-input controls retain their focus indicators.
- Add no dependency and do not introduce a global CSS `:focus` reset.
- Do not commit unless the user explicitly requests it.

---

### Task 1: Add an application-wide input-focus audit

**Files:**
- Create: `front-end/scripts/audit-input-focus.mjs`
- Modify: `front-end/package.json`
- Modify: `front-end/scripts/audit-interaction-contrast.mjs:176-191`

**Interfaces:**
- Consumes: Vite's `createServer`, `createDarkTheme()`, `getOutlinedFieldStateSx(theme)`, and `getComposerSurfaceSx(theme)`.
- Produces: `npm run audit:input-focus`, which exits nonzero when any covered MUI input or local wrapper exposes a focus-driven visual.

- [x] **Step 1: Create the failing theme/helper audit**

Create `scripts/audit-input-focus.mjs` that starts Vite in middleware mode, loads `/src/theme/darkTheme.js`, `/src/styles/shared.js`, and `/src/features/styles/interfaceChrome.js`, and asserts:

```js
const theme = createDarkTheme();
const outlined = getOutlinedFieldStateSx(theme)['& .MuiOutlinedInput-root'];
const composer = getComposerSurfaceSx(theme);

expectNeutral('MuiInputBase root', theme.components.MuiInputBase.styleOverrides.root['&.Mui-focused']);
expectNeutral('MuiInputBase input', theme.components.MuiInputBase.styleOverrides.input['&:focus']);
expectNeutral('MuiOutlinedInput root', theme.components.MuiOutlinedInput.styleOverrides.root['&.Mui-focused']);
expectNeutral('MuiCheckbox', theme.components.MuiCheckbox.styleOverrides.root['&.Mui-focusVisible']);
expectNeutral('MuiRadio', theme.components.MuiRadio.styleOverrides.root['&.Mui-focusVisible']);
expectNeutral('MuiSlider thumb', theme.components.MuiSlider.styleOverrides.thumb['&.Mui-focusVisible']);
```

`expectNeutral` must require `outline: 'none'` and `boxShadow: 'none'`. Add exact assertions that outlined focus uses idle/hover/error border colors at `1px`, the focused InputLabel keeps `text.secondary`, the focused Switch track has `boxShadow: 'none'`, the shared outlined helper mirrors those states, the composer has no `&:focus-within` key, and `SidebarOverlays.jsx` contains no `&:focus-within` selector. Also assert that a non-input theme focus rule such as `MuiIconButton` remains present.

- [x] **Step 2: Register and run the audit to verify RED**

Add this package script:

```json
"audit:input-focus": "node scripts/audit-input-focus.mjs"
```

Run `npm run audit:input-focus` from `front-end`.

Expected: exit code 1 with failures for the current TextField/outlined input, shared outlined helper, composer, Switch, Checkbox, Radio, missing Slider reset, and sidebar search focus wrapper.

- [x] **Step 3: Update the existing composer assertion and verify RED**

Change the composer portion of `audit-interaction-contrast.mjs` to fail unless `composer['&:focus-within'] == null`, with message `composer must not expose a visual focus-within state.`

Run `npm run audit:interaction`.

Expected: exit code 1 because the composer currently exposes a 2px focused border.

---

### Task 2: Neutralize centralized MUI input focus styles

**Files:**
- Modify: `front-end/src/theme/createMoonlitTheme.js:280-303,477-632`
- Test: `front-end/scripts/audit-input-focus.mjs`

**Interfaces:**
- Consumes: Moonlit semantic idle, hover, error, background, and text tokens.
- Produces: neutral focus states for InputBase, OutlinedInput, TextField labels, Select-backed outlined inputs, Checkbox, Radio, Switch, and Slider.

- [x] **Step 1: Neutralize InputBase and OutlinedInput focus**

Add `MuiInputBase` focus resets for the root and actual input using `outline: 'none'` and `boxShadow: 'none'`. Add `MuiOutlinedInput.styleOverrides.root` rules so focused idle uses `S.border.idle` at `1px`, focused hover uses `S.border.hover` at `1px`, and focused error uses `S.error.main` at `1px`. Remove the focus-color and 2px rules nested under `MuiTextField`.

- [x] **Step 2: Neutralize label and selection-control focus**

Keep focused `MuiInputLabel` at `S.text.secondary`. Replace Switch focus-track shadow with `boxShadow: 'none'`; set Checkbox and Radio focus-visible objects to `{ outline: 'none', boxShadow: 'none' }`; add a Slider thumb focus-visible override with the same object.

- [x] **Step 3: Run the input-focus audit**

Run `npm run audit:input-focus`.

Expected: remaining failures are limited to the shared outlined helper, composer, and sidebar search local wrapper.

---

### Task 3: Neutralize shared and local input focus styles

**Files:**
- Modify: `front-end/src/styles/shared.js:141-187`
- Modify: `front-end/src/features/styles/interfaceChrome.js:130-143`
- Modify: `front-end/src/features/sidebar-left/components/SidebarOverlays.jsx:97-128`
- Test: `front-end/scripts/audit-input-focus.mjs`
- Test: `front-end/scripts/audit-interaction-contrast.mjs`

**Interfaces:**
- Consumes: `getOutlinedFieldStateSx(theme)` in Auth and Preferences, `getComposerSurfaceSx(theme)` in ChatInput, and the local sidebar search TextField `sx` object.
- Produces: no focus-driven visual difference for every local input surface that overrides the central theme.

- [x] **Step 1: Neutralize the shared outlined-field helper**

Set its focused root to `outline: 'none'`, `boxShadow: 'none'`, and the normal background. Use idle/hover/error border colors at `1px` for focused, focused-hover, and focused-error states respectively.

- [x] **Step 2: Remove local focus-within visuals**

Delete the `&:focus-within` block from `getComposerSurfaceSx`. Delete the `&:focus-within` block from the sidebar search TextField `sx`; leave its resting background unchanged.

- [x] **Step 3: Run both focus audits to verify GREEN**

Run:

```bash
npm run audit:input-focus
npm run audit:interaction
```

Expected: both commands exit 0.

---

### Task 4: Runtime and regression verification

**Files:**
- Review: all files changed in Tasks 1-3
- Verify: Auth, Chat, Sidebar Search, and Settings routes/overlays in the in-app browser

**Interfaces:**
- Consumes: the final built application and the active authenticated browser session.
- Produces: evidence that focus is visually neutral but remains functional across representative control types.

- [x] **Step 1: Verify runtime input state matrices**

For each representative control, capture computed idle and focused styles and compare focus-only visual properties:

- Auth TextField and Checkbox
- Chat textarea/composer
- Sidebar search input
- Settings Select and Switch

Expected: focus does not change border color/width, outline, shadow, background, or label color; the active element still becomes the control. For Auth error fields, verify focused error remains the same 1px error boundary.

- [x] **Step 2: Verify non-input focus remains**

Inspect one keyboard-focused button or icon button. Expected: its existing focus indicator remains present, proving the change is input-scoped rather than a blanket focus reset.

- [x] **Step 3: Run complete frontend validation**

Run:

```bash
node --test src/config/userSettings.test.js src/theme/mode.test.js src/pages/Landing/landingContent.test.js
npm run audit:input-focus
npm run audit:interaction
npm run audit:dark
npm run audit:theme
npm run lint
npm run knip
npm run build
```

Expected: 3 tests and every audit pass, lint/knip exit cleanly, and Vite builds successfully. Report the existing large-chunk advisory separately if it remains.

- [x] **Step 4: Self-review and completion audit**

Search all source files for MUI input focus selectors and verify every remaining match is visually neutral. Confirm non-input focus selectors remain. Review the exact diff for dead imports, accidental non-input changes, stale audit wording, and whitespace errors. Only after every acceptance criterion has direct evidence may the active goal be marked complete.
