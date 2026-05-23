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
import { getInteractionColors, getInteractiveIconButtonSx } from '@/styles/shared';

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
  const interaction = getInteractionColors(theme);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        py: 0.5,
        borderBottom: '1px solid',
        borderColor: theme.palette.border.subtle,
        bgcolor: 'background.paper',
        flexShrink: 0,
        height: 40,
      }}
    >
      {/* Sidebar toggle */}
      {!schemaSidebarOpen && (
        <Tooltip title="Show schema sidebar">
          <IconButton
            size="small"
            onClick={onToggleSidebar}
            aria-label="Show schema sidebar"
            sx={{
              mr: 0.5,
              ...getInteractiveIconButtonSx(theme, { size: 32, radius: '8px' }),
              borderColor: 'transparent',
            }}
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
          overflowX: 'auto',
          overflowY: 'hidden',
          flexWrap: 'nowrap',
          '& .MuiToggleButtonGroup-grouped': {
            borderColor: theme.palette.border.subtle,
            minWidth: 100,
            maxWidth: 200,
            height: 28,
            px: 1.25,
            py: 0.5,
            textTransform: 'none',
            ...theme.typography.uiCaptionMd,
            '&.Mui-selected': {
              bgcolor: interaction.activeBackground,
              borderColor: interaction.activeBorder,
              color: 'text.primary',
              fontWeight: 600,
              '&:hover': {
                bgcolor: interaction.activeHoverBackground,
              },
            },
          },
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: alpha(theme.palette.text.primary, 0.2),
            borderRadius: 2,
          },
        }}
      >
        {tabs.map((tab) => (
          <ToggleButton
            key={tab.id}
            value={tab.id}
            aria-label={tab.title}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              flexShrink: 0,
            }}
          >
            <Box
              component="span"
              sx={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'inherit',
                    opacity: activeTabId === tab.id ? 0.7 : 0.45,
                    '&:hover': { opacity: 1 },
                  }}
                >
                  <RemoveCircleOutlineRounded sx={{ fontSize: 16 }} />
                </Box>
              </Tooltip>
            )}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Add tab button */}
      <Tooltip title="New query">
        <IconButton
          size="small"
          onClick={onTabAdd}
          aria-label="New query"
          sx={{
            ml: 0.5,
            ...getInteractiveIconButtonSx(theme, { size: 32, radius: '8px' }),
            borderColor: 'transparent',
          }}
        >
          <PostAddRounded sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default memo(QueryTabs);
