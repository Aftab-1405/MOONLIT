/**
 * E2E — Page: Landing (`src/pages/Landing`)
 *
 * Focuses on landing-page behavior and UX resilience:
 *  - Auth-aware CTA routing
 *  - In-page demo navigation
 *  - Reduced-motion behavior
 *  - Media failure resilience
 *  - Mobile/desktop layout overflow
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

async function setupLanding(page, { authenticated = false, mediaOverrides = false } = {}) {
  await page.addInitScript((isAuthenticated) => {
    window.__MOCK_AUTH__ = true;
    if (!isAuthenticated) {
      window.__MOCK_AUTH_FLOW__ = true;
    }
  }, authenticated);

  if (mediaOverrides) {
    await page.route('**/moonlit-demo.mp4', (route) => route.fulfill({ status: 404, body: '' }));
    await page.route('**/logo-oracle.svg', (route) => route.fulfill({ status: 404, body: '' }));
  }

  await setupMocks(page);
}

async function goToLanding(page, options = {}) {
  await setupLanding(page, options);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /stop writing sql/i })).toBeVisible({ timeout: 10000 });
}

async function expectNoHorizontalPageOverflow(page) {
  const overflow = await page.evaluate(() => {
    const root = document.querySelector('[role="main"]') || document.documentElement;
    return {
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      mainScrollWidth: root.scrollWidth,
      mainClientWidth: root.clientWidth,
    };
  });

  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth + 2);
  expect(overflow.mainScrollWidth).toBeLessThanOrEqual(overflow.mainClientWidth + 2);
}

test.describe('Page — Landing', () => {
  test('renders the complete landing page without desktop horizontal overflow', async ({ page }) => {
    await goToLanding(page);

    await expect(page.getByText('AI-Powered Database Assistant')).toBeVisible();
    await expect(page.getByRole('button', { name: /get started free/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /watch demo/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /built for everyone/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /from question to answer/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /three steps/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /ready to talk to your database/i })).toBeVisible();

    await expectNoHorizontalPageOverflow(page);
  });

  test('routes unauthenticated users from primary CTA to auth page', async ({ page }) => {
    await goToLanding(page, { authenticated: false });

    await page.getByRole('button', { name: /get started free/i }).first().click();

    await page.waitForURL('**/auth', { timeout: 8000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 10000 });
  });

  test('routes authenticated users from primary CTA to chat page', async ({ page }) => {
    await goToLanding(page, { authenticated: true });

    await page.getByRole('button', { name: /get started free/i }).first().click();

    await page.waitForURL('**/chat', { timeout: 8000 });
    await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
  });

  test('watch demo scrolls to the demo section and exposes playable media', async ({ page }) => {
    await goToLanding(page);

    await page.getByRole('button', { name: /watch demo/i }).click();

    const demoSection = page.locator('#demo-section');
    await expect(demoSection.getByText(/see it in action/i)).toBeVisible({ timeout: 8000 });
    await expect(demoSection.locator('video source[src="/moonlit-demo.mp4"]')).toHaveCount(1);

    await expect.poll(async () => {
      return demoSection.evaluate((section) => Math.abs(section.getBoundingClientRect().top));
    }).toBeLessThan(80);
  });

  test('respects reduced motion while keeping demo navigation functional', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await goToLanding(page);

    const heroHeading = page.getByRole('heading', { name: /stop writing sql/i });
    const animationName = await heroHeading.evaluate((el) => window.getComputedStyle(el).animationName);
    expect(animationName).toBe('none');

    await page.getByRole('button', { name: /watch demo/i }).click();
    await expect(page.locator('#demo-section').getByText(/from question to answer/i)).toBeVisible({ timeout: 8000 });
  });

  test('stays usable when optional landing media fails to load', async ({ page }) => {
    await goToLanding(page, { mediaOverrides: true });

    await expect(page.getByRole('heading', { name: /stop writing sql/i })).toBeVisible();
    await page.getByRole('button', { name: /watch demo/i }).click();
    await expect(page.locator('#demo-section').getByText(/watch how anyone can explore databases/i)).toBeVisible();
    await expectNoHorizontalPageOverflow(page);
  });

  test('mobile viewport preserves CTA access and avoids horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await goToLanding(page);

    await expect(page.getByRole('button', { name: /get started free/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /watch demo/i })).toBeVisible();
    await expect(page.getByAltText('PostgreSQL')).toBeVisible();
    await expect(page.getByAltText('MySQL')).toBeVisible();
    await expect(page.getByAltText('SQL Server')).not.toBeVisible();

    await expectNoHorizontalPageOverflow(page);
  });
});
