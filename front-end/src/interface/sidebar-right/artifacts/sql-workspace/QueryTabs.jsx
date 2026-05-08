/**
 * QueryTabs - Tab bar for managing multiple SQL queries
 */

import { memo } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import RemoveCircleOutlineRounded from '@mui/icons-material/RemoveCircleOutlineRounded';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import PostAddRounded from '@mui/icons-material/PostAddRounded';

// Sidebar toggle SVG icon (same as main Sidebar)
function SidebarToggleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M16.5 4A1.5 1.5 0 0 1 18 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5v-9A1.5 1.5 0 0 1 3.5 4zM7 15h9.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H7zM3.5 5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H6V5z" />
    </svg>
  );
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
  const isDark = theme.palette.mode === 'dark';

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
            sx={{ 
              mr: 0.5,
              width: 32,
              height: 32,
              border: 'none',
            }}
          >
            <SidebarToggleIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* Tabs - Grouped button design */}
      <Box
        role="tablist"
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          '&::-webkit-scrollbar': {
            height: 4,
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: alpha(theme.palette.text.primary, 0.2),
            borderRadius: 2,
          },
        }}
      >
        {tabs.map((tab, index) => (
          <Box
            key={tab.id}
            component="button"
            type="button"
            role="tab"
            aria-selected={activeTabId === tab.id}
            onClick={() => onTabChange(tab.id)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.5,
              height: 28,
              minWidth: 100,
              maxWidth: 200,
              border: '1px solid',
              borderColor: theme.palette.border.subtle,
              bgcolor: activeTabId === tab.id 
                ? alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08)
                : alpha(theme.palette.text.primary, isDark ? 0.03 : 0.02),
              color: activeTabId === tab.id ? 'text.primary' : 'text.secondary',
              borderRadius: index === 0 
                ? '6px 0 0 6px' 
                : index === tabs.length - 1 
                  ? '0 6px 6px 0' 
                  : 0,
              marginLeft: index === 0 ? 0 : '-1px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              outline: 'none',
              flexShrink: 0,
              '&:hover': {
                bgcolor: activeTabId === tab.id
                  ? alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12)
                  : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
                color: 'text.primary',
                zIndex: 1,
              },
              '&:focus-visible': {
                zIndex: 2,
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: -2,
              },
            }}
          >
            <Box
              component="span"
              sx={{
                ...theme.typography.uiCaptionMd,
                fontWeight: activeTabId === tab.id ? 600 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
                mr: 'auto',
              }}
            >
              {tab.title}
            </Box>
            {tab.isDirty && (
              <FiberManualRecordRoundedIcon
                sx={{
                  fontSize: 8,
                  color: 'primary.main',
                  flexShrink: 0,
                  mr: 0.5,
                }}
              />
            )}
            {tabs.length > 1 && (
              <Box
                component="button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  p: 0,
                  border: 'none',
                  bgcolor: 'transparent',
                  cursor: 'pointer',
                  flexShrink: 0,
                  opacity: activeTabId === tab.id ? 0.6 : 0.4,
                  transition: 'opacity 0.15s ease',
                  color: 'inherit',
                  '&:hover': {
                    opacity: 1,
                  },
                }}
              >
                <RemoveCircleOutlineRounded sx={{ fontSize: 16 }} />
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Add tab button */}
      <Tooltip title="New query">
        <IconButton size="small" onClick={onTabAdd} sx={{ ml: 0.5, border: 'none' }}>
          <PostAddRounded sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default memo(QueryTabs);
