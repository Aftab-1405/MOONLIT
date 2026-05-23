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
export { USER } from '@/api/endpoints';

export { del } from '@/api/client';

export {
  getFirebaseConfig,
  setSession,
  logout,
} from '@/api/auth';

export {
  getConversations,
  getConversation,
  deleteConversation,
  renameConversation,
  sendMessage,
  resumeAgent,
} from '@/api/conversations';

export { getLlmOptions } from '@/api/llm';

export {
  getStatus as getDbStatus,
  connect as connectDb,
  disconnect as disconnectDb,
  getDatabases,
  switchDatabase,
  selectDatabase,
  getSchemas,
  selectSchema,
  getTables,
  getTableSchema,
} from '@/api/database';

export { runQuery } from '@/api/query';

export {
  getContext as getUserContext,
  getSettings as getUserSettings,
  saveSettings as saveUserSettings,
  sessionActive,
} from '@/api/user';
