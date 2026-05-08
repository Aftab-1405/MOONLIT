/**
 * QueryWorkspace - Main query editor area
 * 
 * Contains query tabs and Monaco editor.
 */

import { memo } from 'react';
import { Box } from '@mui/material';
import QueryTabs from './QueryTabs';
import MonacoEditorSurface from './MonacoEditorSurface';

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
  onToggleSidebar,
  schemaSidebarOpen,
}) {
  return (
    <Box
      sx={{
        gridColumn: schemaSidebarOpen ? '2' : '1',
        gridRow: '1',
        display: 'flex',
        flexDirection: 'column',
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

      {/* Monaco Editor */}
      <MonacoEditorSurface
        query={activeTab?.query || ''}
        error={activeTab?.error}
        isConnected={isConnected}
        onQueryChange={onQueryChange}
        onQueryExecute={onQueryExecute}
      />
    </Box>
  );
}

export default memo(QueryWorkspace);
