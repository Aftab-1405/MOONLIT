# Chat Composer Single-Border Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chat composer's double focus frame with one accessible 2px focus border.

**Architecture:** Keep the correction in `getComposerSurfaceSx`, the existing single source of truth consumed by `ChatInput.jsx`. Change the interaction audit first so the current double-layer output fails, then make the smallest style change needed to satisfy the new contract.

**Tech Stack:** React 19, MUI 7, Emotion `sx`, Vite, Node audit scripts

## Global Constraints

- Preserve composer dimensions, radius, background, overflow behavior, toolbar layout, input behavior, and all child-control focus indicators.
- Do not restructure `ChatInput.jsx` or change non-composer controls.
- Add no dependencies and introduce no new styling abstraction.

---

### Task 1: Enforce the composer single-border focus contract

**Files:**
- Modify: `front-end/scripts/audit-interaction-contrast.mjs:176-190`
- Modify: `front-end/src/features/styles/interfaceChrome.js:130-145`
- Verify consumer: `front-end/src/features/chat/ChatInput.jsx:896-903`

**Interfaces:**
- Consumes: `getComposerSurfaceSx(theme)` returning an Emotion `sx` object with an `&:focus-within` state.
- Produces: an idle 1px border and a focused 2px border, without a focus outline or shadow.

- [x] **Step 1: Write the failing interaction assertion**

Replace the composer focus assertion with this contract:

```js
if (
  composerFocus?.borderColor !== tokens.border.focus ||
  composerFocus?.borderWidth !== 2 ||
  composerFocus?.outline != null ||
  composerFocus?.outlineOffset != null
) {
  failures.push(`${mode}/composer: focus-within must use one 2px focus border.`);
}
```

- [x] **Step 2: Run the audit and verify RED**

Run:

```bash
cd front-end
npm run audit:interaction
```

Expected: exit code 1 with `dark/composer: focus-within must use one 2px focus border.` because the implementation still contains an outline and has no focused `borderWidth`.

- [x] **Step 3: Implement the minimal composer style change**

Change `getComposerSurfaceSx(theme)` so its focus state is exactly:

```js
'&:focus-within': {
  borderColor: theme.palette.border.focus,
  borderWidth: 2,
},
```

- [x] **Step 4: Run the audit and verify GREEN**

Run `npm run audit:interaction` from `front-end`.

Expected: exit code 0 with the interaction-audit PASS message.

- [x] **Step 5: Verify the rendered focus layers**

Focus the chat editor and inspect the composer wrapper. Expected computed styles: `border-width: 2px`, focus-token border color, `outline-style: none`, `box-shadow: none`, and exactly one visible boundary layer.

- [x] **Step 6: Run full frontend regression validation**

Run:

```bash
cd front-end
node --test src/config/userSettings.test.js src/theme/mode.test.js src/pages/Landing/landingContent.test.js
npm run audit:interaction
npm run lint
npm run build
```

Expected: 3 tests pass, the audit passes, lint exits without errors, and Vite builds successfully. Report the existing large-chunk advisory separately if it remains.

- [x] **Step 7: Self-review the exact diff**

Confirm the diff changes only the composer focus assertion, the composer focus style, and the associated spec/plan documentation. Check for stale outline requirements, accidental `ChatInput.jsx` edits, whitespace errors, and unrelated formatting. Do not commit unless the user explicitly requests it.
