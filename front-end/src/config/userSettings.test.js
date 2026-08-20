import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultUserSettings,
  mapServerSettingsToClient,
  pickSyncableSettings,
} from './userSettings.js';

test('theme is not a configurable or synchronized user setting', () => {
  assert.equal('theme' in defaultUserSettings, false);
  assert.equal('theme' in pickSyncableSettings({ theme: 'light', maxRows: 25 }), false);
  assert.equal('theme' in mapServerSettingsToClient({ settings: { theme: 'light' } }), false);
});

test('removing theme does not drop supported settings', () => {
  assert.deepEqual(pickSyncableSettings({ theme: 'light', maxRows: '25' }), { maxRows: 25 });
  assert.deepEqual(
    mapServerSettingsToClient({ settings: { theme: 'light', responseStyle: 'concise' } }),
    { responseStyle: 'concise' },
  );
});
