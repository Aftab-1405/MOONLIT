/**
 * E2E — API contracts (`src/api`)
 *
 * Exercises API wrappers through the real UI so request headers/body mapping
 * remain covered where users actually trigger them.
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

const CSRF_TOKEN = 'api-contract-csrf-token';

const API_SETTINGS = {
  status: 'success',
  settings: {
    confirmBeforeRun: false,
    maxRows: 0,
    queryTimeout: 7,
    llmProvider: 'openai',
    llmModel: 'gpt-4o',
  },
};

const SQL_CONVERSATION = {
  status: 'success',
  conversation: {
    id: 'conv-1',
    title: 'Sales Analysis',
    messages: [
      { sender: 'user', content: 'Give me queryable sales data' },
      {
        sender: 'ai',
        content: [
          'Here is a query:',
          '',
          '```sql',
          'SELECT region, SUM(total) AS total_sales FROM orders GROUP BY region;',
          '```',
        ].join('\n'),
      },
    ],
  },
};

async function setupApiPage(page, configureRoutes, overrides = {}) {
  await page.context().addCookies([{
    name: 'csrf_token',
    value: CSRF_TOKEN,
    domain: 'localhost',
    path: '/',
  }]);
  await page.addInitScript(() => {
    window.__MOCK_AUTH__ = true;
  });
  await setupMocks(page, {
    'user/settings': {
      status: 200,
      body: API_SETTINGS,
    },
    ...overrides,
  });
  await configureRoutes();
}

async function openChat(page) {
  await page.goto('/chat');
  await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
}

async function sendPrompt(page, prompt) {
  const input = page.locator('[data-ui-target="chat_input"]:visible').first();
  await input.fill(prompt);
  await input.press('Enter');
}

test.describe('API contracts', () => {
  test('chat streaming POST includes CSRF and normalized settings payload', async ({ page }) => {
    let capturedRequest = null;

    await setupApiPage(page, async () => {
      await page.route('**/api/v1/pass_user_prompt_to_llm', async (route) => {
        capturedRequest = {
          headers: route.request().headers(),
          body: route.request().postDataJSON(),
        };
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          headers: {
            'X-Conversation-Id': 'api-contract-chat',
          },
          body: 'data: {"type":"token","content":"API payload accepted."}\n\ndata: {"type":"done"}\n\n',
        });
      });
    });

    await openChat(page);
    await sendPrompt(page, 'Check API payload');

    await page.waitForURL('**/chat/api-contract-chat', { timeout: 8000 });
    await expect(page.getByText('API payload accepted.')).toBeVisible({ timeout: 10000 });

    expect(capturedRequest).toBeTruthy();
    expect(capturedRequest.headers['x-csrf-token']).toBe(CSRF_TOKEN);
    expect(capturedRequest.body).toMatchObject({
      prompt: 'Check API payload',
      conversation_id: null,
      max_rows: null,
      provider: 'openai',
      model: 'gpt-4o',
    });
  });

  test('SQL execution POST includes CSRF and maps UI query settings to API fields', async ({ page }) => {
    let capturedRequest = null;

    await setupApiPage(page, async () => {
      await page.route('**/api/v1/run_sql_query', async (route) => {
        capturedRequest = {
          headers: route.request().headers(),
          body: route.request().postDataJSON(),
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: {
              result: {
                columns: ['region', 'total_sales'],
                rows: [['North', 1200]],
              },
              row_count: 1,
              total_rows: 1,
              execution_time: '12ms',
            },
          }),
        });
      });
    }, {
      'get_conversation/conv-1': {
        status: 200,
        body: SQL_CONVERSATION,
      },
    });

    await openChat(page);
    await page.getByText('Sales Analysis').first().click();
    await page.waitForURL('**/chat/conv-1', { timeout: 8000 });
    await expect(page.getByText('Here is a query:')).toBeVisible({ timeout: 10000 });

    await page.getByLabel(/^run query$/i).first().click();

    await expect.poll(() => capturedRequest).not.toBeNull();
    expect(capturedRequest.headers['x-csrf-token']).toBe(CSRF_TOKEN);
    expect(capturedRequest.body).toEqual({
      sql_query: 'SELECT region, SUM(total) AS total_sales FROM orders GROUP BY region;',
      max_rows: null,
      timeout: 7,
    });
  });
});
