# Canonical Dark Theme Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every frontend route and code-rendering integration use the canonical dark design,
remove the light-theme control and runtime branches, and keep legacy server settings harmlessly
backward compatible.

**Architecture:** Preserve the existing primitive → semantic → component-token → MUI-theme
pipeline, but collapse it to one dark semantic contract. Keep `SettingsProvider` responsible for
non-theme preferences, keep `ThemeContext`'s public value shape stable for existing consumers, and
make the boot script, MUI theme, Shiki, CodeMirror, Perspective, and audits agree on dark mode.

**Tech Stack:** React 19, Material UI 7, Emotion, Shiki, CodeMirror 6, Node's built-in test runner,
Vite, ESLint.

## Global Constraints

- `front-end/DESIGN.md` is authoritative and must not be modified.
- The current product is dark-only; the canonical mode is exactly `dark`.
- Keep the local-storage key exactly `moonlit-settings` so existing non-theme preferences survive.
- Ignore legacy `theme` values received from local storage or the backend; do not modify backend
  schemas or stored records in this frontend-only phase.
- Do not retain dormant light-theme production branches, palettes, exports, or UI controls.
- Preserve the existing `useTheme()` context fields `isDarkMode` and `effectiveTheme` with constant
  values for consumer compatibility.
- Do not change chat layout, composer styling, breakpoints, backend behavior, routes, or dependencies.
- Preserve all unrelated staged changes and avoid bulk formatting.
- Do not commit automatically. The repository already contains a large user-owned staged change
  set; the review checkpoints below identify logical commit boundaries only.

## Phase Report

**Phase:** Phase 1A — Canonical Dark Theme Foundation

**Scope:** Theme bootstrapping, persisted settings, settings UI, MUI theme selection, semantic and
component tokens, syntax integrations, compliance scripts, and user-facing documentation.

**Files involved:**

- Runtime/settings: `front-end/index.html`, `src/contexts/ThemeContext.jsx`,
  `src/contexts/SettingsContext.jsx`, `src/config/userSettings.js`,
  `src/features/overlays/settings/SettingsModal.jsx`, `src/components/icons/index.js`.
- Theme pipeline: `src/theme/index.js`, `darkTheme.js`, `lightTheme.js`, `mode.js`, `tokens.js`,
  `tokens/primitives.js`, `tokens/semantic.js`, `tokens/component.js`.
- Code integrations: `src/theme/syntaxPalettes.js`, `themeCodeMirror.js`, `src/utils/shiki.js`,
  `src/features/sidebar-right/artifacts/sql-workspace/SqlEditorSurface.jsx`.
- Verification/docs: `front-end/package.json`, `front-end/scripts/audit-*.mjs`, `README.md`, focused
  tests, `docs/frontend-ui-audit/memory.md`, and `docs/frontend-ui-audit/phases.md`.

**Design issues found:**

- `index.html` selects light mode from local storage or system preference.
- `ThemeContext` selects between two MUI themes by route/preference.
- Theme is a synchronized user setting and the settings dialog exposes a light/dark toggle.
- Semantic/component tokens, Shiki, CodeMirror, and Perspective all retain light branches.
- Current audit scripts assert that `/chat` and `/admin` may be light.
- Root product documentation advertises a user-selectable light theme.

**Proposed fixes:** Add executable dark-only invariants, stop serializing the theme preference,
remove the appearance toggle, make boot/runtime selection constant, delete the light MUI theme,
collapse token and syntax integrations to dark, and update the audits and documentation.

**Risks:** Legacy stored `theme: light` values could leak back into state; settings navigation could
open a removed appearance section; code blocks/editor/Perspective could reference deleted palette
names; broad token cleanup could affect unrelated colors. The task ordering below tests each risk
before proceeding.

**Validation plan:** Focused Node tests, a source/runtime dark-only audit, existing theme and
interaction audits, ESLint, production build, landing test, route boot checks, settings UI check,
code-block/SQL-editor smoke checks where accessible, browser console review, and changed-file scan.

---

### Task 1: Lock the dark-mode contract and exclude theme from user settings

**Files:**

- Create: `front-end/src/theme/mode.test.js`
- Create: `front-end/src/config/userSettings.test.js`
- Modify: `front-end/src/theme/mode.js:1-33`
- Modify: `front-end/src/config/userSettings.js:6-107`
- Modify: `front-end/src/contexts/SettingsContext.jsx:6-84`

**Interfaces:**

- Consumes: the existing `moonlit-settings` local-storage record and backend settings payload.
- Produces: `CANONICAL_THEME_MODE`, `THEME_ATTRIBUTE`, `THEME_STORAGE_KEY`, and
  `getEffectiveThemeMode()`; a `settings` object that contains non-theme preferences only.
- Compatibility: `getEffectiveThemeMode(pathname, preferredMode)` keeps its current call signature
  temporarily but always returns `dark`; legacy payload keys are ignored.

- [ ] **Step 1: Write failing mode-contract tests**

Create `front-end/src/theme/mode.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANONICAL_THEME_MODE,
  getEffectiveThemeMode,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from './mode.js';

test('the frontend exposes one canonical dark theme', () => {
  assert.equal(CANONICAL_THEME_MODE, 'dark');
  assert.equal(THEME_ATTRIBUTE, 'data-moonlit-color-scheme');
  assert.equal(THEME_STORAGE_KEY, 'moonlit-settings');
});

test('route and legacy preference values cannot select light mode', () => {
  for (const [pathname, preference] of [
    ['/', 'light'],
    ['/auth', 'light'],
    ['/chat', 'light'],
    ['/chat/conversation-id', 'light'],
    ['/admin', 'light'],
    ['/chat', undefined],
  ]) {
    assert.equal(getEffectiveThemeMode(pathname, preference), 'dark');
  }
});
```

- [ ] **Step 2: Write failing settings-boundary tests**

Create `front-end/src/config/userSettings.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultUserSettings,
  mapServerSettingsToClient,
  pickSyncableSettings,
} from './userSettings.js';

test('theme is not a configurable or synchronized user setting', () => {
  assert.equal('theme' in defaultUserSettings, false);
  assert.equal('theme' in pickSyncableSettings({ theme: 'light', maxRows: 25 }), false);
  assert.equal('theme' in mapServerSettingsToClient({ settings: { theme: 'light' } }), false);
});

test('removing theme does not drop supported settings', () => {
  assert.deepEqual(pickSyncableSettings({ theme: 'light', maxRows: '25' }), { maxRows: 25 });
  assert.deepEqual(
    mapServerSettingsToClient({ settings: { theme: 'light', responseStyle: 'concise' } }),
    { responseStyle: 'concise' },
  );
});
```

- [ ] **Step 3: Run the focused tests and verify they fail for the expected reasons**

Run:

```bash
cd front-end
node --test src/theme/mode.test.js src/config/userSettings.test.js
```

Expected: FAIL because `CANONICAL_THEME_MODE` is not exported and `theme` remains in
`defaultUserSettings` and synchronization output.

- [ ] **Step 4: Implement the minimal dark contract**

Replace `front-end/src/theme/mode.js` with:

```js
export const THEME_STORAGE_KEY = 'moonlit-settings';
export const THEME_ATTRIBUTE = 'data-moonlit-color-scheme';
export const INPUT_MODALITY_ATTRIBUTE = 'data-moonlit-input-modality';
export const KEYBOARD_INPUT_MODALITY_SELECTOR =
  `html[${INPUT_MODALITY_ATTRIBUTE}="keyboard"]`;
export const CANONICAL_THEME_MODE = 'dark';

export const getEffectiveThemeMode = (_pathname, _preferredMode) => CANONICAL_THEME_MODE;
```

In `front-end/src/config/userSettings.js`, remove only `theme: 'dark'` from
`defaultUserSettings`. Because `SYNCABLE_SETTING_KEYS` is derived from that object, existing
`pickSyncableSettings()` and `mapServerSettingsToClient()` will automatically exclude legacy
theme values while retaining every supported preference.

In `front-end/src/contexts/SettingsContext.jsx`:

```js
import { THEME_STORAGE_KEY } from '@/theme/mode';

const defaultSettings = Object.freeze({ ...defaultUserSettings });

const withoutLegacyTheme = (settings = {}) => {
  const { theme: _legacyTheme, ...supportedSettings } = settings;
  return supportedSettings;
};
```

Build rendered settings with:

```js
const settings = useMemo(
  () => ({
    ...defaultSettings,
    ...withoutLegacyTheme(rawSettings),
  }),
  [rawSettings],
);
```

Remove `getInitialThemeMode`, the derived `isDarkMode`, and the top-level `theme`/`isDarkMode`
fields from `SettingsContext`'s value. This ignores an existing local `theme` property without
deleting unrelated stored preferences; removing the key from synchronization prevents further
server writes.

- [ ] **Step 5: Run focused tests and the production compile**

Run:

```bash
node --test src/theme/mode.test.js src/config/userSettings.test.js
npm run build
```

Expected: tests PASS; build PASS. Existing runtime theme selection still compiles because
`getEffectiveThemeMode()` retains its current signature and always returns dark.

- [ ] **Step 6: Review the logical change boundary without committing**

Run:

```bash
git diff --check -- front-end/src/theme/mode.js front-end/src/theme/mode.test.js \
  front-end/src/config/userSettings.js front-end/src/config/userSettings.test.js \
  front-end/src/contexts/SettingsContext.jsx
```

Expected: no whitespace errors. Suggested future commit boundary:
`test: enforce canonical dark theme contract`.

### Task 2: Remove runtime selection and the user-facing light control

**Files:**

- Create: `front-end/scripts/audit-dark-only.mjs`
- Modify: `front-end/package.json:6-17`
- Modify: `front-end/index.html:10-38`
- Modify: `front-end/src/contexts/ThemeContext.jsx:6-112`
- Modify: `front-end/src/features/overlays/settings/SettingsModal.jsx:1-145`
- Modify: `front-end/src/components/icons/index.js:22-46`
- Modify: `front-end/src/theme/index.js:1-19`
- Delete: `front-end/src/theme/lightTheme.js`
- Modify: `front-end/scripts/audit-interaction-contrast.mjs:1-160`

**Interfaces:**

- Consumes: `createDarkTheme()`, non-theme user settings, and the canonical mode constant.
- Produces: one dark MUI theme on every route; `useTheme()` still exposes `settings`, setting
  actions, `isDarkMode: true`, and `effectiveTheme: 'dark'`.
- Settings navigation begins at `ai`; invalid/legacy `appearance` deep links safely fall back to
  `ai`.

- [ ] **Step 1: Add a failing dark-only source invariant audit**

Create `front-end/scripts/audit-dark-only.mjs`:

```js
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const forbid = (path, pattern) => {
  if (pattern.test(read(path))) failures.push(`${path} still matches ${pattern}`);
};
const requirePattern = (path, pattern) => {
  if (!pattern.test(read(path))) failures.push(`${path} is missing ${pattern}`);
};

if (existsSync(new URL('../src/theme/lightTheme.js', import.meta.url))) {
  failures.push('src/theme/lightTheme.js must be removed');
}

forbid('index.html', /prefers-color-scheme|settings\?\.theme|mode = settings\.theme/);
requirePattern('index.html', /const mode = ['"]dark['"]/);
forbid('src/contexts/ThemeContext.jsx', /createLightTheme|effectiveTheme === ['"]light['"]/);
forbid('src/features/overlays/settings/SettingsModal.jsx', /Light theme|settings\.theme/);
forbid('src/theme/index.js', /createLightTheme|lightTheme/);

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exitCode = 1;
} else {
  console.log('PASS: runtime and settings expose only the canonical dark theme.');
}
```

Add this package script after `audit:interaction`:

```json
"audit:dark": "node scripts/audit-dark-only.mjs",
```

- [ ] **Step 2: Run the dark-only audit and verify current production branches fail it**

Run:

```bash
npm run audit:dark
```

Expected: FAIL for the existing light theme file, system/local-storage bootstrap, runtime factory,
settings toggle, and theme export.

- [ ] **Step 3: Make the document bootstrap unconditionally dark**

Replace the inline script body in `front-end/index.html` with:

```html
<script>
  (() => {
    const attribute = 'data-moonlit-color-scheme';
    const mode = 'dark';
    document.documentElement.setAttribute(attribute, mode);
    document.documentElement.style.colorScheme = mode;
  })();
</script>
```

Do not read local storage or `prefers-color-scheme`; non-theme settings remain untouched.

- [ ] **Step 4: Make ThemeContext construct only the dark theme**

Update imports to remove `useLocation`, `useRef`, and `createLightTheme`, then use:

```jsx
import { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { createDarkTheme } from '@/theme/index';
import {
  CANONICAL_THEME_MODE,
  INPUT_MODALITY_ATTRIBUTE,
  THEME_ATTRIBUTE,
} from '@/theme/mode';

function ThemeProviderInner({ children }) {
  const { settings, updateSetting, updateSettings, resetSettings } = useSettings();
  const theme = createDarkTheme();
  const effectiveTheme = CANONICAL_THEME_MODE;
  const isDarkMode = true;

  const value = useMemo(
    () => ({
      settings,
      updateSetting,
      updateSettings,
      resetSettings,
      isDarkMode,
      effectiveTheme,
    }),
    [settings, updateSetting, updateSettings, resetSettings],
  );

  useLayoutEffect(() => {
    document.documentElement.style.colorScheme = CANONICAL_THEME_MODE;
    document.documentElement.setAttribute(THEME_ATTRIBUTE, CANONICAL_THEME_MODE);
  }, []);
```

Keep the existing keyboard/pointer modality effect and provider JSX unchanged. Delete the theme-
switch transition-suppression effect because the theme no longer changes at runtime.

- [ ] **Step 5: Remove the appearance section and obsolete icons**

In `SettingsModal.jsx`:

- Remove `ToggleButton` and `ToggleButtonGroup` imports.
- Remove `DarkModeIcon`, `LightModeIcon`, and `PaletteIcon` imports.
- Remove `{ id: 'appearance', ... }` from `SECTIONS`.
- Change `useState('appearance')` to `useState('ai')`.
- Change the invalid `initialSection` fallback from `appearance` to `ai`.
- Delete the entire `case 'appearance'` render branch.
- Remove the now-unused `toggleGroupSx` memo.

In `components/icons/index.js`, remove these unused exports:

```js
export { default as DarkModeIcon } from '@mui/icons-material/DarkModeRounded';
export { default as LightModeIcon } from '@mui/icons-material/LightModeRounded';
export { default as PaletteIcon } from '@mui/icons-material/PaletteRounded';
```

- [ ] **Step 6: Delete the light theme factory and update the theme entry point**

Delete `front-end/src/theme/lightTheme.js`. Reduce the theme entry-point description and exports
to:

```js
/** Theme module entry point. */
export { createDarkTheme } from '@/theme/darkTheme';
export { TRANSITIONS } from '@/theme/themeEffects';
```

- [ ] **Step 7: Make the interaction audit expect dark for every route**

In `audit-interaction-contrast.mjs`, keep the mode-function import but replace route expectations
with:

```js
const routeExpectations = [
  ['/', 'light', 'dark'],
  ['/auth', 'light', 'dark'],
  ['/chat', 'light', 'dark'],
  ['/chat/conversation-id', 'light', 'dark'],
  ['/admin', 'light', 'dark'],
];
```

The palette loop remains dual-mode until Task 3 removes the light token export.

- [ ] **Step 8: Run focused audits, lint, and build**

Run:

```bash
npm run audit:dark
npm run audit:interaction
npm run lint
npm run build
```

Expected: all PASS. Build may retain the already-documented oversized Perspective chunk warning;
no missing light-theme imports are allowed.

- [ ] **Step 9: Review the logical change boundary without committing**

Run `rg` to confirm UI/runtime references are gone:

```bash
rg -n "createLightTheme|Light theme|settings\.theme|prefers-color-scheme" \
  index.html src --glob '!*.test.js'
```

Expected: no production matches. Focused tests and `audit-dark-only.mjs` intentionally retain
legacy light literals as negative test cases.
Suggested future commit boundary: `feat: enforce dark-only runtime theme`.

### Task 3: Collapse semantic and code-rendering integrations to dark

**Files:**

- Modify: `front-end/src/theme/tokens/primitives.js:102-137`
- Modify: `front-end/src/theme/tokens/semantic.js:4-199`
- Modify: `front-end/src/theme/tokens/component.js:1-40`
- Modify: `front-end/src/theme/tokens.js:1-8`
- Modify: `front-end/src/theme/syntaxPalettes.js:1-44`
- Modify: `front-end/src/utils/shiki.js:1-25`
- Modify: `front-end/src/theme/themeCodeMirror.js:1-211`
- Modify: `front-end/src/features/sidebar-right/artifacts/sql-workspace/SqlEditorSurface.jsx:48-59`
- Modify: `front-end/scripts/audit-theme-contrast.mjs:1-190`
- Modify: `front-end/scripts/audit-interaction-contrast.mjs:1-160`
- Modify: `front-end/scripts/audit-dark-only.mjs`

**Interfaces:**

- Produces: `darkSemanticTokens`, `darkComponentTokens`, `DARK`,
  `moonlitDarkSyntax`, `moonlitDarkShikiTheme`, `getCodeMirrorTheme(transparent)`, and
  `getCodeMirrorHighlighting()`.
- Consumers continue to receive `theme.palette.integration.colorMode === 'dark'`,
  `codeTheme === 'moonlit-dark'`, and `perspectiveTheme === 'Pro Dark'`.

- [ ] **Step 1: Extend the dark-only audit so dormant palette branches fail**

Add these checks to `audit-dark-only.mjs` before its final failure block:

```js
for (const [path, pattern] of [
  ['src/theme/tokens/semantic.js', /lightSemanticTokens|LIGHT_BACKGROUND|moonlit-light|Pro Light/],
  ['src/theme/tokens/component.js', /lightComponentTokens|lightSemanticTokens/],
  ['src/theme/tokens.js', /\bLIGHT\b|lightComponentTokens/],
  ['src/theme/syntaxPalettes.js', /moonlitLight/],
  ['src/theme/themeCodeMirror.js', /moonlitLight|GITHUB_LIGHT/],
  ['src/utils/shiki.js', /moonlitLight/],
]) {
  forbid(path, pattern);
}
```

Also check the primitive palette:

```js
forbid('src/theme/tokens/primitives.js', /githubLight/);
```

- [ ] **Step 2: Verify the extended audit fails before token cleanup**

Run:

```bash
npm run audit:dark
```

Expected: FAIL on all listed light palette and syntax branches.

- [ ] **Step 3: Collapse semantic and component tokens**

In `tokens/primitives.js`, remove the complete `githubLight` object from `primitives.code`; retain
`draculaSoft`, panel/search colors, provider colors, database colors, and all neutral/status colors.

In `tokens/semantic.js`:

- Delete `LIGHT_BACKGROUND`.
- Replace `createStatus(mode, family)` with `createStatus(family)` using only the current dark tuple
  for each family.
- Replace `createSemanticTokens(mode)` with `createDarkSemanticTokens()` and constants:

```js
const background = DARK_BACKGROUND;
const foreground = primitives.neutral[0];
const secondaryForeground = primitives.neutral[300];
const disabledForeground = primitives.neutral[500];
const hairline = primitives.neutral[800];
```

- Replace every `isDark ? darkValue : lightValue` expression with its existing dark value.
- Keep `mode: 'dark'` and set integration exactly to:

```js
integration: Object.freeze({
  colorMode: 'dark',
  codeTheme: 'moonlit-dark',
  perspectiveTheme: 'Pro Dark',
  hyperspeedOpacity: 0,
}),
```

- Export only:

```js
export const darkSemanticTokens = createDarkSemanticTokens();
```

In `tokens/component.js`, import only `darkSemanticTokens` and export only:

```js
export const darkComponentTokens = createComponentTokens(darkSemanticTokens);
```

In `tokens.js`, import only `darkComponentTokens` and export only `DARK`; keep fonts, shape,
switch geometry, and breakpoints unchanged.

- [ ] **Step 4: Collapse Shiki and CodeMirror to one palette**

Replace `syntaxPalettes.js` exports with the dark-only form:

```js
import { primitives } from './tokens/primitives.js';

export const moonlitDarkSyntax = primitives.code.draculaSoft;

export const moonlitDarkShikiTheme = createShikiTheme(
  'moonlit-dark',
  'dark',
  moonlitDarkSyntax,
);
```

Edit only the exports and light-theme construction around the existing `createShikiTheme`
function; its current `colors` and `tokenColors` mappings at lines 6-33 remain byte-for-byte
equivalent.

Change `utils/shiki.js` to import only `moonlitDarkShikiTheme` and initialize:

```js
highlighterPromise = createHighlighter({
  themes: [moonlitDarkShikiTheme],
  langs: ['sql', 'javascript', 'python', 'json', 'html', 'css', 'bash'],
}).then((instance) => {
  highlighterInstance = instance;
  return instance;
});
```

In `themeCodeMirror.js`, import only `moonlitDarkSyntax`, delete `GITHUB_LIGHT`,
`DRACULA_SOFT`, and `getPalette(mode)`, then use:

```js
const CODE_PALETTE = moonlitDarkSyntax;

export function getCodeMirrorTheme(transparent = false) {
  const p = CODE_PALETTE;
}

export function getCodeMirrorHighlighting() {
  const p = CODE_PALETTE;
}
```

The current `EditorView.theme` return at lines 69-117 and `HighlightStyle` return at lines 133-210
remain structurally identical beneath those signatures. Update JSDoc to remove light/GitHub
references and mode parameters.

In `SqlEditorSurface.jsx`, update the existing memos to:

```js
const codeMirrorTheme = useMemo(() => getCodeMirrorTheme(true), []);
const codeMirrorHighlighting = useMemo(() => getCodeMirrorHighlighting(), []);
```

- [ ] **Step 5: Make theme and interaction audits dark-only**

In both audit scripts, import only `darkSemanticTokens` and set:

```js
const MODES = [['dark', darkSemanticTokens]];
```

In `audit-theme-contrast.mjs`, delete light invariant assertions. Replace conditional integration
expectations with:

```js
expectToken('dark Shiki palette', darkSemanticTokens.integration.codeTheme, 'moonlit-dark');
expectToken('dark Perspective palette', darkSemanticTokens.integration.perspectiveTheme, 'Pro Dark');
```

Keep all dark contrast, flat elevation, and shadow invariants.

- [ ] **Step 6: Run all focused tests and audits**

Run:

```bash
node --test src/theme/mode.test.js src/config/userSettings.test.js
npm run audit:dark
npm run audit:theme
npm run audit:interaction
```

Expected: all PASS; theme audit reports dark groups only.

- [ ] **Step 7: Run unused-export and build checks**

Run:

```bash
npm run lint
npm run knip
npm run build
```

Expected: lint and build PASS. Investigate every `knip` finding introduced by removed exports;
distinguish any pre-existing findings explicitly rather than suppressing them. The existing
Perspective chunk warning may remain.

- [ ] **Step 8: Review the logical change boundary without committing**

Run:

```bash
rg -n "lightSemanticTokens|lightComponentTokens|moonlitLight|moonlit-light|Pro Light|githubLight" \
  src --glob '!*.test.js'
git diff --check -- src/theme src/utils/shiki.js \
  src/features/sidebar-right/artifacts/sql-workspace/SqlEditorSurface.jsx scripts
```

Expected: no matches and no whitespace errors. Suggested future commit boundary:
`refactor: collapse theme integrations to dark`.

### Task 4: Update product documentation and complete Phase 1A validation

**Files:**

- Modify: `README.md:67-76`
- Modify: `front-end/src/components/ui/toast.jsx:1-35`
- Modify: `front-end/src/features/chat/MessageList.jsx:895-905`
- Modify: `docs/frontend-ui-audit/phases.md:66-111`
- Modify: `docs/frontend-ui-audit/memory.md`

**Interfaces:**

- Documentation accurately describes the dark-only frontend while preserving the explicit future
  light-theme decision in project memory.
- Phase status changes to `COMPLETE` only after all required validation succeeds.

- [ ] **Step 1: Update stale user-facing and code documentation**

Change the README interface row to:

```markdown
| **Dark Theme** | Canonical near-black interface defined by `front-end/DESIGN.md` |
```

Update comments in `toast.jsx` and `MessageList.jsx` so they refer to the centralized theme or dark
theme, not light/dark adaptation or separate `lightTheme`/`darkTheme` overrides. Do not change
component behavior in these files.

- [ ] **Step 2: Run the complete automated validation set**

Run from `front-end/`:

```bash
node --test src/theme/mode.test.js src/config/userSettings.test.js \
  src/pages/Landing/landingContent.test.js
npm run audit:dark
npm run audit:theme
npm run audit:interaction
npm run lint
npm run knip
npm run build
```

Expected: tests, audits, lint, and build PASS. Record `knip` findings and the Perspective build
warning accurately if they remain pre-existing.

- [ ] **Step 3: Perform browser sanity checks**

With the local Vite server running, inspect `/`, `/auth`, and `/chat` in the in-app browser:

1. Verify `document.documentElement.dataset.moonlitColorScheme === 'dark'`.
2. Verify `getComputedStyle(document.documentElement).colorScheme === 'dark'`.
3. Confirm landing and auth render on `#0a0a0a` without a flash of light content.
4. Confirm `/chat` redirects to `/auth` when unauthenticated and remains dark.
5. Open Settings when authenticated access is available and confirm the first section is Moonlit,
   no Appearance/Light control exists, and reset-to-defaults still works.
6. Open a code block and SQL editor when authenticated access is available; confirm both use the
   dark syntax palette.
7. Check browser console warnings/errors.

Do not claim checks 5-6 passed if authenticated access is unavailable; record them as unverified.

- [ ] **Step 4: Review every changed file and scan for dormant light behavior**

Run:

```bash
git diff --name-only -- README.md front-end docs/frontend-ui-audit
rg -n "createLightTheme|lightSemanticTokens|lightComponentTokens|moonlitLight|moonlit-light|Pro Light|githubLight|Light theme|Dark / Light Theme" \
  README.md front-end/src front-end/scripts front-end/index.html \
  --glob '!*.test.js' --glob '!audit-dark-only.mjs'
rg -n "console\.log|debugger|TODO|FIXME" \
  front-end/src/theme front-end/src/contexts front-end/src/config \
  front-end/src/features/overlays/settings front-end/scripts
git diff --check -- README.md front-end docs/frontend-ui-audit
```

Expected: the light-behavior scan has no matches; any pre-existing TODO/FIXME outside changed
lines is reported rather than removed. No debug code or whitespace errors may remain.

- [ ] **Step 5: Update operational documentation only after validation**

In `docs/frontend-ui-audit/phases.md`, set Phase 1A to `COMPLETE` and replace its validation summary
with exact commands/results. If a required check fails or an authenticated check is unavailable,
use `PARTIALLY COMPLETE` and state the limitation.

In `docs/frontend-ui-audit/memory.md`:

- Set current focus to the next approved task.
- Add the Phase 1A date, behavior summary, exact files changed, and validation results.
- Remove resolved light-mode entries from Known Issues and Technical Debt.
- Retain the future-light-theme decision under Important Decisions/Open Questions.

- [ ] **Step 6: Final diff review without committing**

Review only this phase's paths and confirm `front-end/DESIGN.md` is unchanged:

```bash
git status --short -- front-end/DESIGN.md README.md front-end docs/frontend-ui-audit
git diff --check -- README.md front-end docs/frontend-ui-audit
```

Expected: `front-end/DESIGN.md` has no status entry; all Phase 1A changes are intentional. Suggested
future commit boundary: `docs: record dark-theme foundation completion`.

## Phase 1A Completion Criteria

- Every route resolves to dark before React mounts and after hydration.
- Theme preference is absent from UI, local defaults, client synchronization, and runtime selection.
- Legacy local/server `theme` values cannot activate or re-persist light mode.
- No light MUI, semantic, component, Shiki, CodeMirror, or Perspective branch remains in frontend
  production code.
- Existing non-theme settings, reset behavior, code rendering, and SQL editor behavior remain intact.
- Focused tests, dark/theme/interaction audits, lint, and build pass.
- Browser checks are completed for reachable routes; authenticated limitations are explicit.
- `front-end/DESIGN.md` is unchanged and operational documentation is current.
