# Claude-Inspired Moonlit Welcome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a time-aware Moonlit welcome screen with a two-stage, connection-aware suggestion experience and a Claude-inspired composer shell that remains consistent before and after the first message.

**Architecture:** Keep `ChatInput` as the single composer implementation and centralize its new geometry in `interfaceChrome.js`. Put static welcome content and pure behavior in `welcomeSuggestions.js`, render the two-stage control in a focused `WelcomeSuggestions.jsx`, and let `WelcomeScreen` orchestrate greeting, visibility reset, and existing callbacks. Pass the existing database-modal callback through `MainInterface` and `ChatColumn`; do not introduce global state or backend changes.

**Tech Stack:** React 19, MUI 7, Framer Motion 12, JavaScript ES modules, Node's built-in test runner, existing executable UI audits, Vite 7.

## Global Constraints

- The shared composer and welcome suggestion panel have a maximum width of exactly 672px; transcript content remains 768px.
- The composer uses `background.composer` (`#1a1c20`), a 20px radius, an inset hairline, and `0 4px 20px rgba(0, 0, 0, 0.08)`.
- The suggestion panel uses `background.composer`, a 16px radius, the same soft shadow, and five rows per category.
- Desktop category controls are 32px high with an 8px radius, 12px horizontal padding, a 6px icon gap, and 8px between controls.
- Narrow-layout interactive targets remain at least 44px.
- Category/panel transitions use 220ms ease-out motion with no more than 6px vertical travel; reduced motion removes layout and translation animation.
- Existing Context, SQL, task-mode, model, usage, Send, Stop, slash-command, multiline, streaming, and popover behavior must remain unchanged.
- Use the existing `/moonlit.svg`; do not copy Claude branding, icons, text, model controls, or sidebar.
- Add no dependency, provider, global store, event bus, API, backend route, or persistence.
- Prompt actions use the existing `onSend` callback once; database actions use the existing database-modal callback and never send a prompt.
- Do not connect to a real database or send a production prompt solely to construct a test fixture.

## File Structure

- Create `front-end/src/features/chat/welcomeSuggestions.js`: immutable category data, greeting helpers, keyboard-index helper, and action dispatcher.
- Create `front-end/src/features/chat/welcomeSuggestions.test.js`: pure behavior and data-contract tests using `node:test`.
- Create `front-end/src/features/chat/WelcomeSuggestions.jsx`: accessible category row, animated panel, suggestion rows, roving focus, close/focus restoration, and Moonlit icon mapping.
- Modify `front-end/src/features/chat/WelcomeScreen.jsx`: time-aware heading, Moonlit mark, local category state/reset, and `WelcomeSuggestions` integration.
- Modify `front-end/src/features/chat/ChatInput.jsx`: consume the shared 672px composer width without changing composer behavior.
- Modify `front-end/src/features/styles/interfaceChrome.js`: composer, category, panel, and welcome layout contracts.
- Modify `front-end/src/features/chat/ChatColumn.jsx`: pass the existing database-modal callback to `WelcomeScreen`.
- Modify `front-end/src/features/MainInterface.jsx`: supply `handleSidebarOpenDbModal` to `ChatColumn`.
- Modify `front-end/scripts/audit-interaction-contrast.mjs`: executable visual, semantic, motion, and callback-plumbing contracts.

---

### Task 1: Time-Aware Greeting and Connection-Aware Suggestion Catalog

**Files:**
- Create: `front-end/src/features/chat/welcomeSuggestions.js`
- Create: `front-end/src/features/chat/welcomeSuggestions.test.js`

**Interfaces:**
- Produces: `getWelcomePeriod(date: Date): string`
- Produces: `getWelcomeGreeting({ date?: Date, displayName?: string | null }): string`
- Produces: `getWelcomeCategories(isConnected: boolean): ReadonlyArray<WelcomeCategory>`
- `WelcomeCategory`: `{ id: string, label: string, icon: 'database' | 'schema' | 'code' | 'analysis' | 'moonlit', entries: ReadonlyArray<WelcomeEntry> }`
- `WelcomeEntry`: `{ id: string, label: string, type: 'prompt', prompt: string } | { id: string, label: string, type: 'openDatabase' }`
- Consumes: no application state, React, MUI, or browser globals.

- [ ] **Step 1: Establish the focused baseline**

Run:

```bash
cd front-end
node --test src/features/sidebar-left/conversationListModel.test.js src/config/userSettings.test.js
npm run audit:interaction
```

Expected: the existing model tests and interaction audit pass before the new files exist. Record any failure before proceeding so it is not misattributed to this feature.

- [ ] **Step 2: Write the failing greeting and catalog tests**

Create `front-end/src/features/chat/welcomeSuggestions.test.js` with these assertions:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getWelcomeCategories,
  getWelcomeGreeting,
  getWelcomePeriod,
} from './welcomeSuggestions.js';

const atHour = (hour) => new Date(2026, 7, 16, hour, 0, 0);

test('welcome periods switch at the approved local-time boundaries', () => {
  assert.equal(getWelcomePeriod(atHour(4)), 'tonight');
  assert.equal(getWelcomePeriod(atHour(5)), 'this morning');
  assert.equal(getWelcomePeriod(atHour(11)), 'this morning');
  assert.equal(getWelcomePeriod(atHour(12)), 'this afternoon');
  assert.equal(getWelcomePeriod(atHour(16)), 'this afternoon');
  assert.equal(getWelcomePeriod(atHour(17)), 'this evening');
  assert.equal(getWelcomePeriod(atHour(20)), 'this evening');
  assert.equal(getWelcomePeriod(atHour(21)), 'tonight');
});

test('welcome greeting uses the first display-name token and has a no-name fallback', () => {
  assert.equal(
    getWelcomeGreeting({ date: atHour(22), displayName: 'Aftab Nadaf' }),
    'What are we exploring tonight, Aftab?',
  );
  assert.equal(
    getWelcomeGreeting({ date: atHour(9), displayName: '   ' }),
    'What are we exploring this morning?',
  );
  assert.equal(
    getWelcomeGreeting({ date: atHour(14), displayName: null }),
    'What are we exploring this afternoon?',
  );
});

test('connected catalog exposes the approved categories with five prompt actions each', () => {
  const categories = getWelcomeCategories(true);
  assert.deepEqual(
    categories.map(({ id, label }) => ({ id, label })),
    [
      { id: 'explore-schema', label: 'Explore schema' },
      { id: 'write-sql', label: 'Write SQL' },
      { id: 'analyze-data', label: 'Analyze data' },
      { id: 'moonlits-choice-connected', label: "Moonlit's choice" },
    ],
  );
  for (const category of categories) {
    assert.equal(category.entries.length, 5);
    assert.ok(category.entries.every((entry) => entry.type === 'prompt'));
    assert.ok(category.entries.every((entry) => entry.prompt.trim().length > 0));
  }
});

test('disconnected catalog avoids schema claims and exposes one database action', () => {
  const categories = getWelcomeCategories(false);
  assert.deepEqual(
    categories.map(({ id, label }) => ({ id, label })),
    [
      { id: 'connect-database', label: 'Connect database' },
      { id: 'understand-moonlit', label: 'Understand Moonlit' },
      { id: 'plan-query', label: 'Plan a query' },
      { id: 'moonlits-choice-disconnected', label: "Moonlit's choice" },
    ],
  );
  for (const category of categories) assert.equal(category.entries.length, 5);
  const actions = categories.flatMap((category) => category.entries);
  assert.equal(actions.filter((entry) => entry.type === 'openDatabase').length, 1);
  assert.ok(actions.filter((entry) => entry.type === 'prompt').every((entry) => entry.prompt));
});
```

- [ ] **Step 3: Run the catalog tests and confirm the intended failure**

Run:

```bash
cd front-end
node --test src/features/chat/welcomeSuggestions.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `welcomeSuggestions.js`.

- [ ] **Step 4: Implement the minimal immutable catalog and greeting helpers**

Create `front-end/src/features/chat/welcomeSuggestions.js`. Use this structure and exact user-facing copy:

```js
const prompt = (id, label, promptText) =>
  Object.freeze({ id, label, type: 'prompt', prompt: promptText });

const openDatabase = Object.freeze({
  id: 'open-database-setup',
  label: 'Open database connection setup',
  type: 'openDatabase',
});

const category = (id, label, icon, entries) =>
  Object.freeze({ id, label, icon, entries: Object.freeze(entries) });

const CONNECTED_CATEGORIES = Object.freeze([
  category('explore-schema', 'Explore schema', 'schema', [
    prompt('summarize-schema', 'Summarize my database schema', 'Summarize my database schema and highlight the most important tables.'),
    prompt('map-relationships', 'Map table relationships', 'Show the relationships between my main tables and explain how they connect.'),
    prompt('find-primary-keys', 'Review keys and constraints', 'Review the primary keys, foreign keys, and important constraints in my schema.'),
    prompt('explain-columns', 'Explain unclear columns', 'Identify columns whose names or data types may need clarification and explain what they likely represent.'),
    prompt('schema-opportunities', 'Find schema exploration opportunities', 'Suggest useful questions I can ask based on the structure of my database.'),
  ]),
  category('write-sql', 'Write SQL', 'code', [
    prompt('draft-read-query', 'Draft a read-only query', 'Help me draft a read-only SQL query for the result I describe.'),
    prompt('explain-query', 'Explain a SQL query', 'Explain a SQL query step by step and point out any risky or confusing parts.'),
    prompt('optimize-query', 'Optimize a slow query', 'Review a slow read-only SQL query and suggest safe performance improvements.'),
    prompt('validate-query', 'Validate query logic', 'Check whether a read-only SQL query matches the business question it is meant to answer.'),
    prompt('build-cte', 'Structure a query with CTEs', 'Help me structure a complex read-only query using clear common table expressions.'),
  ]),
  category('analyze-data', 'Analyze data', 'analysis', [
    prompt('find-trends', 'Find meaningful trends', 'Analyze my data for meaningful trends over time and explain the strongest signals.'),
    prompt('compare-segments', 'Compare important segments', 'Compare the most important segments in my data and summarize the differences.'),
    prompt('spot-anomalies', 'Look for anomalies', 'Look for unusual values or patterns in my data and suggest possible explanations.'),
    prompt('create-breakdown', 'Build a useful breakdown', 'Create a useful breakdown of a key metric by the dimensions that matter most.'),
    prompt('executive-summary', 'Create an executive summary', 'Summarize the most decision-relevant findings in my data for an executive audience.'),
  ]),
  category('moonlits-choice-connected', "Moonlit's choice", 'moonlit', [
    prompt('discover-question', 'Discover a high-value question', 'Inspect my schema and suggest one high-value analytical question to investigate.'),
    prompt('data-quality', 'Check data quality signals', 'Look for schema and query signals that may reveal data quality issues.'),
    prompt('relationship-story', 'Tell the story of my schema', 'Explain how the main entities in my database work together as a coherent data story.'),
    prompt('metric-opportunity', 'Find a useful metric', 'Suggest a useful metric I can calculate from my available data and draft the read-only SQL.'),
    prompt('surprising-pattern', 'Search for a surprising pattern', 'Choose a promising part of my data to explore for an unexpected pattern.'),
  ]),
]);

const DISCONNECTED_CATEGORIES = Object.freeze([
  category('connect-database', 'Connect database', 'database', [
    openDatabase,
    prompt('supported-databases', 'See supported databases', 'Which database systems can I connect to Moonlit?'),
    prompt('connection-requirements', 'Review connection requirements', 'What information do I need before connecting a database to Moonlit?'),
    prompt('connection-safety', 'Understand connection safety', 'How does Moonlit keep database access controlled and read-only?'),
    prompt('remote-connection', 'Plan a remote connection', 'Help me prepare a secure remote database connection for Moonlit.'),
  ]),
  category('understand-moonlit', 'Understand Moonlit', 'moonlit', [
    prompt('moonlit-workflow', 'See how Moonlit works', 'Explain the Moonlit workflow from a plain-English question to a verified result.'),
    prompt('read-only-execution', 'Understand read-only execution', 'Explain how Moonlit handles read-only SQL execution and its safety limits.'),
    prompt('available-artifacts', 'Explore available artifacts', 'What tables, charts, diagrams, and SQL artifacts can Moonlit create?'),
    prompt('model-choice', 'Understand model choice', 'How does model selection work in Moonlit?'),
    prompt('conversation-context', 'Understand conversation context', 'How does Moonlit preserve context across a database investigation?'),
  ]),
  category('plan-query', 'Plan a query', 'code', [
    prompt('define-question', 'Turn a goal into a data question', 'Help me turn a business goal into a precise data question before I connect a database.'),
    prompt('identify-tables', 'Identify likely tables', 'Given my analysis goal, help me identify the tables and columns I will probably need.'),
    prompt('draft-generic-sql', 'Draft generic SQL', 'Draft a database-agnostic read-only SQL outline for the analysis I describe.'),
    prompt('plan-validation', 'Plan result validation', 'Help me plan how to validate that a query result answers the intended question.'),
    prompt('plan-breakdown', 'Choose useful dimensions', 'Help me choose useful dimensions and filters for an analytical breakdown.'),
  ]),
  category('moonlits-choice-disconnected', "Moonlit's choice", 'moonlit', [
    prompt('prepare-first-analysis', 'Prepare my first analysis', 'Help me plan a valuable first analysis to run after I connect my database.'),
    prompt('schema-readiness', 'Create a schema readiness checklist', 'Create a short checklist for preparing a database schema for AI-assisted analysis.'),
    prompt('safe-query-practices', 'Learn safe query practices', 'Teach me the essential practices for safe, read-only analytical SQL.'),
    prompt('question-ladder', 'Build an analysis question ladder', 'Build a sequence of questions that moves from a broad metric to a useful diagnosis.'),
    prompt('artifact-plan', 'Plan an analysis artifact', 'Help me decide whether my result should become a table, chart, SQL artifact, or schema diagram.'),
  ]),
]);

export function getWelcomePeriod(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'this morning';
  if (hour >= 12 && hour < 17) return 'this afternoon';
  if (hour >= 17 && hour < 21) return 'this evening';
  return 'tonight';
}

export function getWelcomeGreeting({ date = new Date(), displayName = null } = {}) {
  const firstName = displayName?.trim().split(/\s+/)[0] || '';
  const suffix = firstName ? `, ${firstName}` : '';
  return `What are we exploring ${getWelcomePeriod(date)}${suffix}?`;
}

export function getWelcomeCategories(isConnected) {
  return isConnected ? CONNECTED_CATEGORIES : DISCONNECTED_CATEGORIES;
}
```

- [ ] **Step 5: Run the catalog tests**

Run:

```bash
cd front-end
node --test src/features/chat/welcomeSuggestions.test.js
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit the catalog**

```bash
git add front-end/src/features/chat/welcomeSuggestions.js front-end/src/features/chat/welcomeSuggestions.test.js
git commit -m "feat: add connection-aware welcome suggestions"
```

---

### Task 2: Shared Composer and Suggestion Visual Contracts

**Files:**
- Modify: `front-end/src/features/styles/interfaceChrome.js:16-71,127-147`
- Modify: `front-end/src/features/chat/ChatInput.jsx:50-62,894-903`
- Modify: `front-end/scripts/audit-interaction-contrast.mjs:1-9,357-425,459-461,497`

**Interfaces:**
- Produces: `COMPOSER_MAX_WIDTH: 672`
- Produces: `getComposerSurfaceSx(theme): SxProps`
- Produces: `getWelcomeCategorySx(theme): SxProps`
- Produces: `getWelcomeSuggestionPanelSx(theme): SxProps`
- Consumes: existing MUI theme roles `background.composer`, `border.idle`, `border.focus`, `action.hover`, and `text.secondary`.

- [ ] **Step 1: Change the audit to describe the approved visual contract**

Update the composer and welcome assertions in `front-end/scripts/audit-interaction-contrast.mjs` before production code. Import the new exports and assert:

```js
const {
  COMPOSER_MAX_WIDTH,
  getComposerSurfaceSx,
  getWelcomeCategorySx,
  getWelcomeHeroSx,
  getWelcomeLayoutSx,
  getWelcomeSuggestionPanelSx,
  INTERFACE_RADIUS,
} = interfaceChrome;

if (COMPOSER_MAX_WIDTH !== 672) failures.push('composer: maximum width must be 672px.');

const composer = getComposerSurfaceSx(composerTheme);
if (composer.borderRadius !== '20px') failures.push(`${mode}/composer: radius must be 20px.`);
if (composer.backgroundColor !== tokens.background.composer) {
  failures.push(`${mode}/composer: surface must use background.composer.`);
}
if (composer.boxShadow !== `0 4px 20px rgba(0, 0, 0, 0.08), inset 0 0 0 1px ${tokens.border.idle}`) {
  failures.push(`${mode}/composer: soft shadow or inset hairline mismatch.`);
}
if (composer['&:focus-within']?.boxShadow !== `0 4px 20px rgba(0, 0, 0, 0.08), inset 0 0 0 1px ${tokens.border.focus}`) {
  failures.push(`${mode}/composer: focus inset mismatch.`);
}

const categoryControl = getWelcomeCategorySx(composerTheme);
if (
  categoryControl.height.md !== 32 ||
  categoryControl.minHeight.xs !== 44 ||
  categoryControl.borderRadius !== '8px' ||
  categoryControl.px !== 1.5 ||
  categoryControl.gap !== 0.75
) failures.push(`${mode}/welcome category: responsive geometry mismatch.`);

const panel = getWelcomeSuggestionPanelSx(composerTheme);
if (panel.borderRadius !== '16px' || panel.backgroundColor !== tokens.background.composer) {
  failures.push(`${mode}/welcome panel: surface contract mismatch.`);
}
```

Change the radius loop so only `row`, `control`, `panel`, and `popover` must remain 8px, while `composer` must be 20px and `suggestionPanel` must be 16px. Change the final PASS message from `shadow-free composer states` to `shared composer and welcome suggestion states`.

- [ ] **Step 2: Run the audit and confirm it fails on missing/new contracts**

Run:

```bash
cd front-end
npm run audit:interaction
```

Expected: FAIL because `COMPOSER_MAX_WIDTH`, `getWelcomeCategorySx`, and `getWelcomeSuggestionPanelSx` do not exist and the composer still uses the old 8px/input/no-shadow contract.

- [ ] **Step 3: Implement the shared geometry and surface helpers**

In `front-end/src/features/styles/interfaceChrome.js`, add and update these contracts:

```js
export const COMPOSER_MAX_WIDTH = 672;
const COMPOSER_SHADOW = '0 4px 20px rgba(0, 0, 0, 0.08)';

export const INTERFACE_RADIUS = Object.freeze({
  row: '8px',
  control: '8px',
  composer: '20px',
  suggestionPanel: '16px',
  panel: '8px',
  popover: '8px',
});

export function getWelcomeCategorySx(theme) {
  return {
    height: { xs: 44, md: 32 },
    minHeight: { xs: 44, md: 32 },
    minWidth: { xs: 44, md: 0 },
    px: 1.5,
    gap: 0.75,
    borderRadius: INTERFACE_RADIUS.control,
    border: 0,
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.secondary,
    boxShadow: 'none',
    '&:hover': { backgroundColor: theme.palette.action.selected, color: theme.palette.text.primary },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.border.focus}`,
      outlineOffset: 2,
    },
  };
}

export function getWelcomeSuggestionPanelSx(theme) {
  return {
    width: '100%',
    maxWidth: COMPOSER_MAX_WIDTH,
    borderRadius: INTERFACE_RADIUS.suggestionPanel,
    backgroundColor: theme.palette.background.composer,
    backgroundImage: 'none',
    boxShadow: `${COMPOSER_SHADOW}, inset 0 0 0 1px ${theme.palette.border.idle}`,
    overflow: 'hidden',
  };
}

export function getComposerSurfaceSx(theme) {
  return {
    borderRadius: INTERFACE_RADIUS.composer,
    border: 0,
    overflow: 'hidden',
    backgroundColor: theme.palette.background.composer,
    backgroundImage: 'none',
    boxShadow: `${COMPOSER_SHADOW}, inset 0 0 0 1px ${theme.palette.border.idle}`,
    transition: 'box-shadow 140ms ease, background-color 140ms ease',
    '&:focus-within': {
      boxShadow: `${COMPOSER_SHADOW}, inset 0 0 0 1px ${theme.palette.border.focus}`,
    },
  };
}
```

Keep `getComposerHoverShadow` only if another source still imports it; return `COMPOSER_SHADOW` and update the audit accordingly. Otherwise remove the unused export and import after confirming `rg -n "getComposerHoverShadow" front-end/src front-end/scripts` has no remaining consumer.

- [ ] **Step 4: Apply the 672px contract to the single composer implementation**

In `front-end/src/features/chat/ChatInput.jsx`, import `COMPOSER_MAX_WIDTH` from `interfaceChrome.js` and replace:

```js
maxWidth: UI_LAYOUT.chatInputMaxWidth,
```

with:

```js
maxWidth: COMPOSER_MAX_WIDTH,
```

Do not change transcript width consumers of `UI_LAYOUT.chatInputMaxWidth`.

- [ ] **Step 5: Run visual contracts and focused tests**

Run:

```bash
cd front-end
npm run audit:interaction
npm run audit:theme
node --test src/features/chat/welcomeSuggestions.test.js
```

Expected: all commands PASS. If the theme audit fails, correct the visual helper rather than weakening contrast or global theme invariants.

- [ ] **Step 6: Commit the shared composer contract**

```bash
git add front-end/src/features/styles/interfaceChrome.js front-end/src/features/chat/ChatInput.jsx front-end/scripts/audit-interaction-contrast.mjs
git commit -m "feat: restyle the shared chat composer"
```

---

### Task 3: Pure Suggestion Navigation and Action Dispatch

**Files:**
- Modify: `front-end/src/features/chat/welcomeSuggestions.js`
- Modify: `front-end/src/features/chat/welcomeSuggestions.test.js`

**Interfaces:**
- Produces: `getSuggestionNavigationIndex({ key: string, currentIndex: number, itemCount: number }): number | null`
- Produces: `runWelcomeEntry(entry: WelcomeEntry, { canSend: boolean, onSend?: (prompt: string) => void, onOpenDatabase?: () => void }): boolean`
- Consumes: `WelcomeEntry` from Task 1.

- [ ] **Step 1: Add failing navigation and action-dispatch tests**

Append to `front-end/src/features/chat/welcomeSuggestions.test.js`:

```js
import {
  getSuggestionNavigationIndex,
  runWelcomeEntry,
} from './welcomeSuggestions.js';

test('suggestion keyboard navigation wraps and supports Home and End', () => {
  assert.equal(getSuggestionNavigationIndex({ key: 'ArrowDown', currentIndex: 4, itemCount: 5 }), 0);
  assert.equal(getSuggestionNavigationIndex({ key: 'ArrowRight', currentIndex: 1, itemCount: 5 }), 2);
  assert.equal(getSuggestionNavigationIndex({ key: 'ArrowUp', currentIndex: 0, itemCount: 5 }), 4);
  assert.equal(getSuggestionNavigationIndex({ key: 'ArrowLeft', currentIndex: 3, itemCount: 5 }), 2);
  assert.equal(getSuggestionNavigationIndex({ key: 'Home', currentIndex: 3, itemCount: 5 }), 0);
  assert.equal(getSuggestionNavigationIndex({ key: 'End', currentIndex: 0, itemCount: 5 }), 4);
  assert.equal(getSuggestionNavigationIndex({ key: 'Tab', currentIndex: 0, itemCount: 5 }), null);
});

test('prompt dispatch sends once only when sending is allowed', () => {
  const sent = [];
  const entry = { type: 'prompt', prompt: 'Inspect the schema' };
  assert.equal(runWelcomeEntry(entry, { canSend: false, onSend: (value) => sent.push(value) }), false);
  assert.deepEqual(sent, []);
  assert.equal(runWelcomeEntry(entry, { canSend: true, onSend: (value) => sent.push(value) }), true);
  assert.deepEqual(sent, ['Inspect the schema']);
});

test('database dispatch opens the modal without sending a prompt', () => {
  const calls = [];
  const handled = runWelcomeEntry(
    { type: 'openDatabase' },
    { canSend: true, onSend: () => calls.push('send'), onOpenDatabase: () => calls.push('database') },
  );
  assert.equal(handled, true);
  assert.deepEqual(calls, ['database']);
  assert.equal(runWelcomeEntry({ type: 'openDatabase' }, { canSend: true }), false);
});
```

Merge these named imports into the existing import declaration rather than creating two imports from the same module.

- [ ] **Step 2: Run the tests and confirm missing exports fail**

Run:

```bash
cd front-end
node --test src/features/chat/welcomeSuggestions.test.js
```

Expected: FAIL because the two new named exports do not exist.

- [ ] **Step 3: Implement the pure navigation and dispatch helpers**

Append to `front-end/src/features/chat/welcomeSuggestions.js`:

```js
export function getSuggestionNavigationIndex({ key, currentIndex, itemCount }) {
  if (itemCount <= 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;
  if (key === 'ArrowDown' || key === 'ArrowRight') return (currentIndex + 1) % itemCount;
  if (key === 'ArrowUp' || key === 'ArrowLeft') {
    return (currentIndex - 1 + itemCount) % itemCount;
  }
  return null;
}

export function runWelcomeEntry(
  entry,
  { canSend, onSend, onOpenDatabase } = {},
) {
  if (entry?.type === 'openDatabase') {
    if (typeof onOpenDatabase !== 'function') return false;
    onOpenDatabase();
    return true;
  }
  if (entry?.type !== 'prompt' || !canSend || typeof onSend !== 'function') return false;
  onSend(entry.prompt);
  return true;
}
```

- [ ] **Step 4: Run the pure behavior tests**

Run:

```bash
cd front-end
node --test src/features/chat/welcomeSuggestions.test.js
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit the behavior model**

```bash
git add front-end/src/features/chat/welcomeSuggestions.js front-end/src/features/chat/welcomeSuggestions.test.js
git commit -m "feat: add welcome suggestion behavior model"
```

---

### Task 4: Accessible Animated Two-Stage Suggestion Component

**Files:**
- Create: `front-end/src/features/chat/WelcomeSuggestions.jsx`
- Modify: `front-end/scripts/audit-interaction-contrast.mjs`

**Interfaces:**
- Consumes: `categories: ReadonlyArray<WelcomeCategory>` from `getWelcomeCategories()`.
- Consumes: `activeCategoryId: string | null`, `onCategoryChange(id: string | null)`, `onActivate(entry: WelcomeEntry)`, `canOpenDatabase: boolean`, `disabled: boolean`.
- Produces: semantic category list or one named suggestion region, never both simultaneously.

- [ ] **Step 1: Add source-contract assertions before creating the component**

In `front-end/scripts/audit-interaction-contrast.mjs`, add assertions for the new source:

```js
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /useReducedMotion\(\)/,
  'welcome suggestions must respect reduced motion.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /aria-label="Prompt categories"/,
  'welcome categories must expose a named list.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /role="region"[\s\S]*aria-label=\{`\$\{activeCategory\.label\} suggestions`\}/,
  'welcome suggestion panel must expose a named region.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /getSuggestionNavigationIndex/,
  'welcome suggestion keyboard behavior must use the tested navigation model.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /initial=\{reduceMotion \? false : \{ opacity: 0, y: 6, height: 0 \}\}/,
  'welcome panel motion must use the approved 6px reveal and disable it for reduced motion.',
);
requireSourceAbsent(
  'src/features/chat/WelcomeSuggestions.jsx',
  /role="(?:tab|tabpanel|option|listbox)"/,
  'welcome actions must not use selection-widget roles.',
);
```

- [ ] **Step 2: Run the audit and confirm the missing component fails**

Run:

```bash
cd front-end
npm run audit:interaction
```

Expected: FAIL because `WelcomeSuggestions.jsx` does not exist.

- [ ] **Step 3: Create the component with exact state, focus, and motion boundaries**

Create `front-end/src/features/chat/WelcomeSuggestions.jsx` with this implementation shape:

```jsx
import { Box, Button, IconButton, Typography } from '@mui/material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { memo, useCallback, useMemo, useRef } from 'react';
import {
  AnalyticsIcon,
  CloseIcon,
  CodeEditorIcon,
  DatabaseIcon,
  SchemaIcon,
} from '@/components/icons';
import {
  COMPOSER_MAX_WIDTH,
  getWelcomeCategorySx,
  getWelcomeSuggestionPanelSx,
} from '@/features/styles/interfaceChrome';
import { getSuggestionNavigationIndex } from './welcomeSuggestions.js';

const MotionBox = motion.create(Box);

const ICONS = Object.freeze({
  database: DatabaseIcon,
  schema: SchemaIcon,
  code: CodeEditorIcon,
  analysis: AnalyticsIcon,
  moonlit: SchemaIcon,
});

function CategoryIcon({ icon }) {
  const Icon = ICONS[icon] ?? SchemaIcon;
  return <Icon aria-hidden sx={{ width: 16, height: 16 }} />;
}

function WelcomeSuggestions({
  categories,
  activeCategoryId,
  onCategoryChange,
  onActivate,
  canOpenDatabase = false,
  disabled = false,
}) {
  const reduceMotion = useReducedMotion();
  const categoryRefs = useRef(new Map());
  const suggestionRefs = useRef([]);
  const returnFocusIdRef = useRef(null);
  const panelFocusPendingRef = useRef(false);
  const activeCategory = useMemo(
    () => categories.find(({ id }) => id === activeCategoryId) ?? null,
    [activeCategoryId, categories],
  );

  const closePanel = useCallback(() => {
    returnFocusIdRef.current = activeCategoryId;
    onCategoryChange(null);
  }, [activeCategoryId, onCategoryChange]);

  const openCategory = useCallback(
    (categoryId) => {
      panelFocusPendingRef.current = true;
      onCategoryChange(categoryId);
    },
    [onCategoryChange],
  );

  const handleSuggestionKeyDown = useCallback(
    (event, index) => {
      const nextIndex = getSuggestionNavigationIndex({
        key: event.key,
        currentIndex: index,
        itemCount: activeCategory?.entries.length ?? 0,
      });
      if (nextIndex == null) return;
      event.preventDefault();
      suggestionRefs.current[nextIndex]?.focus();
    },
    [activeCategory],
  );

  const handlePanelKeyDown = useCallback(
    (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePanel();
    },
    [closePanel],
  );

  const transition = reduceMotion ? { duration: 0.08 } : { duration: 0.22, ease: 'easeOut' };

  return (
    <Box sx={{ width: '100%', maxWidth: COMPOSER_MAX_WIDTH, mx: 'auto', mt: 1 }}>
      <AnimatePresence mode="sync" initial={false}>
        {!activeCategory ? (
          <MotionBox
            key="categories"
            component="ul"
            aria-label="Prompt categories"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={transition}
            sx={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 1,
              p: 0,
              m: 0,
              listStyle: 'none',
            }}
          >
            {categories.map((category) => (
              <Box component="li" key={category.id}>
                <Button
                  ref={(node) => {
                    if (!node) {
                      categoryRefs.current.delete(category.id);
                      return;
                    }
                    categoryRefs.current.set(category.id, node);
                    if (returnFocusIdRef.current === category.id) {
                      node.focus();
                      returnFocusIdRef.current = null;
                    }
                  }}
                  disabled={disabled}
                  onClick={() => openCategory(category.id)}
                  startIcon={<CategoryIcon icon={category.icon} />}
                  sx={(theme) => getWelcomeCategorySx(theme)}
                >
                  {category.label}
                </Button>
              </Box>
            ))}
          </MotionBox>
        ) : (
          <MotionBox
            key={activeCategory.id}
            role="region"
            aria-label={`${activeCategory.label} suggestions`}
            onKeyDown={handlePanelKeyDown}
            initial={reduceMotion ? false : { opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, height: 0 }}
            transition={transition}
            sx={(theme) => getWelcomeSuggestionPanelSx(theme)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 48, px: 2, gap: 1 }}>
              <CategoryIcon icon={activeCategory.icon} />
              <Typography
                sx={(theme) => ({
                  ...theme.typography.uiBodySm,
                  flex: 1,
                  color: 'text.secondary',
                })}
              >
                {activeCategory.label}
              </Typography>
              <IconButton aria-label="Close suggestions" onClick={closePanel} sx={{ width: 44, height: 44 }}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
            <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {activeCategory.entries.map((entry, index) => (
                <Box component="li" key={entry.id} sx={{ borderTop: '1px solid', borderColor: 'border.separator' }}>
                  <Button
                    ref={(node) => {
                      suggestionRefs.current[index] = node;
                      if (node && index === 0 && panelFocusPendingRef.current) {
                        node.focus();
                        panelFocusPendingRef.current = false;
                      }
                    }}
                    fullWidth
                    disabled={disabled || (entry.type === 'openDatabase' && !canOpenDatabase)}
                    onClick={() => onActivate(entry)}
                    onKeyDown={(event) => handleSuggestionKeyDown(event, index)}
                    sx={{
                      minHeight: 44,
                      justifyContent: 'flex-start',
                      px: 2,
                      py: 1.25,
                      borderRadius: 0,
                      color: 'text.secondary',
                      textAlign: 'left',
                      textTransform: 'none',
                      '&:hover': { backgroundColor: 'action.hover', color: 'text.primary' },
                      '&:focus-visible': { outline: '2px solid', outlineColor: 'border.focus', outlineOffset: -2 },
                    }}
                  >
                    {entry.label}
                  </Button>
                </Box>
              ))}
            </Box>
          </MotionBox>
        )}
      </AnimatePresence>
    </Box>
  );
}

export default memo(WelcomeSuggestions);
```

`CloseIcon` and `AnalyticsIcon` already exist in `@/components/icons`; do not modify the icon index
or add an icon package. Use `SchemaIcon` for Moonlit's-choice category controls because the
greeting already carries the actual Moonlit mark.

- [ ] **Step 4: Validate source, motion, and formatting contracts**

Run:

```bash
cd front-end
npm run audit:interaction
npx eslint src/features/chat/WelcomeSuggestions.jsx
```

Expected: PASS. Fix actual lint or audit failures; do not suppress rules.

- [ ] **Step 5: Commit the two-stage component**

```bash
git add front-end/src/features/chat/WelcomeSuggestions.jsx front-end/scripts/audit-interaction-contrast.mjs
git commit -m "feat: add animated welcome suggestion panel"
```

---

### Task 5: Welcome Screen Integration and Database Modal Plumbing

**Files:**
- Modify: `front-end/src/features/chat/WelcomeScreen.jsx:1-220`
- Modify: `front-end/src/features/chat/ChatColumn.jsx:20-83`
- Modify: `front-end/src/features/MainInterface.jsx:106-128`
- Modify: `front-end/scripts/audit-interaction-contrast.mjs`

**Interfaces:**
- `WelcomeScreen` adds prop `onOpenDatabase?: (event?: Event) => void`.
- `ChatColumn` adds prop `onOpenDatabase?: (event?: Event) => void` and passes it unchanged.
- `MainInterface` supplies existing `handleSidebarOpenDbModal` as `onOpenDatabase`.
- Consumes: `getWelcomeGreeting`, `getWelcomeCategories`, `runWelcomeEntry`, and `WelcomeSuggestions`.

- [ ] **Step 1: Add failing integration source contracts**

Extend `front-end/scripts/audit-interaction-contrast.mjs`:

```js
requireSource(
  'src/features/chat/WelcomeScreen.jsx',
  /getWelcomeGreeting\(\{[\s\S]*displayName:\s*user\?\.displayName/,
  'welcome heading must use the tested time-aware greeting helper.',
);
requireSource(
  'src/features/chat/WelcomeScreen.jsx',
  /component="img"[\s\S]*src="\/moonlit\.svg"[\s\S]*alt=""/,
  'welcome heading must use the existing decorative Moonlit mark.',
);
requireSource(
  'src/features/chat/WelcomeScreen.jsx',
  /if \(!visible\) setActiveCategoryId\(null\)/,
  'welcome category state must reset when the welcome state ends.',
);
requireSource(
  'src/features/chat/WelcomeScreen.jsx',
  /runWelcomeEntry\(entry,[\s\S]*canSend:\s*!disabled\s*&&\s*!isStreaming/,
  'welcome prompts must preserve disabled and streaming guards.',
);
requireSource(
  'src/features/MainInterface.jsx',
  /onOpenDatabase=\{handleSidebarOpenDbModal\}/,
  'main interface must pass the existing database modal callback into chat.',
);
requireSource(
  'src/features/chat/ChatColumn.jsx',
  /<WelcomeScreen[\s\S]*onOpenDatabase=\{onOpenDatabase\}/,
  'chat column must pass the database modal callback to the welcome screen.',
);
```

- [ ] **Step 2: Run the audit and confirm the old welcome implementation fails**

Run:

```bash
cd front-end
npm run audit:interaction
```

Expected: FAIL because the current welcome screen still has direct-send chips, a static greeting, and no database-modal callback.

- [ ] **Step 3: Replace direct-send chips with the approved orchestration**

In `front-end/src/features/chat/WelcomeScreen.jsx`:

1. Remove `Chip`, the inline `SUGGESTIONS` array, `WELCOME_PREFIX`, `suggestionChipSx`, and `handleSuggestionClick`.
2. Import `useEffect`, `useState`, `WelcomeSuggestions`, `COMPOSER_MAX_WIDTH`, and the pure model functions.
3. Add local state and reset behavior:

```js
function WelcomeScreen({ visible, user, chatInputProps, onOpenDatabase }) {
  const theme = useTheme();
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const {
    disabled = false,
    isConnected = false,
    isStreaming = false,
    onSend,
  } = chatInputProps || {};
  const categories = useMemo(() => getWelcomeCategories(isConnected), [isConnected]);
  const greeting = useMemo(
    () => getWelcomeGreeting({ displayName: user?.displayName }),
    [user?.displayName],
  );

  useEffect(() => {
    if (!visible) setActiveCategoryId(null);
  }, [visible]);

  const handleActivate = useCallback(
    (entry) =>
      runWelcomeEntry(entry, {
        canSend: !disabled && !isStreaming,
        onSend,
        onOpenDatabase,
      }),
    [disabled, isStreaming, onOpenDatabase, onSend],
  );
```

4. Render the heading as one semantic `h1`:

```jsx
<Typography
  component="h1"
  sx={{
    ...getWelcomeHeroSx(theme),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1.5,
    maxWidth: COMPOSER_MAX_WIDTH,
  }}
>
  <Box
    component="img"
    src="/moonlit.svg"
    alt=""
    aria-hidden="true"
    sx={{ width: { xs: 28, md: 32 }, height: { xs: 28, md: 32 }, flexShrink: 0 }}
  />
  <Box component="span">{greeting}</Box>
</Typography>
```

5. Keep `ChatInput` unchanged as the shared composer and replace its current chip children with:

```jsx
<WelcomeSuggestions
  categories={categories}
  activeCategoryId={activeCategoryId}
  onCategoryChange={setActiveCategoryId}
  onActivate={handleActivate}
  canOpenDatabase={typeof onOpenDatabase === 'function'}
  disabled={disabled || isStreaming}
/>
```

6. Use `COMPOSER_MAX_WIDTH` for the welcome content and suggestion wrapper; preserve the existing `Fade`, short initial reveal, centered overflow container, and reduced-motion rules.
   Change the overflow container from `alignItems: 'center'` to `alignItems: 'safe center'` so an
   expanded panel remains scrollable from its first row on short viewports.

- [ ] **Step 4: Pass the existing database modal callback through the chat boundary**

In `front-end/src/features/MainInterface.jsx`, add to `<ChatColumn>`:

```jsx
onOpenDatabase={handleSidebarOpenDbModal}
```

In `front-end/src/features/chat/ChatColumn.jsx`, destructure `onOpenDatabase` and pass:

```jsx
<WelcomeScreen
  visible={showWelcomeState}
  user={user}
  chatInputProps={chatInputSharedProps}
  onOpenDatabase={onOpenDatabase}
/>
```

Do not add the callback to `chatInputSharedProps`; database-modal opening belongs to the welcome orchestration, not the reusable message composer.

- [ ] **Step 5: Run focused behavior and integration validation**

Run:

```bash
cd front-end
node --test src/features/chat/welcomeSuggestions.test.js
npm run audit:interaction
npx eslint src/features/chat/WelcomeScreen.jsx src/features/chat/WelcomeSuggestions.jsx src/features/chat/ChatColumn.jsx src/features/MainInterface.jsx
```

Expected: all commands PASS.

- [ ] **Step 6: Commit the integrated welcome flow**

```bash
git add front-end/src/features/chat/WelcomeScreen.jsx front-end/src/features/chat/ChatColumn.jsx front-end/src/features/MainInterface.jsx front-end/scripts/audit-interaction-contrast.mjs
git commit -m "feat: integrate connection-aware welcome flow"
```

---

### Task 6: Full Regression, Browser Sanity, Cleanup, and Review

**Files:**
- Review every file changed in Tasks 1–5.
- Modify only files needed to correct failures found by the checks below.

**Interfaces:**
- Consumes: the complete feature from Tasks 1–5.
- Produces: verified behavior with no debug code, stale direct-send chip code, unsafe role use, or unrelated formatting changes.

- [ ] **Step 1: Run all relevant automated verification**

Run from `front-end`:

```bash
node --test src/features/chat/welcomeSuggestions.test.js src/features/sidebar-left/conversationListModel.test.js src/config/userSettings.test.js
npm run audit:interaction
npm run audit:input-focus
npm run audit:theme
npm run audit:dark
npm run lint
npm run knip
npm run build
```

Expected: every command exits 0. The known Perspective chunk-size warning may remain if it is only a warning and matches the pre-existing build behavior. Investigate every other failure and distinguish pre-existing failures from regressions before changing code.

- [ ] **Step 2: Start the local app for browser validation**

Run:

```bash
cd front-end
npm run dev -- --host 127.0.0.1
```

Open the emitted local URL in the in-app browser. Use an existing authenticated local session if available. Do not create an account, connect a real database, or send a production prompt just to manufacture state.

- [ ] **Step 3: Validate the disconnected desktop path**

At approximately 1393×831, verify:

- The heading uses the correct local-time phrase and first name.
- The Moonlit mark is 32px, decorative, and aligned with the heading.
- Composer and panel are 672px wide, use 20px/16px radii, and have one quiet inset boundary.
- Composer footer controls remain Context → SQL → effective mode → model → Send/Stop.
- Categories are the disconnected set and each desktop control is 32px high.
- Selecting each category displays five rows and removes the category row.
- Escape and the close button restore the categories and return focus to the opening control.
- Arrow keys, Home, and End move focus among rows; Tab leaves the region naturally.
- “Open database connection setup” opens the existing database modal and does not create a message.
- No new console error, React warning, or horizontal overflow appears.

- [ ] **Step 4: Validate responsive and reduced-motion behavior**

Check approximately 390px, 767px, and 768px widths, plus a short desktop height near 600px:

- Category controls and suggestion rows expose at least 44px touch targets below 768px.
- Categories wrap and suggestion copy wraps without horizontal overflow.
- The final suggestion remains reachable by scrolling at short heights.
- Composer toolbar overflow keeps model and Send/Stop reachable.
- Safe-area padding remains intact.
- With reduced motion enabled, the panel does not translate or animate height; only the short opacity change remains.

- [ ] **Step 5: Validate connected and active-conversation paths without unsafe fixture creation**

If the existing local session already has a connected database, verify the connected category names and five-row panels. If it does not, rely on the pure catalog tests and record that connected browser validation was unavailable rather than connecting external data.

Use an existing conversation to verify the active composer retains the same 672px, 20px shell and all existing controls. Do not send a prompt solely to create this state when an existing conversation is available.

- [ ] **Step 6: Perform mandatory cleanup and self-review**

Run:

```bash
git diff --check
git diff --stat
rg -n "console\.(log|debug)|debugger|TODO|TBD|SUGGESTIONS|WELCOME_PREFIX|<Chip" \
  front-end/src/features/chat/WelcomeScreen.jsx \
  front-end/src/features/chat/WelcomeSuggestions.jsx \
  front-end/src/features/chat/welcomeSuggestions.js
```

Expected: `git diff --check` prints nothing; the search finds no debug statements, placeholders, or stale direct-send chip implementation. Review the complete diff for correctness, focus behavior, duplicate submission risk, responsive regressions, and unrelated edits.

- [ ] **Step 7: Re-run any command affected by cleanup fixes**

At minimum, after the last edit run:

```bash
cd front-end
node --test src/features/chat/welcomeSuggestions.test.js
npm run audit:interaction
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit final validation fixes only if files changed**

```bash
git add front-end/src/features/chat front-end/src/features/styles/interfaceChrome.js front-end/src/features/MainInterface.jsx front-end/scripts/audit-interaction-contrast.mjs
git commit -m "fix: harden welcome interaction behavior"
```

Skip this commit when validation required no code changes. Do not create an empty commit.

---

## Completion Report

Report:

- The time-aware greeting, connected/disconnected category behavior, two-stage panel, and shared composer redesign.
- Every file changed and its responsibility.
- The decision to keep state local and reuse `onSend` plus the existing database-modal callback.
- Exact automated commands and browser viewport/state checks completed.
- Any pre-existing warning or unavailable connected-session browser check.
- No remaining concern when all planned checks pass; otherwise name the precise limitation and its impact.
