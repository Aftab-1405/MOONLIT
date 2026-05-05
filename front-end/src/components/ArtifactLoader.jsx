import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, ButtonBase, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DatasetOutlinedIcon from '@mui/icons-material/DatasetOutlined';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { getGhostIconButtonSx, getGlassmorphismStyles } from '../styles/shared';

const ArtifactRenderers = {
  'sql-editor': lazy(() => import('./MonacoEditor')),
  results: lazy(() => import('./ExecutionResultPanel')),
  visualization: lazy(() => import('./DataVisualizationPanel')),
  'react-flow': lazy(() => import('./DiagramFlowRenderer')),
};

const ARTIFACT_META = {
  'sql-editor': { title: 'SQL editor', icon: CodeRoundedIcon, ariaLabel: 'SQL editor' },
  results: { title: 'Results', icon: DatasetOutlinedIcon, ariaLabel: 'Results canvas' },
  visualization: { title: 'Visualization', icon: BarChartRoundedIcon, ariaLabel: 'Visualization canvas' },
  'react-flow': { title: 'Diagram', icon: AccountTreeRoundedIcon, ariaLabel: 'Diagram canvas' },
};

function getArtifactSignature(artifact) {
  if (!artifact) return 'empty';
  const props = artifact.props || {};
  if (artifact.type === 'react-flow') {
    return `${artifact.type}-${props.code?.length || 0}`;
  }
  if (artifact.type === 'sql-editor') {
    return `${artifact.type}-${props.initialQuery || ''}-${props.initialResults?.row_count || 0}`;
  }
  return `${artifact.type}-${props.data?.row_count || 0}-${props.data?.columns?.join('|') || ''}`;
}

function getArtifactSource(artifact) {
  if (artifact?.type !== 'react-flow') return '';
  const props = artifact.props || {};
  return props.code || '';
}

const openedMixin = (theme, width) => ({
  width: typeof width === 'number' ? width : width,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
  ...getGlassmorphismStyles(theme),
});

const closedMixin = (theme) => ({
  width: 0,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  ...getGlassmorphismStyles(theme),
});

function buildCanvasSx(theme, open, panelWidth, fullscreen) {
  return {
    display: 'flex',
    flexDirection: 'column',
    height: fullscreen ? '100dvh' : '100%',
    '@supports not (height: 100dvh)': fullscreen ? { height: '100vh' } : undefined,
    width: fullscreen ? '100%' : undefined,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    bgcolor: 'background.default',
    ...(fullscreen ? {} : open ? openedMixin(theme, panelWidth) : closedMixin(theme)),
  };
}

function ArtifactModeSwitch({ mode, onModeChange }) {
  const segments = [
    { id: 'preview', label: 'Preview', icon: VisibilityRoundedIcon },
    { id: 'source', label: 'Source', icon: CodeRoundedIcon },
  ];

  return (
    <Box
      role="radiogroup"
      aria-label="Artifact view"
      sx={(theme) => {
        const isDark = theme.palette.mode === 'dark';
        return {
          display: 'inline-grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          alignItems: 'center',
          gap: 0.25,
          p: 0.25,
          width: 74,
          height: 34,
          flexShrink: 0,
          borderRadius: '10px',
          bgcolor: alpha(theme.palette.text.primary, isDark ? 0.11 : 0.055),
          border: '1px solid',
          borderColor: alpha(theme.palette.text.primary, isDark ? 0.09 : 0.07),
          boxSizing: 'border-box',
        };
      }}
    >
      {segments.map((segment) => {
        const Icon = segment.icon;
        const selected = mode === segment.id;
        return (
          <Tooltip key={segment.id} title={segment.label}>
            <span>
              <ButtonBase
                role="radio"
                aria-label={segment.label}
                aria-checked={selected}
                onClick={() => onModeChange(segment.id)}
                sx={(theme) => ({
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 28,
                  borderRadius: '8px',
                  color: selected ? 'text.primary' : 'text.secondary',
                  bgcolor: selected ? alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.96 : 1) : 'transparent',
                  boxShadow: selected
                    ? `0 0 0 1px ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.12 : 0.08)}, 0 1px 4px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.38 : 0.06)}`
                    : 'none',
                  transition: theme.transitions.create(['background-color', 'color', 'box-shadow'], {
                    duration: 160,
                    easing: theme.transitions.easing.easeInOut,
                  }),
                  '&:hover': {
                    color: 'text.primary',
                    bgcolor: selected
                      ? theme.palette.background.paper
                      : alpha(theme.palette.text.primary, 0.055),
                  },
                  '&:focus-visible': {
                    outline: `2px solid ${alpha(theme.palette.text.secondary, 0.38)}`,
                    outlineOffset: 1,
                  },
                })}
              >
                <Icon sx={{ fontSize: 18 }} />
              </ButtonBase>
            </span>
          </Tooltip>
        );
      })}
    </Box>
  );
}

function ArtifactLoaderHeader({ title, Icon, action, mode, onModeChange, sourceAvailable, sourceCopied, onCopySource, onClose }) {
  const HeaderIcon = Icon;
  const ActionIcon = action?.Icon;
  return (
    <Box
      sx={(theme) => {
        const isDark = theme.palette.mode === 'dark';
        return {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: { xs: 1, sm: 1.25 },
          py: { xs: 0.85, sm: 0.95 },
          flexShrink: 0,
          minHeight: { xs: 52, sm: 54 },
          borderBottom: '1px solid',
          borderColor: alpha(theme.palette.divider, isDark ? 0.85 : 0.95),
          background: isDark
            ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette.background.paper, 0.94)} 100%)`
            : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 1)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
        };
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, minWidth: 0, flex: 1 }}>
        {sourceAvailable && (
          <ArtifactModeSwitch
            mode={mode}
            onModeChange={onModeChange}
          />
        )}
        <HeaderIcon sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
        <Typography
          noWrap
          sx={(theme) => ({
            minWidth: 0,
            ...theme.typography.uiCaptionMd,
            fontWeight: 650,
            color: 'text.primary',
          })}
        >
          {title}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375, flexShrink: 0 }}>
        {sourceAvailable && (
          <Tooltip title={sourceCopied ? 'Copied' : 'Copy source'}>
            <IconButton
              size="small"
              onClick={onCopySource}
              aria-label="Copy artifact source"
              sx={(theme) => ({
                ...getGhostIconButtonSx(theme, { size: 34, radius: '10px', active: sourceCopied, activeColor: 'success.main' }),
              })}
            >
              {sourceCopied ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        )}
        {action && ActionIcon && (
          <Tooltip title={action.title}>
            <IconButton
              size="small"
              onClick={action.onClick}
              aria-label={action.ariaLabel}
              sx={(theme) => ({
                ...getGhostIconButtonSx(theme, { size: 34, radius: '10px' }),
              })}
            >
              <ActionIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Close canvas">
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close canvas"
            sx={(theme) => ({
              ...getGhostIconButtonSx(theme, { size: 34, radius: '10px' }),
            })}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

function ArtifactLoaderState({ title, children }) {
  return (
    <Box
      role="status"
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 1,
        color: 'text.secondary',
      }}
    >
      {children}
      <Typography sx={(theme) => ({ ...theme.typography.uiCaptionMd, color: 'text.secondary' })}>
        {title}
      </Typography>
    </Box>
  );
}

function ArtifactSourceView({ source, title }) {
  return (
    <Box
      component="pre"
      aria-label={`${title} source`}
      sx={(theme) => ({
        flex: 1,
        minHeight: 0,
        m: 0,
        p: { xs: 1.5, sm: 2 },
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        fontFamily: theme.typography.fontFamilyMono,
        ...theme.typography.uiCode,
        color: 'text.primary',
        bgcolor: 'background.paper',
        boxSizing: 'border-box',
      })}
    >
      <code>{source || 'No source available.'}</code>
    </Box>
  );
}

function LazyArtifactRenderer({ artifact, isDbConnected, currentDatabase }) {
  if (!artifact) {
    return <ArtifactLoaderState title="Select an artifact to preview." />;
  }

  const Renderer = ArtifactRenderers[artifact.type];
  if (!Renderer) {
    return <ArtifactLoaderState title="This artifact type is not supported yet." />;
  }

  const props = artifact.props || {};
  if (artifact.type === 'sql-editor') {
    return (
      <Renderer
        isConnected={isDbConnected}
        currentDatabase={currentDatabase}
        {...props}
      />
    );
  }
  if (artifact.type === 'results') {
    return <Renderer data={props.data} />;
  }
  if (artifact.type === 'visualization') {
    return <Renderer data={props.data} />;
  }
  if (artifact.type === 'react-flow') {
    return <Renderer code={props.code || ''} embedded />;
  }
  return null;
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
}) {
  const meta = ARTIFACT_META[artifact?.type] || ARTIFACT_META.results;
  const title = artifact?.title || meta.title;
  const artifactSignature = useMemo(() => getArtifactSignature(artifact), [artifact]);
  const source = useMemo(() => getArtifactSource(artifact), [artifact]);
  const sourceAvailable = Boolean(source);
  const [modeState, setModeState] = useState({ signature: 'empty', mode: 'preview' });
  const [copyState, setCopyState] = useState({ signature: 'empty', copied: false });
  const copyTimeoutRef = useRef(null);
  const mode = modeState.signature === artifactSignature && (sourceAvailable || modeState.mode === 'preview')
    ? modeState.mode
    : 'preview';
  const sourceCopied = copyState.signature === artifactSignature && copyState.copied;

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
  }, []);

  const handleModeChange = useCallback((nextMode) => {
    if (nextMode === 'source' && !sourceAvailable) return;
    setModeState({ signature: artifactSignature, mode: nextMode });
  }, [artifactSignature, sourceAvailable]);

  const handleCopySource = useCallback(() => {
    if (!source) return;
    navigator.clipboard.writeText(source);
    setCopyState({ signature: artifactSignature, copied: true });
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopyState({ signature: artifactSignature, copied: false });
    }, 1800);
  }, [artifactSignature, source]);

  const headerAction = useMemo(() => {
    const data = artifact?.props?.data;
    if (!data) return null;
    if (artifact.type === 'results') {
      return {
        title: 'Open visualization',
        ariaLabel: 'Open visualization',
        Icon: BarChartRoundedIcon,
        onClick: () => onOpenArtifact?.({
          type: 'visualization',
          title: 'Visualization',
          props: { data },
        }),
      };
    }
    if (artifact.type === 'visualization') {
      return {
        title: 'Open results',
        ariaLabel: 'Open results',
        Icon: DatasetOutlinedIcon,
        onClick: () => onOpenArtifact?.({
          type: 'results',
          title: 'Query results',
          props: { data },
        }),
      };
    }
    return null;
  }, [artifact, onOpenArtifact]);
  const panelSx = useMemo(
    () => (theme) => buildCanvasSx(theme, isOpen, panelWidth, fullscreen),
    [fullscreen, isOpen, panelWidth],
  );

  return (
    <Box component="section" aria-label={meta.ariaLabel} sx={panelSx}>
      <ArtifactLoaderHeader
        title={title}
        Icon={meta.icon}
        action={headerAction}
        mode={mode}
        onModeChange={handleModeChange}
        sourceAvailable={sourceAvailable}
        sourceCopied={sourceCopied}
        onCopySource={handleCopySource}
        onClose={onClose}
      />
      <Box
        sx={(theme) => ({
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          borderTop: '1px solid',
          borderColor: alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.03 : 0.55),
        })}
      >
        <Box
          sx={(theme) => ({
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            p: { xs: 1, sm: 1.25 },
            bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.38 : 0.46),
          })}
        >
          <Box
            key={`${artifactSignature}-${mode}`}
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'workspaceArtifactIn 180ms cubic-bezier(0.22, 1, 0.36, 1) both',
              '@keyframes workspaceArtifactIn': {
                from: { opacity: 0, transform: 'translateY(5px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
              '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
              },
            }}
          >
            {mode === 'source' ? (
              <ArtifactSourceView source={source} title={title} />
            ) : (
              <Suspense
                fallback={(
                  <ArtifactLoaderState title="Loading artifact...">
                    <CircularProgress size={24} sx={{ color: 'text.secondary' }} />
                  </ArtifactLoaderState>
                )}
              >
                <LazyArtifactRenderer
                  artifact={artifact}
                  isDbConnected={isDbConnected}
                  currentDatabase={currentDatabase}
                />
              </Suspense>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default memo(ArtifactLoader);
