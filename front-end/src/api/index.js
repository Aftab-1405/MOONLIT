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
export { USER } from './endpoints';

export { del } from './client';

export {
  getFirebaseConfig,
  setSession,
  logout,
} from './auth';

export {
  getConversations,
  getConversation,
  deleteConversation,
  sendMessage,
  resumeAgent,
} from './conversations';

export { getLlmOptions } from './llm';

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
} from './database';

export { runQuery } from './query';

export {
  getContext as getUserContext,
  getSettings as getUserSettings,
  saveSettings as saveUserSettings,
  sessionActive,
} from './user';

