import assert from 'node:assert/strict';
import test from 'node:test';
import { getProfileControlGeometry, getProfileSettingsMode } from './profileSettingsModel.js';

test('expanded surfaces expose direct Settings without duplicating it in Profile', () => {
  assert.deepEqual(getProfileSettingsMode(true), {
    showDirectSettings: true,
    showPopoverSettings: false,
  });
});

test('the collapsed desktop rail moves Settings into the Profile popover', () => {
  assert.deepEqual(getProfileSettingsMode(false), {
    showDirectSettings: false,
    showPopoverSettings: true,
  });
});

test('profile footer controls retain 44px mobile targets and compact desktop geometry', () => {
  assert.deepEqual(getProfileControlGeometry(), {
    height: { xs: 44, md: 36 },
    minHeight: { xs: 44, md: 36 },
  });
  assert.deepEqual(getProfileControlGeometry({ iconOnly: true }), {
    width: { xs: 44, md: 36 },
    minWidth: { xs: 44, md: 36 },
    height: { xs: 44, md: 36 },
    minHeight: { xs: 44, md: 36 },
  });
});
