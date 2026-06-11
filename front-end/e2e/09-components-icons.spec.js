/**
 * E2E — Shared Icon Components (`src/components/icons`)
 *
 * These icons are tiny wrappers, so the useful E2E coverage is in-context:
 * verify each exported icon renders in a real UI placement with stable size,
 * decorative accessibility semantics, and theme-aware color inheritance.
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

async function goToChat(page, { viewport, settings } = {}) {
  if (viewport) {
    await page.setViewportSize(viewport);
  }

  await page.addInitScript((initialSettings) => {
    if (initialSettings) {
      window.localStorage.setItem('moonlit-settings', JSON.stringify(initialSettings));
    }
  }, settings);

  await setupMocks(page);
  await page.goto('/chat');
  await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
}

async function expectControlIcon(control, {
  maxSize = 32,
  minSize = 10,
  decorative = true,
  expectedViewBox,
} = {}) {
  await expect(control).toBeVisible();
  const icon = control.locator('svg').first();
  await expect(icon).toBeVisible();

  const metrics = await icon.evaluate((svg) => {
    const rect = svg.getBoundingClientRect();
    const style = window.getComputedStyle(svg);
    return {
      width: rect.width,
      height: rect.height,
      color: style.color,
      fill: style.fill,
      stroke: style.stroke,
      ariaHidden: svg.getAttribute('aria-hidden'),
      focusable: svg.getAttribute('focusable'),
      viewBox: svg.getAttribute('viewBox'),
    };
  });

  expect(metrics.width).toBeGreaterThanOrEqual(minSize);
  expect(metrics.height).toBeGreaterThanOrEqual(minSize);
  expect(metrics.width).toBeLessThanOrEqual(maxSize);
  expect(metrics.height).toBeLessThanOrEqual(maxSize);
  expect(metrics.color).not.toBe('rgba(0, 0, 0, 0)');
  expect([metrics.fill, metrics.stroke]).toContain(metrics.color);

  if (decorative) {
    expect(metrics.ariaHidden).toBe('true');
    expect(metrics.focusable).toBe('false');
  }

  if (expectedViewBox) {
    expect(metrics.viewBox).toBe(expectedViewBox);
  }
}

async function collectIconMetrics(page) {
  return page.locator('svg').evaluateAll((icons) => icons.map((svg) => {
    const rect = svg.getBoundingClientRect();
    const style = window.getComputedStyle(svg);
    return {
      label: svg.closest('button,[role="button"],.MuiChip-root')?.textContent?.trim() || svg.parentElement?.textContent?.trim() || '',
      width: rect.width,
      height: rect.height,
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
      ariaHidden: svg.getAttribute('aria-hidden'),
      focusable: svg.getAttribute('focusable'),
      color: style.color,
      fill: style.fill,
      stroke: style.stroke,
    };
  }));
}

test.describe('Shared components — icons', () => {
  test('sidebar icons render with stable dimensions and do not pollute button names', async ({ page }) => {
    await goToChat(page);

    const sidebar = page.getByRole('navigation', { name: /sidebar/i }).first();
    await expect(sidebar).toBeVisible();

    await expectControlIcon(sidebar.getByRole('button', { name: /^collapse sidebar$/i }), {
      expectedViewBox: '0 0 20 20',
    });
    await expectControlIcon(sidebar.getByRole('button', { name: /^new chat$/i }));
    await expectControlIcon(sidebar.getByRole('button', { name: /^search chats$/i }));
    await expectControlIcon(sidebar.getByRole('button', { name: /^database$/i }));
    await expectControlIcon(sidebar.getByRole('button', { name: /^mindmap$/i }), {
      expectedViewBox: '0 0 24 24',
    });
    await expectControlIcon(sidebar.getByRole('button', { name: /recents/i }));

    await expect(sidebar.getByRole('button', { name: /^new chat$/i })).toHaveCount(1);
    await expect(sidebar.getByRole('button', { name: /^search chats$/i })).toHaveCount(1);
    await expect(sidebar.getByRole('button', { name: /^database$/i })).toHaveCount(1);
    await expect(sidebar.getByRole('button', { name: /^mindmap$/i })).toHaveCount(1);
  });

  test('welcome and composer icons stay visible, compact, and decorative', async ({ page }) => {
    await goToChat(page);

    await expect(page.getByText(/how can i help/i)).toBeVisible();

    await expectControlIcon(page.getByRole('button', { name: /^check connection$/i }), { maxSize: 24 });
    await expectControlIcon(page.getByRole('button', { name: /^schema details$/i }), { maxSize: 24 });
    await expectControlIcon(page.getByRole('button', { name: /^draft sql query$/i }), { maxSize: 24 });
    await expectControlIcon(page.getByRole('button', { name: /^analytics_db$/i }), { maxSize: 24 });
    await expectControlIcon(page.getByRole('button', { name: /^schema: public$/i }), { maxSize: 24 });
    await expectControlIcon(page.getByLabel(/open sql editor/i), { maxSize: 24 });
  });

  test('custom SVG icons use expected vector contracts and currentColor inheritance', async ({ page }) => {
    await goToChat(page);

    const sidebarIcon = page
      .getByRole('navigation', { name: /sidebar/i })
      .first()
      .getByRole('button', { name: /^collapse sidebar$/i })
      .locator('svg')
      .first();
    const mindmapIcon = page
      .getByRole('navigation', { name: /sidebar/i })
      .first()
      .getByRole('button', { name: /^mindmap$/i })
      .locator('svg')
      .first();

    await expect(sidebarIcon).toHaveAttribute('viewBox', '0 0 20 20');
    await expect(mindmapIcon).toHaveAttribute('viewBox', '0 0 24 24');

    const customIconContracts = await Promise.all([
      sidebarIcon.evaluate((svg) => {
        const path = svg.querySelector('path');
        const style = window.getComputedStyle(svg);
        return {
          fill: window.getComputedStyle(path).fill,
          color: style.color,
          pathCount: svg.querySelectorAll('path').length,
        };
      }),
      mindmapIcon.evaluate((svg) => {
        const connector = svg.querySelector('path[stroke="currentColor"]');
        const style = window.getComputedStyle(svg);
        return {
          circleCount: svg.querySelectorAll('circle').length,
          connectorStroke: connector?.getAttribute('stroke'),
          renderedStroke: connector ? window.getComputedStyle(connector).stroke : null,
          color: style.color,
        };
      }),
    ]);

    expect(customIconContracts[0]).toEqual(expect.objectContaining({
      fill: customIconContracts[0].color,
      pathCount: 1,
    }));
    expect(customIconContracts[1]).toEqual(expect.objectContaining({
      circleCount: 5,
      connectorStroke: 'currentColor',
      renderedStroke: customIconContracts[1].color,
    }));
  });

  test('icon rendering survives light theme and narrow mobile layout without invisible or oversized SVGs', async ({ page }) => {
    await goToChat(page, {
      viewport: { width: 360, height: 740 },
      settings: { theme: 'light' },
    });

    await expect(page.getByRole('button', { name: /open sidebar/i })).toBeVisible();
    await page.getByRole('button', { name: /open sidebar/i }).click();
    await expect(page.getByRole('navigation', { name: /sidebar/i })).toBeVisible();

    const metrics = await collectIconMetrics(page);
    const visibleIcons = metrics.filter((icon) => icon.visible);

    expect(visibleIcons.length).toBeGreaterThanOrEqual(8);
    expect(visibleIcons.every((icon) => icon.width >= 10 && icon.height >= 10)).toBe(true);
    expect(visibleIcons.every((icon) => icon.width <= 44 && icon.height <= 44)).toBe(true);
    expect(visibleIcons.every((icon) => icon.color !== 'rgba(0, 0, 0, 0)')).toBe(true);
    expect(visibleIcons.every((icon) => icon.ariaHidden === 'true' && icon.focusable === 'false')).toBe(true);
  });
});
