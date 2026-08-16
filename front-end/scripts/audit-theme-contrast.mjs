import { darkSemanticTokens } from '../src/theme/tokens/semantic.js';

const MODES = [['dark', darkSemanticTokens]];
const BACKGROUND_ROLES = [
  'default',
  'paper',
  'composer',
  'sunken',
  'elevated1',
  'elevated2',
  'elevated3',
  'elevated4',
  'elevated5',
];
const STATUS_ROLES = ['primary', 'secondary', 'error', 'success', 'warning', 'info'];

const parseColor = (value) => {
  if (value.startsWith('#')) {
    const raw = value.slice(1);
    const expanded =
      raw.length === 3 || raw.length === 4
        ? [...raw].map((channel) => `${channel}${channel}`).join('')
        : raw;
    return {
      red: Number.parseInt(expanded.slice(0, 2), 16),
      green: Number.parseInt(expanded.slice(2, 4), 16),
      blue: Number.parseInt(expanded.slice(4, 6), 16),
      alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    };
  }

  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3) throw new Error(`Unsupported color: ${value}`);
  return {
    red: channels[0],
    green: channels[1],
    blue: channels[2],
    alpha: channels[3] ?? 1,
  };
};

const composite = (foreground, background) => ({
  red: foreground.red * foreground.alpha + background.red * (1 - foreground.alpha),
  green: foreground.green * foreground.alpha + background.green * (1 - foreground.alpha),
  blue: foreground.blue * foreground.alpha + background.blue * (1 - foreground.alpha),
});

const linearChannel = (channel) => {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ red, green, blue }) =>
  0.2126 * linearChannel(red) + 0.7152 * linearChannel(green) + 0.0722 * linearChannel(blue);

const contrast = (foregroundValue, backgroundValue) => {
  const background = parseColor(backgroundValue);
  const foreground = composite(parseColor(foregroundValue), background);
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const results = [];
const check = (mode, category, pair, ratio, minimum) => {
  results.push({
    mode,
    category,
    pair,
    ratioValue: ratio,
    ratio: ratio.toFixed(2),
    minimum: minimum.toFixed(1),
    result: ratio >= minimum ? 'PASS' : 'FAIL',
  });
};

for (const [mode, tokens] of MODES) {
  for (const textRole of ['primary', 'secondary']) {
    for (const backgroundRole of BACKGROUND_ROLES) {
      check(
        mode,
        'text',
        `${textRole} / ${backgroundRole}`,
        contrast(tokens.text[textRole], tokens.background[backgroundRole]),
        4.5,
      );
    }
  }

  // Disabled content is intentionally muted, but remains legible as a UI indicator.
  for (const backgroundRole of BACKGROUND_ROLES) {
    check(
      mode,
      'disabled indicator',
      `disabled / ${backgroundRole}`,
      contrast(tokens.text.disabled, tokens.background[backgroundRole]),
      3,
    );
  }

  for (const borderRole of ['default', 'focus']) {
    for (const backgroundRole of BACKGROUND_ROLES) {
      check(
        mode,
        'UI boundary',
        `${borderRole} / ${backgroundRole}`,
        contrast(tokens.border[borderRole], tokens.background[backgroundRole]),
        3,
      );
    }
  }

  for (const statusRole of STATUS_ROLES) {
    check(
      mode,
      'status text',
      `${statusRole}.contrastText / ${statusRole}.main`,
      contrast(tokens[statusRole].contrastText, tokens[statusRole].main),
      4.5,
    );
  }
}

const invariantFailures = [];
const expectToken = (label, actual, expected) => {
  if (actual !== expected) invariantFailures.push(`${label}: expected ${expected}, received ${actual}.`);
};

expectToken('dark canvas', darkSemanticTokens.background.default, '#0a0a0a');
expectToken('dark card', darkSemanticTokens.background.paper, '#191919');
expectToken('dark composer', darkSemanticTokens.background.composer, '#1a1c20');
expectToken('dark soft canvas', darkSemanticTokens.background.sunken, '#1a1c20');
expectToken('dark hairline', darkSemanticTokens.divider, '#212327');
expectToken('dark ink', darkSemanticTokens.text.primary, '#ffffff');
expectToken('dark body', darkSemanticTokens.text.secondary, '#dadbdf');
expectToken('dark muted text', darkSemanticTokens.text.disabled, '#7d8187');

for (const [mode, tokens] of MODES) {
  for (const elevatedRole of ['elevated1', 'elevated2', 'elevated3', 'elevated4', 'elevated5']) {
    if (tokens.background[elevatedRole] !== tokens.background.paper) {
      invariantFailures.push(`${mode}/${elevatedRole} must stay flat with the paper surface.`);
    }
  }
  for (const [shadowRole, value] of Object.entries(tokens.shadow)) {
    if (value !== 'none') invariantFailures.push(`${mode}/shadow.${shadowRole} must be none.`);
  }
  for (const layerRole of ['surfaceMuted', 'surfaceTranslucent', 'glass', 'surfaceSoft', 'surfaceSolid']) {
    if (tokens.layer[layerRole] !== tokens.background.paper) {
      invariantFailures.push(`${mode}/layer.${layerRole} must resolve to the flat paper surface.`);
    }
  }
}

expectToken('dark Shiki palette', darkSemanticTokens.integration.codeTheme, 'moonlit-dark');
expectToken('dark Perspective palette', darkSemanticTokens.integration.perspectiveTheme, 'Pro Dark');

const failedContrast = results.filter(({ result }) => result === 'FAIL');
const summary = MODES.flatMap(([mode]) =>
  ['text', 'disabled indicator', 'UI boundary', 'status text'].map((category) => {
    const group = results.filter((result) => result.mode === mode && result.category === category);
    const minimumResult = group.reduce((lowest, result) =>
      result.ratioValue < lowest.ratioValue ? result : lowest,
    );
    return {
      mode,
      category,
      pairs: group.length,
      minimumRatio: minimumResult.ratio,
      required: minimumResult.minimum,
      result: group.every((result) => result.result === 'PASS') ? 'PASS' : 'FAIL',
    };
  }),
);

console.table(summary);

if (failedContrast.length || invariantFailures.length) {
  if (failedContrast.length) console.table(failedContrast);
  for (const failure of invariantFailures) console.error(`FAIL: ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${results.length} WCAG pairs and all Moonlit surface invariants.`);
}
