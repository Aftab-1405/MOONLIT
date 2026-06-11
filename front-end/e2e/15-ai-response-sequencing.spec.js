/**
 * E2E — AI response sequencing
 *
 * Validates that streamed reasoning/tool stages render before dependent final
 * response content and that reasoning/tool steps preserve SSE event order.
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

function sseBody(events) {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
}

async function setupSequencingPage(page, {
  events,
  conversationId = 'sequencing-conv',
  resumeEvents = null,
}) {
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
        'X-Conversation-Id': conversationId,
      },
      body: sseBody(events),
    });
  });
  if (resumeEvents) {
    await page.route('**/api/v1/resume_agent', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: {
          'X-Conversation-Id': conversationId,
        },
        body: sseBody(resumeEvents),
      });
    });
  }
}

async function openChat(page) {
  await page.goto('/chat');
  await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
}

function main(page) {
  return page.getByRole('main', { name: /chat workspace/i });
}

async function sendPrompt(page, prompt = 'Verify the AI step order') {
  const input = main(page).locator('[data-ui-target="chat_input"]').last();
  await input.fill(prompt);
  await input.press('Enter');
}

async function yPosition(locator) {
  await expect(locator).toBeVisible({ timeout: 10000 });
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return box.y;
}

async function expectVisuallyBefore(first, second) {
  expect(await yPosition(first)).toBeLessThan(await yPosition(second));
}

async function expandAllSteps(page) {
  const expandButtons = main(page).getByRole('button', { name: /expand reasoning steps/i });
  const collapseButtons = main(page).getByRole('button', { name: /collapse reasoning steps/i });
  if (await expandButtons.count() === 0) {
    await expect(collapseButtons.first()).toBeVisible({ timeout: 10000 });
    return;
  }
  while (await expandButtons.count()) {
    await expandButtons.first().click();
  }
}

async function expectStepOrder(page, labels) {
  await expandAllSteps(page);
  const positions = [];
  for (const label of labels) {
    positions.push(await yPosition(main(page).locator('.step-text', { hasText: label }).last()));
  }
  for (let i = 1; i < positions.length; i += 1) {
    expect(positions[i - 1]).toBeLessThan(positions[i]);
  }
}

const schemaToolStart = {
  type: 'tool_start',
  name: 'get_schema_overview',
  args: { database: 'analytics_db' },
};

const schemaToolEnd = {
  type: 'tool_end',
  name: 'get_schema_overview',
  args: { database: 'analytics_db' },
  result: { table_count: 2, tables: ['orders', 'customers'] },
};

const queryToolStart = {
  type: 'tool_start',
  name: 'execute_query',
  args: { query: 'SELECT COUNT(*) FROM orders;' },
};

const queryToolEnd = {
  type: 'tool_end',
  name: 'execute_query',
  args: { query: 'SELECT COUNT(*) FROM orders;' },
  result: { row_count: 1, total_rows: 1, columns: ['count'], data: [{ count: 42 }] },
};

test.describe.serial('AI response sequencing', () => {
  test('Reasoning → Final Response renders steps before final text', async ({ page }) => {
    await setupSequencingPage(page, {
      conversationId: 'seq-reasoning-final',
      events: [
        { type: 'thinking_token', content: 'Checking the sales question first.' },
        { type: 'token', content: 'Final answer after reasoning.' },
        { type: 'done' },
      ],
    });

    await openChat(page);
    await sendPrompt(page);
    await page.waitForURL('**/chat/seq-reasoning-final', { timeout: 8000 });

    await expectVisuallyBefore(
      main(page).getByText(/reasoned through the request/i).last(),
      main(page).getByText('Final answer after reasoning.').last()
    );
  });

  test('Tool Call → Final Response renders tool step before final text', async ({ page }) => {
    await setupSequencingPage(page, {
      conversationId: 'seq-tool-final',
      events: [
        schemaToolStart,
        schemaToolEnd,
        { type: 'token', content: 'Final answer after schema lookup.' },
        { type: 'done' },
      ],
    });

    await openChat(page);
    await sendPrompt(page);
    await page.waitForURL('**/chat/seq-tool-final', { timeout: 8000 });

    await expectVisuallyBefore(
      main(page).getByText(/fetched schema overview/i).last(),
      main(page).getByText('Final answer after schema lookup.').last()
    );
  });

  test('Reasoning → Tool Call → Final Response preserves expanded timeline order', async ({ page }) => {
    await setupSequencingPage(page, {
      conversationId: 'seq-reason-tool-final',
      events: [
        { type: 'thinking_token', content: 'Need schema details before answering.' },
        schemaToolStart,
        schemaToolEnd,
        { type: 'token', content: 'Final answer after reasoning and schema lookup.' },
        { type: 'done' },
      ],
    });

    await openChat(page);
    await sendPrompt(page);
    await page.waitForURL('**/chat/seq-reason-tool-final', { timeout: 8000 });

    await expectVisuallyBefore(
      main(page).getByText(/fetched schema overview/i).last(),
      main(page).getByText('Final answer after reasoning and schema lookup.').last()
    );
    await expandAllSteps(page);
    await expectVisuallyBefore(
      main(page).getByText('Need schema details before answering.').last(),
      main(page).locator('.step-text', { hasText: 'Fetched schema overview' }).last()
    );
  });

  test('Multiple Tool Calls → Final Response preserves tool execution order', async ({ page }) => {
    await setupSequencingPage(page, {
      conversationId: 'seq-multi-tool-final',
      events: [
        schemaToolStart,
        schemaToolEnd,
        queryToolStart,
        queryToolEnd,
        { type: 'token', content: 'Final answer after both tools.' },
        { type: 'done' },
      ],
    });

    await openChat(page);
    await sendPrompt(page);
    await page.waitForURL('**/chat/seq-multi-tool-final', { timeout: 8000 });

    await expectStepOrder(page, ['Fetched schema overview', 'Executed SQL query']);
    await expectVisuallyBefore(
      main(page).locator('.step-text', { hasText: 'Executed SQL query' }).last(),
      main(page).getByText('Final answer after both tools.').last()
    );
  });

  test('Reasoning → Multiple Tool Calls → Final Response preserves all step order', async ({ page }) => {
    await setupSequencingPage(page, {
      conversationId: 'seq-reason-multi-tool-final',
      events: [
        { type: 'thinking_token', content: 'First inspect schema, then run a count.' },
        schemaToolStart,
        schemaToolEnd,
        queryToolStart,
        queryToolEnd,
        { type: 'token', content: 'Final answer after complete tool chain.' },
        { type: 'done' },
      ],
    });

    await openChat(page);
    await sendPrompt(page);
    await page.waitForURL('**/chat/seq-reason-multi-tool-final', { timeout: 8000 });

    await expandAllSteps(page);
    await expectVisuallyBefore(
      main(page).getByText('First inspect schema, then run a count.').last(),
      main(page).locator('.step-text', { hasText: 'Fetched schema overview' }).last()
    );
    await expectStepOrder(page, ['Fetched schema overview', 'Executed SQL query']);
    await expectVisuallyBefore(
      main(page).locator('.step-text', { hasText: 'Executed SQL query' }).last(),
      main(page).getByText('Final answer after complete tool chain.').last()
    );
  });

  test('Tool Call → Reasoning → Final Response preserves non-default backend ordering', async ({ page }) => {
    await setupSequencingPage(page, {
      conversationId: 'seq-tool-reason-final',
      events: [
        schemaToolStart,
        schemaToolEnd,
        { type: 'thinking_token', content: 'Interpreting the schema result after the tool.' },
        { type: 'token', content: 'Final answer after post-tool reasoning.' },
        { type: 'done' },
      ],
    });

    await openChat(page);
    await sendPrompt(page);
    await page.waitForURL('**/chat/seq-tool-reason-final', { timeout: 8000 });

    await expandAllSteps(page);
    await expectVisuallyBefore(
      main(page).locator('.step-text', { hasText: 'Fetched schema overview' }).last(),
      main(page).getByText('Interpreting the schema result after the tool.').last()
    );
    await expectVisuallyBefore(
      main(page).getByText('Interpreting the schema result after the tool.').last(),
      main(page).getByText('Final answer after post-tool reasoning.').last()
    );
  });

  test('Interrupt → Resume → Final Response keeps pre-interrupt steps before resumed text', async ({ page }) => {
    await setupSequencingPage(page, {
      conversationId: 'seq-interrupt-resume',
      events: [
        { type: 'thinking_token', content: 'I need approval before running this query.' },
        {
          type: 'agent_interrupt',
          id: 'approval-1',
          payload: {
            action: 'execute_query',
            query: 'SELECT COUNT(*) FROM orders;',
            title: 'Approve query?',
            message: 'Allow this query to run?',
            confirmText: 'Approve',
            cancelText: 'Decline',
          },
        },
      ],
      resumeEvents: [
        queryToolStart,
        queryToolEnd,
        { type: 'token', content: 'Final answer after approval.' },
        { type: 'done' },
      ],
    });

    await openChat(page);
    await sendPrompt(page);
    await page.waitForURL('**/chat/seq-interrupt-resume', { timeout: 8000 });
    await page.getByRole('status').getByRole('button', { name: /approve/i }).click();

    await expect(page.getByText('Final answer after approval.')).toBeVisible({ timeout: 10000 });
    await expandAllSteps(page);
    await expectVisuallyBefore(
      main(page).getByText('I need approval before running this query.').last(),
      main(page).locator('.step-text', { hasText: 'Executed SQL query' }).last()
    );
    await expectVisuallyBefore(
      main(page).locator('.step-text', { hasText: 'Executed SQL query' }).last(),
      main(page).getByText('Final answer after approval.').last()
    );
  });

  test('Partial Response Streaming → Tool Call → Continued Response preserves text-tool-text chronology', async ({ page }) => {
    await setupSequencingPage(page, {
      conversationId: 'seq-partial-tool-continued',
      events: [
        { type: 'token', content: 'Partial answer before the tool. ' },
        schemaToolStart,
        schemaToolEnd,
        { type: 'token', content: 'Continued answer after the tool.' },
        { type: 'done' },
      ],
    });

    await openChat(page);
    await sendPrompt(page);
    await page.waitForURL('**/chat/seq-partial-tool-continued', { timeout: 8000 });

    const partialText = main(page).getByText('Partial answer before the tool.').last();
    const toolStep = main(page).getByText(/fetched schema overview/i).last();
    const continuedText = main(page).getByText('Continued answer after the tool.').last();

    await expectVisuallyBefore(partialText, toolStep);
    await expectVisuallyBefore(toolStep, continuedText);
  });

  test('Nested sequential tool chain keeps each result after its matching start and before final text', async ({ page }) => {
    const historyStart = {
      type: 'tool_start',
      name: 'get_query_history',
      args: { rationale: 'Need recent query context' },
    };
    const historyEnd = {
      type: 'tool_end',
      name: 'get_query_history',
      args: { rationale: 'Need recent query context' },
      result: { count: 3 },
    };

    await setupSequencingPage(page, {
      conversationId: 'seq-nested-tools',
      events: [
        { type: 'thinking_token', content: 'Resolve context, inspect schema, then query.' },
        historyStart,
        historyEnd,
        schemaToolStart,
        schemaToolEnd,
        queryToolStart,
        queryToolEnd,
        { type: 'token', content: 'Final answer after sequential tool chain.' },
        { type: 'done' },
      ],
    });

    await openChat(page);
    await sendPrompt(page);
    await page.waitForURL('**/chat/seq-nested-tools', { timeout: 8000 });

    await expectStepOrder(page, ['Get Query History', 'Fetched schema overview', 'Executed SQL query']);
    await expectVisuallyBefore(
      main(page).locator('.step-text', { hasText: 'Executed SQL query' }).last(),
      main(page).getByText('Final answer after sequential tool chain.').last()
    );
  });
});
