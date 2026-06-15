/**
 * QueryWorkspace - Main query editor area
 * 
 * Contains query tabs and Monaco editor.
 */

import { lazy, memo, Suspense } from 'react';
import { Box, Skeleton } from '@mui/material';
import QueryTabs from '@/features/sidebar-right/artifacts/sql-workspace/QueryTabs';

const MonacoEditorSurface = lazy(() => import('@/features/sidebar-right/artifacts/sql-workspace/MonacoEditorSurface'));

function MonacoEditorFallback() {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Skeleton variant="rounded" width="34%" height={28} />
      <Skeleton variant="rounded" sx={{ flex: 1, minHeight: 160 }} />
    </Box>
  );
}

function QueryWorkspace({
  tabs,
  activeTabId,
  activeTab,
  isConnected,
  currentDatabase: _currentDatabase,
  onTabChange,
  onTabAdd,
  onTabClose,
  onQueryChange,
  onQueryExecute,
  onRunQuery,
  onToggleSidebar,
  schemaSidebarOpen,
}) {
  return (
    <Box
      sx={{
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* Query Tabs */}
      <QueryTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={onTabChange}
        onTabAdd={onTabAdd}
        onTabClose={onTabClose}
        onToggleSidebar={onToggleSidebar}
        schemaSidebarOpen={schemaSidebarOpen}
      />

      {/* Monaco Editor (lazy — keeps @monaco-editor out of parent chunk) */}
      <Suspense fallback={<MonacoEditorFallback />}>
        <MonacoEditorSurface
          query={activeTab?.query || ''}
          error={activeTab?.error}
          isConnected={isConnected}
          onQueryChange={onQueryChange}
          onQueryExecute={onQueryExecute}
          onRunQuery={onRunQuery}
        />
      </Suspense>
    </Box>
  );
}

export default memo(QueryWorkspace);
