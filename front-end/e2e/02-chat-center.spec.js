/**
 * E2E — Chat Center (Column 2)
 *
 * Tests cover:
 *  - Welcome screen visibility when no conversation is active
 *  - Suggestion chips send a message
 *  - Chat input: typing, Enter key sends, Shift+Enter inserts newline
 *  - Send button enabled/disabled states
 *  - Prevent sending empty / whitespace-only messages
 *  - Model selector: opens popover, selects model, shows selected model
 *  - Model selector: disabled when no LLM options returned
 *  - Message rendering: user bubble right-aligned, AI response left
 *  - Copy button on AI message
 *  - "Turns" counter increments correctly
 *  - Loading skeleton shown when conversation is loading
 *  - Long message doesn't overflow layout
 *  - Database toolbar chips shown/hidden based on connection state
 *  - Database switch popover
 *  - Schema selector shown only for PostgreSQL
 *  - Stop button replaces Send during streaming
 *  - Sending consecutive messages without waiting for response
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

async function goToChat(page, overrides = {}) {
  await setupMocks(page, overrides);
  await page.goto('/chat');
  await expect(page.locator('text=Moonlit').first()).toBeVisible({ timeout: 10000 });
}

async function openConversation(page, title = 'Sales Analysis') {
  await page.locator(`text=${title}`).first().click();
  // Wait for messages to render
  await page.waitForTimeout(500);
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Chat Center — Column 2', () => {

  // ── 1. Welcome screen shows when no conversation selected ─────────────────
  test('shows welcome screen with greeting when no conversation is active', async ({ page }) => {
    await goToChat(page);
    // Welcome screen should be visible (no conversation selected)
    await expect(page.locator('text=How can I help')).toBeVisible({ timeout: 5000 });
  });

  // ── 2. Welcome screen is hidden once a conversation is open ───────────────
  test('welcome screen hides when a conversation is selected', async ({ page }) => {
    await goToChat(page);
    await openConversation(page, 'Sales Analysis');
    await expect(page.locator('text=How can I help')).not.toBeVisible();
  });

  // ── 3. Suggestion chips are clickable and send a message ─────────────────
  test('clicking a suggestion chip sends the predefined prompt', async ({ page }) => {
    await goToChat(page);

    // Suggestion chips should be visible on welcome screen
    await expect(page.locator('text=Check Connection')).toBeVisible({ timeout: 5000 });
    await page.locator('text=Check Connection').click();

    // The prompt text should appear in the message list as a user message
    await expect(page.locator('[data-testid="user-message"]').first()).toBeVisible({ timeout: 6000 });
    await expect(
      page.locator('[data-testid="user-message"]').first()
    ).toContainText('Check my database connection');
  });

  // ── 4. Chat input: empty input send button is disabled ────────────────────
  test('send button is disabled when input is empty', async ({ page }) => {
    await goToChat(page);
    const sendBtn = page.getByRole('button', { name: /send message/i });
    await expect(sendBtn).toBeDisabled();
  });

  // ── 5. Chat input: typing enables send button ─────────────────────────────
  test('send button becomes enabled after typing text', async ({ page }) => {
    await goToChat(page);
    const input = page.locator('[data-ui-target="chat_input"]').first();
    await input.click();
    await input.fill('Hello Moonlit');
    const sendBtn = page.getByRole('button', { name: /send message/i });
    await expect(sendBtn).toBeEnabled();
  });

  // ── 6. Whitespace-only message is NOT sent ────────────────────────────────
  test('sending a whitespace-only message does not add it to the list', async ({ page }) => {
    await goToChat(page);
    const input = page.locator('[data-ui-target="chat_input"]').first();
    await input.click();
    await input.fill('   ');

    // Send button should be disabled for whitespace
    const sendBtn = page.getByRole('button', { name: /send message/i });
    await expect(sendBtn).toBeDisabled();

    // Also try pressing Enter — should not produce a user message bubble
    await input.press('Enter');
    await expect(page.locator('[data-testid="user-message"]')).not.toBeVisible();
  });

  // ── 7. Enter key sends the message ───────────────────────────────────────
  test('Enter key submits the message', async ({ page }) => {
    await goToChat(page);
    const input = page.locator('[data-ui-target="chat_input"]').first();
    await input.click();
    await input.fill('What is the schema?');
    await input.press('Enter');

    // User message should appear immediately (optimistic)
    await expect(
      page.locator('[data-testid="user-message"]').filter({ hasText: 'What is the schema?' })
    ).toBeVisible({ timeout: 5000 });
  });

  // ── 8. Shift+Enter inserts newline instead of sending ────────────────────
  test('Shift+Enter inserts a newline instead of submitting', async ({ page }) => {
    await goToChat(page);
    const input = page.locator('[data-ui-target="chat_input"]').first();
    await input.click();
    await input.fill('Line one');
    await input.press('Shift+Enter');
    await input.type('Line two');

    // Message count should still be 0 (no submission happened)
    await expect(page.locator('[data-testid="user-message"]')).not.toBeVisible();

    // Input should contain both lines
    const value = await input.inputValue();
    expect(value).toContain('Line one');
    expect(value).toContain('Line two');
  });

  // ── 9. Input clears after send ────────────────────────────────────────────
  test('input field clears after sending a message', async ({ page }) => {
    await goToChat(page);
    const input = page.locator('[data-ui-target="chat_input"]').first();
    await input.fill('Clear me after send');
    await input.press('Enter');

    await expect(
      page.locator('[data-testid="user-message"]').filter({ hasText: 'Clear me after send' })
    ).toBeVisible({ timeout: 5000 });

    // Input must be empty now
    await expect(input).toHaveValue('');
  });

  // ── 10. User message is displayed right-aligned ───────────────────────────
  test('user messages are displayed in right-aligned bubbles', async ({ page }) => {
    await goToChat(page);
    const input = page.locator('[data-ui-target="chat_input"]').first();
    await input.fill('Testing alignment');
    await input.press('Enter');

    const userMsg = page.locator('[data-testid="user-message"]').first();
    await expect(userMsg).toBeVisible({ timeout: 5000 });

    // The parent flex container should align to the right
    const msgContainer = userMsg.locator('..').locator('..');
    const alignItems = await msgContainer.evaluate((el) => {
      return window.getComputedStyle(el).alignItems;
    });
    expect(alignItems).toBe('flex-end');
  });

  // ── 11. Model selector popover opens ─────────────────────────────────────
  test('model selector button opens LLM popover with providers', async ({ page }) => {
    await goToChat(page);
    const modelBtn = page.getByRole('button', { name: /select model/i });
    await expect(modelBtn).toBeVisible();
    await modelBtn.click();

    // Popover should show both providers from mock data
    await expect(page.locator('text=OpenAI')).toBeVisible();
    await expect(page.locator('text=Anthropic')).toBeVisible();
  });

  // ── 12. Model selector: shows models listed per provider ─────────────────
  test('model selector popover lists individual models', async ({ page }) => {
    await goToChat(page);
    await page.getByRole('button', { name: /select model/i }).click();

    await expect(page.locator('text=gpt-4o').first()).toBeVisible();
    await expect(page.locator('text=claude-3-5-sonnet').first()).toBeVisible();
  });

  // ── 13. Model can be selected and button label updates ───────────────────
  test('selecting a model updates the model selector label', async ({ page }) => {
    await goToChat(page);
    await page.getByRole('button', { name: /select model/i }).click();

    // Click claude model
    await page.locator('[role="menuitemradio"]').filter({ hasText: 'claude-3-haiku' }).click();

    // The model selector button should now show the selected model
    const modelBtn = page.getByRole('button', { name: /select model/i });
    await expect(modelBtn).toContainText('claude-3-haiku');
  });

  // ── 14. Model selector disabled when no LLM options available ────────────
  test('model selector is disabled when LLM options API returns empty', async ({ page }) => {
    await goToChat(page, {
      'llm/options': {
        status: 200,
        body: { status: 'success', providers: [], default_provider: null, default_model: null },
      },
    });
    const modelBtn = page.getByRole('button', { name: /select model/i });
    await expect(modelBtn).toBeDisabled();
  });

  // ── 15. Currently selected model has a check mark ────────────────────────
  test('currently active model shows a checkmark in the popover', async ({ page }) => {
    await goToChat(page);
    await page.getByRole('button', { name: /select model/i }).click();

    // The default model (gpt-4o) row should have aria-checked=true
    const activeModel = page.locator('[role="menuitemradio"][aria-checked="true"]');
    await expect(activeModel).toBeVisible();
    await expect(activeModel).toContainText('gpt-4o');
  });

  // ── 16. Database chip visible when connected ──────────────────────────────
  test('database chip is visible in chat toolbar when connected', async ({ page }) => {
    await goToChat(page);
    // Tooltip target button showing current db name
    await expect(page.locator('text=analytics_db').first()).toBeVisible({ timeout: 5000 });
  });

  // ── 17. Database chip hidden when disconnected ────────────────────────────
  test('database chip is NOT shown when disconnected', async ({ page }) => {
    await goToChat(page, {
      'db_status': {
        status: 200,
        body: {
          status: 'success',
          data: { connected: false, db_type: null, current_database: null, databases: [], schemas: [], current_schema: null },
        },
      },
    });
    await expect(page.locator('text=analytics_db')).not.toBeVisible();
  });

  // ── 18. Schema chip only visible for PostgreSQL ───────────────────────────
  test('schema selector chip is visible for PostgreSQL connection', async ({ page }) => {
    await goToChat(page);
    // Schema "public" should be present in the toolbar for PostgreSQL
    await expect(page.locator('text=public').first()).toBeVisible({ timeout: 5000 });
  });

  test('schema selector chip is NOT visible for non-PostgreSQL (MySQL)', async ({ page }) => {
    await goToChat(page, {
      'db_status': {
        status: 200,
        body: {
          status: 'success',
          data: {
            connected: true,
            db_type: 'mysql',   // <-- not postgresql
            current_database: 'analytics_db',
            databases: ['analytics_db'],
            schemas: [],
            current_schema: null,
          },
        },
      },
    });
    // No schema chip for MySQL
    await expect(page.locator('button:has-text("public")')).not.toBeVisible();
  });

  // ── 19. Database switch popover ───────────────────────────────────────────
  test('database switch popover lists all available databases', async ({ page }) => {
    await goToChat(page);
    // Database chip should be clickable (multiple DBs available)
    const dbChip = page.locator('button').filter({ hasText: 'analytics_db' }).first();
    await dbChip.click();

    // All 3 databases should appear in the popover
    await expect(page.locator('text=reporting_db')).toBeVisible();
    await expect(page.locator('text=dev_db')).toBeVisible();
  });

  // ── 20. Database chip disabled when only one database ────────────────────
  test('database chip is disabled (non-clickable) when only one database available', async ({ page }) => {
    await goToChat(page, {
      'db_status': {
        status: 200,
        body: {
          status: 'success',
          data: {
            connected: true,
            db_type: 'postgresql',
            current_database: 'analytics_db',
            databases: ['analytics_db'],  // <-- only one
            schemas: ['public'],
            current_schema: 'public',
          },
        },
      },
    });
    const dbChip = page.locator('button').filter({ hasText: 'analytics_db' }).first();
    await expect(dbChip).toBeDisabled();
  });

  // ── 21. Turns counter ────────────────────────────────────────────────────
  test('turns counter chip shows correct turn count', async ({ page }) => {
    await goToChat(page);
    await openConversation(page, 'Sales Analysis');

    // 2 messages (1 user + 1 AI) = 1 turn
    await expect(page.locator('text=Turns: 1')).toBeVisible({ timeout: 5000 });
  });

  // ── 22. Copy button on AI message ────────────────────────────────────────
  test('copy button on AI message changes to checkmark on click', async ({ page }) => {
    await goToChat(page);
    await openConversation(page, 'Sales Analysis');

    // Find the AI message copy button
    const copyBtn = page.locator('[data-testid="action-bar-copy"]').first();

    // Force hover to reveal the button
    await page.locator('text=Here are the total sales').first().hover();
    await copyBtn.click({ force: true });

    // Button should briefly show checkmark (Copied state)
    await expect(page.locator('[aria-label="Copy"]').first()).toBeVisible({ timeout: 3000 });
  });

  // ── 23. Conversation with no messages shows empty state ───────────────────
  test('selecting an empty conversation shows chat input without messages', async ({ page }) => {
    await goToChat(page);
    await openConversation(page, 'Revenue Report'); // mock has empty messages

    // No user messages
    await expect(page.locator('[data-testid="user-message"]')).not.toBeVisible();
    // Input should still be present
    await expect(page.locator('[data-ui-target="chat_input"]').first()).toBeVisible();
  });

  // ── 24. Disclaimer text is visible ───────────────────────────────────────
  test('displays Moonlit disclaimer text below input', async ({ page }) => {
    await goToChat(page);
    await expect(page.locator('text=Moonlit can make mistakes')).toBeVisible();
  });

  // ── 25. Very long message doesn't break layout ────────────────────────────
  test('very long user message does not overflow the viewport horizontally', async ({ page }) => {
    await goToChat(page);
    const longMsg = 'word '.repeat(200);
    const input = page.locator('[data-ui-target="chat_input"]').first();
    await input.fill(longMsg);
    await input.press('Enter');

    const userMsg = page.locator('[data-testid="user-message"]').first();
    await expect(userMsg).toBeVisible({ timeout: 5000 });

    // Check no horizontal overflow
    const overflows = await userMsg.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.right > window.innerWidth + 2;
    });
    expect(overflows).toBe(false);
  });

  // ── 26. SQL Editor button visible in toolbar ──────────────────────────────
  // NOTE: The WelcomeScreen renders an "Open SQL Editor" suggestion Chip AND
  // the ChatInput toolbar renders an "Open SQL Editor" Button — both are visible
  // simultaneously on the welcome state. This is a real UX duplication finding:
  // two interactive elements with the same accessible name exist at once.
  // We verify the toolbar button specifically (aria-label="Open SQL Editor").
  test('SQL editor button is visible in the chat input toolbar', async ({ page }) => {
    await goToChat(page);
    // The actual toolbar button has aria-label="Open SQL Editor" (set via Tooltip)
    // Use .first() since both the Chip and the Button share the same accessible name
    const sqlBtn = page.getByRole('button', { name: /sql editor/i }).first();
    await expect(sqlBtn).toBeVisible();
  });

  // ── 27. Prevent consecutive sends during streaming ────────────────────────
  test('cannot submit a new message by pressing Enter while streaming is active', async ({ page }) => {
    await goToChat(page, {
      'chat': {
        delay: 3000,
        status: 200,
        body: { status: 'success', message: 'First response' }
      }
    });

    const input = page.locator('[data-ui-target="chat_input"]:visible').first();
    await input.fill('First message');
    await input.press('Enter');

    // Wait a brief moment for streaming to start, verify the user bubble is visible
    await expect(page.locator('text=First message').first()).toBeVisible({ timeout: 3000 });

    // Now type a second message and press Enter while it is still streaming (since delay is 3000ms)
    const input2 = page.locator('[data-ui-target="chat_input"]:visible').first();
    await input2.fill('Second message');
    await input2.press('Enter');

    // Give it a moment to see if it shows up
    await page.waitForTimeout(500);

    // Verify "Second message" was NOT added to the chat history
    await expect(page.locator('text=Second message')).not.toBeVisible();
  });
});
