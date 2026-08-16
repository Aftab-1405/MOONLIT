import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { createServer } from 'vite';

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

try {
  const [
    { createDarkTheme },
    {
      getPreferenceButtonSx,
      getPreferenceControlSx,
      getPreferenceToggleGroupSx,
      PREFERENCE_LAYOUT,
    },
    { default: Notification },
    dialogActionStyles,
    { getArtifactActionButtonSx },
    { ArtifactEmptyState },
    { default: ResizeHandle },
    { default: QueryTabs },
  ] = await Promise.all([
    server.ssrLoadModule('/src/theme/darkTheme.js'),
    server.ssrLoadModule(
      '/src/features/overlays/preference-surface/preferenceSurfaceStyles.js',
    ),
    server.ssrLoadModule('/src/components/ui/toast.jsx'),
    server.ssrLoadModule('/src/components/common/dialogActionStyles.js'),
    server.ssrLoadModule(
      '/src/features/sidebar-right/artifact-loader/artifactLayoutUtils.js',
    ),
    server.ssrLoadModule(
      '/src/features/sidebar-right/artifact-loader/ArtifactLayout.jsx',
    ),
    server.ssrLoadModule('/src/components/common/ResizeHandle.jsx'),
    server.ssrLoadModule(
      '/src/features/sidebar-right/artifacts/sql-workspace/QueryTabs.jsx',
    ),
  ]);

  const theme = createDarkTheme();
  const responsiveControlHeight = { xs: 44, md: 34 };
  const preferenceControl = getPreferenceControlSx(theme)['& .MuiInputBase-root'];
  const preferenceButton = getPreferenceButtonSx(theme);
  const preferenceToggle =
    getPreferenceToggleGroupSx(theme)['& .MuiToggleButtonGroup-grouped'];

  assert.deepEqual(
    PREFERENCE_LAYOUT.responsiveControlHeight,
    responsiveControlHeight,
    'preference geometry must expose 44px mobile and 34px desktop control heights',
  );
  assert.deepEqual(
    preferenceControl.minHeight,
    responsiveControlHeight,
    'preference fields must consume responsive control geometry',
  );
  assert.equal(
    preferenceControl.borderRadius,
    '8px',
    'preference fields must retain the canonical 8px input radius',
  );
  assert.deepEqual(
    preferenceButton.minHeight,
    responsiveControlHeight,
    'preference actions must consume responsive control geometry',
  );
  assert.equal(
    preferenceButton.borderRadius,
    theme.shape.radius.pill,
    'preference actions must use the canonical pill radius',
  );
  assert.deepEqual(
    preferenceToggle.minHeight,
    { xs: 44, md: 32 },
    'preference segmented actions must be touch-safe below 768px',
  );
  assert.equal(
    preferenceToggle.borderRadius,
    `${theme.shape.radius.pill}px !important`,
    'preference segmented actions must use the canonical pill radius',
  );

  const renderNotification = (type) =>
    renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        { theme },
        React.createElement(Notification, {
          type,
          title: type === 'error' ? 'Connection failed' : 'Settings saved',
          message: 'Try again.',
          duration: 4000,
          onClose: () => {},
        }),
      ),
    );

  const errorNotification = renderNotification('error');
  assert.match(
    errorNotification,
    /role="alert"/,
    'error notifications must render as alerts',
  );
  assert.match(
    errorNotification,
    /aria-live="assertive"/,
    'error notifications must be announced assertively',
  );

  const successNotification = renderNotification('success');
  assert.match(
    successNotification,
    /role="status"/,
    'success notifications must render as status messages',
  );
  assert.match(
    successNotification,
    /aria-live="polite"/,
    'success notifications must be announced politely',
  );
  assert.match(
    successNotification,
    /aria-label="Dismiss notification"/,
    'notifications must expose a named dismissal control',
  );

  assert.equal(
    typeof dialogActionStyles.getDialogCloseButtonSx,
    'function',
    'shared dialog styles must expose responsive close-button geometry',
  );
  const dialogCloseButton = dialogActionStyles.getDialogCloseButtonSx(theme);
  assert.deepEqual(dialogCloseButton.width, { xs: 44, md: 34 });
  assert.deepEqual(dialogCloseButton.height, { xs: 44, md: 34 });
  assert.equal(dialogCloseButton.borderRadius, theme.shape.radius.pill);

  assert.equal(
    typeof dialogActionStyles.getConfirmActionGeometrySx,
    'function',
    'shared dialog styles must expose responsive confirmation action geometry',
  );
  const confirmAction = dialogActionStyles.getConfirmActionGeometrySx(theme);
  assert.deepEqual(confirmAction.minHeight, { xs: 44, md: 38 });
  assert.deepEqual(confirmAction.height, { xs: 44, md: 38 });
  assert.equal(confirmAction.borderRadius, theme.shape.radius.pill);

  const artifactAction = getArtifactActionButtonSx(theme, { size: 32 });
  assert.deepEqual(
    artifactAction.width,
    { xs: 44, md: 32 },
    'artifact actions must be touch-safe below 768px and compact on desktop',
  );
  assert.deepEqual(artifactAction.height, { xs: 44, md: 32 });
  assert.deepEqual(artifactAction.minWidth, { xs: 44, md: 32 });
  assert.deepEqual(artifactAction.minHeight, { xs: 44, md: 32 });
  assert.equal(artifactAction.borderRadius, theme.shape.radius.pill);

  const artifactError = renderToStaticMarkup(
    React.createElement(
      ThemeProvider,
      { theme },
      React.createElement(ArtifactEmptyState, {
        role: 'alert',
        ariaLive: 'assertive',
        title: 'Artifact failed to render',
        message: 'Try again.',
      }),
    ),
  );
  assert.match(artifactError, /role="alert"/);
  assert.match(artifactError, /aria-live="assertive"/);

  const resizeHandle = renderToStaticMarkup(
    React.createElement(
      ThemeProvider,
      { theme },
      React.createElement(ResizeHandle, {
        valueMin: 320,
        valueMax: 900,
        valueNow: 520,
      }),
    ),
  );
  assert.match(resizeHandle, /role="separator"/);
  assert.match(resizeHandle, /aria-orientation="vertical"/);
  assert.match(resizeHandle, /aria-valuemin="320"/);
  assert.match(resizeHandle, /aria-valuemax="900"/);
  assert.match(resizeHandle, /aria-valuenow="520"/);

  const queryTabs = renderToStaticMarkup(
    React.createElement(
      ThemeProvider,
      { theme },
      React.createElement(QueryTabs, {
        tabs: [
          { id: 'query-1', title: 'Query 1', isDirty: false },
          { id: 'query-2', title: 'Query 2', isDirty: true },
        ],
        activeTabId: 'query-1',
        onTabChange: () => {},
        onTabAdd: () => {},
        onTabClose: () => {},
        onToggleSidebar: () => {},
        schemaSidebarOpen: true,
      }),
    ),
  );
  assert.match(queryTabs, /role="tablist"/);
  assert.match(queryTabs, /aria-label="SQL query tabs"/);
  assert.equal(queryTabs.match(/role="tab"/g)?.length, 2);
  assert.match(queryTabs, /aria-selected="true"/);
  assert.match(queryTabs, /aria-selected="false"/);
  assert.match(queryTabs, /aria-label="Close Query 1"/);
  assert.doesNotMatch(
    queryTabs,
    /role="button"/,
    'query selection controls must not contain simulated buttons',
  );

  const artifactLoaderSource = await readFile(
    new URL('../src/features/sidebar-right/artifact-loader/ArtifactLoader.jsx', import.meta.url),
    'utf8',
  );
  const mainInterfaceSource = await readFile(
    new URL('../src/features/MainInterface.jsx', import.meta.url),
    'utf8',
  );
  const queryWorkspaceSource = await readFile(
    new URL(
      '../src/features/sidebar-right/artifacts/sql-workspace/QueryWorkspace.jsx',
      import.meta.url,
    ),
    'utf8',
  );
  const schemaMindmapSource = await readFile(
    new URL('../src/features/overlays/mindmap/SchemaMindmapDialog.jsx', import.meta.url),
    'utf8',
  );
  const dataVisualizationSource = await readFile(
    new URL(
      '../src/features/sidebar-right/artifacts/data-visualization/DataVisualizationPanel.jsx',
      import.meta.url,
    ),
    'utf8',
  );
  const perspectiveDashboardSource = await readFile(
    new URL(
      '../src/features/sidebar-right/artifacts/data-visualization/PerspectiveDashboard.jsx',
      import.meta.url,
    ),
    'utf8',
  );
  assert.doesNotMatch(
    artifactLoaderSource,
    /document\.addEventListener\(['"]keydown['"]/,
    'fullscreen Escape handling must stay local to the artifact region',
  );
  assert.match(artifactLoaderSource, /useReducedMotion/);
  assert.match(artifactLoaderSource, /fullscreenRootRef/);
  assert.match(artifactLoaderSource, /fullscreenReturnFocusRef/);
  assert.match(artifactLoaderSource, /tabIndex=\{-1\}/);
  assert.match(artifactLoaderSource, /onKeyDown=\{handleFullscreenKeyDown\}/);
  assert.match(artifactLoaderSource, /['"]Fullscreen artifact['"]/);
  assert.equal(
    artifactLoaderSource.match(/<ArtifactRenderer\b/g)?.length,
    1,
    'fullscreen must preserve one mounted ArtifactRenderer instance',
  );
  assert.match(
    mainInterfaceSource,
    /!isNarrowLayout\s*&&\s*\(\s*<ResizeHandle/,
    'the resize separator must not consume width in the narrow full-screen artifact overlay',
  );
  assert.match(queryWorkspaceSource, /role="tabpanel"/);
  assert.match(queryWorkspaceSource, /id=\{`sql-query-panel-\$\{activeTabId\}`\}/);
  assert.match(queryWorkspaceSource, /aria-labelledby=\{`sql-query-tab-\$\{activeTabId\}`\}/);
  assert.doesNotMatch(schemaMindmapSource, /disableAutoFocus/);
  assert.doesNotMatch(schemaMindmapSource, /disableEnforceFocus/);
  assert.doesNotMatch(schemaMindmapSource, /disableRestoreFocus/);
  assert.match(schemaMindmapSource, /useReducedMotion/);
  assert.match(schemaMindmapSource, /autoFocus/);
  assert.match(schemaMindmapSource, /size:\s*\{ xs: 44, md: 34 \}/);
  assert.match(schemaMindmapSource, /role="status"/);
  assert.match(dataVisualizationSource, /ArtifactEmptyState/);
  assert.match(dataVisualizationSource, /role="alert"/);
  assert.match(
    dataVisualizationSource,
    /<Box sx=\{\{ flex: 1, minHeight: 0, minWidth: 0 \}\}>/,
  );
  assert.match(perspectiveDashboardSource, /flex:\s*1/);
  assert.match(perspectiveDashboardSource, /role="status"/);
  assert.match(perspectiveDashboardSource, /role="alert"/);
  assert.doesNotMatch(perspectiveDashboardSource, /shadowRoot|::part|::theme/);

  console.log(
    'PASS: workspace overlays expose responsive geometry and semantic feedback.',
  );
} finally {
  await server.close();
}
