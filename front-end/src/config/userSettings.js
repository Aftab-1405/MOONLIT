/**
 * User preferences synced per account via the API (Firestore-backed).
 * @module config/userSettings
 */

export const defaultUserSettings = {
  theme: 'dark',
  confirmBeforeRun: false,
  queryTimeout: 30,
  maxRows: 1000,
  nullDisplay: 'NULL',
  rememberConnection: false,
  defaultDbType: 'postgresql',
  connectionPersistence: 0,
  enableReasoning: true,
  reasoningEffort: 'medium',
  responseStyle: 'balanced',
  llmProvider: null,
  llmModel: null,
};

/** Keys persisted to the server for cross-browser sync. */
const SYNCABLE_SETTING_KEYS = Object.keys(defaultUserSettings);

const NUMERIC_KEYS = new Set(['queryTimeout', 'maxRows', 'connectionPersistence']);

/**
 * Build a partial settings object for POST /user/settings.
 * @param {Object} settings
 * @returns {Object}
 */
export function pickSyncableSettings(settings = {}) {
  const payload = {};
  for (const key of SYNCABLE_SETTING_KEYS) {
    if (settings[key] === undefined) continue;
    let value = settings[key];
    if (NUMERIC_KEYS.has(key) && value !== null && value !== '') {
      value = Number(value);
      if (Number.isNaN(value)) continue;
    }
    payload[key] = value;
  }
  return payload;
}

/**
 * Map API settings payload onto SettingsContext keys.
 * @param {Object} serverPayload
 * @returns {Object}
 */
export function mapServerSettingsToClient(serverPayload = {}) {
  const source = serverPayload.settings ?? serverPayload;
  const patch = {};

  for (const key of SYNCABLE_SETTING_KEYS) {
    if (source[key] === undefined || source[key] === null) continue;
    let value = source[key];
    if (NUMERIC_KEYS.has(key)) {
      value = Number(value);
      if (Number.isNaN(value)) continue;
    }
    patch[key] = value;
  }

  const legacyPersistence = source.connectionPersistenceMinutes;
  if (
    patch.connectionPersistence === undefined
    && legacyPersistence !== undefined
    && legacyPersistence !== null
  ) {
    const minutes = Number(legacyPersistence);
    if (!Number.isNaN(minutes)) {
      patch.connectionPersistence = minutes;
    }
  }

  return patch;
}
