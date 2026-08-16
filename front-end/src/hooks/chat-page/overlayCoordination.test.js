import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planOverlayLaunch,
  resolveOverlayFocusTarget,
} from './overlayCoordination.js';

test('defers a preference overlay until the mobile drawer exits', () => {
  assert.deepEqual(planOverlayLaunch({ drawerOpen: true, overlay: 'settings' }), {
    closeDrawer: true,
    openOverlay: null,
    pendingOverlay: 'settings',
  });
});

test('opens a preference overlay immediately when the mobile drawer is closed', () => {
  assert.deepEqual(planOverlayLaunch({ drawerOpen: false, overlay: 'database' }), {
    closeDrawer: false,
    openOverlay: 'database',
    pendingOverlay: null,
  });
});

test('falls back to the current sidebar trigger when the original trigger unmounts', () => {
  const disconnectedTrigger = { isConnected: false };
  const sidebarTrigger = { isConnected: true };

  assert.equal(
    resolveOverlayFocusTarget(disconnectedTrigger, sidebarTrigger),
    sidebarTrigger,
  );
  assert.equal(resolveOverlayFocusTarget(sidebarTrigger, null), sidebarTrigger);
  assert.equal(resolveOverlayFocusTarget(disconnectedTrigger, null), null);
});
