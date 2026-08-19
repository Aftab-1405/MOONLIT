import assert from 'node:assert/strict';
import test from 'node:test';

const layoutModule = await import('./authLayoutStyles.js').catch(() => ({}));

test('Auth layout uses one column below 768px and the approved 44/56 split from 768px', () => {
  assert.equal(
    typeof layoutModule.getAuthLayoutSx,
    'function',
    'getAuthLayoutSx must define the responsive Auth layout contract',
  );

  const layout = layoutModule.getAuthLayoutSx({
    palette: { border: { subtle: '#212327' } },
  });

  assert.deepEqual(layout.page.gridTemplateColumns, {
    xs: 'minmax(0, 1fr)',
    md: '44% minmax(0, 56%)',
  });
  assert.deepEqual(layout.brandPanel.borderRight, {
    xs: 0,
    md: '1px solid #212327',
  });
  assert.deepEqual(layout.brandPanel.borderBottom, {
    xs: '1px solid #212327',
    md: 0,
  });
  assert.deepEqual(layout.desktopProductCopy.display, { xs: 'none', md: 'block' });
  assert.deepEqual(layout.mobileProductCopy.display, { xs: 'block', md: 'none' });
  assert.equal(layout.formInner.maxWidth, 480);
});

test('Auth layout keeps the decorative orbit non-interactive and motion-free', () => {
  assert.equal(
    typeof layoutModule.getAuthLayoutSx,
    'function',
    'getAuthLayoutSx must define decorative geometry',
  );

  const layout = layoutModule.getAuthLayoutSx({
    palette: { border: { subtle: '#212327' } },
  });

  assert.equal(layout.orbit.pointerEvents, 'none');
  assert.equal(layout.orbit.animation, 'none');
  assert.equal(layout.orbit.borderRadius, '50%');
});
