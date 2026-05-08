import { Component, Suspense, lazy, memo, useCallback, useMemo, useState } from 'react';
import { Box, Skeleton, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { ArtifactEmptyState } from './ArtifactLayout';

const artifactRegistry = {
  'sql-editor': {
    loader: lazy(() => import('../artifacts/sql-workspace')),
    getProps: ({ artifact, common }) => ({
      ...artifact.props,
      ...common,
      title: artifact.title,
      isConnected: common.isDbConnected,
      currentDatabase: common.currentDatabase,
    }),
  },
  results: {
    loader: lazy(() => import('../artifacts/execution-result')),
    getProps: ({ artifact, common }) => ({
      data: artifact.props?.data,
      title: artifact.title,
      sourceQuery: artifact.props?.sourceQuery,
      sourceType: artifact.props?.sourceType,
      ...common,
    }),
  },
  visualization: {
    loader: lazy(() => import('../artifacts/data-visualization')),
    getProps: ({ artifact, common }) => ({
      data: artifact.props?.data,
      title: artifact.title,
      sourceQuery: artifact.props?.sourceQuery,
      sourceType: artifact.props?.sourceType,
      ...common,
    }),
  },
  'react-flow': {
    loader: lazy(() => import('../artifacts/diagram-flow')),
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
  if (artifact.type === 'sql-editor') return `${artifact.type}-${props.initialQuery || ''}-${props.initialResults?.row_count || 0}`;
  return `${artifact.type}-${props.data?.row_count || 0}-${props.data?.columns?.join('|') || ''}`;
}

function CanvasHost({ open, panelWidth, fullscreen = false, children }) {
  return (
    <Box
      component="aside"
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        minWidth: 0,
        minHeight: 0,
        width: fullscreen ? '100%' : open ? panelWidth : 0,
        height: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: theme.transitions.create('width', {
          easing: open ? theme.transitions.easing.sharp : theme.transitions.easing.easeOut,
          duration: open ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen,
        }),
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
          message={this.state.error?.message || 'Try opening another artifact or rerun the request.'}
        />
      );
    }

    return this.props.children;
  }
}

function ArtifactLoadingFallback() {
  return (
    <Stack
      spacing={1.5}
      sx={(theme) => ({
        height: '100%',
        minHeight: 0,
        p: 2,
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.28 : 0.44),
      })}
    >
      <Skeleton variant="rounded" width="42%" height={28} />
      <Skeleton variant="rounded" width="100%" height={42} />
      <Skeleton variant="rounded" sx={{ flex: 1, minHeight: 120 }} />
    </Stack>
  );
}

function UnknownArtifactFallback({ type }) {
  return (
    <Box sx={{ height: '100%', minHeight: 0 }}>
      <ArtifactEmptyState
        icon={<ErrorOutlineRoundedIcon sx={{ fontSize: 44 }} />}
        title="Unsupported artifact"
        message={type ? `No renderer is registered for "${type}".` : 'No artifact renderer is registered.'}
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

  const handleRequestOpenArtifact = useCallback((nextArtifact, options = {}) => {
    onOpenArtifact?.(nextArtifact);
    if (options.preserveFullscreen || isArtifactFullscreen) {
      setIsArtifactFullscreen(true);
    }
  }, [isArtifactFullscreen, onOpenArtifact]);

  return (
    <CanvasHost open={isOpen} panelWidth={panelWidth} fullscreen={fullscreen}>
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
          <Suspense fallback={<ArtifactLoadingFallback />}>
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
          </Suspense>
        </ArtifactErrorBoundary>
      </Box>
    </CanvasHost>
  );
}

export default memo(ArtifactLoader);
