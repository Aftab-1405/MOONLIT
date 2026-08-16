# AI Context Segmented Control Design

**Date:** 2026-08-15
**Status:** Approved design, pending implementation plan

## Problem

The Databases/Queries switch in AI Context renders two nested background
layers. Live computed styles show a `rgba(255, 255, 255, 0.04)` group wrapper
with 4px padding and a second `rgba(255, 255, 255, 0.11)` fill on the selected
button. Other segmented controls use Moonlit's shared helper, whose wrapper is
transparent and whose state styling belongs only to the buttons.

The divergence originates in a bespoke `ToggleButtonGroup` `sx` object in
`UserDBContextManagerForAI.jsx` rather than the established shared helper.

## Goals

- Remove the redundant outer background and inset padding.
- Match the established Settings/Database segmented-control treatment.
- Preserve the selected-tab fill, hover feedback, focus behavior, labels,
  counts, selection logic, and responsive wrapping.
- Prevent the local control from drifting from the shared pattern again.

## Non-Goals

- Changing AI Context data loading, deletion, or view-selection behavior.
- Changing ToggleButton styling globally.
- Redesigning badges, toolbar spacing, or the Clear all action.
- Changing unrelated segmented controls.

## Approaches Considered

### Consume the shared segmented-control helper — selected

Use `getPreferenceToggleGroupSx(theme)`, the same wrapper around
`getSegmentedToggleGroupSx` used by Database preference controls. This provides
a transparent, padding-free group wrapper and keeps interaction styling on each
button.

### Patch the local wrapper only

Setting local padding and background to zero would fix the immediate symptom,
but leave a second copy of the button-state system that can drift again.

### Change the global MUI ToggleButton theme

This would have a larger blast radius and could alter SQL tabs and other
unrelated toggle controls.

## Design

`UserDBContextManagerForAI.jsx` will import
`getPreferenceToggleGroupSx(theme)` and memoize the result with its other
theme-derived styles. The Databases/Queries `ToggleButtonGroup` will consume
that style object instead of its bespoke wrapper/button `sx` block.

The helper contract provides:

- transparent wrapper background;
- zero wrapper padding and border;
- no wrapper shadow;
- button-level transparent idle state;
- button-level selected and hover states;
- existing typography and focus treatment.

The existing toolbar Box retains its layout and gap. The count badges remain
local because they are content, not segmented-control chrome.

## Testing Strategy

Extend the existing interaction audit before production changes. Resolve
`getPreferenceToggleGroupSx(theme)` and assert that its wrapper is transparent,
padding is zero, border is absent, and selected styling exists only under the
grouped-button selector. Add a narrow source assertion that the AI Context
component consumes the shared helper and no longer declares the faint wrapper
background.

After implementation, run the interaction audit, lint, unused-code analysis,
and production build. In the running app, reopen Settings > AI Context and
confirm the group wrapper computes to a transparent background with zero
padding while the selected Databases or Queries button retains its selected
fill.

## Acceptance Criteria

- The Databases/Queries group wrapper has no visible background layer.
- The selected tab remains visually distinct.
- Switching tabs and count badges behave exactly as before.
- The component consumes the established shared preference toggle helper.
- No unrelated ToggleButtonGroup changes.
- Focused audits and the frontend regression suite pass.
