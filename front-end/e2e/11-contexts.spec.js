/**
 * E2E — App contexts (`src/contexts`)
 *
 * Covers observable context behavior through the real app shell:
 * SettingsContext + ThemeContext persistence, UserSettingsSync hydration/save,
 * and DatabaseContext recovery when status sync fails.
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

async function setupContextPage(
  page,
  {
    localSettings,
    settingsGet = { status: 'success', settings: {} },
    settingsGetStatus = 200,
    settingsPostStatus = 200,
    overrides = {},
  } = {},
) {
  const settingsRequests = [];

  await page.addInitScript((settings) => {
    window.__MOCK_AUTH__ = true;
    if (settings && !window.localStorage.getItem('moonlit-settings')) {
      window.localStorage.setItem('moonlit-settings', JSON.stringify(settings));
    }
  }, localSettings);

  await setupMocks(page, overrides);

  await page.route('**/api/v1/user/settings', async (route) => {
    const request = route.request();
    const method = request.method();
    const body = request.postDataJSON?.() ?? null;
    settingsRequests.push({ method, body });

    if (method === 'GET') {
      await route.fulfill({
        status: settingsGetStatus,
        contentType: 'application/json',
        body: JSON.stringify(settingsGet),
      });
      return;
    }

    await route.fulfill({
      status: settingsPostStatus,
      contentType: 'application/json',
      body: JSON.stringify({ status: settingsPostStatus < 400 ? 'success' : 'error' }),
    });
  });

  return settingsRequests;
}

async function goToChat(page) {
  await page.goto('/chat');
  await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
}

async function openSettings(page) {
  await page.getByRole('button', { name: /mock user, settings/i }).click();
  await page.getByRole('menuitem', { name: /^settings$/i }).click();
  await expect(page.getByRole('heading', { name: /^appearance$/i })).toBeVisible();
}

async function readStoredSettings(page) {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem('moonlit-settings') || '{}'));
}

test.describe('App contexts', () => {
  test('UserSettingsSync hydrates server settings over local defaults without immediately persisting them back', async ({ page }) => {
    const settingsRequests = await setupContextPage(page, {
      localSettings: {
        theme: 'dark',
        maxRows: 1000,
        queryTimeout: 30,
      },
      settingsGet: {
        status: 'success',
        settings: {
          theme: 'light',
          maxRows: 5000,
          queryTimeout: 60,
          confirmBeforeRun: true,
          llmProvider: 'openai',
          llmModel: 'gpt-4o',
        },
      },
    });

    await goToChat(page);

    await expect.poll(async () => page.evaluate(() => document.documentElement.style.colorScheme)).toBe('light');
    await expect.poll(async () => {
      const settings = await readStoredSettings(page);
      return {
        theme: settings.theme,
        maxRows: settings.maxRows,
        queryTimeout: settings.queryTimeout,
        confirmBeforeRun: settings.confirmBeforeRun,
        llmProvider: settings.llmProvider,
        llmModel: settings.llmModel,
      };
    }).toEqual({
      theme: 'light',
      maxRows: 5000,
      queryTimeout: 60,
      confirmBeforeRun: true,
      llmProvider: 'openai',
      llmModel: 'gpt-4o',
    });

    await page.waitForTimeout(900);
    expect(settingsRequests.filter((request) => request.method === 'POST')).toEqual([]);
  });

  test('ThemeContext and SettingsContext persist a user theme change and debounce-save syncable settings', async ({ page }) => {
    const settingsRequests = await setupContextPage(page, {
      localSettings: {
        theme: 'dark',
        maxRows: 1000,
        queryTimeout: 30,
        confirmBeforeRun: false,
      },
      settingsGet: { status: 'success', settings: {} },
    });

    await goToChat(page);
    await expect.poll(async () => page.evaluate(() => document.documentElement.style.colorScheme)).toBe('dark');

    await openSettings(page);
    await page.getByRole('button', { name: /light theme/i }).click();

    await expect.poll(async () => page.evaluate(() => document.documentElement.style.colorScheme)).toBe('light');
    await expect.poll(async () => {
      const settings = await readStoredSettings(page);
      return settings.theme;
    }).toBe('light');

    await expect.poll(() => settingsRequests.some((request) => (
      request.method === 'POST' && request.body?.theme === 'light'
    )), {
      timeout: 2500,
    }).toBe(true);

    const themePost = settingsRequests.find((request) => (
      request.method === 'POST' && request.body?.theme === 'light'
    ));
    expect(themePost.body).toEqual(expect.objectContaining({
      theme: 'light',
      maxRows: 1000,
      queryTimeout: 30,
      confirmBeforeRun: false,
    }));

    await page.reload();
    await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => page.evaluate(() => document.documentElement.style.colorScheme)).toBe('light');
  });

  test('settings sync failure does not block local settings or the authenticated app shell', async ({ page }) => {
    await setupContextPage(page, {
      localSettings: {
        theme: 'light',
        maxRows: 500,
      },
      settingsGetStatus: 500,
      settingsGet: { status: 'error', message: 'settings unavailable' },
    });

    await goToChat(page);

    await expect(page.getByText(/how can i help/i)).toBeVisible();
    await expect.poll(async () => page.evaluate(() => document.documentElement.style.colorScheme)).toBe('light');
    await expect.poll(async () => {
      const settings = await readStoredSettings(page);
      return settings.maxRows;
    }).toBe(500);
  });

  test('DatabaseContext keeps chat usable and hides database selectors when status sync fails', async ({ page }) => {
    await setupContextPage(page, {
      overrides: {
        db_status: {
          status: 500,
          body: { status: 'error', message: 'database status down' },
        },
      },
    });

    await goToChat(page);

    await expect(page.getByText(/how can i help/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^analytics_db$/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^schema: public$/i })).not.toBeVisible();
    await expect(page.locator('[data-ui-target="chat_input"]').first()).toBeVisible();
  });
});
