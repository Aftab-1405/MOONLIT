/**
 * databaseResponse - Centralized normalization for database API responses.
 *
 * Backend endpoints may return the current/selected database under different
 * field names depending on which route handled the request:
 *   - selected_database  (connect, select-database)
 *   - current_database   (status, switch-database)
 *   - database           (some legacy routes)
 *   - db_config.database (nested config objects)
 *
 * Use these helpers everywhere instead of inline field lookups so future
 * backend changes only need a single update here.
 *
 * @module utils/databaseResponse
 */

/**
 * Extract the selected/current database name from any supported response shape.
 *
 * @param {object|null} data - The `data` (or root) object from a backend response.
 * @returns {string|null} Database name, or null if not present.
 */
export function getSelectedDatabase(data) {
  if (!data) return null;
  return (
    data.selected_database ??
    data.current_database ??
    data.database ??
    data.db_config?.database ??
    null
  );
}

/**
 * Extract the connection-active flag from any supported response shape.
 *
 * @param {object|null} data
 * @returns {boolean}
 */
export function getIsConnected(data) {
  if (!data) return false;
  // `connected` is the canonical field; fall back to boolean coercion of DB name
  if (typeof data.connected === 'boolean') return data.connected;
  return Boolean(getSelectedDatabase(data));
}
