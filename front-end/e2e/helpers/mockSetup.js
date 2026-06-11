/**
 * Shared mock setup for Moonlit E2E tests.
 *
 * Provides a single `setupMocks(page, overrides)` function that intercepts
 * all back-end API calls and returns controlled, deterministic responses so
 * tests never depend on a running server.
 *
 * `overrides` lets individual tests swap specific responses to inject
 * error conditions, empty states, or race conditions.
 */

export const DEFAULT_CONVERSATIONS = [
  { id: 'conv-1', title: 'Sales Analysis', timestamp: '2026-06-10T12:00:00Z' },
  { id: 'conv-2', title: 'Schema Explorer', timestamp: '2026-06-10T12:05:00Z' },
  { id: 'conv-3', title: 'Revenue Report', timestamp: '2026-06-10T13:00:00Z' },
];

// IMPORTANT: API returns sender/content (not role/text).
// normalizeConversationMessage() maps sender→role, content→text internally.
export const DEFAULT_MESSAGES_CONV1 = [
  { sender: 'user', content: 'Show me total sales by region' },
  { sender: 'ai', content: 'Here are the total sales by region:\n\n| Region | Total |\n|--------|-------|\n| North  | 1200  |\n| South  | 980   |' },
];

export const DEFAULT_MESSAGES_CONV2 = [
  { sender: 'user', content: 'What tables do we have?' },
  { sender: 'ai', content: 'The database has these tables: `orders`, `customers`, `products`.' },
];

export const LLM_OPTIONS = {
  status: 'success',
  providers: [
    { name: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'], default_model: 'gpt-4o' },
    { name: 'anthropic', label: 'Anthropic', models: ['claude-3-5-sonnet', 'claude-3-haiku'], default_model: 'claude-3-5-sonnet' },
  ],
  default_provider: 'openai',
  default_model: 'gpt-4o',
};

export const DB_STATUS_CONNECTED = {
  status: 'success',
  data: {
    connected: true,
    db_type: 'postgresql',
    current_database: 'analytics_db',
    databases: ['analytics_db', 'reporting_db', 'dev_db'],
    schemas: ['public', 'sales', 'marketing'],
    current_schema: 'public',
  },
};

export const DB_STATUS_DISCONNECTED = {
  status: 'success',
  data: {
    connected: false,
    db_type: null,
    current_database: null,
    databases: [],
    schemas: [],
    current_schema: null,
  },
};

/**
 * Inject mock Firebase auth and set up route interception.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} overrides  - keyed by endpoint fragment, value = { status, body }
 */
export async function setupMocks(page, overrides = {}) {
  // Inject mock auth before any scripts run
  await page.addInitScript(() => {
    window.__MOCK_AUTH__ = true;
  });

  await page.route((url) => {
    const p = url.pathname;
    return p.includes('/api/v1/') || p.includes('/firebase-config');
  }, async (route) => {
    const urlStr = route.request().url();

    const respond = async (status, body) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    };

    try {
      // ── firebase config ──────────────────────────────────────────────────
      if (urlStr.includes('/firebase-config')) {
        return respond(200, {
          status: 'success',
          config: { apiKey: 'mock', authDomain: 'mock.firebaseapp.com', projectId: 'mock' },
        });
      }

      // ── user settings ────────────────────────────────────────────────────
      if (urlStr.includes('/api/v1/user/settings')) {
        const ov = overrides['user/settings'];
        return respond(ov?.status ?? 200, ov?.body ?? {
          status: 'success',
          settings: { confirmBeforeRun: false, maxRows: 1000, queryTimeout: 30 },
        });
      }

      // ── conversations list ───────────────────────────────────────────────
      if (urlStr.includes('/api/v1/get_conversations')) {
        const ov = overrides['get_conversations'];
        return respond(ov?.status ?? 200, ov?.body ?? {
          status: 'success',
          conversations: DEFAULT_CONVERSATIONS,
        });
      }

      // ── individual conversation ──────────────────────────────────────────
      if (urlStr.includes('/api/v1/get_conversation/conv-1')) {
        const ov = overrides['get_conversation/conv-1'];
        return respond(ov?.status ?? 200, ov?.body ?? {
          status: 'success',
          conversation: { id: 'conv-1', title: 'Sales Analysis', messages: DEFAULT_MESSAGES_CONV1 },
        });
      }
      if (urlStr.includes('/api/v1/get_conversation/conv-2')) {
        const ov = overrides['get_conversation/conv-2'];
        return respond(ov?.status ?? 200, ov?.body ?? {
          status: 'success',
          conversation: { id: 'conv-2', title: 'Schema Explorer', messages: DEFAULT_MESSAGES_CONV2 },
        });
      }
      if (urlStr.includes('/api/v1/get_conversation/conv-3')) {
        return respond(200, {
          status: 'success',
          conversation: { id: 'conv-3', title: 'Revenue Report', messages: [] },
        });
      }

      // ── delete conversation ──────────────────────────────────────────────
      if (urlStr.includes('/api/v1/delete_conversation/')) {
        const ov = overrides['delete_conversation'];
        if (ov?.delay) {
          await new Promise((r) => setTimeout(r, ov.delay));
        }
        return respond(ov?.status ?? 200, ov?.body ?? { status: 'success' });
      }

      // ── rename conversation ──────────────────────────────────────────────
      if (urlStr.includes('/api/v1/rename_conversation/')) {
        const ov = overrides['rename_conversation'];
        if (ov) return respond(ov.status, ov.body);
        // Echo back whatever title was in the request body so optimistic UI matches
        try {
          const body = JSON.parse(route.request().postData() || '{}');
          const title = body.title || body.new_title || 'Renamed';
          return respond(200, { status: 'success', title });
        } catch {
          return respond(200, { status: 'success', title: 'Renamed' });
        }
      }

      // ── db status ────────────────────────────────────────────────────────
      if (urlStr.includes('/api/v1/db_status')) {
        const ov = overrides['db_status'];
        return respond(ov?.status ?? 200, ov?.body ?? DB_STATUS_CONNECTED);
      }

      // ── db connect ───────────────────────────────────────────────────────
      if (urlStr.includes('/api/v1/connect')) {
        const ov = overrides['connect'];
        return respond(ov?.status ?? 200, ov?.body ?? { status: 'success', message: 'Connected' });
      }

      // ── LLM options ──────────────────────────────────────────────────────
      if (urlStr.includes('/api/v1/llm/options')) {
        const ov = overrides['llm/options'];
        return respond(ov?.status ?? 200, ov?.body ?? LLM_OPTIONS);
      }

      // ── LLM preference ──────────────────────────────────────────────────
      if (urlStr.includes('/api/v1/llm/preference')) {
        return respond(200, { status: 'success' });
      }

      // ── user context ─────────────────────────────────────────────────────
      if (urlStr.includes('/api/v1/user/context')) {
        return respond(200, {
          status: 'success',
          schemas: [
            {
              database: 'analytics_db',
              tables: [
                { name: 'orders', columns: ['id', 'customer_id', 'total', 'created_at'] },
                { name: 'customers', columns: ['id', 'name', 'email', 'region'] },
              ],
            },
          ],
        });
      }

      // ── chat / send message ──────────────────────────────────────────────
      if (urlStr.includes('/api/v1/chat') || urlStr.includes('/api/v1/stream') || urlStr.includes('/api/v1/pass_user_prompt_to_llm')) {
        const ov = overrides['chat'];
        if (ov?.delay) {
          await new Promise((r) => setTimeout(r, ov.delay));
        }
        if (ov) return respond(ov.status, ov.body);
        // Return a simple SSE-style response
        return respond(200, { status: 'success', message: 'Response received' });
      }

      // ── schema (switch) ─────────────────────────────────────────────────
      if (urlStr.includes('/api/v1/switch_schema') || urlStr.includes('/api/v1/select_schema')) {
        return respond(200, { status: 'success' });
      }

      // ── switch database ──────────────────────────────────────────────────
      if (urlStr.includes('/api/v1/switch_database')) {
        return respond(200, { status: 'success' });
      }

      // ── fallback ─────────────────────────────────────────────────────────
      return respond(200, { status: 'success' });
    } catch (err) {
      console.error('[mockSetup] Interceptor error:', err);
      await route.abort();
    }
  });
}
