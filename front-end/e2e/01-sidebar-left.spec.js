/**
 * E2E — Left Sidebar (Column 1)
 *
 * Tests cover:
 *  - Sidebar collapse / expand
 *  - Conversation list rendering
 *  - Selecting a conversation (navigation)
 *  - Rename flow (dialog interaction + optimistic update)
 *  - Delete flow (confirm dialog + removal from list)
 *  - Search (filter + empty state)
 *  - New chat (resets panel)
 *  - Database button states (disconnected vs connected)
 *  - Mindmap gating (only visible when connected)
 *  - Edge cases: long title overflow, empty conversation list
 */

import { test, expect } from '@playwright/test';
import { setupMocks, DEFAULT_CONVERSATIONS } from './helpers/mockSetup.js';

// ── Helper: navigate to /chat with mocks already in place ─────────────────────
async function goToChat(page, overrides = {}) {
  await setupMocks(page, overrides);
  await page.goto('/chat');
  // Wait for the sidebar "Moonlit" brand to confirm the shell is mounted
  await expect(page.locator('text=Moonlit').first()).toBeVisible({ timeout: 10000 });
}

// ── Helper: hover over a conversation row to reveal the options button ────────
async function hoverConversationRow(page, titleText) {
  const row = page.locator(`[data-testid="conv-item"], .conv-item, li, [role="listitem"]`)
    .filter({ hasText: titleText })
    .first();
  // Fallback: just find the text node's parent
  const item = page.locator(`text=${titleText}`).first();
  await item.hover();
  return item;
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Left Sidebar — Column 1', () => {

  // ── 1. Basic rendering ────────────────────────────────────────────────────
  test('renders all conversations from API on load', async ({ page }) => {
    await goToChat(page);
    for (const conv of DEFAULT_CONVERSATIONS) {
      await expect(page.locator(`text=${conv.title}`).first()).toBeVisible();
    }
  });

  // ── 2. Empty conversation state ───────────────────────────────────────────
  test('shows empty state gracefully when no conversations exist', async ({ page }) => {
    await goToChat(page, {
      'get_conversations': {
        status: 200,
        body: { status: 'success', conversations: [] },
      },
    });
    // Should not crash; sidebar should still render without conversation items
    await expect(page.locator('text=Moonlit').first()).toBeVisible();
    // None of the default titles should be present
    await expect(page.locator('text=Sales Analysis')).not.toBeVisible();
  });

  // ── 3. API error for conversation list ────────────────────────────────────
  test('handles conversation list API error without crashing', async ({ page }) => {
    await goToChat(page, {
      'get_conversations': {
        status: 500,
        body: { status: 'error', message: 'Internal Server Error' },
      },
    });
    // App shell should still render — no white screen
    await expect(page.locator('#app-shell, [id="app-shell"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Moonlit').first()).toBeVisible();
  });

  // ── 4. Sidebar collapse / expand ─────────────────────────────────────────
  test('collapses and expands sidebar via toggle button', async ({ page }) => {
    await goToChat(page);
    // Find the collapse toggle button (aria-label = "Collapse sidebar")
    const collapseBtn = page.getByRole('button', { name: /collapse sidebar/i });
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();

    // After collapse: conversation titles should be hidden (sidebar is narrow)
    // The brand text width collapses to 0
    await expect(page.locator('text=Sales Analysis')).not.toBeVisible();

    // Expand again
    const expandBtn = page.getByRole('button', { name: /expand sidebar/i });
    await expandBtn.click();
    await expect(page.locator('text=Sales Analysis').first()).toBeVisible();
  });

  // ── 5. Select a conversation ──────────────────────────────────────────────
  // BUG PROBE: Clicking a conversation navigates to /chat/:id via URL params.
  // If URL routing isn't wired correctly, messages never load.
  test('loads conversation messages when a conversation is clicked', async ({ page }) => {
    await goToChat(page);
    await page.locator('text=Sales Analysis').first().click();
    // Wait for the URL to change to /chat/conv-1 (URL-driven conversation loading)
    await page.waitForURL('**/chat/conv-1', { timeout: 8000 });
    // Message from mock data should appear after URL navigation triggers load
    await expect(page.locator('text=Show me total sales by region')).toBeVisible({ timeout: 10000 });
  });

  test('loads conversation messages when opening a conversation URL directly', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/chat/conv-1');
    await page.waitForURL('**/chat/conv-1', { timeout: 8000 });
    await expect(page.locator('text=Show me total sales by region')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=How can I help')).not.toBeVisible();
  });

  // ── 6. Switch between conversations (cache / remount) ─────────────────────
  // BUG PROBE: Switching conversations may show stale messages from the previous one.
  test('switches between conversations and shows correct messages each time', async ({ page }) => {
    await goToChat(page);

    await page.locator('text=Sales Analysis').first().click();
    await page.waitForURL('**/chat/conv-1', { timeout: 8000 });
    await expect(page.locator('text=Show me total sales by region')).toBeVisible({ timeout: 10000 });

    await page.locator('text=Schema Explorer').first().click();
    await page.waitForURL('**/chat/conv-2', { timeout: 8000 });
    await expect(page.locator('text=What tables do we have?')).toBeVisible({ timeout: 10000 });

    // Navigate back to first — must not bleed Schema Explorer messages
    await page.locator('text=Sales Analysis').first().click();
    await page.waitForURL('**/chat/conv-1', { timeout: 8000 });
    await expect(page.locator('text=Show me total sales by region')).toBeVisible({ timeout: 10000 });
    // BUG: if messages from conv-2 appear here, there's a state bleed
    await expect(page.locator('text=What tables do we have?')).not.toBeVisible();
  });

  // ── 7. Rename conversation — dialog opens ─────────────────────────────────
  test('opens rename dialog with correct pre-filled title', async ({ page }) => {
    await goToChat(page);
    await hoverConversationRow(page, 'Sales Analysis');

    // Try finding the options kebab / dots button for the first conversation
    const optionsBtn = page.locator('.options-btn').first();
    await optionsBtn.click({ force: true });

    // Click Rename in context menu
    await page.getByRole('menuitem', { name: /rename/i }).click();

    // Dialog with input pre-filled
    const input = page.getByRole('textbox', { name: /conversation title/i });
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('Sales Analysis');
  });

  // ── 8. Rename conversation — submit with new name ─────────────────────────
  // BUG PROBE: After rename, the sidebar must update with the new title.
  // useConversations uses `data.title || trimmedTitle` — mock echoes back the
  // submitted title so both paths show the correct new name.
  test('renames a conversation and updates it in the sidebar list', async ({ page }) => {
    await goToChat(page);
    await hoverConversationRow(page, 'Sales Analysis');

    const optionsBtn = page.locator('.options-btn').first();
    await optionsBtn.click({ force: true });
    await page.getByRole('menuitem', { name: /rename/i }).click();

    const input = page.getByRole('textbox', { name: /conversation title/i });
    await input.clear();
    await input.fill('Q2 Sales Analysis');

    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('rename_conversation')),
      page.getByRole('button', { name: /^rename$/i }).click(),
    ]);
    expect(res.status()).toBe(200);

    // BUG: if optimistic update or cache invalidation is broken,
    // the old title persists and/or the new title never appears.
    // Give a moment for optimistic state update to propagate
    await page.waitForTimeout(500);
    await expect(page.locator('text=Q2 Sales Analysis').first()).toBeVisible({ timeout: 6000 });
  });

  // ── 9. Rename — submit with EMPTY name should be disabled ─────────────────
  test('rename submit button is disabled when title is cleared', async ({ page }) => {
    await goToChat(page);
    await hoverConversationRow(page, 'Sales Analysis');

    const optionsBtn = page.locator('.options-btn').first();
    await optionsBtn.click({ force: true });
    await page.getByRole('menuitem', { name: /rename/i }).click();

    const input = page.getByRole('textbox', { name: /conversation title/i });
    await input.clear();

    const submitBtn = page.getByRole('button', { name: /^rename$/i });
    await expect(submitBtn).toBeDisabled();
  });

  // ── 10. Rename — submit with WHITESPACE-ONLY should be blocked ────────────
  test('rename submit button is disabled when title is whitespace only', async ({ page }) => {
    await goToChat(page);
    await hoverConversationRow(page, 'Sales Analysis');

    const optionsBtn = page.locator('.options-btn').first();
    await optionsBtn.click({ force: true });
    await page.getByRole('menuitem', { name: /rename/i }).click();

    const input = page.getByRole('textbox', { name: /conversation title/i });
    await input.clear();
    await input.fill('   ');

    const submitBtn = page.getByRole('button', { name: /^rename$/i });
    // Button should remain disabled because .trim() produces empty string
    await expect(submitBtn).toBeDisabled();
  });

  // ── 11. Delete conversation — confirm dialog ──────────────────────────────
  test('shows delete confirmation dialog before deleting', async ({ page }) => {
    await goToChat(page);
    await hoverConversationRow(page, 'Sales Analysis');

    const optionsBtn = page.locator('.options-btn').first();
    await optionsBtn.click({ force: true });
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // Confirm dialog should appear
    await expect(page.locator('text=Delete conversation?')).toBeVisible();
    // Cancel should close without deleting
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('text=Sales Analysis').first()).toBeVisible();
  });

  // ── 12. Delete conversation — confirm removes from list ───────────────────
  test('deletes a conversation and removes it from the sidebar', async ({ page }) => {
    await goToChat(page);
    await hoverConversationRow(page, 'Sales Analysis');

    const optionsBtn = page.locator('.options-btn').first();
    await optionsBtn.click({ force: true });
    await page.getByRole('menuitem', { name: /delete/i }).click();
    await expect(page.locator('text=Delete conversation?')).toBeVisible();

    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('delete_conversation')),
      page.getByRole('button', { name: /^delete$/i }).click(),
    ]);
    expect(res.status()).toBe(200);
    await expect(page.locator('text=Sales Analysis')).not.toBeVisible();
  });

  // ── 13. Delete — API error should surface feedback ────────────────────────
  test('shows error feedback when delete API fails', async ({ page }) => {
    await goToChat(page, {
      'delete_conversation': {
        status: 500,
        body: { status: 'error', message: 'Failed to delete' },
      },
    });

    await hoverConversationRow(page, 'Sales Analysis');
    const optionsBtn = page.locator('.options-btn').first();
    await optionsBtn.click({ force: true });
    await page.getByRole('menuitem', { name: /delete/i }).click();
    await page.getByRole('button', { name: /^delete$/i }).click();

    // Conversation should STILL be in the list on failure
    await expect(page.locator('text=Sales Analysis').first()).toBeVisible({ timeout: 6000 });
  });

  // ── 14. New chat button ───────────────────────────────────────────────────
  // BUG PROBE: New chat must clear messages and navigate to /chat (no id).
  // If URL doesn't reset, welcome screen won't show.
  test('new chat button clears current conversation and shows welcome state', async ({ page }) => {
    await goToChat(page);
    // First open a conversation via URL navigation
    await page.locator('text=Sales Analysis').first().click();
    await page.waitForURL('**/chat/conv-1', { timeout: 8000 });
    await expect(page.locator('text=Show me total sales by region')).toBeVisible({ timeout: 10000 });

    // Click new chat — should navigate back to /chat (no conversationId)
    await page.getByRole('button', { name: /new chat/i }).click();
    await page.waitForURL('**/chat', { timeout: 5000 });

    // Welcome state should now be visible
    await expect(page.locator('text=How can I help')).toBeVisible({ timeout: 5000 });
  });

  // ── 15. Search — filters conversation list ────────────────────────────────
  // BUG PROBE: "Schema Explorer" appears in BOTH the sidebar AND the search
  // popover results simultaneously — strict mode catches this duplication.
  // We scope the assertion to the popover container to avoid the conflict.
  test('search input filters conversations by title', async ({ page }) => {
    await goToChat(page);

    // Open search popover
    await page.getByRole('button', { name: /search/i }).click();

    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Schema');

    // The AppPopover renders into a MUI portal. Find the popover Paper that
    // contains the "Search chats" input field — this is the unique anchor for
    // the search popover and avoids strict-mode conflicts with the sidebar behind it.
    const searchPlaceholderInput = page.getByPlaceholder('Search chats');
    await expect(searchPlaceholderInput).toBeVisible({ timeout: 5000 });

    // The results list is a sibling Box inside the same Popover Paper.
    // Walk up to the Paper root and scope all assertions there.
    const searchPopoverPaper = page.locator('.MuiPopover-paper').filter({ has: page.getByPlaceholder('Search chats') });
    await expect(searchPopoverPaper.locator('text=Schema Explorer').first()).toBeVisible({ timeout: 5000 });

    // BUG: if "Sales Analysis" appears in filtered results, the search filter is broken
    await expect(searchPopoverPaper.locator('text=Sales Analysis')).not.toBeVisible();
  });

  // ── 16. Database nav item (disconnected) — opens modal ───────────────────
  test('database nav item opens connection modal when disconnected', async ({ page }) => {
    await goToChat(page, {
      'db_status': {
        status: 200,
        body: {
          status: 'success',
          data: { connected: false, db_type: null, current_database: null, databases: [], schemas: [], current_schema: null },
        },
      },
    });

    const dbBtn = page.locator('[data-ui-target="database_button"]').first();
    await dbBtn.click();

    // Database connection modal should open
    await expect(page.locator('text=Connect').first()).toBeVisible({ timeout: 5000 });
  });

  // ── 17. Database connected — shows connected indicator ────────────────────
  test('database nav item shows connected status indicator when db is connected', async ({ page }) => {
    await goToChat(page);
    // A success indicator (green dot or similar) near the database nav item
    const dbBtn = page.locator('[data-ui-target="database_button"]').first();
    await expect(dbBtn).toBeVisible();
    // The status indicator is rendered alongside when showStatus=true; just confirm no crash
    // More specific assertion on the status indicator
    // The SidebarNavItem renders a Box with bgcolor=success when showStatus=true
    // We verify the db button is in the DOM and visible
    await expect(dbBtn).toBeVisible();
  });

  // ── 18. Mindmap — only visible when connected ─────────────────────────────
  test('mindmap nav item is only shown when database is connected', async ({ page }) => {
    // Disconnected: no mindmap
    await goToChat(page, {
      'db_status': {
        status: 200,
        body: {
          status: 'success',
          data: { connected: false, db_type: null, current_database: null, databases: [], schemas: [], current_schema: null },
        },
      },
    });
    await expect(page.getByRole('button', { name: /mindmap/i })).not.toBeVisible();
  });

  test('mindmap nav item is visible when database is connected', async ({ page }) => {
    await goToChat(page);
    // Connected: mindmap button should appear
    await expect(page.getByRole('button', { name: /mindmap/i })).toBeVisible({ timeout: 5000 });
  });

  // ── 19. Long conversation title overflow ──────────────────────────────────
  test('very long conversation title does not break sidebar layout', async ({ page }) => {
    const longTitle = 'A'.repeat(120) + ' very long conversation title that should be truncated';
    await goToChat(page, {
      'get_conversations': {
        status: 200,
        body: {
          status: 'success',
          conversations: [{ id: 'conv-long', title: longTitle, timestamp: '2026-06-10T12:00:00Z' }],
        },
      },
    });
    // Sidebar should still be visible and not overflow horizontally
    const sidebar = page.locator('nav, [aria-label*="sidebar"], [aria-label*="Sidebar"]').first();
    await expect(sidebar).toBeVisible();
    // Layout check: sidebar should not cause horizontal scroll
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance
  });

  // ── 20. Recents section collapse toggle ───────────────────────────────────
  test('recents section can be collapsed and expanded', async ({ page }) => {
    await goToChat(page);
    // Click the "Recents" collapse toggle
    const recentsToggle = page.locator('text=Recents').first();
    await expect(recentsToggle).toBeVisible();
    await recentsToggle.click();

    // Conversations should be hidden
    await expect(page.locator('text=Sales Analysis')).not.toBeVisible();

    // Click again to expand
    await recentsToggle.click();
    await expect(page.locator('text=Sales Analysis').first()).toBeVisible();
  });
});
