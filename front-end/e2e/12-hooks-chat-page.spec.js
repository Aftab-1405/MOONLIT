/**
 * E2E — Chat-page hooks (`src/hooks/chat-page`)
 *
 * Focuses on high-risk hook behavior exposed through the real chat UI:
 * streaming failures/actions, query execution confirmation/failure, and
 * workspace canvas state created by hook-driven UI actions.
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

async function setupHookPage(page, overrides = {}) {
  await page.addInitScript(() => {
    window.__MOCK_AUTH__ = true;
  });
  await setupMocks(page, overrides);
}

async function openChatWithRoutes(page, configureRoutes, overrides = {}) {
  await setupHookPage(page, overrides);
  await configureRoutes();
  await page.goto('/chat');
  await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
}

function sseBody(events) {
  return events.map((event) => {
    if (event === '[MALFORMED]') return 'data: {not-json\n\n';
    if (event === '[DONE]') return 'data: [DONE]\n\n';
    return `data: ${JSON.stringify(event)}\n\n`;
  }).join('');
}

async function routeChatStream(page, events, { conversationId = 'stream-conv-1', status = 200 } = {}) {
  await page.route('**/api/v1/pass_user_prompt_to_llm', async (route) => {
    if (status >= 400) {
      await route.fulfill({
        status,
        contentType: 'text/plain',
        body: 'upstream unavailable',
      });
      return;
    }

    await route.fulfill({
      status,
      contentType: 'text/event-stream',
      headers: {
        'Cache-Control': 'no-cache',
        'X-Conversation-Id': conversationId,
      },
      body: sseBody(events),
    });
  });
}

function activeChatInput(page) {
  return page
    .getByRole('main', { name: /chat workspace/i })
    .locator('[data-ui-target="chat_input"]')
    .last();
}

async function sendPrompt(page, prompt) {
  const input = activeChatInput(page);
  await input.fill(prompt);
  await input.press('Enter');
}

const SQL_CONVERSATION = {
  status: 'success',
  conversation: {
    id: 'conv-1',
    title: 'Sales Analysis',
    messages: [
      { sender: 'user', content: 'Can you write a query?' },
      {
        sender: 'ai',
        content: [
          'Use this query:',
          '',
          '```sql',
          'SELECT region, SUM(total) AS total_sales FROM orders GROUP BY region;',
          '```',
        ].join('\n'),
      },
    ],
  },
};

test.describe('Chat-page hooks', () => {
  test('streaming SSE can open the SQL workspace through a validated UI action without breaking the response', async ({ page }) => {
    await openChatWithRoutes(page, async () => routeChatStream(page, [
      '[MALFORMED]',
      { type: 'token', content: 'I drafted a query and opened the editor.' },
      {
        type: 'ui_action',
        action: 'write_sql_editor_query',
        payload: { query: 'SELECT id, total FROM orders LIMIT 10;' },
      },
      { type: 'done' },
    ]));

    await sendPrompt(page, 'Draft a SQL query');

    await page.waitForURL('**/chat/stream-conv-1', { timeout: 8000 });
    await expect(page.getByTestId('user-message').filter({ hasText: 'Draft a SQL query' })).toBeVisible();
    await expect(page.getByText('I drafted a query and opened the editor.')).toBeVisible({ timeout: 10000 });

    const canvas = page.locator('[data-ui-target="workspace_canvas"]');
    await expect(canvas).toBeVisible({ timeout: 10000 });
    await expect(canvas.getByRole('button', { name: /^query 1$/i })).toBeVisible({ timeout: 10000 });
    const box = await canvas.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(100);
  });

  test('chat send failure leaves an assistant error state and restores the composer for another attempt', async ({ page }) => {
    await openChatWithRoutes(page, async () => routeChatStream(page, [], { status: 500 }));

    await sendPrompt(page, 'This should fail');

    await expect(page.getByText('This should fail')).toBeVisible();
    await expect(page.getByText(/server is experiencing issues/i)).toBeVisible({ timeout: 10000 });

    const input = activeChatInput(page);
    const composer = input.locator('xpath=ancestor::form[1]');
    const sendButton = composer.getByRole('button', { name: /^send message$/i });
    await expect(sendButton).toBeDisabled();
    await expect(input).toBeEnabled();
    await input.fill('Recovered prompt');
    await expect(input).toHaveValue('Recovered prompt');
    await expect(sendButton).toBeEnabled();
  });

  test('query execution confirmation can be cancelled without calling the API, then surfaces API failure on confirm', async ({ page }) => {
    let queryCalls = 0;
    await openChatWithRoutes(page, async () => {
      await page.route('**/api/v1/run_sql_query', async (route) => {
        queryCalls += 1;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'error', message: 'database refused query' }),
        });
      });
    }, {
      'user/settings': {
        status: 200,
        body: {
          status: 'success',
          settings: {
            confirmBeforeRun: true,
            maxRows: 1000,
            queryTimeout: 30,
            llmProvider: 'openai',
            llmModel: 'gpt-4o',
          },
        },
      },
      'get_conversation/conv-1': {
        status: 200,
        body: SQL_CONVERSATION,
      },
    });

    await page.getByText('Sales Analysis').first().click();
    await page.waitForURL('**/chat/conv-1', { timeout: 8000 });
    await expect(page.getByText('Use this query:')).toBeVisible({ timeout: 10000 });

    const runButton = page.getByLabel(/^run query$/i).first();
    await runButton.click();

    const dialog = page.getByRole('dialog', { name: /run query/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).not.toBeVisible();
    expect(queryCalls).toBe(0);

    await runButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^run query$/i }).click();

    await expect.poll(() => queryCalls).toBe(1);
    await expect(page.getByText(/failed to execute query/i)).toBeVisible({ timeout: 10000 });
  });
});
