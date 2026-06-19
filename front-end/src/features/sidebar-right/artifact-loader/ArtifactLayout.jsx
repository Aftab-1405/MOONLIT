import { memo } from 'react';
import {
  Box,
  Card,
  Fade,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { getScrollbarStyles, UI_Z_INDEX } from '@/styles/shared';
import {
  ARTIFACT_ROOT_SX,
  ARTIFACT_STANDALONE_INSET,
  getArtifactActionButtonSx,
  useArtifactActions,
} from '@/features/sidebar-right/artifact-loader/artifactLayoutUtils';



function ArtifactActionButton({
  label,
  icon,
  onClick,
  disabled = false,
  active = false,
  size = 36,
}) {
  const theme = useTheme();

  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          sx={getArtifactActionButtonSx(theme, { active, size })}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function ArtifactToolbar({ children, sx = {} }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!children) return null;

  return (
    <Box
      sx={{
        flexShrink: 0,
        p: isMobile ? 1.5 : 2,
        borderBottom: '1px solid',
        borderColor: theme.palette.border.subtle,
        bgcolor: theme.palette.background.paper,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function ArtifactHeader({
  icon,
  title,
  subtitle,
  actions,
  sx = {},
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const visibleActions = useArtifactActions(actions);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        flexShrink: 0,
        p: isMobile ? 1.5 : 2,
        borderBottom: '1px solid',
        borderColor: theme.palette.border.subtle,
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.55 : 0.98),
        backgroundImage: theme.palette.mode === 'dark'
          ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.03)} 0%, transparent 100%)`
          : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.55)} 0%, transparent 100%)`,
        ...sx,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
        {icon ? <Box sx={{ display: 'flex', color: 'text.secondary', flexShrink: 0 }}>{icon}</Box> : null}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            noWrap
            sx={{
              ...theme.typography.uiBodyMd,
              fontWeight: 650,
              color: 'text.primary',
            }}
          >
            {title}
          </Typography>
          {subtitle ? (
            <Typography
              noWrap
              sx={{
                ...theme.typography.uiCaptionSm,
                color: 'text.secondary',
                mt: 0.25,
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </Stack>

      {visibleActions.length ? (
        <Stack direction="row" alignItems="center" gap={0.5} flexShrink={0} flexWrap="wrap" justifyContent="flex-end">
          {visibleActions.map((action) => (
            <ArtifactActionButton key={action.key || action.label} {...action} />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}

function ArtifactBody({ children, component = 'div', scroll = 'auto', sx = {} }) {
  const theme = useTheme();

  return (
    <Box
      component={component}
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: scroll,
        ...getScrollbarStyles(theme),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function ArtifactFooter({ children, sx = {} }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!children) return null;

  return (
    <Box
      sx={{
        flexShrink: 0,
        px: isMobile ? 1.5 : 2,
        py: 1.5,
        borderTop: '1px solid',
        borderColor: theme.palette.border.subtle,
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.5 : 1),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function ArtifactEmptyState({
  icon,
  title = 'Nothing to display',
  message,
  sx = {},
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        ...ARTIFACT_ROOT_SX,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        p: 4,
        textAlign: 'center',
        color: 'text.secondary',
        ...sx,
      }}
    >
      {icon ? <Box sx={{ display: 'flex', color: 'text.disabled', opacity: 0.58 }}>{icon}</Box> : null}
      <Typography sx={{ ...theme.typography.uiBodyMd, color: 'text.secondary', fontWeight: 600 }}>
        {title}
      </Typography>
      {message ? (
        <Typography sx={{ ...theme.typography.uiCaptionMd, color: 'text.disabled', maxWidth: 360 }}>
          {message}
        </Typography>
      ) : null}
    </Box>
  );
}



function ArtifactShell({
  title,
  subtitle,
  icon,
  chrome = 'standalone',
  onClose,
  onRequestClose,
  _workspaceContainerRef,
  fullscreenMode = 'workspace',
  isFullscreen = false,
  onEnterFullscreen,
  onExitFullscreen,
  onToggleFullscreen,
  actions = [],
  controls,
  footer,
  children,
  bodyScroll = 'hidden',
  bodySx = {},
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isStandalone = chrome === 'standalone';
  const requestClose = onRequestClose || onClose;
  const handleFullscreenClick = isFullscreen
    ? (onExitFullscreen || onToggleFullscreen)
    : (onEnterFullscreen || onToggleFullscreen);

  const shellActions = useArtifactActions([
    ...actions,
    isStandalone && fullscreenMode === 'workspace' && handleFullscreenClick
      ? {
          key: 'fullscreen',
          label: isFullscreen ? 'Exit fullscreen' : 'Fullscreen',
          icon: isFullscreen
            ? <FullscreenExitRoundedIcon sx={{ fontSize: 18 }} />
            : <FullscreenRoundedIcon sx={{ fontSize: 18 }} />,
          onClick: handleFullscreenClick,
          active: isFullscreen,
        }
      : null,
    isStandalone && requestClose
      ? {
          key: 'close',
          label: 'Close artifact',
          icon: <CloseRoundedIcon sx={{ fontSize: 18 }} />,
          onClick: requestClose,
        }
      : null,
  ]);

  const card = (
    <Card
      elevation={0}
      sx={{
        ...ARTIFACT_ROOT_SX,
        borderRadius: isStandalone ? (isMobile ? '10px' : '14px') : 0,
        border: isStandalone ? '1px solid' : 0,
        borderColor: theme.palette.border.subtle,
        bgcolor: 'background.paper',
        boxShadow: isStandalone
          ? `0 8px 24px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.22 : 0.07)}`
          : 'none',
      }}
    >
      {isStandalone ? (
        <ArtifactHeader icon={icon} title={title} subtitle={subtitle} actions={shellActions} />
      ) : null}
      {controls ? <ArtifactToolbar>{controls}</ArtifactToolbar> : null}
      <ArtifactBody scroll={bodyScroll} sx={bodySx}>
        {children}
      </ArtifactBody>
      {footer ? <ArtifactFooter>{footer}</ArtifactFooter> : null}
    </Card>
  );

  const shell = isStandalone ? (
    <Box
      sx={{
        ...ARTIFACT_ROOT_SX,
        p: ARTIFACT_STANDALONE_INSET,
        boxSizing: 'border-box',
      }}
    >
      {card}
    </Box>
  ) : card;

  return shell;
}

export default memo(ArtifactShell);
