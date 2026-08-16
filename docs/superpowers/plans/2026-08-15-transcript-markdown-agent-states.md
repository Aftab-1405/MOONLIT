# Phase 1C Transcript, Markdown, and Agent States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Moonlit's authenticated transcript, Markdown/code surfaces, inline results, reasoning/tool controls, and guided-confirmation states comply with the canonical dark design system without changing chat or agent behavior.

**Architecture:** Preserve the current `MessageList` → Markdown/code/result/step component graph and make presentation-only changes. Reuse the responsive pill helpers already owned by `interfaceChrome.js`, strengthen the existing executable interaction audit, and verify reachable states through the existing authenticated schema conversation.

**Tech Stack:** React 19, MUI, React Markdown/remark-gfm, Shiki Stream, Material React Table, Vite, ESLint, Knip, Node executable audits.

## Global Constraints

- `front-end/DESIGN.md` is authoritative and must not be edited.
- The canvas remains `#0a0a0a`; card/table surfaces use `#191919`; full code blocks use `#1a1c20`.
- Cards and text inputs use an 8px radius; interactive controls use a 9999px pill radius.
- Interactive targets below 768px are at least 44px in both dimensions.
- Changed visible margin, padding, and gap values resolve to 4px increments.
- Inter and Geist Mono remain the font families and all text remains weight 400.
- Focus uses a visible 2px outline; do not introduce focus shadows.
- Do not change props, callbacks, parsing, state ownership, message ordering, streaming, query execution, result fetching, or backend contracts.
- Do not add a fixture route, mock backend, test framework, dependency, or production-only audit path.
- Work in the current checkout, preserve unrelated staged and unstaged changes, avoid bulk formatting, and do not commit automatically.

---

## File Map

- `front-end/scripts/audit-interaction-contrast.mjs`: executable regression contract for canonical geometry, surfaces, and helper consumption.
- `front-end/src/features/styles/interfaceChrome.js`: existing responsive pill helpers; no new styling abstraction is expected.
- `front-end/src/features/chat/MessageList.jsx`: transcript typography, message actions, artifact/status presentation.
- `front-end/src/features/chat/MarkdownRenderer.jsx`: Markdown spacing and table surface role.
- `front-end/src/components/CodeViewer.jsx`: code surface and responsive action geometry.
- `front-end/src/features/chat/InlineExecutionTable.jsx`: execution-table surface parity and visible spacing.
- `front-end/src/features/chat/ai-response-steps/timelineShared.js`: flat responsive pill geometry for reasoning controls.
- `front-end/src/features/chat/ai-response-steps/index.jsx`: reasoning summary control layout.
- `front-end/src/features/chat/ai-response-steps/StepTimelineItems.jsx`: tool-row targets and step spacing.
- `front-end/src/features/chat/ai-response-steps/ToolResultDetails.jsx`: expandable schema-row targets and detail spacing.
- `front-end/src/features/chat/GuidedConfirmationPrompt.jsx`: warning-strip geometry, actions, and focus treatment.
- `docs/frontend-ui-audit/phases.md`: Phase 1C findings, verification, fixture limits, and final status.
- `docs/frontend-ui-audit/memory.md`: operational state and next phase handoff.

### Task 1: Establish and Strengthen the Phase 1C Audit Contract

**Files:**
- Modify: `front-end/scripts/audit-interaction-contrast.mjs`
- Modify: `front-end/src/features/chat/ai-response-steps/timelineShared.js`

**Interfaces:**
- Consumes: `getFlatStepControlSx(theme, options)` and existing `interfaceChrome` responsive helpers.
- Produces: `getFlatStepControlSx()` with a default responsive minimum height of `{ xs: 44, md: 32 }` and `theme.shape.radius.pill` geometry.

- [ ] **Step 1: Run the current focused audit as the baseline**

Run:

```bash
cd front-end && npm run audit:interaction
```

Expected: PASS before the new Phase 1C assertions are introduced.

- [ ] **Step 2: Change the reasoning-control assertion so it describes the approved contract**

In the audit's `stepControl` theme fixture, add the canonical shape:

```js
shape: { radius: { pill: 9999 } },
```

Replace the old 8px/single-height check with:

```js
if (
  stepControl.minHeight?.xs !== 44 ||
  stepControl.minHeight?.md !== 32 ||
  stepControl.borderRadius !== 9999 ||
  stepControl.boxShadow !== 'none'
) {
  failures.push(`${mode}/reasoning step: responsive pill geometry or elevation mismatch.`);
}
```

- [ ] **Step 3: Run the audit and confirm the new assertion fails**

Run:

```bash
cd front-end && npm run audit:interaction
```

Expected: FAIL with `reasoning step: responsive pill geometry or elevation mismatch`.

- [ ] **Step 4: Implement the minimal shared reasoning-control geometry**

Change the helper signature and defaults in `timelineShared.js`:

```js
export function getFlatStepControlSx(
  theme,
  { size = { xs: 44, md: 32 }, radius = theme.shape.radius.pill } = {},
) {
  return {
    minHeight: size,
    borderRadius: radius,
    color: theme.palette.text.secondary,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    boxShadow: 'none',
    transition: theme.transitions.create(['color', 'box-shadow'], {
      duration: theme.transitions.duration.shorter,
    }),
    [HOVER_CAPABLE_QUERY]: {
      '&:hover': {
        color: theme.palette.text.primary,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        boxShadow: 'none',
      },
    },
    '&:active': {
      backgroundColor: 'transparent',
      boxShadow: 'none',
    },
    '&:focus-visible': {
      color: theme.palette.text.primary,
      backgroundColor: 'transparent',
      boxShadow: 'none',
      outline: `2px solid ${theme.palette.border.focus}`,
      outlineOffset: 2,
    },
  };
}
```

Do not change animation, status colors, or focus semantics.

- [ ] **Step 5: Run the focused audit and review the diff**

Run:

```bash
cd front-end && npm run audit:interaction
git diff --check -- front-end/scripts/audit-interaction-contrast.mjs front-end/src/features/chat/ai-response-steps/timelineShared.js
```

Expected: audit PASS and no whitespace errors.

### Task 2: Correct Transcript Typography and Message Actions

**Files:**
- Modify: `front-end/scripts/audit-interaction-contrast.mjs`
- Modify: `front-end/src/features/chat/MessageList.jsx`

**Interfaces:**
- Consumes: `getResponsivePillIconButtonSx(theme, { desktopSize })` from `interfaceChrome.js` and `theme.typography.uiResponseBody`.
- Produces: 44px mobile/30px desktop message action pills and role-based user-message typography.

- [ ] **Step 1: Add source-contract helpers to the executable audit**

Add:

```js
import { readFileSync } from 'node:fs';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const requireSource = (path, pattern, message) => {
  if (!pattern.test(readSource(path))) failures.push(message);
};
```

Add the transcript assertions:

```js
requireSource(
  'src/features/chat/MessageList.jsx',
  /getResponsivePillIconButtonSx\(theme,\s*\{\s*desktopSize:\s*30\s*\}\)/s,
  'transcript actions must consume 44px-mobile/30px-desktop pill geometry.',
);
requireSource(
  'src/features/chat/MessageList.jsx',
  /theme\.typography\.uiResponseBody/,
  'user messages must consume the response-body typography role.',
);
```

- [ ] **Step 2: Run the audit and confirm both assertions fail**

Run `cd front-end && npm run audit:interaction`.

Expected: FAIL with both new transcript messages.

- [ ] **Step 3: Apply the existing responsive pill helper to copy actions**

Import `getResponsivePillIconButtonSx` from `interfaceChrome.js`, then replace local width, height,
and radius values in `getMessageActionButtonSx` with:

```js
...getResponsivePillIconButtonSx(theme, { desktopSize: 30 }),
```

Set the action-row minimum height to `{ xs: 44, md: 30 }`. Keep its hover, touch, focus-within,
copy-success, and reduced-motion behavior unchanged.

- [ ] **Step 4: Replace the user-message type ladder with the named role**

In the user-message `Typography` style, replace the one-off `fontSize` with:

```js
...theme.typography.uiResponseBody,
```

Keep `whiteSpace`, wrapping, and the 8px bubble geometry.

Normalize the user-turn layout to `mt: { xs: 2, md: 2.5 }`, bubble horizontal padding
`{ xs: 1.5, md: 2 }`, and bubble vertical padding `{ xs: 1, md: 1.5 }`.

- [ ] **Step 5: Normalize the visible artifact status chip**

Change the noninteractive `Building…` chip from `6px` to `theme.shape.radius.pill`, set its padding
to `px: { xs: 2, md: 2.5 }` and `py: 0.5`, and normalize the artifact card to
`px: { xs: 1.5, md: 2 }` and `py: { xs: 1, md: 1.5 }`. Do not alter the
interactive `View diagram` button, which already consumes the shared pill action style and reaches
44px on touch through the theme.

- [ ] **Step 6: Run the focused audit and static checks**

Run:

```bash
cd front-end && npm run audit:interaction
npx eslint src/features/chat/MessageList.jsx scripts/audit-interaction-contrast.mjs
git diff --check -- front-end/src/features/chat/MessageList.jsx front-end/scripts/audit-interaction-contrast.mjs
```

Expected: all commands PASS.

### Task 3: Align Markdown Tables and Code Blocks with Semantic Surfaces

**Files:**
- Modify: `front-end/scripts/audit-interaction-contrast.mjs`
- Modify: `front-end/src/features/chat/MarkdownRenderer.jsx`
- Modify: `front-end/src/components/CodeViewer.jsx`

**Interfaces:**
- Consumes: `theme.palette.background.paper`, `theme.palette.code.background`, and `getResponsivePillIconButtonSx`.
- Produces: `#191919` Markdown-table cards, `#1a1c20` code blocks, and 44px-mobile/28px-desktop code actions.

- [ ] **Step 1: Add failing semantic-surface and control-consumption assertions**

Add:

```js
requireSource(
  'src/features/chat/MarkdownRenderer.jsx',
  /backgroundColor:\s*theme\.palette\.background\.paper/,
  'markdown tables must use the semantic card surface.',
);
requireSource(
  'src/components/CodeViewer.jsx',
  /theme\.palette\.code\.background/,
  'code blocks must use the semantic code surface.',
);
requireSource(
  'src/components/CodeViewer.jsx',
  /getResponsivePillIconButtonSx\(theme,\s*\{\s*desktopSize:\s*28\s*\}\)/s,
  'code actions must consume 44px-mobile/28px-desktop pill geometry.',
);
```

Also assert the token values directly:

```js
if (darkSemanticTokens.background.paper !== '#191919') {
  failures.push('card surface must remain #191919.');
}
if (darkSemanticTokens.background.sunken !== '#1a1c20') {
  failures.push('code surface must remain #1a1c20.');
}
```

- [ ] **Step 2: Run the audit and confirm the component assertions fail**

Run `cd front-end && npm run audit:interaction`.

Expected: FAIL for Markdown table, CodeViewer surface, and CodeViewer action consumption; token-value assertions pass.

- [ ] **Step 3: Correct Markdown table presentation without changing parsing**

In `MarkdownRenderer.jsx`:

- set the outer table `backgroundColor` to `theme.palette.background.paper`;
- preserve the 8px radius, hairline, and horizontal overflow;
- normalize table block margin to `my: isCompact ? 1 : 2`;
- normalize header/cell horizontal padding to `{ xs: 1, md: 2 }` and vertical padding to `1`;
- leave Markdown transforms, component routing, line heights, link semantics, and streaming caret untouched.

- [ ] **Step 4: Correct CodeViewer surface and action geometry**

Import `getResponsivePillIconButtonSx`, set the full container background to
`theme.palette.code.background`, and replace the ActionButton's fixed geometry with:

```js
...getResponsivePillIconButtonSx(theme, { desktopSize: 28 }),
```

Keep the simple/transparent variants transparent, retain the 8px full-container radius and
hairline, and do not alter stream setup, dynamic imports, syntax colors, wrapping, copying, or query
execution.

- [ ] **Step 5: Normalize only visible code-block spacing**

Use these 4px-scale values for the outer margin and header/code padding:

```js
my: 2,
header: { pt: 1, pb: 0.5, px: { xs: 1.5, md: 2 }, gap: 1 },
codeWindow: { pt: 0.5, pb: { xs: 1.5, md: 2 }, px: { xs: 1.5, md: 2 } },
```

Do not change code font size, line height, tab size, scrollbar dimensions, or streaming metrics.

- [ ] **Step 6: Run focused validation**

Run:

```bash
cd front-end && npm run audit:interaction
npx eslint src/features/chat/MarkdownRenderer.jsx src/components/CodeViewer.jsx scripts/audit-interaction-contrast.mjs
git diff --check -- front-end/src/features/chat/MarkdownRenderer.jsx front-end/src/components/CodeViewer.jsx
```

Expected: all commands PASS.

### Task 4: Preserve Markdown/Execution-Table Parity

**Files:**
- Modify: `front-end/scripts/audit-interaction-contrast.mjs`
- Modify: `front-end/src/features/chat/InlineExecutionTable.jsx`

**Interfaces:**
- Consumes: `theme.palette.background.paper`, existing Material React Table configuration, and the Markdown table spacing contract from Task 3.
- Produces: a `#191919`, 8px, hairline, no-shadow execution-result surface with unchanged data behavior.

- [ ] **Step 1: Add a failing source assertion for the table surface**

```js
requireSource(
  'src/features/chat/InlineExecutionTable.jsx',
  /backgroundColor:\s*theme\.palette\.background\.paper/,
  'execution tables must use the semantic card surface.',
);
```

- [ ] **Step 2: Run the audit and confirm the assertion fails**

Run `cd front-end && npm run audit:interaction`.

Expected: FAIL with `execution tables must use the semantic card surface`.

- [ ] **Step 3: Update only execution-table presentation properties**

In `getSurfaceSx(theme)`, set `backgroundColor: theme.palette.background.paper`, retain 8px,
hairline, overflow, and `boxShadow: 'none'`, and normalize `mt`/`mb` from `1.75` to `2`.

Make loading header, table header, and body cell padding match Task 3:

```js
px: { xs: 1, md: 2 },
py: 1,
```

Set the empty/error-state icon tile to 40px, gap to `1.5`, padding to `2`, and supporting-text top
margin to `0.5`. Do not change fetching, mounted guards, column
definitions, formatting, resizing, virtualization, sorting, pagination, row order, or result-state
semantics.

- [ ] **Step 4: Run focused validation**

Run:

```bash
cd front-end && npm run audit:interaction
npx eslint src/features/chat/InlineExecutionTable.jsx
git diff --check -- front-end/src/features/chat/InlineExecutionTable.jsx
```

Expected: all commands PASS.

### Task 5: Apply Responsive Pill Geometry to Reasoning and Tool Details

**Files:**
- Modify: `front-end/src/features/chat/ai-response-steps/index.jsx`
- Modify: `front-end/src/features/chat/ai-response-steps/StepTimelineItems.jsx`
- Modify: `front-end/src/features/chat/ai-response-steps/ToolResultDetails.jsx`

**Interfaces:**
- Consumes: the Task 1 default contract of `getFlatStepControlSx(theme)`.
- Produces: 44px mobile/32px desktop reasoning, tool, and expandable schema controls.

- [ ] **Step 1: Remove overrides that defeat the responsive helper**

In `index.jsx`, replace:

```js
...getFlatStepControlSx(theme, { size: 32 }),
minHeight: 32,
```

with:

```js
...getFlatStepControlSx(theme),
```

Keep noninteractive single-workflow summaries flat; give those rows `minHeight: { xs: 44, md: 32 }`
without adding hover or click treatment.

- [ ] **Step 2: Make tool-step controls consume the shared default**

In `StepTimelineItems.jsx`, change `getStepButtonSx` so interactive controls spread
`getFlatStepControlSx(theme)` with no fixed size or radius. Noninteractive rows use
`minHeight: { xs: 44, md: 32 }` and remain visually flat. Change `STEP_TITLE_MIN_HEIGHT` to the same
responsive object and keep node positions, animations, status colors, summaries, and expansion
logic unchanged.

Set `TIMELINE_CONTENT_PL` to `{ xs: 3.5, md: 4 }`, `TIMELINE_ITEM_PY` to `0.5`, and step-control
gap to `1`. These values resolve to the approved 4px scale without changing timeline behavior.

- [ ] **Step 3: Make expandable schema rows consume the shared default**

In `ToolResultDetails.jsx`, replace `getFlatStepControlSx(theme, { size: 32 })` with
`getFlatStepControlSx(theme)`. Give disabled/nonexpandable rows the responsive minimum height but no
interactive chrome.

For the expandable schema-row block, set outer vertical padding to `0.5`, button horizontal padding
to `{ xs: 0.5, md: 1 }`, button vertical padding to `0.5`, and content bottom padding to `0.5`.
Do not change mono/body roles, result normalization, URL behavior, column resolution, or payload
rendering.

- [ ] **Step 4: Run focused validation**

Run:

```bash
cd front-end && npm run audit:interaction
npx eslint src/features/chat/ai-response-steps/index.jsx src/features/chat/ai-response-steps/StepTimelineItems.jsx src/features/chat/ai-response-steps/ToolResultDetails.jsx
git diff --check -- front-end/src/features/chat/ai-response-steps
```

Expected: all commands PASS.

### Task 6: Correct Guided Confirmation Geometry and Focus

**Files:**
- Modify: `front-end/scripts/audit-interaction-contrast.mjs`
- Modify: `front-end/src/features/chat/GuidedConfirmationPrompt.jsx`

**Interfaces:**
- Consumes: `getResponsivePillControlSx(theme, { desktopHeight: 32 })`.
- Produces: an attached 8px warning surface with 44px-mobile/32px-desktop pill actions and a 2px focus outline.

- [ ] **Step 1: Add failing guided-confirmation assertions**

```js
requireSource(
  'src/features/chat/GuidedConfirmationPrompt.jsx',
  /getResponsivePillControlSx\(theme,\s*\{\s*desktopHeight:\s*32\s*\}\)/s,
  'guided confirmation actions must consume responsive pill geometry.',
);
requireSource(
  'src/features/chat/GuidedConfirmationPrompt.jsx',
  /outline:\s*`2px solid \$\{theme\.palette\.border\.focus\}`/,
  'guided confirmation focus must use the canonical 2px outline.',
);
```

- [ ] **Step 2: Run the audit and confirm both assertions fail**

Run `cd front-end && npm run audit:interaction`.

Expected: FAIL with both guided-confirmation messages.

- [ ] **Step 3: Apply canonical surface and action geometry**

Import `getResponsivePillControlSx`. Change the attached warning surface's top radii from 14px to
8px, set its gap to `{ xs: 1, md: 1.5 }`, horizontal padding to `{ xs: 2, md: 2.5 }`, and the action
row gap to `1`. Set both button horizontal paddings to `1.5`. For both actions, replace fixed
height/radius with:

```js
...getResponsivePillControlSx(theme, { desktopHeight: 32 }),
```

- [ ] **Step 4: Replace focus shadows with the canonical outline**

For both actions use:

```js
'&.Mui-focusVisible': {
  boxShadow: 'none',
  outline: `2px solid ${theme.palette.border.focus}`,
  outlineOffset: 2,
},
```

Preserve callbacks, labels, role/status attributes, z-index, absolute positioning, warning color,
Collapse/Fade behavior, and composer interactivity.

- [ ] **Step 5: Run focused validation**

Run:

```bash
cd front-end && npm run audit:interaction
npx eslint src/features/chat/GuidedConfirmationPrompt.jsx scripts/audit-interaction-contrast.mjs
git diff --check -- front-end/src/features/chat/GuidedConfirmationPrompt.jsx
```

Expected: all commands PASS.

### Task 7: Perform Phase-Level Automated Validation and Self-Review

**Files:**
- Review: every production and audit file changed in Tasks 1–6.

**Interfaces:**
- Consumes: the completed presentation changes.
- Produces: a clean, validated Phase 1C candidate before browser verification.

- [ ] **Step 1: Review the complete Phase 1C diff**

Run:

```bash
git diff -- front-end/scripts/audit-interaction-contrast.mjs front-end/src/components/CodeViewer.jsx front-end/src/features/chat/MessageList.jsx front-end/src/features/chat/MarkdownRenderer.jsx front-end/src/features/chat/InlineExecutionTable.jsx front-end/src/features/chat/GuidedConfirmationPrompt.jsx front-end/src/features/chat/ai-response-steps
```

Confirm there are no parsing, state, callback, API, stream, query, or result-shape changes. Remove
only unused imports or obsolete style declarations introduced by this phase; preserve unrelated
user changes.

- [ ] **Step 2: Run all focused design audits**

Run:

```bash
cd front-end
npm run audit:interaction
npm run audit:theme
npm run audit:dark
npm run audit:input-focus
```

Expected: all four audits PASS.

- [ ] **Step 3: Run repository frontend validation**

Run:

```bash
cd front-end
npm run lint
npm run knip
npm run build
```

Expected: lint and Knip PASS; build completes. Record any existing Perspective chunk warning
verbatim rather than treating it as a new Phase 1C failure.

- [ ] **Step 4: Check whitespace and accidental debug code**

Run:

```bash
git diff --check
rg -n "console\.(log|debug)|debugger" front-end/src/features/chat front-end/src/components/CodeViewer.jsx front-end/scripts/audit-interaction-contrast.mjs
```

Expected: no whitespace errors and no newly introduced debug statements. Existing
intentional `console.error` handling in CodeViewer is not removed merely to satisfy this scan.

### Task 8: Browser-Verify Reachable Transcript States

**Files:**
- No application file changes unless a verified regression from Tasks 1–6 is found.

**Interfaces:**
- Consumes: the existing authenticated schema conversation.
- Produces: desktop and exact-390px evidence for reachable Phase 1C states.

- [ ] **Step 1: Inspect the desktop transcript without mutating data**

Open the existing conversation titled `Show me the database schema with all tables and their
columns`. Verify long Markdown, inline code, the artifact card, message actions, and collapsed and
expanded reasoning states. Do not send a message, execute a query, or connect a database.

- [ ] **Step 2: Measure desktop controls and focus behavior**

Verify message actions are 30px, CodeViewer actions are 28px when a reachable code block exists,
reasoning/tool controls are 32px, all interactive controls are pills, and focus uses a 2px outline
without shadow. Exercise expansion and keyboard focus only; do not invoke tool or artifact actions.

- [ ] **Step 3: Verify the exact 390px viewport**

Set 390×844 and verify:

- message actions are at least 44×44;
- reasoning and expandable tool rows are at least 44px high;
- the artifact action remains at least 44px high;
- long Markdown and inline code wrap without page-level horizontal overflow;
- the composer remains reachable;
- no new console errors appear.

Capture a screenshot of collapsed and expanded reasoning states.

- [ ] **Step 4: Restore the original desktop viewport**

Restore 1097×926 and confirm the page remains on the existing conversation.

- [ ] **Step 5: Record unavailable visual states honestly**

Mark fenced code blocks, execution-result tables, active streaming, guided confirmation,
paused execution, and error presentation as source/audit validated but not browser verified because
the current conversation lacks safe repeatable fixtures.

### Task 9: Update the Audit Ledger and Phase Handoff

**Files:**
- Modify: `docs/frontend-ui-audit/phases.md`
- Modify: `docs/frontend-ui-audit/memory.md`

**Interfaces:**
- Consumes: exact results from Tasks 7–8.
- Produces: an auditable Phase 1C completion record and Phase 2 handoff.

- [ ] **Step 1: Update the Phase 1C ledger entry**

Record:

- the files actually changed;
- the canonical geometry and surface corrections;
- exact automated commands and their outcomes;
- desktop and 390px browser evidence;
- unavailable fixture states;
- status as `COMPLETE WITH FIXTURE LIMITATIONS` only if all reachable checks pass.

Do not claim unavailable states were visually verified.

- [ ] **Step 2: Update operational memory**

Set current focus to the Phase 2 pre-phase sidebar/history audit. Preserve unresolved Phase 1A code
and SQL-editor fixture gaps and add the Phase 1C unavailable-state list. Include the next exact task:
read-only Phase 2 inspection and pre-phase compliance report before sidebar edits.

- [ ] **Step 3: Validate documentation and final diff scope**

Run:

```bash
git diff --check -- docs/frontend-ui-audit/phases.md docs/frontend-ui-audit/memory.md
git status --short
```

Expected: no documentation whitespace errors. Confirm only the intended Phase 1C files were added to
the already-dirty checkout and no unrelated file was overwritten.

- [ ] **Step 4: Report completion precisely**

Report what changed, files changed, significant design decisions, every validation command run,
browser evidence, the Perspective warning if present, and fixture limitations. Do not claim full
visual coverage for unavailable states.
