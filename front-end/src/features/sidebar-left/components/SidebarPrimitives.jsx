import { memo, useCallback, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Menu,
  MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { HOVER_CAPABLE_QUERY, TOUCH_DEVICE_QUERY } from '@/styles/mediaQueries';
import {
  getInteractionColors,
  getPopoverMenuItemSx,
  getPopoverMenuListSx,
  getPopoverPaperSx,
  getSelectableMenuItemSx,
  getUtilityIconButtonSx,
  UI_POPOVER,
} from '@/styles/shared';
import {
  buildNavRowSx,
  buildConversationRowSx,
  ICON_COL,
} from '@/features/sidebar-left/styles/sidebarStyles';

// ─── ConversationItem ─────────────────────────────────────────────────────────
export const ConversationItem = memo(function ConversationItem({
  conv,
  isActive,
  onSelect,
  onDelete,
  onRename,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [menuAnchor, setMenuAnchor] = useState(null);
  const menuOpen = Boolean(menuAnchor);
  const utilityIconButtonSx = getUtilityIconButtonSx(theme);
  const neutralInteraction = getInteractionColors(theme);
  const renameMenuItemSx = getPopoverMenuItemSx(theme);
  const deleteMenuItemSx = getPopoverMenuItemSx(theme, { tone: 'error' });

  const handleClick = useCallback(() => onSelect(conv.id), [onSelect, conv.id]);
  const handleMenuOpen = useCallback((e) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  }, []);
  const handleMenuClose = useCallback(() => setMenuAnchor(null), []);
  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    setMenuAnchor(null);
    onDelete(conv.id);
  }, [onDelete, conv.id]);
  const handleRename = useCallback((e) => {
    e.stopPropagation();
    setMenuAnchor(null);
    onRename(conv.id, conv.title || 'New Conversation');
  }, [onRename, conv.id, conv.title]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <Box
        component="div"
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-current={isActive ? 'true' : undefined}
        sx={{
          ...buildConversationRowSx(theme, { isActive, menuOpen }),
          [TOUCH_DEVICE_QUERY]: {
            '& .options-btn': { opacity: 1 },
            '& .conv-title': {
              maskImage: 'linear-gradient(to right, black 75%, transparent 95%)',
              WebkitMaskImage: 'linear-gradient(to right, black 75%, transparent 95%)',
            },
          },
        }}
      >
        <Typography
          className="conv-title"
          noWrap
          sx={{ flex: '1 1 auto', minWidth: 0, ...theme.typography.uiNavItem, fontWeight: isActive ? 500 : 400 }}
        >
          {conv.title || 'New Conversation'}
        </Typography>

        <Tooltip title="Conversation options">
          <IconButton
            className="options-btn"
            size="small"
            onClick={handleMenuOpen}
            aria-label="Conversation options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            sx={{
              ...utilityIconButtonSx,
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              '&:active': {
                transform: 'translateY(-50%)',
              },
            }}
          >
            <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: getPopoverPaperSx(theme, isDark, { borderRadius: '12px', minWidth: 160, mt: 0.75, p: 0 }),
          },
          list: { sx: getPopoverMenuListSx() },
        }}
      >
        <MenuItem
          onClick={handleRename}
          sx={{
            ...renameMenuItemSx,
          }}
        >
          <ListItemIcon>
            <DriveFileRenameOutlineRoundedIcon />
          </ListItemIcon>
          Rename
        </MenuItem>
        <MenuItem
          onClick={handleDelete}
          sx={{
            ...deleteMenuItemSx,
            '&:hover': {
              backgroundColor: neutralInteraction.hoverBackground,
              color: theme.palette.error.main,
            },
            '&:active': {
              backgroundColor: neutralInteraction.hoverBackground,
            },
          }}
        >
          <ListItemIcon>
            <DeleteOutlineRoundedIcon />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
});

// ─── SidebarNavItem ───────────────────────────────────────────────────────────
//
// Layout model (collapsed width = 52px, row px = 8px each side):
//
//  ┌──────────────────────────────────────────────────────────────────┐
//  │  8px │  ←── ICON_COL (36px) ──→  │  label (fades out) │  8px  │
//  └──────────────────────────────────────────────────────────────────┘
//
// The icon column is always 36px wide and centered within itself.
// It never moves — no justifyContent switching, no px switching.
// The label box collapses to maxWidth:0 + opacity:0 when collapsed.
//
export const SidebarNavItem = memo(function SidebarNavItem({
  label,
  tooltip,
  icon,
  onClick,
  isCollapsed,
  isActive = false,
  showStatus = false,
  disabled = false,
  shortcut,
  uiTarget,
}) {
  const theme = useTheme();

  return (
    <Tooltip
      title={isCollapsed ? (tooltip || label) : ''}
      placement="right"
      arrow
      disableHoverListener={!isCollapsed}
      disableFocusListener={!isCollapsed}
      disableTouchListener={!isCollapsed}
    >
      <Box
        component="button"
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-label={label}
        data-ui-target={uiTarget}
        sx={{
          ...buildNavRowSx(theme, { isActive, disabled }),
          px: 0,
          '&:hover:not(:disabled) .shortcut-hint': { opacity: 1 },
        }}
      >
        {/* ── Icon column ── always ICON_COL wide, icon centered inside ── */}
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            flexShrink: 0,
            width: ICON_COL,
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <Box component="span" sx={{ display: 'inline-flex', color: 'inherit' }}>
            {icon}
          </Box>

          {showStatus && (
            <Box
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: theme.palette.success.main,
                boxShadow: `0 0 0 1.5px ${theme.palette.background.paper}`,
              }}
            />
          )}
        </Box>

        {/* ── Label — collapses to zero when sidebar is collapsed ── */}
        <Box
          sx={{
            flex: '1 1 auto',
            minWidth: 0,
            maxWidth: isCollapsed ? 0 : 200,
            opacity: isCollapsed ? 0 : 1,
            overflow: 'hidden',
            transition: theme.transitions.create(['max-width', 'opacity'], {
              duration: theme.transitions.duration.shortest,
            }),
          }}
        >
          <Typography
            noWrap
            sx={{ ...theme.typography.uiNavItem, fontWeight: isActive ? 500 : 400, color: 'inherit', textAlign: 'left' }}
          >
            {label}
          </Typography>
        </Box>

        {/* ── Shortcut hint — only visible on hover when expanded ── */}
        {shortcut && !isCollapsed && (
          <Typography
            className="shortcut-hint"
            component="span"
            sx={{
              ...theme.typography.uiNavShortcut,
              color: 'text.disabled',
              flexShrink: 0,
              opacity: 0,
              transition: 'opacity 0.15s ease',
              whiteSpace: 'nowrap',
              pr: 0.5,
            }}
          >
            {shortcut}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
});

// ─── HistoryPopoverItem ───────────────────────────────────────────────────────
export const HistoryPopoverItem = memo(function HistoryPopoverItem({
  conv,
  isActive,
  onSelect,
  onDelete,
  onClosePopover,
  theme,
}) {
  const utilityIconButtonSx = getUtilityIconButtonSx(theme);
  const rowSx = getSelectableMenuItemSx(theme, {
    isActive,
    columns: 'auto minmax(0, 1fr) auto',
  });

  const handleClick = useCallback(() => {
    onClosePopover();
    onSelect(conv.id);
  }, [onClosePopover, onSelect, conv.id]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    onDelete(conv.id);
  }, [onDelete, conv.id]);

  return (
    <ListItemButton
      selected={isActive}
      onClick={handleClick}
      sx={{
        ...rowSx,
        '&.Mui-selected': {
          backgroundColor: rowSx.backgroundColor,
        },
        '&.Mui-selected:hover': {
          backgroundColor: rowSx[HOVER_CAPABLE_QUERY]?.['&:hover']?.backgroundColor || rowSx.backgroundColor,
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: UI_POPOVER.iconSlotWidth, width: UI_POPOVER.iconSlotWidth }}>
        {isActive
          ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16, color: theme.palette.text.primary }} />
          : <QuestionAnswerOutlinedIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
        }
      </ListItemIcon>
      <ListItemText
        primary={conv.title || 'New Conversation'}
        primaryTypographyProps={{
          noWrap: true,
          sx: { ...theme.typography.uiNavItem, fontWeight: isActive ? 500 : 400 },
        }}
      />
      <Tooltip title="Delete conversation">
        <IconButton
          size="small"
          onClick={handleDelete}
          aria-label="Delete conversation"
          sx={{
            ...utilityIconButtonSx,
            opacity: 0.5,
            [HOVER_CAPABLE_QUERY]: {
              '&:hover': {
                ...utilityIconButtonSx[HOVER_CAPABLE_QUERY]?.['&:hover'],
                color: 'error.main',
                opacity: 1,
              },
            },
          }}
        >
          <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </ListItemButton>
  );
});

// ─── HistoryListSkeleton ──────────────────────────────────────────────────────
export const HistoryListSkeleton = memo(function HistoryListSkeleton() {
  return (
    <Box sx={{ px: 1, pb: 1 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 1.5,
            py: 0.5,
            mb: 0.25,
            minHeight: 32,
          }}
        >
          <Skeleton variant="circular" width={14} height={14} />
          <Skeleton
            variant="rounded"
            sx={{ width: `${90 - (i % 3) * 14}%`, maxWidth: 170, height: 11, borderRadius: 999 }}
          />
        </Box>
      ))}
    </Box>
  );
});
