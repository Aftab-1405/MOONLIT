/**
 * SqlWorkspace - Production SQL Editor Workspace
 * 
 * A professional SQL IDE-like interface with:
 * - Schema sidebar with database explorer
 * - Multi-tab query editor with Monaco
 * - Integrated result and visualization panels
 * - Resizable panels and clean workspace layout
 */

import { useState, useCallback, useMemo, memo } from 'react';
import { Box, Collapse } from '@mui/material';
import logger from '@/utils/logger';
import CodeEditorIcon from '@/components/icons/CodeEditorIcon';
import { ArtifactShell } from '@/features/sidebar-right/artifact-loader';
import SchemaSidebar from '@/features/sidebar-right/artifacts/sql-workspace/SchemaSidebar';
import QueryWorkspace from '@/features/sidebar-right/artifacts/sql-workspace/QueryWorkspace';
import StatusBar from '@/features/sidebar-right/artifacts/sql-workspace/StatusBar';

const SCHEMA_PANEL_MOTION = {
  duration: 220,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
};

function SqlWorkspace({
  title,
  initialQuery = '',
  initialResults = null,
  isConnected = false,
  currentDatabase = null,
  chrome = 'standalone',
  onClose,
  onRequestClose,
  onOpenArtifact,
  isFullscreen = false,
  onEnterFullscreen,
  onExitFullscreen,
  onToggleFullscreen,
  workspaceContainerRef,
}) {
  // Panel state
  const [schemaSidebarOpen, setSchemaSidebarOpen] = useState(true);
  const [schemaSidebarWidth, setSchemaSidebarWidth] = useState(260);

  // Query state
  const [activeTabId, setActiveTabId] = useState('query-1');
  const [tabs, setTabs] = useState([
    {
      id: 'query-1',
      title: 'Query 1',
      query: initialQuery,
      isDirty: false,
      results: initialResults,
      error: null,
    },
  ]);

  // Resizing state
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  // Tab management
  const handleAddTab = useCallback(() => {
    const newId = `query-${Date.now()}`;
    setTabs((prev) => [
      ...prev,
      {
        id: newId,
        title: `Query ${prev.length + 1}`,
        query: '',
        isDirty: false,
        results: null,
        error: null,
      },
    ]);
    setActiveTabId(newId);
  }, []);

  const handleCloseTab = useCallback((tabId) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId);
      if (filtered.length === 0) {
        return [
          {
            id: 'query-1',
            title: 'Query 1',
            query: '',
            isDirty: false,
            results: null,
            error: null,
          },
        ];
      }
      return filtered;
    });
    setActiveTabId((prev) => {
      if (prev === tabId) {
        const idx = tabs.findIndex((t) => t.id === tabId);
        const nextTab = tabs[idx + 1] || tabs[idx - 1] || tabs[0];
        return nextTab?.id || 'query-1';
      }
      return prev;
    });
  }, [tabs]);

  const handleUpdateTab = useCallback((tabId, updates) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t))
    );
  }, []);

  // Query execution
  const handleQueryChange = useCallback(
    (value) => {
      handleUpdateTab(activeTabId, { query: value, isDirty: true });
    },
    [activeTabId, handleUpdateTab]
  );

  const handleQueryExecute = useCallback(
    (results, error) => {
      handleUpdateTab(activeTabId, { results, error, isDirty: false });
      
      if (results) {
        if (onOpenArtifact) {
          // Open results as artifact in canvas (consistent with message list behavior)
          // Include source query so user can navigate back to editor
          onOpenArtifact({
            type: 'results',
            title: 'Query Results',
            props: { 
              data: results,
              sourceQuery: activeTab?.query,
              sourceType: 'sql-editor',
            },
          });
        } else {
          // Fallback: log warning if onOpenArtifact is not provided
          logger.warn('SqlWorkspace: onOpenArtifact prop is required to display query results');
        }
      }

      if (error) {
        logger.error('Query execution error:', error);
      }
    },
    [activeTabId, activeTab?.query, handleUpdateTab, onOpenArtifact]
  );

  // Panel resizing
  const handleSidebarResizeStart = useCallback((e) => {
    setResizingSidebar(true);
    setResizeStartX(e.clientX);
    setResizeStartWidth(schemaSidebarWidth);
  }, [schemaSidebarWidth]);

  const handleSidebarResize = useCallback((e) => {
    if (!resizingSidebar) return;
    e.preventDefault();
    const deltaX = e.clientX - resizeStartX;
    const newWidth = Math.max(200, Math.min(500, resizeStartWidth + deltaX));
    setSchemaSidebarWidth(newWidth);
  }, [resizingSidebar, resizeStartX, resizeStartWidth]);

  const handleMouseUp = useCallback(() => {
    setResizingSidebar(false);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (resizingSidebar) {
      handleSidebarResize(e);
    }
  }, [resizingSidebar, handleSidebarResize]);

  // Workspace layout
  const workspaceStyles = useMemo(
    () => ({
      display: 'flex',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      bgcolor: 'background.default',
      contain: 'layout paint style',
    }),
    []
  );
  const schemaPanelTransition = resizingSidebar
    ? 'none'
    : `width ${SCHEMA_PANEL_MOTION.duration}ms ${SCHEMA_PANEL_MOTION.easing}`;

  const workspaceContent = (
    <Box
      data-workspace-container
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        bgcolor: 'background.default',
        cursor: resizingSidebar ? 'col-resize' : 'default',
        userSelect: resizingSidebar ? 'none' : 'auto',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Main workspace grid */}
      <Box sx={workspaceStyles}>
        {/* Schema Sidebar */}
        <Collapse
          orientation="horizontal"
          in={schemaSidebarOpen}
          timeout={resizingSidebar ? 0 : SCHEMA_PANEL_MOTION.duration}
          collapsedSize={0}
          easing={SCHEMA_PANEL_MOTION.easing}
          mountOnEnter={false}
          unmountOnExit={false}
          sx={{
            flexShrink: 0,
            minHeight: 0,
            height: '100%',
            width: schemaSidebarOpen ? schemaSidebarWidth : 0,
            transition: schemaPanelTransition,
            willChange: resizingSidebar ? 'auto' : 'width',
            contain: 'layout paint style',
            '& .MuiCollapse-wrapper': {
              height: '100%',
              width: schemaSidebarWidth,
            },
            '& .MuiCollapse-wrapperInner': {
              height: '100%',
              width: schemaSidebarWidth,
            },
          }}
        >
          <SchemaSidebar
            width={schemaSidebarWidth}
            open={schemaSidebarOpen}
            isConnected={isConnected}
            currentDatabase={currentDatabase}
            onClose={() => setSchemaSidebarOpen(false)}
            onResizeStart={handleSidebarResizeStart}
            resizing={resizingSidebar}
          />
        </Collapse>

        {/* Query Workspace */}
        <QueryWorkspace
          tabs={tabs}
          activeTabId={activeTabId}
          activeTab={activeTab}
          isConnected={isConnected}
          currentDatabase={currentDatabase}
          onTabChange={setActiveTabId}
          onTabAdd={handleAddTab}
          onTabClose={handleCloseTab}
          onQueryChange={handleQueryChange}
          onQueryExecute={handleQueryExecute}
          onToggleSidebar={() => setSchemaSidebarOpen((v) => !v)}
          schemaSidebarOpen={schemaSidebarOpen}
        />
      </Box>

      {/* Status Bar */}
      <StatusBar
        isConnected={isConnected}
        currentDatabase={currentDatabase}
        activeTab={activeTab}
        onQueryExecute={handleQueryExecute}
      />
    </Box>
  );

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <ArtifactShell
        title={title || 'SQL Editor'}
        icon={<CodeEditorIcon sx={{ width: 20, height: 20 }} />}
        chrome={chrome}
        onClose={onClose}
        onRequestClose={onRequestClose}
        isFullscreen={isFullscreen}
        onEnterFullscreen={onEnterFullscreen}
        onExitFullscreen={onExitFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        workspaceContainerRef={workspaceContainerRef}
      >
        {workspaceContent}
      </ArtifactShell>
    </Box>
  );
}

export default memo(SqlWorkspace);
