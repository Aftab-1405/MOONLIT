/**
 * E2E — Shared Components (`src/components`)
 *
 * These tests exercise common primitives through real application flows:
 *  - AppPopover: close/reset behavior and keyboard navigation
 *  - ConfirmDialog: async loading, close prevention, and failure feedback
 *  - DialogShell: modal close semantics in the database connection flow
 *  - ResizeHandle: pointer resize behavior and keyboard accessibility
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

async function goToChat(page, overrides = {}) {
  await setupMocks(page, overrides);
  await page.goto('/chat');
  await expect(page.locator('text=Moonlit').first()).toBeVisible({ timeout: 10000 });
}

async function openConversationMenu(page, title = 'Sales Analysis') {
  await page.locator(`text=${title}`).first().hover();
  await page.locator('.options-btn').first().click({ force: true });
}

async function openDeleteDialog(page, title = 'Sales Analysis') {
  await openConversationMenu(page, title);
  await page.getByRole('menuitem', { name: /delete/i }).click();
  await expect(page.getByRole('dialog', { name: /delete conversation/i })).toBeVisible();
}

async function openSqlEditor(page) {
  await page.getByLabel('Open SQL Editor').click();
  const canvas = page.locator('[data-ui-target="workspace_canvas"]');
  await expect(canvas).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('separator', { name: /resize panels/i })).toBeVisible({ timeout: 5000 });
  return canvas;
}

test.describe('Shared components — AppPopover', () => {
  test('search popover closes on Escape and clears stale query before reopening', async ({ page }) => {
    await goToChat(page);

    await page.getByRole('button', { name: /search/i }).click();
    const searchInput = page.getByPlaceholder('Search chats');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Schema');
    await expect(page.locator('.MuiPopover-paper').filter({ has: searchInput }).locator('text=Schema Explorer')).toBeVisible();

    await searchInput.press('Escape');
    await expect(searchInput).not.toBeVisible();

    await page.getByRole('button', { name: /search/i }).click();
    const reopenedSearchInput = page.getByPlaceholder('Search chats');
    await expect(reopenedSearchInput).toBeVisible();
    await expect(reopenedSearchInput).toHaveValue('');
    await expect(page.locator('.MuiPopover-paper').filter({ has: reopenedSearchInput }).locator('text=Sales Analysis')).toBeVisible();
  });

  test('model popover supports arrow-key selection and returns focus to trigger', async ({ page }) => {
    await goToChat(page);

    const modelButton = page.getByRole('button', { name: /select model/i });
    await modelButton.click();

    const activeModel = page.locator('[role="menuitemradio"][aria-checked="true"]');
    await expect(activeModel).toContainText('gpt-4o');
    await activeModel.press('ArrowDown');
    await expect(page.locator('[role="menuitemradio"]').filter({ hasText: 'gpt-4o-mini' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(modelButton).toContainText('gpt-4o-mini');
    await expect(page.locator('[role="menu"]', { hasText: 'gpt-4o-mini' })).not.toBeVisible();
    await expect(modelButton).toBeFocused();
  });
});

test.describe('Shared components — ConfirmDialog', () => {
  test('delete dialog prevents accidental close while async confirmation is pending', async ({ page }) => {
    await goToChat(page, {
      delete_conversation: {
        delay: 1500,
        status: 200,
        body: { status: 'success' },
      },
    });

    await openDeleteDialog(page);
    await page.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.getByRole('button', { name: /deleting/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /delete conversation/i })).toBeVisible();

    await expect(page.locator('text=Sales Analysis')).not.toBeVisible({ timeout: 6000 });
  });

  test('delete failure keeps destructive dialog open and gives recoverable feedback', async ({ page }) => {
    await goToChat(page, {
      delete_conversation: {
        status: 500,
        body: { status: 'error', message: 'Failed to delete' },
      },
    });

    await openDeleteDialog(page);
    await page.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.getByRole('dialog', { name: /delete conversation/i })).toBeVisible();
    await expect(page.getByText(/failed to delete/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^delete$/i })).toBeEnabled();
    await expect(page.locator('text=Sales Analysis').first()).toBeVisible();
  });
});

test.describe('Shared components — DialogShell', () => {
  test('database connection dialog is labelled, dismissible with Escape, and restores focus', async ({ page }) => {
    await goToChat(page, {
      db_status: {
        status: 200,
        body: {
          status: 'success',
          data: { connected: false, db_type: null, current_database: null, databases: [], schemas: [], current_schema: null },
        },
      },
    });

    const databaseButton = page.locator('[data-ui-target="database_button"]').first();
    await databaseButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/connect/i);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(databaseButton).toBeFocused();
  });
});

test.describe('Shared components — ResizeHandle', () => {
  test('dragging the workspace resize handle changes width and restores document interaction state', async ({ page }) => {
    await goToChat(page);
    const canvas = await openSqlEditor(page);
    const handle = page.getByRole('separator', { name: /resize panels/i });

    const initialBox = await canvas.boundingBox();
    const handleBox = await handle.boundingBox();
    expect(initialBox?.width ?? 0).toBeGreaterThan(100);
    expect(handleBox).toBeTruthy();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 160, handleBox.y + handleBox.height / 2, { steps: 6 });
    await page.mouse.up();

    const resizedBox = await canvas.boundingBox();
    expect(Math.abs((resizedBox?.width ?? 0) - (initialBox?.width ?? 0))).toBeGreaterThan(40);

    const bodyInteractionState = await page.evaluate(() => ({
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    }));
    expect(bodyInteractionState).toEqual({ cursor: '', userSelect: '' });
  });

  test('resize separator is keyboard-focusable and resizes with arrow keys', async ({ page }) => {
    await goToChat(page);
    const canvas = await openSqlEditor(page);
    const handle = page.getByRole('separator', { name: /resize panels/i });

    await handle.focus();
    await expect(handle).toBeFocused();
    const initialBox = await canvas.boundingBox();

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');

    const resizedBox = await canvas.boundingBox();
    expect(Math.abs((resizedBox?.width ?? 0) - (initialBox?.width ?? 0))).toBeGreaterThan(1);
  });
});
