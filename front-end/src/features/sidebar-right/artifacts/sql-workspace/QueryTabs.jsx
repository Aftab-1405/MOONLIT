import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import { Box, IconButton, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { memo } from 'react';
import CodeEditorIcon from '@/components/icons/CodeEditorIcon';
import SidebarPanelIcon from '@/components/icons/SidebarPanelIcon';
import { getArtifactActionButtonSx } from '@/features/sidebar-right/artifact-loader';
import { getInteractionColors, getScrollbarStyles } from '@/styles/shared';

const TAB_HEIGHT = 32;
const TAB_MIN_WIDTH = 104;
const TAB_MAX_WIDTH = 196;

function getTabSx(theme, active) {
  const interaction = getInteractionColors(theme, { active });
  const activeBackground = alpha(
    theme.palette.text.primary,
    theme.palette.mode === 'dark' ? 0.09 : 0.055,
  );
  const activeHoverBackground = alpha(
    theme.palette.text.primary,
    theme.palette.mode === 'dark' ? 0.12 : 0.075,
  );

  return {
    height: TAB_HEIGHT,
    minWidth: TAB_MIN_WIDTH,
    maxWidth: TAB_MAX_WIDTH,
    flex: '0 1 auto',
    px: 1.125,
    py: 0,
    gap: 0.75,
    border: 0,
    borderRadius: '9px',
    textTransform: 'none',
    color: active ? 'text.primary' : 'text.secondary',
    bgcolor: active ? activeBackground : 'transparent',
    boxShadow: active
      ? `inset 0 0 0 1px ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.1 : 0.075)}`
      : 'none',
    transition: theme.transitions.create(['background-color', 'box-shadow', 'color'], {
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover': {
      color: 'text.primary',
      bgcolor: active ? activeHoverBackground : interaction.hoverBackground,
    },
    '&.Mui-selected': {
      color: 'text.primary',
      bgcolor: activeBackground,
      '&:hover': { bgcolor: activeHoverBackground },
    },
    '&.MuiToggleButtonGroup-grouped': {
      border: 0,
      mx: 0,
      '&:not(:first-of-type)': {
        borderRadius: '9px',
        marginLeft: 0,
      },
      '&:first-of-type': { borderRadius: '9px' },
    },
  };
}

function QueryTabs({
  tabs,
  activeTabId,
  onTabChange,
  onTabAdd,
  onTabClose,
  onToggleSidebar,
  schemaSidebarOpen,
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.625,
        px: 1.125,
        py: 0.875,
        bgcolor: 'transparent',
        flexShrink: 0,
        minHeight: 48,
      }}
    >
      {!schemaSidebarOpen && (
        <Tooltip title="Show schema explorer">
          <IconButton
            size="small"
            onClick={onToggleSidebar}
            aria-label="Show schema explorer"
            sx={getArtifactActionButtonSx(theme, { size: 32 })}
          >
            <SidebarPanelIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}

      <ToggleButtonGroup
        exclusive
        value={activeTabId}
        onChange={(_, nextTabId) => {
          if (nextTabId) onTabChange(nextTabId);
        }}
        aria-label="SQL query tabs"
        sx={{
          flex: 1,
          minWidth: 0,
          gap: 0.5,
          overflowX: 'auto',
          overflowY: 'hidden',
          flexWrap: 'nowrap',
          p: 0,
          ...getScrollbarStyles(theme),
          '& .MuiToggleButtonGroup-grouped': {
            ...theme.typography.uiCaptionMd,
          },
        }}
      >
        {tabs.map((tab) => {
          const active = activeTabId === tab.id;
          return (
            <ToggleButton
              key={tab.id}
              value={tab.id}
              aria-label={tab.title}
              sx={getTabSx(theme, active)}
            >
              <CodeEditorIcon
                sx={{
                  width: 14,
                  height: 14,
                  flexShrink: 0,
                  color: active ? 'text.primary' : 'text.disabled',
                }}
              />
              <Box
                component="span"
                sx={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                }}
              >
                {tab.title}
              </Box>
              {tab.isDirty && (
                <FiberManualRecordRoundedIcon
                  sx={{ fontSize: 7, color: 'text.primary', flexShrink: 0 }}
                />
              )}
              {tabs.length > 1 && (
                <Tooltip title="Close query">
                  <Box
                    component="span"
                    role="button"
                    tabIndex={0}
                    aria-label={`Close ${tab.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onTabClose(tab.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        onTabClose(tab.id);
                      }
                    }}
                    sx={{
                      width: 20,
                      height: 20,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'inherit',
                      opacity: active ? 0.72 : 0,
                      borderRadius: '6px',
                      transition: theme.transitions.create(['background-color', 'opacity'], {
                        duration: theme.transitions.duration.shorter,
                      }),
                      '.MuiToggleButton-root:hover &': { opacity: 0.72 },
                      '&:hover': {
                        opacity: 1,
                        bgcolor: alpha(
                          theme.palette.text.primary,
                          theme.palette.mode === 'dark' ? 0.12 : 0.06,
                        ),
                      },
                      '&:focus-visible': {
                        opacity: 1,
                        outline: `2px solid ${alpha(theme.palette.primary.main, 0.38)}`,
                        outlineOffset: 1,
                      },
                    }}
                  >
                    <CloseRoundedIcon sx={{ fontSize: 14 }} />
                  </Box>
                </Tooltip>
              )}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>

      <Tooltip title="Create new query">
        <IconButton
          size="small"
          onClick={onTabAdd}
          aria-label="Create new query"
          sx={{
            ...getArtifactActionButtonSx(theme, { size: 32 }),
            color: 'text.primary',
            bgcolor: alpha(
              theme.palette.text.primary,
              theme.palette.mode === 'dark' ? 0.07 : 0.045,
            ),
          }}
        >
          <AddRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default memo(QueryTabs);
