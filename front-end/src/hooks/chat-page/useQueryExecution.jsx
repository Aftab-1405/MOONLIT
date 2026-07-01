/**
 * useQueryExecution Hook
 *
 * Manages SQL query execution, results, and confirmation dialogs.
 * Handles integration with database connection state.
 *
 * @module hooks/useQueryExecution
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { runQuery } from '@/api';

/**
 * Hook for query execution functionality
 * @param {Object} params - Hook parameters
 * @param {boolean} params.isDbConnected - Database connection status
 * @param {Object} params.settings - User settings object
 * @param {Function} params.setDbModalOpen - Function to open database modal
 * @param {Function} params.showSnackbar - Function to show snackbar notifications
 * @param {Function} params.onQueryResults - Function to show successful results
 * @returns {Object} Query execution state and handlers
 */
export function useQueryExecution({
  isDbConnected,
  settings,
  setDbModalOpen,
  showSnackbar,
  onQueryResults,
}) {
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    details: '',
    onConfirm: null,
    onCancel: null,
  });

  const queryResolverRef = useRef(null);
  const abortControllerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  const executeQuery = useCallback(
    async (sql, maxRows, queryTimeout) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const response = await runQuery({ sql, maxRows, timeout: queryTimeout }, signal);
        if (response.status === 'success') {
          const queryData = response.data;
          const columns = queryData.result?.columns || [];
          const rows = queryData.result?.rows || [];

          const transformedResult = rows.map((row) => {
            const obj = {};
            columns.forEach((col, idx) => {
              obj[col] = row[idx];
            });
            return obj;
          });

          onQueryResults?.(
            {
              columns,
              result: transformedResult,
              row_count: queryData.row_count,
              total_rows: queryData.total_rows,
              truncated: queryData.truncated,
              execution_time: queryData.execution_time_ms
                ? queryData.execution_time_ms / 1000
                : null,
            },
            sql,
          );
          showSnackbar(`Query returned ${queryData.row_count} rows`, 'success');
        } else {
          // Show the backend's descriptive message when available.
          showSnackbar(response.message || 'Query failed', 'error');
        }
      } catch (error) {
        if (error.name === 'AbortError') return; // Ignore abort errors
        // Extract the most descriptive safe message available.
        const message =
          error?.data?.message ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to execute query';
        showSnackbar(message, 'error');
      }
    },
    [onQueryResults, showSnackbar],
  );
  const handleRunQuery = useCallback(
    (sql) => {
      if (!isDbConnected) {
        showSnackbar('Please connect to a database first', 'warning');
        setDbModalOpen(true);
        return Promise.resolve();
      }

      const confirmBeforeRun = settings.confirmBeforeRun ?? false;
      const maxRows = settings.maxRows ?? 1000;
      const queryTimeout = settings.queryTimeout ?? 30;

      if (confirmBeforeRun) {
        return new Promise((resolve) => {
          queryResolverRef.current = resolve;
          setConfirmDialog({
            open: true,
            details: sql,
            onConfirm: async () => {
              await executeQuery(sql, maxRows, queryTimeout);
              setConfirmDialog({ open: false, details: '', onConfirm: null, onCancel: null });
              queryResolverRef.current?.();
            },
            onCancel: () => {
              setConfirmDialog({ open: false, details: '', onConfirm: null, onCancel: null });
              queryResolverRef.current?.();
            },
          });
        });
      }

      return executeQuery(sql, maxRows, queryTimeout);
    },
    [isDbConnected, settings, executeQuery, setDbModalOpen, showSnackbar],
  );
  const handleConfirmDialogClose = useCallback(() => {
    confirmDialog.onCancel?.();
    setConfirmDialog({ open: false, details: '', onConfirm: null, onCancel: null });
  }, [confirmDialog]);

  return {
    confirmDialog,
    handleRunQuery,
    handleConfirmDialogClose,
  };
}
