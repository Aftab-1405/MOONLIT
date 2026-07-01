import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Box } from '@mui/material';
import { Component, memo, useCallback, useMemo, useState } from 'react';
import { ArtifactEmptyState } from '@/features/sidebar-right/artifact-loader/ArtifactLayout';
import DataVisualizationPanel from '@/features/sidebar-right/artifacts/data-visualization';
import DiagramFlowRenderer from '@/features/sidebar-right/artifacts/diagram-flow';
import SqlWorkspace from '@/features/sidebar-right/artifacts/sql-workspace';
import { getAppSunkenSurfaceSx, getArtifactPanelChromeSx } from '@/features/styles/interfaceChrome';
import { UI_Z_INDEX } from '@/styles/shared';

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
  return (
    <Box
      component="aside"
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        minWidth: 0,
        minHeight: 0,
        width: fullscreen ? 'auto' : open ? panelWidth : 0,
        height: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition:
          isResizing || fullscreen
            ? 'none'
            : theme.transitions.create('width', {
                easing: theme.transitions.easing.easeInOut,
                duration: 240,
              }),
        willChange: fullscreen ? 'auto' : 'width',
        ...(open && !fullscreen ? getArtifactPanelChromeSx(theme) : {}),
        ...(fullscreen
          ? {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              width: 'auto !important',
              height: 'auto !important',
              zIndex: UI_Z_INDEX.artifactFullscreen,
              ...getAppSunkenSurfaceSx(theme),
              borderLeft: 'none',
              boxShadow: 'none',
            }
          : {}),
      })}
    >
      {children}
    </Box>
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
    },
  });

  return <Renderer {...rendererProps} />;
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
          />
        </ArtifactErrorBoundary>
      </Box>
    </CanvasHost>
  );
}

export default memo(ArtifactLoader);
