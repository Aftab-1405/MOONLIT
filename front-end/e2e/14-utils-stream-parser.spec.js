/**
 * E2E — stream parser (`src/utils/streamParser.js`)
 *
 * Covers malformed and boundary SSE payloads through the real chat streaming UI.
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

async function setupStreamPage(page, streamBody) {
  await page.addInitScript(() => {
    window.__MOCK_AUTH__ = true;
  });
  await setupMocks(page, {
    'user/settings': {
      status: 200,
      body: {
        status: 'success',
        settings: {
          confirmBeforeRun: false,
          maxRows: 1000,
          queryTimeout: 30,
          llmProvider: 'openai',
          llmModel: 'gpt-4o',
        },
      },
    },
  });
  await page.route('**/api/v1/pass_user_prompt_to_llm', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: {
        'X-Conversation-Id': 'stream-parser-boundary',
      },
      body: streamBody,
    });
  });
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

test.describe('stream parser boundaries', () => {
  test('renders a final SSE event when the stream closes without a trailing newline', async ({ page }) => {
    await setupStreamPage(
      page,
      'data: {"type":"token","content":"Final token without newline."}'
    );

    await openChat(page);
    await sendPrompt(page, 'Stream without trailing newline');

    await page.waitForURL('**/chat/stream-parser-boundary', { timeout: 8000 });
    await expect(page.getByText('Final token without newline.')).toBeVisible({ timeout: 10000 });
  });
});
