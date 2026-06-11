/**
 * E2E — Page: Chat (`src/pages/Chat.jsx`)
 *
 * Chat.jsx is a thin page wrapper around MainInterface, so these tests focus on
 * page-level integration: route guards, direct URL hydration, failed route IDs,
 * history transitions, logout routing, and mobile shell behavior.
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

async function setupChat(page, { authenticated = true, overrides = {}, viewport } = {}) {
  if (viewport) {
    await page.setViewportSize(viewport);
  }

  await page.addInitScript((isAuthenticated) => {
    window.__MOCK_AUTH__ = true;
    if (!isAuthenticated) {
      window.__MOCK_AUTH_FLOW__ = true;
    }
  }, authenticated);

  await setupMocks(page, overrides);
}

async function goToChat(page, path = '/chat', options = {}) {
  await setupChat(page, options);
  await page.goto(path);
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    appRootScrollWidth: document.querySelector('#app-root')?.scrollWidth || 0,
    appRootClientWidth: document.querySelector('#app-root')?.clientWidth || 0,
  }));

  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth + 2);
  expect(overflow.appRootScrollWidth).toBeLessThanOrEqual(overflow.appRootClientWidth + 2);
}

test.describe('Page — Chat', () => {
  test('redirects unauthenticated users to auth page', async ({ page }) => {
    await goToChat(page, '/chat', { authenticated: false });

    await page.waitForURL('**/auth', { timeout: 8000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 10000 });
  });

  test('direct conversation URL hydrates the chat shell and message state', async ({ page }) => {
    await goToChat(page, '/chat/conv-1');

    await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Show me total sales by region')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('How can I help')).not.toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('unknown conversation route shows recoverable load-error state without crashing shell', async ({ page }) => {
    await goToChat(page, '/chat/missing-conversation', {
      overrides: {
        get_conversations: {
          status: 200,
          body: {
            status: 'success',
            conversations: [
              { id: 'missing-conversation', title: 'Broken Link', timestamp: '2026-06-10T12:00:00Z' },
            ],
          },
        },
      },
    });

    await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/this conversation could not be loaded/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /new chat/i })).toBeVisible();
  });

  test('browser back and forward keep URL, sidebar, and messages in sync', async ({ page }) => {
    await goToChat(page);

    await page.getByText('Sales Analysis').first().click();
    await page.waitForURL('**/chat/conv-1', { timeout: 8000 });
    await expect(page.getByText('Show me total sales by region')).toBeVisible({ timeout: 10000 });

    await page.getByText('Schema Explorer').first().click();
    await page.waitForURL('**/chat/conv-2', { timeout: 8000 });
    await expect(page.getByText('What tables do we have?')).toBeVisible({ timeout: 10000 });

    await page.goBack();
    await page.waitForURL('**/chat/conv-1', { timeout: 8000 });
    await expect(page.getByText('Show me total sales by region')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('What tables do we have?')).not.toBeVisible();

    await page.goForward();
    await page.waitForURL('**/chat/conv-2', { timeout: 8000 });
    await expect(page.getByText('What tables do we have?')).toBeVisible({ timeout: 10000 });
  });

  test('signing out from chat routes to auth and hides protected shell', async ({ page }) => {
    await goToChat(page);
    await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /mock user, settings/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();

    await page.waitForURL('**/auth', { timeout: 8000 });
    await expect(page.getByRole('main', { name: /chat workspace/i })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 10000 });
  });

  test('mobile chat page opens and closes sidebar without horizontal overflow', async ({ page }) => {
    await goToChat(page, '/chat', { viewport: { width: 360, height: 740 } });

    await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /open sidebar/i })).toBeVisible();
    await page.getByRole('button', { name: /open sidebar/i }).click();
    await expect(page.getByRole('navigation', { name: /sidebar/i })).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /open sidebar/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('mobile direct conversation URL keeps input reachable after route hydration', async ({ page }) => {
    await goToChat(page, '/chat/conv-1', { viewport: { width: 360, height: 740 } });

    await expect(page.getByText('Show me total sales by region')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-ui-target="chat_input"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /send message/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
