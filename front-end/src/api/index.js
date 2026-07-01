/**
 * API Layer - Barrel Export
 *
 * Centralizes all API module exports for clean imports.
 *
 * @example
 * import { getConversations, sendMessage } from '@/api';
 *
 * @module api
 */

export {
  getFirebaseConfig,
  logout,
  setSession,
} from '@/api/auth';

export { del } from '@/api/client';
export {
  deleteConversation,
  getConversation,
  getConversations,
  renameConversation,
  resumeAgent,
  sendMessage,
} from '@/api/conversations';
export {
  connect as connectDb,
  disconnect as disconnectDb,
  getDatabases,
  getSchemas,
  getStatus as getDbStatus,
  getTableSchema,
  getTables,
  selectDatabase,
  selectSchema,
  switchDatabase,
} from '@/api/database';
export { USER } from '@/api/endpoints';
export { getLlmOptions } from '@/api/llm';

export { runQuery } from '@/api/query';

export {
  getContext as getUserContext,
  getSettings as getUserSettings,
  saveSettings as saveUserSettings,
  sessionActive,
} from '@/api/user';
