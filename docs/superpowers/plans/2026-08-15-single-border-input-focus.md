# Single-Border Input Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the double-border focus effect from outlined MUI inputs while retaining an accessible, state-aware focus indicator.

**Architecture:** Keep the behavior centralized in the existing MUI theme and shared outlined-field helper. Repair the auth page's nested style merge so it consumes that shared contract rather than replacing it.

**Tech Stack:** React 19, MUI 7, Emotion `sx`, Vite, Node audit scripts

## Global Constraints

- Preserve dark-mode colors, form behavior, validation, labels, helper text, and layout.
- Do not alter non-input focus indicators such as buttons or the chat composer.
- Add no dependencies and introduce no new styling abstraction.

---

### Task 1: Enforce a single input focus border

**Files:**
- Modify: `front-end/src/styles/shared.js:143-192`
- Modify: `front-end/src/theme/createMoonlitTheme.js:280-296`
- Modify: `front-end/src/pages/Auth.jsx:105-112`
- Verify: `front-end/scripts/audit-interaction-contrast.mjs`

**Interfaces:**
- Consumes: `getOutlinedFieldStateSx(theme, options)` and the existing `MuiTextField` theme override.
- Produces: one 1px idle/error border and one 2px focus/focused-error border, with no input-root outline.

- [x] **Step 1: Run the failing browser-state check**

Focus the Email input using keyboard modality and inspect `.MuiOutlinedInput-root` plus `.MuiOutlinedInput-notchedOutline`.

Expected before the fix: the focused root has a non-`none` outline while the fieldset also has a visible border.

- [x] **Step 2: Update the shared outlined-field state contract**

Change `getOutlinedFieldStateSx` so `.Mui-focused .MuiOutlinedInput-notchedOutline` uses `theme.palette.border.focus` at `2px`; remove the keyboard outline rule; and make `.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline` use the error color at `2px`.

- [x] **Step 3: Align the global MUI TextField override**

Keep `&.Mui-focused fieldset` at the focus color and `2px`, remove the separate `:has(:focus-visible)` outline rule, and add an explicit focused-error fieldset rule using `S.error.main` at `2px`.

- [x] **Step 4: Preserve shared auth root styles while setting height**

Store the return value of `getOutlinedFieldStateSx(theme, { radius: '8px' })`, spread it into `fieldSx`, and merge its `& .MuiOutlinedInput-root` object before adding `minHeight: 48`.

- [x] **Step 5: Run the passing browser-state checks**

Verify Email and Password at idle, keyboard-focused, error, and focused-error states. Each state must expose one visible fieldset border, root `outline-style: none`, root `box-shadow: none`, and the expected 1px or 2px width.

- [x] **Step 6: Run regression validation**

Run:

```bash
cd front-end
npm run audit:interaction
npm run lint
npm run build
```

Expected: all commands exit successfully. Report any pre-existing warnings separately.

- [x] **Step 7: Self-review the changed files**

Review the exact diff for duplicate selectors, stale imports, accidental layout changes, weakened error indication, and unrelated formatting changes. Do not commit unless the user explicitly requests it.
