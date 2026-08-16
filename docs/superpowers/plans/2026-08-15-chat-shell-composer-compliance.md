# Chat Shell and Composer Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the authenticated chat shell, empty state, composer, and primary responsive topology into compliance with the approved dark-only design system while preserving all chat, database, and navigation behavior.

**Architecture:** Keep the existing React/MUI component hierarchy and data flow intact. Establish the approved visual contract in shared theme tokens and pure style helpers first, then make narrowly scoped component changes that consume those contracts. Verify the responsive breakpoint globally at the shell boundaries and use authenticated browser checks for UI behavior that is not covered by the repository's current automated test stack.

**Tech Stack:** React 19, Material UI 7, Vite, Vitest, ESLint, Knip, Node-based design audits, authenticated in-app browser testing.

## Global Constraints

- Treat [`front-end/DESIGN.md`](../../../front-end/DESIGN.md) as immutable.
- Preserve the approved dark-only Phase 1A behavior. Do not reintroduce a theme selector or light-mode runtime state.
- Preserve chat submission, slash commands, task-mode selection, model selection, SQL editor, context menu, sidebar, settings, and database behavior.
- Do not send a chat message, reset application data, or connect/disconnect a database during verification without separate user authorization.
- Do not restyle transcript messages, code blocks, tool output, or conversation history in this phase.
- Use the existing MUI theme and shared style helpers; add no dependency and introduce no parallel styling abstraction.
- Use the canonical 4px spacing scale for changed fixed spacing values. The approved exceptions are the 44px touch target and responsive typography values.
- Set the global `md` breakpoint to 768px. This deliberately changes every existing `theme.breakpoints.up('md')` consumer; validate the known shell and modal consumers explicitly.
- Keep automatic commits disabled because the worktree contains user-owned staged changes. Record logical commit boundaries in the implementation report, but do not commit unless the user separately requests it.
- Update the Phase 1B audit documentation with exact validation results. Mark browser checks blocked or partial rather than fabricating coverage when fixture-dependent states are unavailable.

---

## Task 1: Lock the Phase 1B Theme Contract with Failing Audits

**Files:**

- Modify: `front-end/scripts/audit-interaction-contrast.mjs`
- Modify: `front-end/scripts/audit-theme-contrast.mjs`
- Modify: `front-end/src/theme/tokens.js`
- Modify: `front-end/src/theme/tokens/semantic.js`
- Modify: `front-end/src/features/styles/interfaceChrome.js`

### Step 1: Establish the focused baseline

- [ ] From `front-end`, run the existing audits before editing:

```bash
npm run audit:theme
npm run audit:interaction
```

Expected: both commands pass against the current Phase 1A contract. Record any unexpected baseline failure before continuing.

### Step 2: Add failing assertions for the approved breakpoint, composer surface, and welcome role

- [ ] Extend `audit-interaction-contrast.mjs` to import and exercise the real shared contracts directly:

```js
import {
  getComposerHoverShadow,
  getComposerSurfaceSx,
  getWelcomeHeroSx,
  INTERFACE_RADIUS,
} from '../src/features/styles/interfaceChrome.js';
import { UI_LAYOUT } from '../src/styles/shared.js';
import { BREAKPOINTS, SHAPE } from '../src/theme/tokens.js';
```

- [ ] Add focused contract assertions alongside the existing failure collection:

```js
if (BREAKPOINTS.values.md !== 768) {
  failures.push(`md breakpoint must be 768px; received ${BREAKPOINTS.values.md}px.`);
}

if (darkSemanticTokens.background.composer !== '#1a1c20') {
  failures.push(
    `Composer surface must be #1a1c20; received ${darkSemanticTokens.background.composer}.`,
  );
}

if (UI_LAYOUT.touchTarget !== 44) {
  failures.push(`Mobile touch target must remain 44px; received ${UI_LAYOUT.touchTarget}px.`);
}

if (SHAPE.radius.pill !== 9999) {
  failures.push(`Pill radius must remain 9999; received ${SHAPE.radius.pill}.`);
}

const displaySm = Object.freeze({
  fontSize: Object.freeze({ xs: '1.75rem', md: '2rem' }),
  fontWeight: 400,
  lineHeight: 1.125,
  letterSpacing: '-0.6px',
});
const welcomeHero = getWelcomeHeroSx({
  typography: {
    uiDisplaySm: displaySm,
    uiHeadingHero: Object.freeze({ fontSize: '99rem' }),
  },
});

for (const property of ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']) {
  if (welcomeHero[property] !== displaySm[property]) {
    failures.push(`Welcome hero must consume typography.uiDisplaySm.${property}.`);
  }
}
```

- [ ] In `audit-theme-contrast.mjs`, change only the exact dark composer expectation:

```js
composer: '#1a1c20',
```

Keep the existing contrast calculations and semantic-token checks intact.

### Step 3: Run the new contract checks and confirm they fail for the intended reasons

- [ ] Run:

```bash
npm run audit:theme
npm run audit:interaction
```

Expected failures before production edits:

- the theme audit reports that the composer is still `#141414`;
- the interaction audit reports `md` is still 960px;
- the interaction audit reports the composer surface mismatch;
- the interaction audit reports that the welcome helper still consumes `uiHeadingHero` rather than `uiDisplaySm`.

If either audit fails for a different reason, investigate that discrepancy before modifying production code.

### Step 4: Implement the smallest shared-token changes

- [ ] In `src/theme/tokens.js`, change only the `md` value:

```js
export const BREAKPOINTS = Object.freeze({
  values: Object.freeze({
    xs: 0,
    sm: 600,
    md: 768,
    lg: 1200,
    xl: 1536,
  }),
});
```

- [ ] In `src/theme/tokens/semantic.js`, use the existing `neutral[850]` primitive for the composer:

```js
const DARK_BACKGROUND = Object.freeze({
  default: primitives.neutral[950],
  paper: primitives.neutral[900],
  composer: primitives.neutral[850],
  sunken: primitives.neutral[850],
  hover: primitives.neutral[850],
  strong: primitives.neutral[700],
  elevated1: primitives.neutral[900],
  elevated2: primitives.neutral[900],
  elevated3: primitives.neutral[900],
  elevated4: primitives.neutral[900],
  elevated5: primitives.neutral[900],
});
```

- [ ] In `src/features/styles/interfaceChrome.js`, make the welcome helper consume the approved display role:

```js
export function getWelcomeHeroSx(theme) {
  return {
    ...theme.typography.uiDisplaySm,
    color: 'text.primary',
    textWrap: 'balance',
  };
}
```

- [ ] Remove or correct only comments in the touched helper that now describe obsolete light-theme or elevated-composer behavior. Do not reformat unrelated exports.

### Step 5: Prove the shared contract is green

- [ ] Run:

```bash
npm run audit:theme
npm run audit:interaction
npm run build
```

Expected: all three commands pass. The build may retain the already-known Perspective warning, but must not add a new warning or error caused by this phase.

- [ ] Inspect the focused diff:

```bash
git diff -- front-end/scripts/audit-interaction-contrast.mjs front-end/scripts/audit-theme-contrast.mjs front-end/src/theme/tokens.js front-end/src/theme/tokens/semantic.js front-end/src/features/styles/interfaceChrome.js
git diff --check
```

Expected: only the approved token/helper/audit changes appear, and `git diff --check` prints no errors.

**Logical commit boundary:** `test(theme): lock phase 1b responsive and surface contracts` plus `style(theme): apply phase 1b shared tokens`.

---

## Task 2: Normalize the Welcome Screen and Composer Geometry

**Files:**

- Modify: `front-end/scripts/audit-interaction-contrast.mjs`
- Modify: `front-end/src/features/styles/interfaceChrome.js`
- Modify: `front-end/src/features/chat/WelcomeScreen.jsx`
- Modify: `front-end/src/features/chat/ChatInput.jsx`
- Modify: `front-end/src/features/chat/ChatColumn.jsx`

### Step 1: Capture the remaining component-level failures in the authenticated browser

- [ ] Use the existing authenticated `/chat` session and record computed styles at 390px, 767px, and 768px viewport widths before editing these components.

Measure the following by accessible name or semantic role:

| Element | 390px expected | 767px expected | 768px expected |
|---|---:|---:|---:|
| Welcome heading font size | 28px | 28px | 32px |
| Suggestion chip height | 44px | 44px | 34px |
| Open-sidebar control | 44×44px, pill | 44×44px, pill | hidden in desktop shell |
| Context control | 44px high | 44px high | 36px high |
| SQL editor control | 44px high | 44px high | 36px high |
| Model selector | 44px high | 44px high | 36px high |
| Send control | 44×44px | 44×44px | 36×36px |
| Composer background | `rgb(26, 28, 32)` | `rgb(26, 28, 32)` | `rgb(26, 28, 32)` |

Expected red-state observations after Task 1 but before Task 2:

- the local welcome font-size ladder overrides the shared display role;
- suggestion chips remain 34px high below 768px;
- toolbar and send controls compact at 600px rather than 768px;
- the mobile sidebar button retains a 10px radius;
- the composer uses intermediate 6px/10px/14px spacing values instead of the approved 4px scale.

Do not click the send button or any destructive setting while measuring.

### Step 2: Add failing executable checks for rendered-style contracts

- [ ] Import `interfaceChrome.js` as a namespace so the audit can report missing helper contracts as normal failures rather than terminating on a missing named export:

```js
import * as interfaceChrome from '../src/features/styles/interfaceChrome.js';
```

- [ ] Add assertions for three production style helpers that the components will consume:

```js
const geometryTheme = {
  shape: { radius: { pill: 9999 } },
  spacing: (value) => `${value * 8}px`,
};

if (typeof interfaceChrome.getResponsivePillControlSx !== 'function') {
  failures.push('chat controls: responsive pill geometry helper is missing.');
} else {
  const pill = interfaceChrome.getResponsivePillControlSx(geometryTheme, {
    desktopHeight: 36,
  });
  if (pill.height.xs !== 44 || pill.height.md !== 36 || pill.borderRadius !== 9999) {
    failures.push('chat controls: expected 44px mobile, 36px desktop, and pill geometry.');
  }
}

if (typeof interfaceChrome.getResponsivePillIconButtonSx !== 'function') {
  failures.push('chat icon controls: responsive pill geometry helper is missing.');
} else {
  const iconButton = interfaceChrome.getResponsivePillIconButtonSx(geometryTheme, {
    desktopSize: 40,
  });
  if (
    iconButton.width.xs !== 44 ||
    iconButton.width.md !== 40 ||
    iconButton.height.xs !== 44 ||
    iconButton.height.md !== 40 ||
    iconButton.borderRadius !== 9999
  ) {
    failures.push('chat icon controls: responsive target geometry mismatch.');
  }
}

if (typeof interfaceChrome.getComposerLayoutSx !== 'function') {
  failures.push('composer: responsive layout helper is missing.');
} else {
  const layout = interfaceChrome.getComposerLayoutSx(geometryTheme);
  if (
    layout.form.px.xs !== 0.5 ||
    layout.form.px.md !== 1 ||
    layout.content.px.xs !== 1.5 ||
    layout.content.px.md !== 2 ||
    layout.content.py !== 1.5 ||
    layout.toolbar.gap !== 1
  ) {
    failures.push('composer: responsive spacing contract mismatch.');
  }
}

if (typeof interfaceChrome.getWelcomeLayoutSx !== 'function') {
  failures.push('welcome: responsive layout helper is missing.');
} else {
  const welcomeLayout = interfaceChrome.getWelcomeLayoutSx();
  if (
    welcomeLayout.content.gap.xs !== 2 ||
    welcomeLayout.content.gap.md !== 3 ||
    welcomeLayout.suggestions.gap !== 1
  ) {
    failures.push('welcome: responsive spacing contract mismatch.');
  }
}
```

- [ ] Run `npm run audit:interaction`.

Expected: it fails with the four explicit “helper is missing” messages. These checks exercise real style-helper outputs and hand-derived values; they do not grep JSX or expose test-only component internals.

- [ ] Add the minimal helpers to `interfaceChrome.js`, then make the existing components consume them in Steps 3–5:

```js
export function getResponsivePillControlSx(
  theme,
  { desktopHeight, mobileHeight = 44 } = {},
) {
  return {
    height: { xs: mobileHeight, md: desktopHeight },
    minHeight: { xs: mobileHeight, md: desktopHeight },
    borderRadius: theme.shape.radius.pill,
  };
}

export function getResponsivePillIconButtonSx(
  theme,
  { desktopSize, mobileSize = 44 } = {},
) {
  return {
    width: { xs: mobileSize, md: desktopSize },
    height: { xs: mobileSize, md: desktopSize },
    borderRadius: theme.shape.radius.pill,
  };
}

export function getComposerLayoutSx(theme) {
  return {
    form: {
      px: { xs: 0.5, md: 1 },
      pb: { xs: `max(${theme.spacing(1)}, env(safe-area-inset-bottom))`, md: 1 },
    },
    surface: { minHeight: { xs: 132, md: 124 } },
    content: { px: { xs: 1.5, md: 2 }, py: 1.5, gap: 1.5 },
    toolbar: { gap: 1 },
  };
}

export function getWelcomeLayoutSx() {
  return {
    outer: { px: { xs: 1, md: 3 }, py: { xs: 2.5, md: 4 } },
    content: { gap: { xs: 2, md: 3 } },
    suggestions: { gap: 1 },
  };
}
```

- [ ] Re-run `npm run audit:interaction` only after Steps 3–5 have consumed the helpers. Expected: the runtime helper assertions pass together with the rendered browser checks; no source-text assertion is introduced.

### Step 3: Make the welcome screen consume theme roles without local typography overrides

- [ ] In `WelcomeScreen.jsx`, reuse the already-imported `UI_LAYOUT` touch-target contract. Do not add a second import.

- [ ] Replace the suggestion chip geometry with responsive touch-safe sizing and the theme's pill token:

```js
const welcomeLayout = getWelcomeLayoutSx();
const suggestionChipSx = useMemo(
  () => ({
    ...getResponsivePillControlSx(theme, {
      desktopHeight: 34,
      mobileHeight: UI_LAYOUT.touchTarget,
    }),
    border: `1px solid ${theme.palette.border.idle}`,
    bgcolor: 'transparent',
    color: 'text.secondary',
    '& .MuiChip-icon': { color: 'inherit', ml: 1 },
    '& .MuiChip-label': { px: 1.5, ...theme.typography.buttonMd },
    '&:hover': {
      bgcolor: theme.palette.action.selected,
      color: 'text.primary',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.border.focus}`,
      outlineOffset: 2,
    },
  }),
  [theme],
);
```

Preserve all existing hover/focus/disabled colors and the existing click behavior.

- [ ] Align the outer and group spacing to the approved responsive boundary:

```js
px: { xs: 1, md: 3 },
py: { xs: 2.5, md: 4 },
```

```js
gap: { xs: 2, md: 3 },
```

```js
gap: 1,
```

The three snippets respectively apply to the outer welcome container, the primary content stack, and the suggestion-chip group.
Consume these through `welcomeLayout.outer`, `welcomeLayout.content`, and
`welcomeLayout.suggestions` so the executable helper checks cover the values rendered by the
component.

- [ ] Remove `theme.typography.uiDisplayMd`, the local `{ xs: '1.65rem', sm: '2.05rem', md: '2.55rem' }` font-size ladder, and the local `lineHeight: 1.18` from the heading. Keep only the shared helper plus layout properties:

```js
sx={(theme) => ({
  ...getWelcomeHeroSx(theme),
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '0.25em',
  maxWidth: { xs: 'min(100%, 680px)', md: 720 },
})}
```

### Step 4: Keep composer controls touch-sized until the new 768px boundary

- [ ] In `ChatInput.jsx`, change responsive compact-control keys from `sm` to `md` for the toolbar button styles:

```js
...getResponsivePillControlSx(theme, {
  desktopHeight: 36,
  mobileHeight: UI_LAYOUT.touchTarget,
}),
minWidth: { xs: UI_LAYOUT.touchTarget, md: 32 },
maxWidth: { xs: 'min(42vw, 168px)', md: 208 },
px: { xs: 1, md: 1.5 },
```

- [ ] Apply the same `md` boundary to the input and send control without changing their state logic:

```js
minHeight: { xs: 48, md: 50 },
```

```js
width: { xs: UI_LAYOUT.touchTarget, md: 36 },
height: { xs: UI_LAYOUT.touchTarget, md: 36 },
borderRadius: theme.shape.radius.pill,
```

- [ ] Normalize the form and composer spacing:

```js
px: { xs: 0.5, md: 1 },
pb: {
  xs: `max(${theme.spacing(1)}, env(safe-area-inset-bottom))`,
  md: 1,
},
```

```js
minHeight: { xs: 132, md: 124 },
```

```js
px: { xs: 1.5, md: 2 },
py: 1.5,
gap: 1.5,
```

These values produce 4/8px outer horizontal spacing, 8px desktop bottom spacing, 12/16px inner horizontal spacing, and 12px vertical spacing.
Create `const composerLayout = getComposerLayoutSx(theme)` and spread its `form`, `surface`,
`content`, and `toolbar` members into the corresponding existing `sx` objects instead of
duplicating those values locally.

- [ ] Change the toolbar row gap from 6px to 8px:

```js
gap: 1,
```

- [ ] For the context and SQL buttons, replace intermediate horizontal padding with scale values:

```js
px: { xs: 1, md: 1.5 },
```

- [ ] Keep the effective task-mode label hidden until `md` and keep the model selector at its mobile width until `md`:

```js
display: { xs: 'none', md: 'block' },
```

```js
width: { xs: 116, md: 156 },
```

Do not change handlers, menu item values, refs, disabled logic, keyboard behavior, or payload construction.

### Step 5: Normalize the floating chat controls

- [ ] In `ChatColumn.jsx`, import `UI_LAYOUT` with the existing shared UI helpers using the repository's alias convention:

```js
import { getInteractiveIconButtonSx, getScrollbarStyles, UI_LAYOUT } from '@/styles/shared';
```

- [ ] Change the mobile sidebar entry point to the shared touch size and pill radius, and align its fixed inset to the spacing scale:

```js
left: 12,
...getInteractiveIconButtonSx(theme, {
  size: UI_LAYOUT.touchTarget,
  radius: theme.shape.radius.pill,
}),
```

- [ ] Make the scroll-to-latest control touch-sized below `md`, explicitly pill-shaped, and align its offset:

```js
bottom: 'calc(100% + 12px)',
width: { xs: UI_LAYOUT.touchTarget, md: 40 },
height: { xs: UI_LAYOUT.touchTarget, md: 40 },
borderRadius: theme.shape.radius.pill,
```

Generate the three geometry properties above by spreading
`getResponsivePillIconButtonSx(theme, { desktopSize: 40, mobileSize: UI_LAYOUT.touchTarget })`.

Preserve its visibility condition, scroll handler, icon, label, and z-index behavior.

### Step 6: Run focused static validation

- [ ] Run:

```bash
npm run lint
npm run audit:theme
npm run audit:interaction
npm run build
git diff --check
```

Expected: all commands pass, with no new warning beyond any recorded baseline warning.

### Step 7: Re-run the browser measurements and confirm the component contract is green

- [ ] Repeat the Step 1 measurement table at 390px, 767px, and 768px.

Expected:

- the welcome heading computes to 28/28/32px;
- all mobile and tablet-width interaction targets stay at least 44px through 767px;
- desktop controls compact only at 768px;
- the sidebar and floating action controls are pill-shaped;
- the composer background is `rgb(26, 28, 32)` at all widths;
- the composer does not overflow horizontally at any tested width.

**Logical commit boundary:** `style(chat): align empty state and composer with phase 1b spec`.

---

## Task 3: Validate Global Responsive Topology and Non-Destructive Interaction States

**Files:**

- Modify only if a regression is demonstrated: `front-end/src/features/shell/AppShell.jsx`
- Modify only if a regression is demonstrated: `front-end/src/features/overlays/settings/SettingsModal.jsx`
- Modify only if a regression is demonstrated: `front-end/src/features/overlays/database/DatabaseModal.jsx`
- Modify only if a regression is demonstrated: `front-end/src/features/sidebar-left/index.jsx`

### Step 1: Verify the shell transition at the exact boundary

- [ ] At 767px, confirm:

  - the permanent desktop sidebar is absent;
  - the 44×44px mobile sidebar button is visible and keyboard focusable;
  - activating it opens the temporary sidebar drawer;
  - pressing Escape closes the drawer and returns focus to the trigger;
  - no horizontal document overflow is introduced.

- [ ] At 768px, confirm:

  - the permanent desktop sidebar is visible;
  - the mobile sidebar trigger is absent;
  - the chat column retains usable width;
  - the composer remains anchored and unobscured.

Expected: the topology changes exactly at 768px because `useResponsive` and the shell already consume `theme.breakpoints.up('md')`. Do not edit `AppShell.jsx` if this passes.

### Step 2: Verify settings and database modal topology at the same boundary

- [ ] Open Settings at 767px and 768px and confirm:

  - navigation and content are usable without horizontal overflow;
  - the dark-only settings state remains intact;
  - no Appearance/Light selector reappears;
  - close behavior and focus return work at both widths.

- [ ] Open the database dialog at 767px and 768px and confirm:

  - prerequisite/empty messaging remains readable;
  - dialog controls meet the applicable touch-target expectation;
  - the dialog does not overflow the viewport;
  - close behavior and focus return work.

Do not attempt a database connection. If a regression exists, first identify the exact existing `md` consumer and make the smallest local layout correction; do not revert the global breakpoint.

### Step 3: Verify composer interactive states without submitting data

- [ ] At 390px and 768px:

  - focus the chat textbox using the keyboard and confirm a visible focus treatment;
  - type a temporary unsent string and confirm the send button transitions from disabled to enabled;
  - clear the string and confirm the send button returns to disabled;
  - type `/` to open the slash-command surface, verify it remains on-screen, then clear the input;
  - open and close the context, SQL, task-mode, and model controls where available;
  - confirm Escape dismisses each transient surface and focus remains logical.

Do not press Enter while text is present and do not activate the send button.

### Step 4: Check browser console and runtime stability

- [ ] Reload `/chat` once at 390px and once at 768px. Record console errors and warnings.

Expected: no new runtime error attributable to the Phase 1B changes. Distinguish the pre-existing Framer Motion warning or historical request failures from new regressions rather than suppressing them.

### Step 5: Apply only evidence-backed responsive fixes, if required

- [ ] If all checks pass, make no code change in the conditional file list.

- [ ] If a check fails, first reproduce it at both 767px and 768px, identify the responsible style rule, and add the smallest breakpoint or overflow correction in the existing component. Re-run the failed check plus the Task 2 static validation commands immediately.

**Logical commit boundary if a fix is required:** `fix(layout): preserve modal and shell behavior at 768px breakpoint`.

---

## Task 4: Full Regression Validation, Cleanup, and Phase Documentation

**Files:**

- Modify: `docs/frontend-ui-audit/phases.md`
- Modify: `docs/frontend-ui-audit/memory.md`
- Review: every file changed in Tasks 1–3

### Step 1: Update the existing Phase 1B implementation record

- [ ] In `docs/frontend-ui-audit/phases.md`, update the existing Phase 1B section in place:

- replace Known Issues and Planned Changes with the implemented contract;
- add exact automated-validation results;
- add the 390/767/768/desktop browser observations;
- retain any baseline warning and fixture limitation;
- set Status to `COMPLETE` only if every in-scope check passes, otherwise use `PARTIALLY COMPLETE` and name the limitation precisely.

- [ ] In `docs/frontend-ui-audit/memory.md`:

  - move Phase 1B into Recently Completed with exact files and validation results;
  - update Current Focus and Next Recommended Task to the Phase 1C pre-phase audit;
  - remove the resolved composer, radius, welcome-type, and 960px-breakpoint entries from Known Issues;
  - retain the missing database/conversation fixtures and future-light-theme decision;
  - state that transcript/code/tool presentation remains Phase 1C and sidebar-history presentation remains Phase 2.

### Step 2: Run the full repository-appropriate frontend validation suite

- [ ] From `front-end`, run:

```bash
node --test src/theme/mode.test.js src/config/userSettings.test.js src/pages/Landing/landingContent.test.js
npm run lint
npm run knip
npm run audit:dark
npm run audit:theme
npm run audit:interaction
npm run build
```

Expected: every command exits successfully. Record each exact command and result in the Phase 1B document. If a command fails, determine whether it is introduced by this phase or pre-existing before reporting completion.

### Step 3: Perform mandatory cleanup and self-review

- [ ] Review every changed file for:

  - unused imports or variables;
  - stale comments about light mode, 960px desktop behavior, or elevated composer surfaces;
  - temporary logging or browser-test attributes;
  - duplicated responsive values that should consume the existing token;
  - accidental changes to handlers, data flow, or disabled-state behavior;
  - unrelated formatting churn.

- [ ] Search the focused implementation for obsolete local values:

```bash
rg -n "1\.65rem|2\.05rem|2\.55rem|radius: '10px'|sm: 36|sm: 208|sm: 156" front-end/src/features/chat front-end/src/features/styles
```

Expected: no obsolete Phase 1B override remains in the changed scope. Review every match rather than deleting blindly.

- [ ] Review the final diff and whitespace:

```bash
git diff --stat
git diff --check
git diff -- front-end/src/theme front-end/src/features/chat front-end/src/features/styles front-end/scripts docs/frontend-ui-audit
```

Expected: the diff is limited to the approved token, audit, chat-shell, and documentation scope.

### Step 4: Final authenticated sanity pass

- [ ] At 390px, 767px, 768px, and a normal desktop width, confirm the primary route renders, the composer accepts and clears unsent text, navigation surfaces open and close, and no tested surface overflows.

- [ ] Capture final screenshots for the implementation report at:

  - 390px empty-state chat;
  - 767px chat with the mobile sidebar entry point;
  - 768px chat with the permanent sidebar;
  - normal desktop empty-state chat.

- [ ] Do not claim fixture-dependent transcript, code-block, or scroll-to-latest states were browser-verified if no conversation fixture can safely expose them. The static geometry change and automated checks may be reported separately from live-state verification.

### Step 5: Prepare the implementation handoff

- [ ] Report:

  - what changed and why;
  - the important files changed;
  - the 768px global-breakpoint decision and its verified consumers;
  - exact automated commands and browser widths tested;
  - any retained baseline warning;
  - any fixture-dependent or deferred checks;
  - confirmation that no message was sent, no data was reset, and no database connection was changed.

**Logical commit boundary:** `docs(ui): record phase 1b validation`.
