export const UI_ACTION_METADATA_KEYS = [
  'title',
  'message',
  'intent',
  'severity',
  'requiresConfirmation',
  'sourceTool',
];

export const VALID_DB_TYPES = ['mysql', 'postgresql', 'sqlserver', 'oracle'];
export const VALID_SETTINGS_SECTIONS = ['appearance', 'ai', 'database', 'context'];
export const VALID_SEVERITIES = ['info', 'success', 'warning', 'error'];

export const UI_ACTIONS = {
  open_sql_editor: {
    running: 'Opening SQL editor',
    done: 'Opened SQL editor',
    validate: ({ payload }) => ({ ok: true, payload: payload || {} }),
  },
  write_sql_editor_query: {
    running: 'Preparing SQL query',
    done: 'Prepared SQL query',
    validate: ({ payload }) => {
      const query = typeof payload?.query === 'string' ? payload.query.trim() : '';
      return query ? { ok: true, payload: { ...payload, query } } : { ok: false, reason: 'Missing SQL query.' };
    },
  },
  open_database_modal: {
    running: 'Opening database connection',
    done: 'Opened database connection',
    validate: ({ payload }) => {
      const dbType = payload?.db_type;
      if (dbType === undefined || dbType === null || dbType === '') return { ok: true, payload: payload || {} };
      return VALID_DB_TYPES.includes(dbType)
        ? { ok: true, payload }
        : { ok: false, reason: `Unsupported database type: ${dbType}.` };
    },
  },
  open_settings_modal: {
    running: 'Opening settings',
    done: 'Opened settings',
    validate: ({ payload }) => {
      const section = payload?.section;
      if (section === undefined || section === null) return { ok: true, payload: payload || {} };
      return VALID_SETTINGS_SECTIONS.includes(section)
        ? { ok: true, payload }
        : { ok: false, reason: `Unknown settings section: ${section}.` };
    },
  },
  navigate_new_chat: {
    running: 'Preparing new chat',
    done: 'Awaiting new chat confirmation',
    guarded: true,
    validate: ({ payload }) => ({ ok: true, payload: payload || {} }),
  },
  complete_navigate_new_chat: {
    running: 'Starting new chat',
    done: 'Started new chat',
    validate: ({ payload }) => ({ ok: true, payload: payload || {} }),
  },
};

export const REGISTERED_UI_ACTIONS = Object.keys(UI_ACTIONS);
