# Single-Border Input Focus Design

## Problem

Outlined MUI inputs can render two simultaneous focus indicators: the native MUI fieldset border and a separate 2px outline on the input root. The auth form makes the overlap especially visible because its local `minHeight` rule replaces the nested rules returned by `getOutlinedFieldStateSx`, leaving the global theme focus treatment in control.

## Scope

- Apply one consistent focus treatment to shared outlined MUI text fields and selects.
- Repair the auth field style merge so the shared state rules are preserved.
- Preserve existing form behavior, validation, spacing, labels, helper text, and colors.
- Do not change buttons, the chat composer, or other non-input focus rings.

## Approved Interaction Design

- Idle and unfocused error inputs use one 1px fieldset border.
- Focused valid inputs use one 2px focus-colored fieldset border.
- Focused invalid inputs use one 2px error-colored fieldset border.
- The input root does not draw an additional outline or box shadow.
- Keyboard focus remains clearly visible through the thicker, high-contrast fieldset border.

## Implementation

1. Update the centralized `MuiTextField` override to remove the separate keyboard outline and keep the 2px focused fieldset as the sole indicator.
2. Align `getOutlinedFieldStateSx` with the same focused and focused-error contract so Preferences and other consumers do not reintroduce the double border.
3. Merge the auth input root rules instead of replacing the shared root rule when adding `minHeight: 48`.

## Verification

- Reproduce the current failure with keyboard focus and confirm both a fieldset border and root outline are present.
- Confirm idle, focused-valid, error, and focused-error states each render exactly one visible border.
- Run the interaction audit, lint, and production build.
- Recheck the auth page visually in the in-app browser.
