/**
 * QueryTabs - Tab bar for managing multiple SQL queries
 */

import { memo } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import RemoveCircleOutlineRounded from '@mui/icons-material/RemoveCircleOutlineRounded';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import PostAddRounded from '@mui/icons-material/PostAddRounded';
import SidebarPanelIcon from '@/components/icons/SidebarPanelIcon';
import { getInteractionColors, getScrollbarStyles } from '@/styles/shared';
import { getArtifactActionButtonSx } from '@/features/sidebar-right/artifact-loader';
import { getAppBarSurfaceSx, getAppDividerColor } from '@/features/styles/interfaceChrome';

const TAB_HEIGHT = 30;
const TAB_MIN_WIDTH = 112;
const TAB_MAX_WIDTH = 220;

function getTabSx(theme, active) {
  const interaction = getInteractionColors(theme, { active });
  return {
    height: TAB_HEIGHT,
    minWidth: TAB_MIN_WIDTH,
    maxWidth: TAB_MAX_WIDTH,
    flex: '0 1 auto',
    px: 1,
    py: 0,
    gap: 0.75,
    border: 0,
    borderRadius: '8px',
    textTransform: 'none',
    color: active ? 'text.primary' : 'text.secondary',
    bgcolor: active ? interaction.activeBackground : 'transparent',
    transition: theme.transitions.create(['background-color', 'color'], {
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover': {
      color: 'text.primary',
      bgcolor: active ? interaction.activeHoverBackground : interaction.hoverBackground,
    },
    '&.Mui-selected': {
      color: 'text.primary',
      bgcolor: interaction.activeBackground,
      '&:hover': {
        bgcolor: interaction.activeHoverBackground,
      },
    },
    '&.MuiToggleButtonGroup-grouped': {
      border: 0,
      mx: 0,
      '&:not(:first-of-type)': {
        borderRadius: '8px',
        marginLeft: 0,
      },
      '&:first-of-type': {
        borderRadius: '8px',
      },
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
        gap: 0.75,
        px: 1,
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: getAppDividerColor(theme),
        ...getAppBarSurfaceSx(theme),
        flexShrink: 0,
        minHeight: 46,
      }}
    >
      {/* Sidebar toggle */}
      {!schemaSidebarOpen && (
        <Tooltip title="Show schema sidebar">
          <IconButton
            size="small"
            onClick={onToggleSidebar}
            aria-label="Show schema sidebar"
            sx={getArtifactActionButtonSx(theme, { size: 30 })}
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
              <Box
                component="span"
                sx={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'clip',
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                  maskImage: 'linear-gradient(to right, black 82%, transparent 98%)',
                  WebkitMaskImage: 'linear-gradient(to right, black 82%, transparent 98%)',
                }}
              >
                {tab.title}
              </Box>
              {tab.isDirty && (
                <FiberManualRecordRoundedIcon
                  sx={{ fontSize: 8, color: 'primary.main', flexShrink: 0 }}
                />
              )}
              {tabs.length > 1 && (
                <Tooltip title="Close query">
                  <Box
                    component="span"
                    role="button"
                    tabIndex={0}
                    aria-label={`Close ${tab.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(tab.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onTabClose(tab.id);
                      }
                    }}
                    sx={{
                      width: 22,
                      height: 22,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'inherit',
                      opacity: active ? 0.82 : 0.58,
                      borderRadius: '6px',
                      '&:hover': {
                        opacity: 1,
                        bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.12 : 0.06),
                      },
                    }}
                  >
                    <RemoveCircleOutlineRounded sx={{ fontSize: 16 }} />
                  </Box>
                </Tooltip>
              )}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>

      {/* Add tab button */}
      <Tooltip title="New query">
        <IconButton
          size="small"
          onClick={onTabAdd}
          aria-label="New query"
          sx={getArtifactActionButtonSx(theme, { size: 30 })}
        >
          <PostAddRounded sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default memo(QueryTabs);
