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
import { alpha, useTheme } from '@mui/material/styles';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { TOUCH_DEVICE_QUERY } from '../../../styles/mediaQueries';
import { getPopoverPaperSx, getUtilityIconButtonSx } from '../../../styles/shared';
import {
  buildNavRowSx,
  buildConversationRowSx,
  ICON_COL,
} from '../styles/sidebarStyles';

// ─── ConversationItem ─────────────────────────────────────────────────────────
export const ConversationItem = memo(function ConversationItem({
  conv,
  isActive,
  onSelect,
  onDelete,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [menuAnchor, setMenuAnchor] = useState(null);
  const menuOpen = Boolean(menuAnchor);
  const utilityIconButtonSx = getUtilityIconButtonSx(theme);

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

  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <Box
        component="button"
        type="button"
        onClick={handleClick}
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
          }}
        >
          <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
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
            sx: getPopoverPaperSx(theme, isDark, { borderRadius: '12px', minWidth: 160, mt: 0.75, p: 0.5 }),
          },
          list: { sx: { py: 0 } },
        }}
      >
        <MenuItem
          onClick={handleDelete}
          sx={{
            ...theme.typography.uiMenuItemSm,
            gap: 1,
            px: 1,
            py: 0.85,
            borderRadius: '8px',
            color: theme.palette.error.main,
            transition: theme.transitions.create(['background-color', 'color'], {
              duration: theme.transitions.duration.shortest,
            }),
            '&:hover': {
              backgroundColor: alpha(theme.palette.error.main, isDark ? 0.12 : 0.08),
              color: theme.palette.error.main,
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
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
  circularIconBg = false,
  shortcut,
  uiTarget,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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
          ...(circularIconBg && {
            '&:hover:not(:disabled) .icon-ring': {
              backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.2 : 0.15),
              transform: 'scale(1.08) rotate(-3deg)',
            },
            '&:active:not(:disabled) .icon-ring': {
              transform: 'scale(0.96) rotate(6deg)',
            },
          }),
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
          {circularIconBg ? (
            <Box
              className="icon-ring"
              component="span"
              sx={{
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.12 : 0.08),
                color: 'inherit',
                transition: theme.transitions.create(['background-color', 'transform'], {
                  duration: theme.transitions.duration.shorter,
                }),
              }}
            >
              {icon}
            </Box>
          ) : (
            <Box component="span" sx={{ display: 'inline-flex', color: 'inherit' }}>
              {icon}
            </Box>
          )}

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
      sx={{ borderRadius: '8px', py: 0.5, px: 1, minHeight: 32 }}
    >
      <ListItemIcon sx={{ minWidth: 26 }}>
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
      <IconButton
        size="small"
        onClick={handleDelete}
        aria-label="Delete conversation"
        sx={{
          ...utilityIconButtonSx,
          opacity: 0.5,
          '&:hover': {
            ...utilityIconButtonSx['&:hover'],
            opacity: 1,
          },
        }}
      >
        <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
      </IconButton>
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
