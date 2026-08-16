import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANONICAL_THEME_MODE,
  getEffectiveThemeMode,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from './mode.js';

test('the frontend exposes one canonical dark theme', () => {
  assert.equal(CANONICAL_THEME_MODE, 'dark');
  assert.equal(THEME_ATTRIBUTE, 'data-moonlit-color-scheme');
  assert.equal(THEME_STORAGE_KEY, 'moonlit-settings');
});

test('route and legacy preference values cannot select light mode', () => {
  for (const [pathname, preference] of [
    ['/', 'light'],
    ['/auth', 'light'],
    ['/chat', 'light'],
    ['/chat/conversation-id', 'light'],
    ['/admin', 'light'],
    ['/chat', undefined],
  ]) {
    assert.equal(getEffectiveThemeMode(pathname, preference), 'dark');
  }
});
