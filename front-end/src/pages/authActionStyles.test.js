import assert from 'node:assert/strict';
import test from 'node:test';
import { getAuthActionSx } from './authActionStyles.js';

test('Auth actions stay touch-safe through 767px and compact from 768px', () => {
  assert.deepEqual(
    getAuthActionSx({ shape: { radius: { pill: 999 } } }),
    {
      minHeight: { xs: 44, md: 36 },
      borderRadius: 999,
    },
  );
});
