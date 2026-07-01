import { useCallback, useState } from 'react';
import { getUserContext } from '@/api';
import { queryClient, queryKeys } from '@/api/queryClient';
import logger from '@/utils/logger';

export function useMindmapSchema({ isConnected, currentDatabase }) {
  const [mindmapOpen, setMindmapOpen] = useState(false);
  const [schemaData, setSchemaData] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  const handleOpenMindmap = useCallback(async () => {
    if (!isConnected || !currentDatabase) return;
    setSchemaLoading(true);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.userContext,
        queryFn: getUserContext,
        staleTime: 60 * 1000,
      });
      if (data.status === 'success') {
        setSchemaData(data.schemas?.find((s) => s.database === currentDatabase) || null);
      }
    } catch (err) {
      logger.error('Failed to fetch schema:', err);
      setSchemaData(null);
    } finally {
      setSchemaLoading(false);
      setMindmapOpen(true);
    }
  }, [currentDatabase, isConnected]);

  const handleCloseMindmap = useCallback(() => setMindmapOpen(false), []);

  return {
    mindmapOpen,
    schemaData,
    schemaLoading,
    handleOpenMindmap,
    handleCloseMindmap,
  };
}
