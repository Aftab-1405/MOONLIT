import { useCallback, useEffect, useState } from 'react';
import { del, getUserContext } from '@/api';
import { USER } from '@/api/endpoints';
import { queryClient, queryKeys } from '@/api/queryClient';

export function useUserDBContext() {
  const [loading, setLoading] = useState(true);
  const [schemas, setSchemas] = useState([]);
  const [queries, setQueries] = useState([]);
  const [activeView, setActiveView] = useState('schemas'); // 'schemas' | 'queries'
  const [expandedSchema, setExpandedSchema] = useState(null);
  const [expandedQuery, setExpandedQuery] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    type: null,
    target: null,
  });
  const [error, setError] = useState(null);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialog({ open: false, type: null, target: null });
  }, []);

  const fetchContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.userContext,
        queryFn: getUserContext,
        staleTime: 60 * 1000,
      });
      if (data.status === 'success') {
        setSchemas(data.schemas || []);
        setQueries(data.recent_queries || []);
      } else {
        setError(data.message || 'Failed to load context');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const handleDelete = useCallback(async () => {
    const { type, target } = deleteDialog;
    closeDeleteDialog();

    try {
      let url;
      if (type === 'schema') {
        url = USER.CONTEXT_DELETE_SCHEMA(target);
      } else if (type === 'all-schemas') {
        url = USER.CONTEXT_DELETE_ALL_SCHEMAS;
      } else if (type === 'queries') {
        url = USER.CONTEXT_DELETE_QUERIES;
      }
      if (!url) return;
      await del(url);
      await queryClient.invalidateQueries({ queryKey: queryKeys.userContext });
      fetchContext();
    } catch (err) {
      setError(err.message || 'Failed to delete');
    }
  }, [closeDeleteDialog, deleteDialog, fetchContext]);

  const openDeleteDialog = useCallback((type, target = null) => {
    setDeleteDialog({ open: true, type, target });
  }, []);

  const toggleSchemaExpand = useCallback((database) => {
    setExpandedSchema((prev) => (prev === database ? null : database));
  }, []);

  const toggleQueryExpand = useCallback((index) => {
    setExpandedQuery((prev) => (prev === index ? null : index));
  }, []);

  return {
    loading,
    schemas,
    queries,
    activeView,
    setActiveView,
    expandedSchema,
    expandedQuery,
    deleteDialog,
    error,
    setError,
    closeDeleteDialog,
    fetchContext,
    handleDelete,
    openDeleteDialog,
    toggleSchemaExpand,
    toggleQueryExpand,
  };
}
