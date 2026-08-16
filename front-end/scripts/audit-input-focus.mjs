import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const failures = [];
const fail = (message) => failures.push(message);
const expectValue = (label, actual, expected) => {
  if (actual !== expected) fail(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
};
const expectNeutral = (label, state) => {
  if (!state) {
    fail(`${label}: neutral focus state is missing.`);
    return;
  }
  expectValue(`${label} outline`, state.outline, 'none');
  expectValue(`${label} box shadow`, state.boxShadow, 'none');
};
const expectBorder = (label, state, color) => {
  if (!state) {
    fail(`${label}: border state is missing.`);
    return;
  }
  expectValue(`${label} color`, state.borderColor, color);
  expectValue(`${label} width`, state.borderWidth, 1);
};

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

try {
  const [
    { createDarkTheme },
    { getOutlinedFieldStateSx },
    { getComposerSurfaceSx },
    { getPreferenceControlSx, getPreferenceToggleGroupSx },
  ] = await Promise.all([
      server.ssrLoadModule('/src/theme/darkTheme.js'),
      server.ssrLoadModule('/src/styles/shared.js'),
      server.ssrLoadModule('/src/features/styles/interfaceChrome.js'),
      server.ssrLoadModule(
        '/src/features/overlays/preference-surface/preferenceSurfaceStyles.js',
      ),
    ]);

  const theme = createDarkTheme();
  const components = theme.components;
  const inputBase = components.MuiInputBase?.styleOverrides;
  const outlinedInput = components.MuiOutlinedInput?.styleOverrides?.root;
  const textFieldRoot = components.MuiTextField?.styleOverrides?.root;
  const inputLabel = components.MuiInputLabel?.styleOverrides?.root;
  const switchOverrides = components.MuiSwitch?.styleOverrides;
  const inputSurface = theme.palette.background.input;

  expectValue('semantic input surface', inputSurface, '#191919');
  expectValue(
    'MuiTextField outlined background',
    textFieldRoot?.['& .MuiOutlinedInput-root']?.backgroundColor,
    inputSurface,
  );
  expectValue('MuiOutlinedInput background', outlinedInput?.backgroundColor, inputSurface);

  expectNeutral('MuiInputBase root', inputBase?.root?.['&.Mui-focused']);
  expectNeutral('MuiInputBase input', inputBase?.input?.['&:focus']);
  expectNeutral('MuiOutlinedInput root', outlinedInput?.['&.Mui-focused']);
  expectBorder(
    'MuiOutlinedInput focused border',
    outlinedInput?.['&.Mui-focused .MuiOutlinedInput-notchedOutline'],
    theme.palette.border.idle,
  );
  expectBorder(
    'MuiOutlinedInput focused hover border',
    outlinedInput?.['&.Mui-focused:hover .MuiOutlinedInput-notchedOutline'],
    theme.palette.border.hover,
  );
  expectBorder(
    'MuiOutlinedInput focused error border',
    outlinedInput?.['&.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline'],
    theme.palette.error.main,
  );

  if (JSON.stringify(textFieldRoot).includes('Mui-focused')) {
    fail('MuiTextField must not reintroduce a nested focused input state.');
  }
  expectValue(
    'MuiInputLabel focused color',
    inputLabel?.['&.Mui-focused']?.color,
    theme.palette.text.secondary,
  );

  expectNeutral('MuiSwitch base', switchOverrides?.switchBase?.['&.Mui-focusVisible']);
  expectValue(
    'MuiSwitch focused track shadow',
    switchOverrides?.switchBase?.['&.Mui-focusVisible + .MuiSwitch-track']?.boxShadow,
    'none',
  );
  expectNeutral(
    'MuiCheckbox',
    components.MuiCheckbox?.styleOverrides?.root?.['&.Mui-focusVisible'],
  );
  expectNeutral('MuiRadio', components.MuiRadio?.styleOverrides?.root?.['&.Mui-focusVisible']);
  expectNeutral(
    'MuiSlider thumb',
    components.MuiSlider?.styleOverrides?.thumb?.['&.Mui-focusVisible'],
  );

  const outlined = getOutlinedFieldStateSx(theme)['& .MuiOutlinedInput-root'];
  for (const [label, state] of [
    ['shared outlined idle', outlined],
    ['shared outlined hover', outlined?.['&:hover']],
    ['shared outlined focused', outlined?.['&.Mui-focused']],
    ['shared outlined focused hover', outlined?.['&.Mui-focused:hover']],
  ]) {
    expectValue(`${label} background`, state?.backgroundColor, inputSurface);
  }
  expectNeutral('shared outlined root', outlined?.['&.Mui-focused']);
  expectBorder(
    'shared outlined focused border',
    outlined?.['&.Mui-focused .MuiOutlinedInput-notchedOutline'],
    theme.palette.border.idle,
  );
  expectBorder(
    'shared outlined focused hover border',
    outlined?.['&.Mui-focused:hover .MuiOutlinedInput-notchedOutline'],
    theme.palette.border.hover,
  );
  expectBorder(
    'shared outlined focused error border',
    outlined?.['&.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline'],
    theme.palette.error.main,
  );

  const composer = getComposerSurfaceSx(theme);
  expectValue('chat composer background', composer.backgroundColor, inputSurface);
  if (composer['&:focus-within'] != null) {
    fail('chat composer must not expose a visual focus-within state.');
  }

  const preferenceControl = getPreferenceControlSx(theme)['& .MuiInputBase-root'];
  for (const [label, state] of [
    ['preference idle', preferenceControl],
    ['preference hover', preferenceControl?.['&:hover']],
    ['preference focused', preferenceControl?.['&.Mui-focused']],
    ['preference focused hover', preferenceControl?.['&.Mui-focused:hover']],
  ]) {
    expectValue(`${label} background`, state?.backgroundColor, inputSurface);
  }
  expectNeutral('preference control', preferenceControl?.['&.Mui-focused']);
  expectValue(
    'preference control focused background',
    preferenceControl?.['&.Mui-focused']?.backgroundColor,
    preferenceControl?.backgroundColor,
  );

  const preferenceToggleGroup = getPreferenceToggleGroupSx(theme);
  expectValue(
    'preference toggle wrapper background',
    preferenceToggleGroup.backgroundColor,
    'transparent',
  );
  expectValue('preference toggle wrapper padding', preferenceToggleGroup.p, 0);
  expectValue('preference toggle wrapper border', preferenceToggleGroup.border, 'none');
  expectValue('preference toggle wrapper shadow', preferenceToggleGroup.boxShadow, 'none');
  expectValue('preference toggle responsive wrapping', preferenceToggleGroup.flexWrap, 'wrap');

  const preferenceToggleButton = preferenceToggleGroup['& .MuiToggleButtonGroup-grouped'];
  expectValue(
    'preference toggle idle background',
    preferenceToggleButton?.backgroundColor,
    'transparent',
  );
  if (!preferenceToggleButton?.['&.Mui-selected']?.backgroundColor) {
    fail('preference toggle selected state must retain a button-level background.');
  }

  const design = await readFile(new URL('../DESIGN.md', import.meta.url), 'utf8');
  if (!design.includes('input-surface: "#191919"')) {
    fail('DESIGN.md must define the approved neutral input surface.');
  }
  if (!design.includes('backgroundColor: "{colors.input-surface}"')) {
    fail('DESIGN.md text-input must consume the neutral input surface.');
  }

  const sidebarOverlays = await readFile(
    new URL('../src/features/sidebar-left/components/SidebarOverlays.jsx', import.meta.url),
    'utf8',
  );
  if (sidebarOverlays.includes("'&:focus-within'")) {
    fail('sidebar search must not expose a visual focus-within state.');
  }
  if (!sidebarOverlays.includes('backgroundColor: theme.palette.background.input')) {
    fail('sidebar search must consume the semantic input surface.');
  }

  const sidebarPrimitives = await readFile(
    new URL('../src/features/sidebar-left/components/SidebarPrimitives.jsx', import.meta.url),
    'utf8',
  );
  const inlineRenameFocus =
    /'&\.Mui-focused':\s*\{\s*borderColor:\s*theme\.palette\.border\.hover,\s*outline:\s*'none',\s*boxShadow:\s*'none',\s*\}/s;
  if (!inlineRenameFocus.test(sidebarPrimitives)) {
    fail('sidebar inline rename must keep its focused field visually neutral.');
  }
  if (!sidebarPrimitives.includes('backgroundColor: theme.palette.background.input')) {
    fail('sidebar inline rename must consume the semantic input surface.');
  }

  const iconButtonFocus =
    components.MuiIconButton?.styleOverrides?.root?.['&.Mui-focusVisible'];
  if (!iconButtonFocus || iconButtonFocus.outline === 'none') {
    fail('non-input IconButton focus indicator must remain intact.');
  }
} finally {
  await server.close();
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    'PASS: MUI inputs use the neutral surface, expose no focus-driven visuals, and preserve non-input focus.',
  );
}
