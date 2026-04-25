import { TOOL_ACTIONS } from '../../config/toolActions';

function parseJSON(value) {
  if (!value || value === 'null' || value === '{}') return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function formatToolName(name = '') {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStepId(step, idx) {
  if (step?.id) return String(step.id);
  if (step?.type === 'tool') {
    const status = step.status || 'unknown';
    const name = step.name || 'tool';
    return `tool-${idx}-${name}-${status}`;
  }
  return `thinking-${idx}`;
}

function isSemanticFailure(name, result) {
  if (!result) return false;
  if (result.success === false || result.error) return true;
  switch (name) {
    case 'get_connection_status':
      return result.connected === false;
    case 'get_database_list':
      return (result.count ?? result.databases?.length ?? 0) === 0;
    case 'get_database_schema':
      return (result.table_count ?? result.tables?.length ?? 0) === 0;
    case 'get_table_columns':
      return (result.column_count ?? result.columns?.length ?? 0) === 0;
    default:
      return false;
  }
}

export function getDetailedResult(name, result) {
  if (!result) return 'No result';
  if (result.success === false || result.error) {
    return `Error: ${result.error || result.message || 'Unknown error'}`;
  }

  const details = {
    get_connection_status: () => {
      if (!result.connected) return 'Not connected to any database';
      let msg = `Connected to ${result.database || 'database'}`;
      if (result.db_type) msg += ` (${result.db_type.toUpperCase()})`;
      return msg;
    },
    get_database_list: () => {
      const count = result.count ?? result.databases?.length ?? 0;
      return `Found ${count} database${count !== 1 ? 's' : ''} available`;
    },
    get_database_schema: () => {
      const count = result.table_count ?? result.tables?.length ?? 0;
      const database = result.database ? ` from ${result.database}` : '';
      return `Retrieved ${count} table${count !== 1 ? 's' : ''}${database}`;
    },
    get_table_columns: () => {
      const count = result.column_count ?? result.columns?.length ?? 0;
      const table = result.table ? ` in ${result.table}` : '';
      return `Retrieved ${count} column${count !== 1 ? 's' : ''}${table}`;
    },
    execute_query: () => {
      const rowCount = result.row_count ?? 0;
      const totalRows = result.total_rows ?? rowCount;
      let msg = `Query returned ${rowCount} rows`;
      if (result.truncated && totalRows > rowCount) {
        msg += ` (of ${totalRows.toLocaleString()} total)`;
      }
      return msg;
    },
    get_table_indexes: () => `Found ${result.count ?? result.indexes?.length ?? 0} indexes`,
    get_foreign_keys: () => {
      const count = result.count ?? result.foreign_keys?.length ?? 0;
      const table = result.table ? ` for ${result.table}` : '';
      return `Found ${count} foreign key relationship${count !== 1 ? 's' : ''}${table}`;
    },
    web_search: () => {
      const count = result.count ?? result.results?.length ?? 0;
      const query = result.query ? ` for "${result.query}"` : '';
      return `Found ${count} cited source${count !== 1 ? 's' : ''}${query}`;
    },
  };

  return details[name]?.() || 'Completed successfully';
}

export function normalizeSteps(steps) {
  const validSteps = Array.isArray(steps) ? steps.filter((step) => step && step.type) : [];
  return validSteps
    .map((step, idx) => {
      if (step.type === 'thinking') {
        return {
          id: getStepId(step, idx),
          type: 'thinking',
          content: step.content || '',
          isComplete: Boolean(step.isComplete),
        };
      }

      if (step.type === 'tool') {
        const parsedArgs = parseJSON(step.args);
        const parsedResult = parseJSON(step.result);
        const isRunning = step.status === 'running';
        const config = TOOL_ACTIONS[step.name];
        return {
          id: getStepId(step, idx),
          type: 'tool',
          name: step.name,
          actionText: config ? (isRunning ? config.running : config.done) : formatToolName(step.name),
          parsedArgs,
          parsedResult,
          isRunning,
          isError: step.status === 'error' || isSemanticFailure(step.name, parsedResult),
        };
      }

      return null;
    })
    .filter(Boolean);
}

export function buildStepsSummary(normalizedSteps) {
  if (normalizedSteps.length === 0) return '';

  const activeTool = normalizedSteps.find((s) => s.type === 'tool' && s.isRunning);
  if (activeTool) return activeTool.actionText;

  const activeThinking = normalizedSteps.find((s) => s.type === 'thinking' && !s.isComplete);
  if (activeThinking) return 'Thinking…';

  const completedTools = normalizedSteps.filter((s) => s.type === 'tool' && !s.isRunning);
  const thinkingSteps = normalizedSteps.filter((s) => s.type === 'thinking');

  if (completedTools.length === 0) {
    if (thinkingSteps.length > 0) return 'Reasoned through the request';
    return 'Processing…';
  }

  const actions = completedTools.map((s) => s.actionText);
  if (actions.length === 1) return actions[0];
  if (actions.length === 2) return actions.join(', ');
  return `${actions.slice(0, 2).join(', ')}, and more`;
}

export function isAnyStepActive(normalizedSteps) {
  return normalizedSteps.some(
    (s) =>
      (s.type === 'tool' && s.isRunning) ||
      (s.type === 'thinking' && !s.isComplete)
  );
}

export function getCurrentStepIndex(normalizedSteps) {
  return normalizedSteps.findIndex((step) =>
    (step.type === 'thinking' && !step.isComplete)
    || (step.type === 'tool' && step.isRunning)
  );
}

export function areAllStepsComplete(normalizedSteps, isStreaming) {
  return !isStreaming && normalizedSteps.every((step) =>
    (step.type === 'thinking' && step.isComplete)
    || (step.type === 'tool' && !step.isRunning)
  );
}

