import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Box, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { Component, lazy, memo, Suspense, useCallback, useMemo, useState } from 'react';
import { ArtifactEmptyState } from '@/features/sidebar-right/artifact-loader/ArtifactLayout';
import { getAppSunkenSurfaceSx, getArtifactPanelChromeSx } from '@/features/styles/interfaceChrome';
import { UI_Z_INDEX } from '@/styles/shared';

/**
 * ArtifactLoader — host panel for canvas artifacts (right side of the workspace).
 *
 * Responsibilities:
 *   - Look up the correct renderer for `artifact.type` in `artifactRegistry`.
 *   - Manage fullscreen state (user can pop a single artifact to fullscreen).
 *   - Animate panel width via framer-motion (desktop) or full-screen slide-up
 *     (mobile — handled by the parent MainInterface).
 *   - Catch renderer errors via `ArtifactErrorBoundary` so one broken
 *     artifact doesn't take down the whole panel.
 *
 * Renderers (all lazy-loaded so they don't bloat the initial bundle):
 *   - `sql-editor`     → SqlWorkspace             (CodeMirror)
 *   - `visualization`  → DataVisualizationPanel   (Perspective — ~10MB)
 *   - `react-flow`     → DiagramFlowRenderer      (react-flow + dagre)
 *
 * The Perspective bundle is by far the heaviest — lazy-loading it keeps the
 * initial chat shell under 2MB instead of 12MB+, which makes first paint
 * dramatically faster.
 */

// ─── Lazy-loaded renderers ───────────────────────────────────────────────────
// Each renderer pulls in megabytes of vendor code (Perspective, CodeMirror,
// react-flow). Lazy-loading them means users who never open an artifact never
// download that code. The Suspense fallback below renders a graceful skeleton.
const DataVisualizationPanel = lazy(
  () => import('@/features/sidebar-right/artifacts/data-visualization'),
);
const DiagramFlowRenderer = lazy(
  () => import('@/features/sidebar-right/artifacts/diagram-flow'),
);
const SqlWorkspace = lazy(() => import('@/features/sidebar-right/artifacts/sql-workspace'));

/**
 * Suspense fallback shown while a renderer chunk downloads. Mimics the
 * structure of an actual artifact panel: a header row (icon + title bar),
 * a toolbar row of action-button slots, and a large body placeholder.
 * This reads as "the panel is loading its content" rather than a generic
 * gray block — users immediately understand what's about to appear.
 */
function RendererFallback() {
  return (
    <Box
      role="status"
      aria-label="Loading artifact"
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper',
      }}
    >
      {/* Header row — icon slot + title bar + action-button slots */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Skeleton variant="rounded" width={30} height={30} sx={{ borderRadius: '8px' }} />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Skeleton variant="rounded" width="55%" height={10} sx={{ borderRadius: 999 }} />
          <Skeleton variant="rounded" width="32%" height={8} sx={{ borderRadius: 999 }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              variant="circular"
              width={28}
              height={28}
              animation="wave"
            />
          ))}
        </Box>
      </Box>

      {/* Body placeholder — large rounded rectangle fills remaining space */}
      <Box sx={{ flex: 1, minHeight: 0, p: 2, display: 'flex' }}>
        <Skeleton
          variant="rounded"
          animation="wave"
          sx={{ width: '100%', height: '100%', borderRadius: 2 }}
        />
      </Box>
    </Box>
  );
}

const dataVisualizationRenderer = {
  loader: DataVisualizationPanel,
  getProps: ({ artifact, common }) => ({
    data: artifact.props?.data,
    title: artifact.title,
    sourceQuery: artifact.props?.sourceQuery,
    sourceType: artifact.props?.sourceType,
    ...common,
  }),
};

const artifactRegistry = {
  'sql-editor': {
    loader: SqlWorkspace,
    getProps: ({ artifact, common }) => ({
      ...artifact.props,
      ...common,
      title: artifact.title,
      isConnected: common.isDbConnected,
      currentDatabase: common.currentDatabase,
      // `isStreaming` comes from the artifact's props — set by the controller
      // when the agent is actively writing the query via write_sql_editor_query.
      isStreaming: artifact.props?.isStreaming ?? false,
    }),
  },
  visualization: dataVisualizationRenderer,
  // Compatibility for persisted artifacts and older callers that still emit "results".
  results: dataVisualizationRenderer,
  'react-flow': {
    loader: DiagramFlowRenderer,
    getProps: ({ artifact, common }) => ({
      code: artifact.props?.code || '',
      title: artifact.title,
      ...common,
    }),
  },
};

function getArtifactSignature(artifact) {
  if (!artifact) return 'empty';
  if (artifact.id || artifact.version) {
    return `${artifact.type}-${artifact.id || 'artifact'}-${artifact.version || 'v0'}`;
  }
  const props = artifact.props || {};
  if (artifact.type === 'react-flow') return `${artifact.type}-${props.code?.length || 0}`;
  if (artifact.type === 'sql-editor')
    return `${artifact.type}-${props.initialQuery || ''}-${props.initialResults?.row_count || 0}`;
  return `${artifact.type}-${props.data?.row_count || 0}-${props.data?.columns?.join('|') || ''}`;
}

function CanvasHost({ open, panelWidth, fullscreen = false, isResizing = false, children }) {
  const theme = useTheme();
  const targetWidth = open ? panelWidth : 0;

  // ── Layout strategy ─────────────────────────────────────────────────────
  // The in-flow motion.div ALWAYS renders (when open) and animates width
  // exactly like the left sidebar. This keeps the 3-column flex layout
  // stable during ALL transitions — open/close AND fullscreen toggle.
  //
  // When fullscreen, the in-flow panel keeps its width (panelWidth) so the
  // chat workspace doesn't reflow. The panel's content is NOT rendered
  // in-flow (to avoid duplicate React nodes / refs); instead, a separate
  // absolute overlay renders the content on top of the entire workspace.
  //
  // Previous bug: the in-flow motion.div was replaced entirely by the
  // overlay when fullscreen. The section (flexShrink: 0) collapsed to
  // the ResizeHandle's 10px width, the chat workspace expanded, and the
  // panel appeared "squished and pushed to the left."

  return (
    <>
      {/* ── In-flow width placeholder (always present when open) ── */}
      {/* Animates width identically to the left sidebar. Keeps the flex
          layout stable. Content is hidden when fullscreen (shown in the
          overlay below). */}
      <motion.div
        animate={{ width: targetWidth }}
        transition={isResizing ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
        style={{
          flexShrink: 0,
          height: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <Box
          component="aside"
          sx={{
            width: panelWidth,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
            ...getArtifactPanelChromeSx(theme),
          }}
        >
          {/* Only render children here when NOT fullscreen — avoids
              duplicate nodes / refs. Fullscreen content is in the overlay. */}
          {!fullscreen && children}
        </Box>
      </motion.div>

      {/* ── Fullscreen overlay ── */}
      {/* Absolute within the workspace container (the nearest positioned
          ancestor). Covers the full workspace area — chat + canvas section.
          The in-flow placeholder underneath keeps its width so the layout
          doesn't shift. */}
      {fullscreen && open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
            zIndex: UI_Z_INDEX.artifactFullscreen,
          }}
        >
          <Box
            component="aside"
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
              ...getAppSunkenSurfaceSx(theme),
              boxShadow: 'none',
            }}
          >
            {children}
          </Box>
        </motion.div>
      )}
    </>
  );
}

class ArtifactErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <ArtifactEmptyState
          icon={<ErrorOutlineRoundedIcon sx={{ fontSize: 44 }} />}
          title="Artifact failed to render"
          message={
            this.state.error?.message || 'Try opening another artifact or rerun the request.'
          }
        />
      );
    }

    return this.props.children;
  }
}

function UnknownArtifactFallback({ type }) {
  return (
    <Box sx={{ height: '100%', minHeight: 0 }}>
      <ArtifactEmptyState
        icon={<ErrorOutlineRoundedIcon sx={{ fontSize: 44 }} />}
        title="Unsupported artifact"
        message={
          type ? `No renderer is registered for "${type}".` : 'No artifact renderer is registered.'
        }
      />
    </Box>
  );
}

function ArtifactRenderer({
  artifact,
  isDbConnected,
  currentDatabase,
  onClose,
  onOpenArtifact,
  onRequestClose,
  onRequestOpenArtifact,
  isFullscreen,
  onEnterFullscreen,
  onExitFullscreen,
  onToggleFullscreen,
  workspaceContainerRef,
  onNotify,
}) {
  if (!artifact) return null;

  const registryEntry = artifactRegistry[artifact.type];
  if (!registryEntry) return <UnknownArtifactFallback type={artifact.type} />;

  const Renderer = registryEntry.loader;
  const rendererProps = registryEntry.getProps({
    artifact,
    common: {
      chrome: 'standalone',
      onClose,
      onOpenArtifact,
      onRequestClose,
      onRequestOpenArtifact,
      isFullscreen,
      onEnterFullscreen,
      onExitFullscreen,
      onToggleFullscreen,
      workspaceContainerRef,
      isDbConnected,
      currentDatabase,
      onNotify,
    },
  });

  // Wrap the lazy-loaded renderer in Suspense so the chunk download shows
  // our skeleton fallback instead of crashing the panel.
  return (
    <Suspense fallback={<RendererFallback />}>
      <Renderer {...rendererProps} />
    </Suspense>
  );
}

function ArtifactLoader({
  artifact,
  onOpenArtifact,
  onClose,
  isOpen = true,
  panelWidth = 520,
  fullscreen = false,
  isDbConnected = false,
  currentDatabase = null,
  isResizing = false,
  workspaceContainerRef,
  onNotify,
}) {
  const [isArtifactFullscreen, setIsArtifactFullscreen] = useState(false);
  const artifactSignature = useMemo(() => getArtifactSignature(artifact), [artifact]);
  const effectiveFullscreen = Boolean(isArtifactFullscreen && artifact && isOpen);

  const handleEnterFullscreen = useCallback(() => {
    setIsArtifactFullscreen(true);
  }, []);

  const handleExitFullscreen = useCallback(() => {
    setIsArtifactFullscreen(false);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setIsArtifactFullscreen((value) => !value);
  }, []);

  const handleRequestClose = useCallback(() => {
    setIsArtifactFullscreen(false);
    onClose?.();
  }, [onClose]);

  const handleRequestOpenArtifact = useCallback(
    (nextArtifact, options = {}) => {
      onOpenArtifact?.(nextArtifact);
      if (options.preserveFullscreen || isArtifactFullscreen) {
        setIsArtifactFullscreen(true);
      }
    },
    [isArtifactFullscreen, onOpenArtifact],
  );

  return (
    <CanvasHost
      open={isOpen}
      panelWidth={panelWidth}
      fullscreen={effectiveFullscreen || fullscreen}
      isResizing={isResizing}
    >
      <Box
        key={artifactSignature}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <ArtifactErrorBoundary resetKey={artifactSignature}>
          <ArtifactRenderer
            artifact={artifact}
            isDbConnected={isDbConnected}
            currentDatabase={currentDatabase}
            onClose={handleRequestClose}
            onOpenArtifact={handleRequestOpenArtifact}
            onRequestClose={handleRequestClose}
            onRequestOpenArtifact={handleRequestOpenArtifact}
            isFullscreen={effectiveFullscreen}
            onEnterFullscreen={handleEnterFullscreen}
            onExitFullscreen={handleExitFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            workspaceContainerRef={workspaceContainerRef}
            onNotify={onNotify}
          />
        </ArtifactErrorBoundary>
      </Box>
    </CanvasHost>
  );
}

export default memo(ArtifactLoader);
