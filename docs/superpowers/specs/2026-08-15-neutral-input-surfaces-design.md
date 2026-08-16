# Neutral Input Surfaces Design

**Date:** 2026-08-15
**Status:** Approved design, pending implementation plan

## Problem

Moonlit's text inputs, chat composer, and Settings selects currently use the
`canvas-soft` color `#1a1c20`. Although this matches the current `DESIGN.md`, its
RGB balance (`26, 28, 32`) gives form controls a cool blue cast that feels
inconsistent with the application's otherwise neutral near-black surfaces.

The same color reaches multiple controls through `background.composer`,
`background.sunken`, and local MUI `sx` helpers. Fixing individual components
would leave the application vulnerable to visual drift.

## Goals

- Give every application input surface the same neutral `#191919` fill.
- Cover Chat, Auth, Settings and Preferences controls, sidebar search and inline
  rename, and any control using the shared outlined-field helper.
- Keep the neutral fill unchanged during hover and focus.
- Preserve existing border hover feedback, validation/error styling, disabled
  styling, selected/checked behavior, and functional DOM focus.
- Update the documented design contract and add automated regression coverage.

## Non-Goals

- Changing cards, dialogs, tooltips, navigation hover states, or other consumers
  of `canvas-soft`.
- Reintroducing input focus indicators removed by the approved focus-state work.
- Changing typography, spacing, border radii, or input layout.
- Adding or restoring light mode.

## Approaches Considered

### Dedicated semantic input token — selected

Add `background.input` to the dark semantic palette and map it to the existing
neutral primitive `#191919`. Shared and local input styles consume that role.

This keeps component intent explicit, provides one source of truth, and avoids
coupling inputs to cards or changing unrelated `canvas-soft` consumers.

### Reuse `background.paper`

This would produce the requested color with fewer token changes, but it couples
form controls to the card/dialog surface role. A future paper-surface adjustment
would then silently change inputs.

### Change `canvas-soft` globally

This is the smallest raw token edit, but it changes tooltips, navigation hover
states, code surfaces, and other components outside the reported issue.

## Design

### Token contract

The dark semantic background palette gains:

```js
input: primitives.neutral[900] // #191919
```

`canvas-soft` and its existing semantic mappings remain unchanged. The component
token compatibility layer may expose the new role only if an existing consumer
requires it; application code should prefer `theme.palette.background.input`.

### Component behavior

The shared outlined-field helper uses `background.input` as its default fill.
Its idle, hover, focused, and focused-hover states all keep that same fill. The
existing border transition remains the only hover change, and the existing
neutral focus rules remain intact.

The chat composer uses `background.input` directly. Auth inherits the new fill
through the outlined-field helper. Settings and Preferences controls inherit it
through the preference-control helper. Local input surfaces that do not use the
shared helper—sidebar search and inline conversation rename—also use
`background.input` through their local MUI `sx` objects.

Select popover paper and menu-option interaction states are not input fills and
remain unchanged. The closed Select control itself uses the neutral input fill.

### Documentation

`front-end/DESIGN.md` will define the standard `text-input` background as the
neutral input surface `#191919`, while retaining `canvas-soft` for its existing
non-input roles.

## State Matrix

| State | Fill | Other behavior |
|---|---|---|
| Idle | `background.input` (`#191919`) | Existing 1px hairline border |
| Hover | `background.input` (`#191919`) | Existing hover border remains |
| Focused | `background.input` (`#191919`) | No focus-only visual change |
| Focused + hover | `background.input` (`#191919`) | Existing hover border remains |
| Error | `background.input` (`#191919`) | Existing error border/text remains |
| Disabled | Existing disabled fill | Existing disabled opacity/text remains |

## Testing Strategy

Extend the existing Vite-powered input audit before production changes. The
failing audit must assert that:

- `theme.palette.background.input` exists and resolves to `#191919`.
- The chat composer resolves to `background.input`.
- The shared outlined-field helper uses `background.input` for idle, hover,
  focused, and focused-hover states.
- Preferences controls use the same neutral fill across those states.
- Sidebar search and inline rename local `sx` rules reference the semantic input
  role rather than a cool surface or raw color.
- `DESIGN.md` documents the neutral input surface.

After implementation, run the focused audit, existing interaction/theme audits,
tests, lint, unused-code analysis, and production build. In the running app,
compare computed styles for the chat composer and a Settings Select and confirm
both resolve to `rgb(25, 25, 25)` without changing on focus.

## Acceptance Criteria

- Every input surface in scope resolves to `#191919` at rest.
- Hover and focus do not introduce the previous `#1a1c20` fill.
- Chat, Auth, Settings, Preferences, sidebar search, and inline rename share the
  same semantic input-surface contract.
- Validation, disabled, checked/selected, typing, selection, and keyboard
  operation continue to work.
- Non-input `canvas-soft` consumers are unchanged.
- Automated audits and the full frontend validation suite pass.
