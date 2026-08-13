import assert from 'node:assert/strict';
import test from 'node:test';
import { getLandingDestination } from './landingContent.js';

test('preserves the existing auth-aware CTA destination', () => {
  assert.equal(getLandingDestination({ loading: true, isAuthenticated: false }), '/chat');
  assert.equal(getLandingDestination({ loading: false, isAuthenticated: true }), '/chat');
  assert.equal(getLandingDestination({ loading: false, isAuthenticated: false }), '/auth');
});
