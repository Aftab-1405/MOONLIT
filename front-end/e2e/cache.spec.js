import { test, expect } from '@playwright/test';

test.describe('TanStack Cache System E2E Tests', () => {
  let settingsCalls = 0;
  let conversationsListCalls = 0;
  let getConversation1Calls = 0;
  let getConversation2Calls = 0;
  let dbStatusCalls = 0;

  test.beforeEach(async ({ page }) => {
    // Reset call counters
    settingsCalls = 0;
    conversationsListCalls = 0;
    getConversation1Calls = 0;
    getConversation2Calls = 0;
    dbStatusCalls = 0;

    // Inject mock authentication BEFORE the scripts load
    await page.addInitScript(() => {
      window.__MOCK_AUTH__ = true;
    });

    // Intercept all API and config endpoints with a single matcher function
    await page.route(url => {
      const path = url.pathname;
      return path.includes('/api/v1/') || path.includes('/firebase-config');
    }, async (route) => {
      try {
        const urlStr = route.request().url();
        if (urlStr.includes('/firebase-config')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              config: {
                apiKey: 'mock-api-key',
                authDomain: 'mock-auth-domain',
                projectId: 'mock-project-id',
              },
            }),
          });
        } else if (urlStr.includes('/api/v1/user/settings')) {
          settingsCalls++;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              settings: {
                confirmBeforeRun: false,
                maxRows: 1000,
                queryTimeout: 30,
              },
            }),
          });
        } else if (urlStr.includes('/api/v1/get_conversations')) {
          conversationsListCalls++;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              conversations: [
                { id: 'conv-1', title: 'Conversation 1', timestamp: '2026-06-10T12:00:00Z' },
                { id: 'conv-2', title: 'Conversation 2', timestamp: '2026-06-10T12:05:00Z' },
              ],
            }),
          });
        } else if (urlStr.includes('/api/v1/get_conversation/conv-1')) {
          getConversation1Calls++;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              conversation: {
                id: 'conv-1',
                title: 'Conversation 1',
                messages: [
                  { sender: 'user', content: 'Hello' },
                  { sender: 'ai', content: 'Hi, I am Moonlit' },
                ],
              },
            }),
          });
        } else if (urlStr.includes('/api/v1/get_conversation/conv-2')) {
          getConversation2Calls++;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              conversation: {
                id: 'conv-2',
                title: 'Conversation 2',
                messages: [
                  { sender: 'user', content: 'What is TanStack?' },
                  { sender: 'ai', content: 'It is a state management and caching library!' },
                ],
              },
            }),
          });
        } else if (urlStr.includes('/api/v1/delete_conversation/conv-1')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'success' }),
          });
        } else if (urlStr.includes('/api/v1/rename_conversation/conv-1')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'success', title: 'Renamed Title' }),
          });
        } else if (urlStr.includes('/api/v1/db_status')) {
          dbStatusCalls++;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              data: {
                connected: true,
                db_type: 'postgresql',
                current_database: 'test_db',
                databases: ['test_db', 'other_db'],
                schemas: ['public'],
                current_schema: 'public',
              },
            }),
          });
        } else if (urlStr.includes('/api/v1/llm/options')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              providers: [
                {
                  name: 'openai',
                  label: 'OpenAI',
                  models: ['gpt-4o'],
                  default_model: 'gpt-4o',
                },
              ],
              default_provider: 'openai',
              default_model: 'gpt-4o',
            }),
          });
        } else if (urlStr.includes('/api/v1/user/context')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'success', schemas: [] }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'success' }),
          });
        }
      } catch (err) {
        console.error('ERROR in interceptor:', err);
        await route.abort();
      }
    });
  });

  test('should load app, cache settings, and cache list of conversations', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('text=Moonlit')).toBeVisible();
    await expect(page.locator('text=Conversation 1')).toBeVisible();
    await expect(page.locator('text=Conversation 2')).toBeVisible();
    expect(settingsCalls).toBe(1);
    expect(conversationsListCalls).toBe(1);
  });

  test('should reuse conversation details cache on repeat navigation (Cache Hit)', async ({ page }) => {
    await page.goto('/chat');
    await page.click('text=Conversation 1');
    await expect(page.locator('text=Hi, I am Moonlit')).toBeVisible();
    expect(getConversation1Calls).toBe(1);

    await page.click('text=Conversation 2');
    await expect(page.locator('text=What is TanStack?')).toBeVisible();
    expect(getConversation2Calls).toBe(1);

    await page.click('text=Conversation 1');
    await expect(page.locator('text=Hi, I am Moonlit')).toBeVisible();
    expect(getConversation1Calls).toBe(1);
  });

  test('should invalidate conversations list cache when renaming a conversation', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('text=Conversation 1')).toBeVisible();

    const optionsBtn = page.locator('.options-btn').first();
    await optionsBtn.click({ force: true });

    await page.click('text=Rename');
    const inputField = page.getByRole('textbox', { name: 'Conversation title' });
    await inputField.fill('Renamed Title');

    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('rename_conversation')),
      page.click('button:has-text("Rename")')
    ]);
    expect(response.status()).toBe(200);

    await expect(page.locator('text=Renamed Title')).toBeVisible();
    await expect(page.locator('text=Conversation 1')).not.toBeVisible();
    expect(conversationsListCalls).toBe(1);
  });

  test('should invalidate and clear cache when deleting a conversation', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('text=Conversation 1')).toBeVisible();

    await page.click('text=Conversation 1');
    await expect(page.locator('text=Hi, I am Moonlit')).toBeVisible();

    const optionsBtn = page.locator('.options-btn').first();
    await optionsBtn.click({ force: true });

    await page.click('text=Delete');

    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('delete_conversation')),
      page.click('button:has-text("Delete")')
    ]);
    expect(response.status()).toBe(200);

    await expect(page.locator('text=Conversation 1')).not.toBeVisible();
    expect(conversationsListCalls).toBe(1);
  });
});
