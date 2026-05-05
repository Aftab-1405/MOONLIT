import { memo, useMemo } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import DatasetOutlinedIcon from '@mui/icons-material/DatasetOutlined';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import SQLEditorCanvas from './SQLEditorCanvas';
import SQLResultsTable from './SQLResultsTable';
import ChartVisualization from './ChartVisualization';
import DiagramFlowRenderer from './DiagramFlowRenderer';
import { getGhostIconButtonSx, getGlassmorphismStyles } from '../styles/shared';

const ARTIFACT_META = {
  'sql-editor': { title: 'SQL editor', icon: CodeRoundedIcon, ariaLabel: 'SQL editor' },
  results: { title: 'Results', icon: DatasetOutlinedIcon, ariaLabel: 'Results canvas' },
  visualization: { title: 'Visualization', icon: BarChartRoundedIcon, ariaLabel: 'Visualization canvas' },
  'react-flow': { title: 'Diagram', icon: AccountTreeRoundedIcon, ariaLabel: 'Diagram canvas' },
};

function getArtifactKey(artifact) {
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

function WorkspaceCanvasHeader({ title, Icon, action, onClose }) {
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, minWidth: 0 }}>
        <HeaderIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
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

function renderArtifactContent({ artifact, onClose, isDbConnected, currentDatabase }) {
  if (!artifact) return null;

  switch (artifact.type) {
    case 'sql-editor':
      return (
        <SQLEditorCanvas
          isConnected={isDbConnected}
          currentDatabase={currentDatabase}
          {...artifact.props}
        />
      );
    case 'results':
      return <SQLResultsTable data={artifact.props?.data} onClose={onClose} embedded />;
    case 'visualization':
      return <ChartVisualization data={artifact.props?.data} embedded />;
    case 'react-flow':
      return (
        <DiagramFlowRenderer
          code={artifact.props?.code || ''}
          embedded
        />
      );
    default:
      return null;
  }
}

function WorkspaceCanvas({
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
  const artifactKey = useMemo(() => getArtifactKey(artifact), [artifact]);
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
  const content = renderArtifactContent({ artifact, onClose, isDbConnected, currentDatabase });

  return (
    <Box component="section" aria-label={meta.ariaLabel} sx={panelSx}>
      <WorkspaceCanvasHeader
        title={title}
        Icon={meta.icon}
        action={headerAction}
        onClose={onClose}
      />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}
      >
        <Box
          key={artifactKey}
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            p: { xs: 1, sm: 1.25 },
            animation: 'workspaceArtifactIn 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
            '@keyframes workspaceArtifactIn': {
              from: { opacity: 0, transform: 'translateY(8px) scale(0.992)' },
              to: { opacity: 1, transform: 'translateY(0) scale(1)' },
            },
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
            },
          }}
        >
          {content}
        </Box>
      </Box>
    </Box>
  );
}

export default memo(WorkspaceCanvas);
