import { UI_ACTIONS } from '@/config/uiActions';

export const TOOL_ACTIONS = {
  read_skill: { running: 'Reading skill instructions', done: 'Read skill instructions' },
  get_connection_status: {
    running: 'Checking connection status',
    done: 'Checked connection status',
  },
  get_database_list: { running: 'Listing available databases', done: 'Listed available databases' },
  get_schema_overview: { running: 'Fetching schema overview', done: 'Fetched schema overview' },
  get_table_columns: { running: 'Getting table structure', done: 'Got table structure' },
  execute_query: { running: 'Executing SQL query', done: 'Executed SQL query' },
  analyze_query_result: { running: 'Analyzing query result', done: 'Analyzed query result' },
  get_table_indexes: { running: 'Fetching indexes', done: 'Fetched indexes' },
  get_foreign_keys: { running: 'Fetching foreign keys', done: 'Fetched foreign keys' },
  web_search: { running: 'Searching the web', done: 'Searched the web' },
  ...Object.fromEntries(
    Object.entries(UI_ACTIONS).map(([name, config]) => [
      name,
      { running: config.running, done: config.done },
    ]),
  ),
};
