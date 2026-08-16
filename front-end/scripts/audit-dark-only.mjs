import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const forbid = (path, pattern) => {
  if (pattern.test(read(path))) failures.push(`${path} still matches ${pattern}`);
};
const requirePattern = (path, pattern) => {
  if (!pattern.test(read(path))) failures.push(`${path} is missing ${pattern}`);
};

if (existsSync(new URL('../src/theme/lightTheme.js', import.meta.url))) {
  failures.push('src/theme/lightTheme.js must be removed');
}

forbid('index.html', /prefers-color-scheme|settings\?\.theme|mode = settings\.theme/);
requirePattern('index.html', /const mode = ['"]dark['"]/);
forbid('src/contexts/ThemeContext.jsx', /createLightTheme|effectiveTheme === ['"]light['"]/);
forbid('src/features/overlays/settings/SettingsModal.jsx', /Light theme|settings\.theme/);
forbid('src/theme/index.js', /createLightTheme|lightTheme/);
forbid('src/theme/tokens/primitives.js', /githubLight/);

for (const [path, pattern] of [
  ['src/theme/tokens/semantic.js', /lightSemanticTokens|LIGHT_BACKGROUND|moonlit-light|Pro Light/],
  ['src/theme/tokens/component.js', /lightComponentTokens|lightSemanticTokens/],
  ['src/theme/tokens.js', /\bLIGHT\b|lightComponentTokens/],
  ['src/theme/syntaxPalettes.js', /moonlitLight/],
  ['src/theme/themeCodeMirror.js', /moonlitLight|GITHUB_LIGHT/],
  ['src/utils/shiki.js', /moonlitLight/],
]) {
  forbid(path, pattern);
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exitCode = 1;
} else {
  console.log('PASS: runtime and settings expose only the canonical dark theme.');
}
