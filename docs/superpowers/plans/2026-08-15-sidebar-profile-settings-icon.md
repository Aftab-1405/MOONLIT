# Sidebar Profile Settings Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the misleading sidebar profile-footer caret with the existing semantic settings gear without changing menu behavior.

**Architecture:** Keep the existing sidebar trigger and profile-menu data flow intact. Change only the semantic icon import/render site and extend the existing source-contract audit to prevent regression.

**Tech Stack:** React, Material UI, Node executable audit, Vite

## Global Constraints

- Preserve the current profile-menu click behavior and accessible label.
- Reuse `SettingsIcon` from `@/components/icons`; add no dependency.
- Make no unrelated Phase 2 sidebar changes.
- Work inline without commits, as requested by the user.

---

### Task 1: Sidebar profile settings icon

**Files:**
- Modify: `front-end/scripts/audit-interaction-contrast.mjs`
- Modify: `front-end/src/features/sidebar-left/index.jsx`

**Interfaces:**
- Consumes: `SettingsIcon` from `@/components/icons` and the existing `handleProfileClick` trigger behavior.
- Produces: The same profile/settings trigger with a semantic gear glyph.

- [ ] **Step 1: Write the failing regression assertion**

Add source-contract assertions requiring `SettingsIcon` in the sidebar footer and rejecting
`ExpandMoreIcon` in the sidebar module.

- [ ] **Step 2: Run the audit to verify RED**

Run: `npm run audit:interaction`

Expected: FAIL because the footer still imports/renders `ExpandMoreIcon`.

- [ ] **Step 3: Implement the minimal icon replacement**

Replace the `ExpandMoreIcon` import and footer render with `SettingsIcon`. Preserve the existing
`fontSize: 18`, secondary color, display, wrapper geometry, and event handling.

- [ ] **Step 4: Run automated validation**

Run `npm run audit:interaction`, `npm run lint`, and `npm run build` from `front-end/`.

Expected: all commands exit 0; the existing Perspective chunk-size warning may remain.

- [ ] **Step 5: Verify the signed-in browser workflow**

At the current desktop viewport, confirm the footer shows a gear, click it to open the existing
profile menu, close the menu without choosing an action, and confirm there is no horizontal
overflow or console regression.
