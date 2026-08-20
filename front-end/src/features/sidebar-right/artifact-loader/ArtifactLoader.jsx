// ArtifactLoader — host panel for canvas artifacts (right side of the workspace).
//
// Responsibilities:
//   - Look up the correct renderer for `artifact.type` in `artifactRegistry`.
//   - Manage per-artifact fullscreen state (user can pop a single artifact
//     to fullscreen — this is internal to the artifact panel, distinct from
//     the column-level open/close which is owned by AppShell).
//   - Catch renderer errors via `ArtifactErrorBoundary` so one broken
//     artifact doesn't take down the whole panel.
//
// Renderers (all lazy-loaded so they don't bloat the initial bundle):
//   - `sql-editor`     → SqlWorkspace             (CodeMirror)
//   - `visualization`  → DataVisualizationPanel   (Perspective — ~10MB)
//   - `react-flow`     → DiagramFlowRenderer      (react-flow + dagre)
//
// Layout: ArtifactLoader no longer owns its column-width animation — that is
// AppShell's responsibility. ArtifactLoader fills its slot (100% × 100%) and
// paints no surface of its own (the column already did).
//
// Fullscreen behavior: a SINGLE ArtifactRenderer instance is rendered as a
// child of one container Box. When `effectiveFullscreen` flips, only the CSS
// on that container changes — `position: fixed` + inset 0 — so it breaks out
// of the artifact column and covers the entire viewport. React never sees a
// tree change, so the renderer fiber is preserved across the transition and
// all internal state (SQL editor tabs, scroll position, CodeMirror cursor,
// Perspective viewer config) survives.
//
// Previous bug: two separate ArtifactRenderer instances were mounted (one
// in-flow, one in an absolute overlay). The overlay only covered the
// artifact column — so the artifact didn't actually get bigger — AND the
// duplicate instance lost all internal state on every toggle.

import { Box, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Component,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ErrorIcon } from '@/components/icons';
import { ArtifactEmptyState } from '@/features/sidebar-right/artifact-loader/ArtifactLayout';
import { getAppSunkenSurfaceSx } from '@/features/styles/interfaceChrome';
import { UI_Z_INDEX } from '@/styles/shared';

const MotionDiv = motion.div;

// ─── Lazy-loaded renderers ───────────────────────────────────────────────────
const DataVisualizationPanel = lazy(
  () => import('@/features/sidebar-right/artifacts/data-visualization'),
);
const DiagramFlowRenderer = lazy(() => import('@/features/sidebar-right/artifacts/diagram-flow'));
const SqlWorkspace = lazy(() => import('@/features/sidebar-right/artifacts/sql-workspace'));

/**
 * Suspense fallback shown while a renderer chunk downloads. Mimics the
 * structure of an actual artifact panel: a header row (icon + title bar),
 * a toolbar row of action-button slots, and a large body placeholder.
 */
function RendererFallback() {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Loading artifact"
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
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
            <Skeleton key={i} variant="circular" width={28} height={28} animation="wave" />
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
          role="alert"
          ariaLive="assertive"
          icon={<ErrorIcon sx={{ fontSize: 44 }} />}
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
        role="alert"
        ariaLive="assertive"
        icon={<ErrorIcon sx={{ fontSize: 44 }} />}
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
      isDbConnected,
      currentDatabase,
      onNotify,
    },
  });

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
  _panelWidth: _deprecatedPanelWidth,
  _fullscreen: _deprecatedFullscreen,
  isDbConnected = false,
  currentDatabase = null,
  _isResizing: _deprecatedIsResizing,
  _workspaceContainerRef: _deprecatedWorkspaceContainerRef,
  onNotify,
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const fullscreenRootRef = useRef(null);
  const fullscreenReturnFocusRef = useRef(null);
  const wasFullscreenRef = useRef(false);
  const [isArtifactFullscreen, setIsArtifactFullscreen] = useState(false);
  const artifactSignature = useMemo(() => getArtifactSignature(artifact), [artifact]);
  const effectiveFullscreen = Boolean(isArtifactFullscreen && artifact && isOpen);

  const captureFullscreenReturnFocus = useCallback(() => {
    if (
      typeof document !== 'undefined' &&
      typeof HTMLElement !== 'undefined' &&
      document.activeElement instanceof HTMLElement
    ) {
      fullscreenReturnFocusRef.current = document.activeElement;
    }
  }, []);

  const handleEnterFullscreen = useCallback(() => {
    captureFullscreenReturnFocus();
    setIsArtifactFullscreen(true);
  }, [captureFullscreenReturnFocus]);

  const handleExitFullscreen = useCallback(() => {
    setIsArtifactFullscreen(false);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (effectiveFullscreen) {
      setIsArtifactFullscreen(false);
      return;
    }

    captureFullscreenReturnFocus();
    setIsArtifactFullscreen(true);
  }, [captureFullscreenReturnFocus, effectiveFullscreen]);

  const handleFullscreenKeyDown = useCallback(
    (event) => {
      if (!effectiveFullscreen || event.key !== 'Escape') return;

      event.preventDefault();
      event.stopPropagation();
      handleExitFullscreen();
    },
    [effectiveFullscreen, handleExitFullscreen],
  );

  const handleRequestClose = useCallback(() => {
    setIsArtifactFullscreen(false);
    onClose?.();
  }, [onClose]);

  const handleRequestOpenArtifact = useCallback(
    (nextArtifact, options = {}) => {
      onOpenArtifact?.(nextArtifact);
      if (options.preserveFullscreen || isArtifactFullscreen) {
        if (!isArtifactFullscreen) captureFullscreenReturnFocus();
        setIsArtifactFullscreen(true);
      }
    },
    [captureFullscreenReturnFocus, isArtifactFullscreen, onOpenArtifact],
  );

  useEffect(() => {
    let animationFrameId;

    if (effectiveFullscreen) {
      wasFullscreenRef.current = true;
      animationFrameId = window.requestAnimationFrame(() => {
        fullscreenRootRef.current?.focus();
      });
    } else if (wasFullscreenRef.current) {
      wasFullscreenRef.current = false;
      const returnFocusTarget = fullscreenReturnFocusRef.current;
      fullscreenReturnFocusRef.current = null;
      animationFrameId = window.requestAnimationFrame(() => {
        if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
      });
    }

    return () => {
      if (animationFrameId !== undefined) window.cancelAnimationFrame(animationFrameId);
    };
  }, [effectiveFullscreen]);

  // When the panel is closed, render nothing — AppShell animates the column
  // width to 0 (so the layout still transitions smoothly).
  if (!isOpen) return null;

  // Single renderer instance, always rendered as a child of the SAME
  // container element. When `effectiveFullscreen` flips, only the CSS on the
  // container changes (position: fixed → fills viewport). React never
  // unmounts the renderer, so internal state (SQL editor tabs, scroll
  // position, CodeMirror cursor, Perspective viewer config, etc.) is
  // preserved across the maximize/unmaximize transition.
  //
  // Previous bug: two separate ArtifactRenderer instances were mounted (one
  // in-flow, one in an overlay) and the overlay only covered the artifact
  // column — so the artifact didn't actually get bigger AND state was lost
  // on every toggle.
  return (
    <Box
      ref={fullscreenRootRef}
      role="region"
      aria-label={effectiveFullscreen ? 'Fullscreen artifact' : 'Artifact panel'}
      tabIndex={-1}
      onKeyDown={handleFullscreenKeyDown}
      sx={{
        // When NOT fullscreen: fill the artifact column (in-flow).
        // When fullscreen: break out of the column via `position: fixed` and
        // cover the entire viewport. This is a pure CSS transition — React
        // doesn't see it, so the renderer instance is preserved.
        ...(effectiveFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: UI_Z_INDEX.artifactFullscreen,
              // Smooth fade-in when entering fullscreen. The transition is
              // one-shot (no exit animation) because we can't animate a
              // position change from fixed → in-flow cleanly. The opacity
              // transition is handled by Framer Motion below.
            }
          : {
              position: 'relative',
              flex: 1,
              minWidth: 0,
              minHeight: 0,
            }),
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        // Apply the sunken surface only in fullscreen so the in-flow state
        // inherits the column's surface (painted by AppShell).
        ...(effectiveFullscreen ? getAppSunkenSurfaceSx(theme) : {}),
      }}
    >
      <AnimatePresence>
        {effectiveFullscreen && (
          <MotionDiv
            key="fullscreen-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              // Subtle backdrop tint to visually separate the fullscreen
              // artifact from the workspace beneath it.
              backgroundColor: theme.palette.overlay.fullscreen,
            }}
          />
        )}
      </AnimatePresence>

      <Box
        key={artifactSignature}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
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
            onNotify={onNotify}
          />
        </ArtifactErrorBoundary>
      </Box>
    </Box>
  );
}

export default memo(ArtifactLoader);
