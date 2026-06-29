const STORAGE_PREFIX = 'moonlit:perspective:v4:';
const SAMPLE_SIZE = 100;

function zipRows(columns, rows) {
  if (!columns.length || !rows.length || !Array.isArray(rows[0])) return rows;
  return rows.map((row) => Object.fromEntries(
    columns.map((column, index) => [column, row[index]]),
  ));
}

export function normalizeTabularData(data) {
  if (Array.isArray(data)) return data;
  if (!data) return [];

  if (Array.isArray(data.result?.rows)) {
    const columns = data.result.columns || data.result.fields || data.columns || [];
    return zipRows(columns, data.result.rows);
  }
  if (Array.isArray(data.rows)) {
    return zipRows(data.columns || data.fields || [], data.rows);
  }
  return Array.isArray(data.data) ? data.data : [];
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createAnalysisStorageKey({ sourceQuery = '', columns = [], database = '' }) {
  const identity = JSON.stringify({ sourceQuery, columns, database });
  return `${STORAGE_PREFIX}${hashText(identity)}`;
}

export function loadAnalysisConfig(storageKey) {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(storageKey);
    if (!value) return null;
    const { table: _ephemeralTable, ...config } = JSON.parse(value);
    return config;
  } catch {
    return null;
  }
}

export function saveAnalysisConfig(storageKey, config) {
  if (!storageKey || !config || typeof window === 'undefined') return false;
  try {
    const { table: _ephemeralTable, ...portableConfig } = config;
    window.localStorage.setItem(storageKey, JSON.stringify(portableConfig));
    return true;
  } catch {
    return false;
  }
}

export function clearAnalysisConfig(storageKey) {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function inferColumnType(values) {
  const populated = values.filter((value) => value !== null && value !== undefined);
  if (!populated.length) return 'string';
  if (populated.every((value) => typeof value === 'boolean')) return 'boolean';
  if (populated.every((value) => Number.isInteger(value))) return 'integer';
  if (populated.every((value) => typeof value === 'number' && Number.isFinite(value))) return 'float';
  if (populated.every((value) => (
    typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  ))) {
    return 'date';
  }
  if (populated.every((value) => (
    typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(value)
    && !Number.isNaN(Date.parse(value))
  ))) {
    return 'datetime';
  }
  return 'string';
}

export function toColumnar(columns, rows) {
  const out = {};
  columns.forEach((col, idx) => {
    out[col] = rows.map((row) => {
      const val = row[idx];
      if (val && typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val ?? null;
    });
  });
  return out;
}
