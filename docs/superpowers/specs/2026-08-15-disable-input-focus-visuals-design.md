# Disable Input Focus Visuals Design

## Objective

Remove every visual focus state from the application's MUI form controls while preserving actual DOM focus, typing, selection, validation, and keyboard operation.

## Scope

The focus reset applies to all current and theme-supported MUI input controls:

- Text fields and multiline textareas
- `InputBase` controls, including sidebar search and inline rename
- Outlined inputs and selects
- Checkboxes and radios
- Switches
- Sliders
- The chat composer wrapper that visually represents its nested textarea's focus
- Input labels whose color currently changes on focus

Buttons, links, tabs, menu items, accordions, dialogs, resize handles, React Flow nodes, and other non-input interactive elements retain their focus indicators.

## Behavior Contract

Focus itself must add no visual change:

- No focus-colored border
- No focus-only border-width change
- No outline
- No box shadow or focus ring
- No focus-only background change
- No focus-only input-label color change

Other states remain authoritative:

- Idle controls retain their idle appearance.
- Hovered controls retain their hover appearance even while focused.
- Invalid controls retain their error color and 1px error boundary while focused.
- Checked, disabled, and selected controls retain their existing state styling.
- Focused controls remain operable by keyboard and continue receiving keystrokes.

## Architecture

Use MUI styling objects and selectors rather than a global CSS `:focus` reset:

1. Central theme component overrides neutralize focus visuals for `MuiInputBase`, `MuiOutlinedInput`, `MuiTextField`, `MuiInputLabel`, `MuiSelect`, `MuiCheckbox`, `MuiRadio`, `MuiSwitch`, and `MuiSlider`.
2. `getOutlinedFieldStateSx` mirrors the same neutral focus behavior for Auth and preference controls that intentionally override theme defaults.
3. `getComposerSurfaceSx` exposes no `&:focus-within` visual state.
4. The sidebar search wrapper removes its local `&:focus-within` background and box-shadow treatment.
5. Existing inline rename styling remains unchanged because its focused state is already visually neutral.

## Testing Strategy

- Add a dedicated input-focus audit that loads the actual MUI theme through Vite and asserts neutral component focus overrides.
- Extend the existing interaction audit so the composer must expose no focus-within style block.
- Audit the shared outlined-field helper and the sidebar search source so local overrides cannot reintroduce a visual focus state.
- Verify representative runtime controls in the browser:
  - Auth outlined TextField
  - Chat textarea/composer
  - Sidebar search InputBase/TextField wrapper
  - Settings Select and Switch
  - Auth Checkbox
- Run all frontend tests, focus/interaction audits, lint, and the production build.

## Acceptance Criteria

1. Every current MUI input control has no focus-driven outline, shadow, border-color change, border-width change, background change, or label-color change.
2. Hover, error, checked, selected, and disabled states continue to render as designed.
3. Actual focus and keyboard behavior remain functional.
4. Non-input interactive elements retain their existing focus indicators.
5. Automated audits and frontend regression commands pass.
