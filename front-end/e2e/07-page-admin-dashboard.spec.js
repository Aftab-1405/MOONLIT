/**
 * E2E — Page: AdminDashboard (`src/pages/AdminDashboard.jsx`)
 *
 * Focuses on admin-only routing, metrics loading, live stream failures,
 * refresh state, TTL countdown, and mobile layout resilience.
 */

import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockSetup.js';

const ADMIN_UID = 'arLB46aCTxSU4DNHvjrdvctBUjK2';

const DEFAULT_METRICS = {
  hit_rate_percent: 73,
  hits: 1234,
  misses: 456,
  stores: 89,
  clears: 7,
  metrics_enabled: true,
  config: {
    ttl_remaining: 65,
    connected_database: 'analytics_db',
    active_table_count: 14,
    remaining_tables: 986,
    schema_context_max_tables: 1000,
  },
};

async function setupAdminPage(
  page,
  {
    authenticated = true,
    admin = true,
    metricsStatus = 200,
    metricsBody = { status: 'success', metrics: DEFAULT_METRICS },
    healthStatus = 200,
    healthBody = { status: 'success' },
    streamMode = 'metrics',
    viewport,
  } = {},
) {
  if (viewport) {
    await page.setViewportSize(viewport);
  }

  await page.addInitScript(({ isAuthenticated, isAdmin, mode, metrics }) => {
    window.__MOCK_AUTH__ = true;
    if (!isAuthenticated) {
      window.__MOCK_AUTH_FLOW__ = true;
    }
    if (isAdmin) {
      window.__MOCK_AUTH_ADMIN__ = true;
    }

    class MockEventSource {
      constructor(url) {
        this.url = url;
        this.listeners = {};
        window.__ADMIN_EVENT_SOURCES__ = window.__ADMIN_EVENT_SOURCES__ || [];
        window.__ADMIN_EVENT_SOURCES__.push(this);

        setTimeout(() => {
          if (mode === 'metrics') {
            this.dispatch('metrics', { data: JSON.stringify(metrics) });
          } else if (mode === 'malformed') {
            this.dispatch('metrics', { data: '{not-json' });
          } else if (mode === 'error') {
            this.onerror?.(new Event('error'));
          }
        }, mode === 'metrics' ? 25 : 250);
      }

      addEventListener(type, handler) {
        this.listeners[type] = this.listeners[type] || [];
        this.listeners[type].push(handler);
      }

      dispatch(type, event) {
        for (const handler of this.listeners[type] || []) {
          handler(event);
        }
      }

      close() {
        this.closed = true;
      }
    }

    window.EventSource = MockEventSource;
  }, {
    isAuthenticated: authenticated,
    isAdmin: admin,
    mode: streamMode,
    metrics: DEFAULT_METRICS,
  });

  await setupMocks(page);

  await page.route('**/api/v1/', async (route) => {
    await route.fulfill({
      status: healthStatus,
      contentType: 'application/json',
      body: JSON.stringify(healthBody),
    });
  });

  await page.route('**/api/v1/context/metrics', async (route) => {
    await route.fulfill({
      status: metricsStatus,
      contentType: 'application/json',
      body: JSON.stringify(metricsBody),
    });
  });
}

async function goToAdmin(page, options = {}) {
  await setupAdminPage(page, options);
  await page.goto('/admin');
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth + 2);
}

test.describe('Page — AdminDashboard', () => {
  test('redirects unauthenticated users to auth', async ({ page }) => {
    await goToAdmin(page, { authenticated: false, admin: false });

    await page.waitForURL('**/auth', { timeout: 8000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('redirects authenticated non-admin users away from admin dashboard', async ({ page }) => {
    await goToAdmin(page, { authenticated: true, admin: false });

    await page.waitForURL('**/chat', { timeout: 8000 });
    await expect(page.getByRole('main', { name: /chat workspace/i })).toBeVisible({ timeout: 10000 });
  });

  test('renders live metrics for an admin without desktop horizontal overflow', async ({ page }) => {
    await goToAdmin(page);

    await expect(page.getByRole('heading', { name: /admin command surface/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Online')).toBeVisible();
    await expect(page.getByText(/backend responding in/i)).toBeVisible();
    await expect(page.getByLabel(/cache hit rate 73%/i)).toBeVisible();
    await expect(page.getByText('1,234').first()).toBeVisible();
    await expect(page.getByText('456').first()).toBeVisible();
    await expect(page.getByText('analytics_db')).toBeVisible();
    await expect(page.getByText('Enabled')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('counts down cache TTL after metrics arrive', async ({ page }) => {
    await goToAdmin(page);

    await expect(page.getByText('1m 05s')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1m 04s')).toBeVisible({ timeout: 2500 });
  });

  test('surfaces initial metrics API failures while keeping dashboard shell usable', async ({ page }) => {
    await goToAdmin(page, {
      metricsStatus: 500,
      metricsBody: { status: 'error', message: 'metrics down' },
      streamMode: 'none',
    });

    await expect(page.getByRole('heading', { name: /admin command surface/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/initial metrics request failed with http 500/i)).toBeVisible();
    await expect(page.getByLabel(/cache hit rate 0%/i)).toBeVisible();
  });

  test('surfaces malformed live telemetry payloads instead of silently ignoring them', async ({ page }) => {
    await goToAdmin(page, { streamMode: 'malformed' });

    await expect(page.getByText(/live telemetry payload could not be read/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /admin command surface/i })).toBeVisible();
  });

  test('surfaces live telemetry disconnects', async ({ page }) => {
    await goToAdmin(page, { streamMode: 'error' });

    await expect(page.getByText(/live telemetry stream disconnected/i)).toBeVisible({ timeout: 10000 });
  });

  test('refresh relay handles offline API state and leaves metrics visible', async ({ page }) => {
    await goToAdmin(page);
    await expect(page.getByText('Online')).toBeVisible({ timeout: 10000 });

    await page.unroute('**/api/v1/');
    await page.route('**/api/v1/', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'error' }),
      });
    });

    await page.getByRole('button', { name: /check api relay/i }).click();

    await expect(page.getByText('Offline', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/backend connection is offline/i)).toBeVisible();
    await expect(page.getByLabel(/cache hit rate 73%/i)).toBeVisible();
  });

  test('mobile viewport keeps operational panels usable without horizontal overflow', async ({ page }) => {
    await goToAdmin(page, { viewport: { width: 360, height: 740 } });

    await expect(page.getByRole('heading', { name: /admin command surface/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/cache hit rate 73%/i)).toBeVisible();
    await expect(page.getByText('Cache TTL')).toBeVisible();
    await expect(page.getByText('Cache Hits')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
