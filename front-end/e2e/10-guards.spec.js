/**
 * E2E — Route guards (`src/guards`)
 *
 * These tests focus on guard-level behavior that page specs should not need to
 * duplicate: loading gates, history replacement, and preventing protected page
 * side effects from running before access is granted.
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

async function setupMockAuth(page, { authenticated = true, admin = false } = {}) {
  await page.addInitScript(({ isAuthenticated, isAdmin }) => {
    window.__MOCK_AUTH__ = true;
    if (!isAuthenticated) {
      window.__MOCK_AUTH_FLOW__ = true;
    }
    if (isAdmin) {
      window.__MOCK_AUTH_ADMIN__ = true;
    }
  }, {
    isAuthenticated: authenticated,
    isAdmin: admin,
  });

  await setupMocks(page);
}

async function setupAdminSideEffectTrap(page) {
  await page.addInitScript(() => {
    window.__ADMIN_EVENT_SOURCE_ATTEMPTS__ = [];
    class TrappedEventSource {
      constructor(url) {
        window.__ADMIN_EVENT_SOURCE_ATTEMPTS__.push(url);
      }

      addEventListener() {}
      close() {}
    }

    window.EventSource = TrappedEventSource;
  });

  const adminRequests = [];

  await page.route('**/api/v1/context/metrics**', async (route) => {
    adminRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', metrics: {} }),
    });
  });

  await page.route('**/api/v1/', async (route) => {
    adminRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success' }),
    });
  });

  return adminRequests;
}

async function expectBrowserBackDoesNotReveal(page, forbiddenUrl, forbiddenLocator) {
  await page.goBack();
  await page.waitForTimeout(300);
  await expect(page).not.toHaveURL(forbiddenUrl);
  await expect(forbiddenLocator).not.toBeVisible();
}

test.describe('Route guards', () => {
  test('ProtectedRoute keeps protected content hidden while auth initialization is pending', async ({ page }) => {
    let releaseFirebaseConfig;
    const firebaseConfigReleased = new Promise((resolve) => {
      releaseFirebaseConfig = resolve;
    });

    await page.route('**/firebase-config', async (route) => {
      await firebaseConfigReleased;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          config: {
            apiKey: 'mock',
            authDomain: 'mock.firebaseapp.com',
            projectId: 'mock',
            appId: 'mock',
          },
        }),
      });
    });

    await page.goto('/chat', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Moonlit').first()).toBeVisible();
    await expect(page.getByRole('main', { name: /chat workspace/i })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: /welcome back/i })).not.toBeVisible();

    releaseFirebaseConfig();
  });

  test('ProtectedRoute redirects unauthenticated deep links with history replacement', async ({ page }) => {
    await setupMockAuth(page, { authenticated: false });

    await page.goto('/');
    await page.goto('/chat/conv-1');

    await page.waitForURL('**/auth', { timeout: 8000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole('main', { name: /chat workspace/i })).not.toBeVisible();

    await expectBrowserBackDoesNotReveal(
      page,
      /\/chat\/conv-1$/,
      page.getByRole('main', { name: /chat workspace/i }),
    );
  });

  test('AdminRoute redirects unauthenticated users before admin side effects run', async ({ page }) => {
    const adminRequests = await setupAdminSideEffectTrap(page);
    await setupMockAuth(page, { authenticated: false, admin: false });

    await page.goto('/');
    await page.goto('/admin');

    await page.waitForURL('**/auth', { timeout: 8000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /admin command surface/i })).not.toBeVisible();
    expect(adminRequests).toEqual([]);
    await expect(page.evaluate(() => window.__ADMIN_EVENT_SOURCE_ATTEMPTS__)).resolves.toEqual([]);

    await expectBrowserBackDoesNotReveal(
      page,
      /\/admin$/,
      page.getByRole('heading', { name: /admin command surface/i }),
    );
  });

  test('AdminRoute redirects authenticated non-admin users before admin side effects run', async ({ page }) => {
    const adminRequests = await setupAdminSideEffectTrap(page);
    await setupMockAuth(page, { authenticated: true, admin: false });

    await page.goto('/');
    await page.goto('/admin');

    await page.waitForURL('**/chat', { timeout: 8000 });
    await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /admin command surface/i })).not.toBeVisible();
    expect(adminRequests).toEqual([]);
    await expect(page.evaluate(() => window.__ADMIN_EVENT_SOURCE_ATTEMPTS__)).resolves.toEqual([]);

    await expectBrowserBackDoesNotReveal(
      page,
      /\/admin$/,
      page.getByRole('heading', { name: /admin command surface/i }),
    );
  });
});
