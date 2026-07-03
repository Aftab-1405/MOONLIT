/**
 * Database API Module
 *
 * Handles database connection management:
 * - Connection status
 * - Connect/disconnect
 * - List databases
 * - Switch database
 * - Schema management
 *
 * @module api/database
 */

import { get, post } from '@/api/client';
import { DATABASE } from '@/api/endpoints';

/**
 * Synchronize frontend state with the active database connection.
 *
 * @returns {Promise<{status: 'success', data: Object, message?: string}>}
 */
export async function syncConnectionState() {
  return get(DATABASE.STATUS);
}

/**
 * Connect to a database.
 *
 * @param {Object} params - Connection parameters
 * @param {string} params.db_type - Database type (mysql, postgresql, etc.)
 * @param {string} [params.host] - Database host
 * @param {string} [params.port] - Database port
 * @param {string} [params.user] - Database user
 * @param {string} [params.password] - Database password
 * @param {string} [params.db_name] - Database name
 * @param {string} [params.connection_string] - Connection string (for remote DBs)
 * @returns {Promise<{status: 'success', data: Object, message?: string}>}
 */
export async function connect(params) {
  return post(DATABASE.CONNECT, params);
}

/**
 * Disconnect from current database.
 *
 * @returns {Promise<{status: 'success', data: Object, message?: string}>}
 */
export async function disconnect() {
  return post(DATABASE.DISCONNECT);
}

/**
 * List available databases.
 *
 * @returns {Promise<{status: 'success', data: Object, message?: string}>}
 */
export async function getDatabases() {
  return get(DATABASE.LIST_DATABASES);
}

/**
 * Switch to a different database (for remote connections).
 *
 * @param {string} database - Target database name
 * @returns {Promise<{status: 'success', data: Object, message?: string}>}
 */
export async function switchDatabase(database) {
  return post(DATABASE.SWITCH_DATABASE, { database });
}

/**
 * Select a database on existing local connection.
 * Uses session's db_config, no need to re-send credentials.
 *
 * @param {string} database - Target database name
 * @returns {Promise<{status: 'success', data: Object, message?: string}>}
 */
export async function selectDatabase(database) {
  return post(DATABASE.SELECT_DATABASE, { database });
}

/**
 * Get available schemas.
 *
 * @returns {Promise<{status: 'success', data: Object, message?: string}>}
 */
export async function getSchemas() {
  return get(DATABASE.GET_SCHEMAS);
}

/**
 * Select a schema for AI context.
 *
 * @param {string} schemaName - Schema name
 * @returns {Promise<{status: 'success', data: Object, message?: string}>}
 */
export async function selectSchema(schemaName) {
  return post(DATABASE.SELECT_SCHEMA, { schema_name: schemaName });
}

/**
 * Get tables in the current database/schema.
 *
 * @returns {Promise<{status: 'success', data: Object, message?: string}>}
 */
export async function getTables() {
  return get(DATABASE.GET_TABLES);
}

/**
 * Get columns and metadata for a table.
 *
 * @param {string} tableName - Table name
 * @returns {Promise<{status: 'success', data: Object, message?: string}>}
 */
export async function getTableSchema(tableName) {
  return post(DATABASE.GET_TABLE_SCHEMA, { table_name: tableName });
}
