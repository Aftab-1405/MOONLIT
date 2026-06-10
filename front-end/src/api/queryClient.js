import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  dbStatus: ['db', 'status'],
  dbDatabases: ['db', 'databases'],
  dbSchemas: (database) => ['db', 'schemas', database || '__current__'],
  dbTables: (database) => ['db', 'tables', database || '__current__'],
  dbTableSchema: (database, tableName) => ['db', 'tableSchema', database || '__current__', tableName],
  llmOptions: ['llm', 'options'],
  conversations: ['conversations', 'list'],
  conversation: (conversationId) => ['conversations', 'detail', conversationId],
  userSettings: ['user', 'settings'],
  userContext: ['user', 'context'],
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
