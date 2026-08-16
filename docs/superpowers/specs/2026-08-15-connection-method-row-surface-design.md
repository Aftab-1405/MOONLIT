# Connection Method Row Surface Design

**Date:** 2026-08-15
**Status:** Approved design, pending implementation plan

## Problem

The Connect Database dialog's Connection Method section renders an unnecessary
second surface tone. Live computed styles show the section at `rgb(25, 25, 25)`
and its only `PreferenceRow` at `rgba(255, 255, 255, 0.024)`. The selected
Credentials or Connection String button then adds its intended selected-state
fill.

The row tint comes from the shared alternating-row treatment used by multi-row
Settings sections. Because Connection Method contains only one row, that tint
does not communicate alternation and instead appears as redundant nested
chrome. The segmented-control wrapper is already transparent and is not the
source of the issue.

## Goals

- Remove the background tint from the lone Connection mode row.
- Retain the outer Connection Method section surface and boundary.
- Retain selected, hover, and keyboard-focus styling on both segmented buttons.
- Preserve labels, icons, switching behavior, spacing, and responsive layout.
- Keep multi-row Settings section styling unchanged.

## Non-Goals

- Changing the shared `PreferenceRow` API or its global alternating-row style.
- Changing the shared segmented-control helper.
- Redesigning the Connection Details form or database navigation.
- Changing connection state, validation, or submission behavior.

## Approaches Considered

### Apply a local transparent row override — selected

Pass a background override to the Connection mode `PreferenceRow` in
`DatabaseModal.jsx`. This removes the redundant tone at its only problematic
consumer and leaves the shared multi-row pattern intact.

### Add a reusable plain PreferenceRow variant

A `plain` variant would express the intent through the component API, but it
would expand the shared interface for one known use and is not currently
justified.

### Remove alternating row backgrounds globally

This would change unrelated Settings sections and has an unnecessarily large
visual regression surface.

## Design

The Connection mode `PreferenceRow` will receive a local `sx` override with a
transparent background. The override is applied after the shared row styles,
so the row retains its existing padding, gap, responsive direction, opacity,
and typography while allowing the parent section surface to show through.

The nested `ToggleButtonGroup` continues to use
`getPreferenceToggleGroupSx(theme)`. Its wrapper remains transparent, and the
selected Credentials or Connection String button retains the button-level
active fill.

## Testing Strategy

Before the production change, inspect the rendered Connection mode group and
record the row's non-transparent computed background as the RED reproduction.
After the change, use the same rendered behavior check to confirm the row
computes to a transparent background while the parent section remains
`rgb(25, 25, 25)` and the selected button retains a visible fill. Keep the
existing shared-style audits unchanged; a source-text assertion for a local
`sx` value would test implementation spelling rather than user-visible
behavior.

Run the focused audit, lint, unused-code analysis, the complete UI audit set,
and the production build. Switch between Credentials and Connection String in
the running app to confirm behavior is unchanged.

## Acceptance Criteria

- The Connection mode row has a transparent computed background.
- The Connection Method section retains its existing surface and border.
- The selected connection-mode button remains visually distinct.
- Both connection modes remain selectable.
- Shared Settings row styling and unrelated preference sections are unchanged.
- Focused and full frontend validation pass.
