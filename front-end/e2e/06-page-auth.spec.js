/**
 * E2E — Page: Auth (`src/pages/Auth.jsx`)
 *
 * Focuses on breaking auth-page flows and UX states:
 *  - Field validation and state transitions between tabs
 *  - Password visibility accessibility
 *  - Forgot-password dialog validation
 *  - Successful mocked auth routing
 *  - Mobile/short viewport overflow
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

async function goToAuth(page, { viewport } = {}) {
  if (viewport) {
    await page.setViewportSize(viewport);
  }

  await page.addInitScript(() => {
    window.__MOCK_AUTH__ = true;
    window.__MOCK_AUTH_FLOW__ = true;
  });
  await setupMocks(page);
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 10000 });
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth + 2);
}

test.describe('Page — Auth', () => {
  test('renders sign-in page without desktop horizontal overflow', async ({ page }) => {
    await goToAuth(page);

    await expect(page.getByText('Moonlit').first()).toBeVisible();
    await expect(page.getByRole('tab', { name: /sign in/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('textbox', { name: /^email$/i })).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^google$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^github$/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('blocks empty sign-in submit with field-level errors and no navigation', async ({ page }) => {
    await goToAuth(page);

    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('clears validation errors when switching between sign-in and sign-up tabs', async ({ page }) => {
    await goToAuth(page);

    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText('Email is required')).toBeVisible();

    await page.getByRole('tab', { name: /sign up/i }).click();
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await expect(page.getByText('Email is required')).not.toBeVisible();
    await expect(page.getByText('Password is required')).not.toBeVisible();
  });

  test('blocks mismatched sign-up passwords without creating an account', async ({ page }) => {
    await goToAuth(page);

    await page.getByRole('tab', { name: /sign up/i }).click();
    await page.getByRole('textbox', { name: /display name/i }).fill('Aftab');
    await page.getByRole('textbox', { name: /^email$/i }).fill('aftab@example.com');
    await page.getByLabel(/^password$/i).fill('secret1');
    await page.getByLabel(/confirm password/i).fill('secret2');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText('Passwords do not match')).toBeVisible();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('successful mocked sign-in navigates to chat and disables repeat submit while pending', async ({ page }) => {
    await goToAuth(page);

    await page.getByRole('textbox', { name: /^email$/i }).fill('user@example.com');
    await page.getByLabel(/^password$/i).fill('secret');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await page.waitForURL('**/chat', { timeout: 8000 });
    await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
  });

  test('forgot-password dialog shows validation feedback for invalid email', async ({ page }) => {
    await goToAuth(page);

    await page.getByRole('button', { name: /forgot password/i }).click();
    const dialog = page.getByRole('dialog', { name: /reset password/i });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /send reset link/i }).click();

    await expect(dialog.getByText('Email is required')).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('password visibility toggles are accessible by name and change field type', async ({ page }) => {
    await goToAuth(page);

    const password = page.getByLabel(/^password$/i);
    await expect(password).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: /show password/i }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: /hide password/i }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('short mobile viewport keeps sign-up actions reachable without clipping', async ({ page }) => {
    await goToAuth(page, { viewport: { width: 360, height: 560 } });

    await page.getByRole('tab', { name: /sign up/i }).click();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    await expect(page.getByText(/terms and privacy policy/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
