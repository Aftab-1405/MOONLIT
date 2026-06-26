import { memo, useCallback, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  ListItemButton,
  ListItemIcon,
  Skeleton,
  Menu,
  MenuItem,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import { HOVER_CAPABLE_QUERY, TOUCH_DEVICE_QUERY } from "@/styles/mediaQueries";
import {
  getPopoverMenuItemSx,
  getPopoverMenuListSx,
  getPopoverPaperSx,
  getSelectableMenuItemSx,
  getUtilityIconButtonSx,
} from "@/styles/shared";
import {
  buildNavRowSx,
  buildConversationRowSx,
  ICON_COL,
  getCollapsingLabelSx,
  getSidebarRailTooltipSlotProps,
} from "@/features/sidebar-left/styles/sidebarStyles";
import { INTERFACE_RADIUS } from "@/features/styles/interfaceChrome";

// ─── ConversationItem ─────────────────────────────────────────────────────────
export const ConversationItem = memo(function ConversationItem({
  conv,
  isActive,
  onSelect,
  onDelete,
  onRename,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [menuAnchor, setMenuAnchor] = useState(null);
  const menuOpen = Boolean(menuAnchor);
  const utilityIconButtonSx = getUtilityIconButtonSx(theme);
  const renameMenuItemSx = getPopoverMenuItemSx(theme);
  const deleteMenuItemSx = getPopoverMenuItemSx(theme, { tone: "error" });
  const title = conv.title || "New Conversation";

  const handleClick = useCallback(() => onSelect(conv.id), [onSelect, conv.id]);
  const handleMenuOpen = useCallback((e) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  }, []);
  const handleMenuClose = useCallback(() => setMenuAnchor(null), []);
  const handleDelete = useCallback(
    (e) => {
      e.stopPropagation();
      setMenuAnchor(null);
      onDelete(conv.id);
    },
    [onDelete, conv.id],
  );
  const handleRename = useCallback(
    (e) => {
      e.stopPropagation();
      setMenuAnchor(null);
      onRename(conv.id, title);
    },
    [onRename, conv.id, title],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <Box component="li" sx={{ listStyle: "none" }}>
      <Box
        component="div"
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-current={isActive ? "true" : undefined}
        aria-label={`Open ${title}`}
        sx={{
          ...buildConversationRowSx(theme, { isActive, menuOpen }),
          [TOUCH_DEVICE_QUERY]: {
            "& .options-btn": { opacity: 1 },
            "& .conv-title": {
              maskImage:
                "linear-gradient(to right, black 78%, transparent 98%)",
              WebkitMaskImage:
                "linear-gradient(to right, black 78%, transparent 98%)",
            },
          },
        }}
      >
        <Box
          component="span"
          aria-hidden
          sx={{
            width: ICON_COL,
            minWidth: ICON_COL,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: isActive ? "success.main" : "text.secondary",
          }}
        >
          {isActive ? (
            <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
          ) : (
            <QuestionAnswerOutlinedIcon sx={{ fontSize: 16 }} />
          )}
        </Box>
        <Typography
          className="conv-title"
          sx={{
            flex: "1 1 auto",
            minWidth: 0,
            ...theme.typography.uiNavItem,
            fontWeight: isActive ? 500 : 400,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "clip",
            maskImage: "linear-gradient(to right, black 78%, transparent 98%)",
            WebkitMaskImage:
              "linear-gradient(to right, black 78%, transparent 98%)",
          }}
        >
          {title}
        </Typography>

        <Tooltip title="Conversation options" arrow>
          <IconButton
            className="options-btn"
            size="small"
            onClick={handleMenuOpen}
            aria-label={`Options for ${title}`}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            sx={{
              ...utilityIconButtonSx,
              position: "absolute",
              right: 4,
              top: "50%",
              opacity: menuOpen ? 1 : undefined,
              color: menuOpen ? "text.primary" : undefined,
              bgcolor: menuOpen
                ? alpha(theme.palette.text.primary, isDark ? 0.1 : 0.06)
                : undefined,
              transform: "translateY(-50%)",
              transition: theme.transitions.create(
                ["background-color", "color", "opacity"],
                { duration: theme.transitions.duration.shorter },
              ),
              "&:active": {
                transform: "translateY(-50%)",
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
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: getPopoverPaperSx(theme, isDark, {
              borderRadius: INTERFACE_RADIUS.row,
              minWidth: 160,
              mt: 0.75,
              p: 0,
            }),
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
        <MenuItem onClick={handleDelete} sx={deleteMenuItemSx}>
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
  const tooltipTitle = disabled || isCollapsed ? tooltip || label : "";
  const railTooltipSlotProps = getSidebarRailTooltipSlotProps(theme);

  return (
    <Tooltip
      title={tooltipTitle}
      placement="right"
      arrow
      slotProps={railTooltipSlotProps}
      disableHoverListener={!tooltipTitle}
      disableFocusListener={!tooltipTitle}
      disableTouchListener={!tooltipTitle}
    >
      <Box component="span" sx={{ display: "block" }}>
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
            width: "100%",
            "&:hover:not(:disabled) .shortcut-hint": { opacity: 1 },
          }}
        >
          {/* ── Icon column ── always ICON_COL wide, icon centered inside ── */}
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              flexShrink: 0,
              width: ICON_COL,
              justifyContent: "center",
              alignItems: "center",
              position: "relative",
            }}
          >
            <Box
              component="span"
              sx={{ display: "inline-flex", color: "inherit" }}
            >
              {icon}
            </Box>

            {showStatus && (
              <Box
                sx={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: theme.palette.success.main,
                  border: `1.5px solid ${theme.palette.background.paper}`,
                }}
              />
            )}
          </Box>

          {/* ── Label — collapses to zero when sidebar is collapsed ── */}
          <Box
            sx={getCollapsingLabelSx(theme, isCollapsed)}
          >
            <Typography
              noWrap
              sx={{
                ...theme.typography.uiNavItem,
                fontWeight: isActive ? 500 : 400,
                color: "inherit",
                textAlign: "left",
              }}
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
                color: "text.secondary",
                flexShrink: 0,
                opacity: 0,
                transition: "opacity 0.15s ease",
                whiteSpace: "nowrap",
                pr: 0.5,
              }}
            >
              {shortcut}
            </Typography>
          )}
        </Box>
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
  onRename,
  onClosePopover,
  theme,
}) {
  const isDark = theme.palette.mode === "dark";
  const [menuAnchor, setMenuAnchor] = useState(null);
  const menuOpen = Boolean(menuAnchor);
  const utilityIconButtonSx = getUtilityIconButtonSx(theme);
  const renameMenuItemSx = getPopoverMenuItemSx(theme);
  const deleteMenuItemSx = getPopoverMenuItemSx(theme, { tone: "error" });
  const rowSx = getSelectableMenuItemSx(theme, {
    isActive,
    minHeight: 36,
    columns: `${ICON_COL}px minmax(0, 1fr) 26px`,
    gap: 0,
  });
  const title = conv.title || "New Conversation";

  const handleClick = useCallback(() => {
    onClosePopover();
    onSelect(conv.id);
  }, [onClosePopover, onSelect, conv.id]);

  const handleDelete = useCallback(
    (e) => {
      e.stopPropagation();
      setMenuAnchor(null);
      onDelete(conv.id);
    },
    [onDelete, conv.id],
  );
  const handleMenuOpen = useCallback((e) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  }, []);
  const handleMenuClose = useCallback((e) => {
    e?.stopPropagation?.();
    setMenuAnchor(null);
  }, []);
  const handleRename = useCallback(
    (e) => {
      e.stopPropagation();
      setMenuAnchor(null);
      onClosePopover();
      onRename?.(conv.id, title);
    },
    [conv.id, onClosePopover, onRename, title],
  );

  return (
    <>
      <ListItemButton
        selected={isActive}
        onClick={handleClick}
        sx={{
          ...rowSx,
          height: 36,
          py: 0,
          pl: 0,
          pr: 0.5,
          boxShadow: "none",
          "&.Mui-selected": {
            backgroundColor: rowSx.backgroundColor,
            boxShadow: "none",
          },
          "&.Mui-selected:hover": {
            backgroundColor:
              rowSx[HOVER_CAPABLE_QUERY]?.["&:hover"]?.backgroundColor ||
              rowSx.backgroundColor,
            boxShadow: "none",
          },
          "& .history-options-btn": { opacity: menuOpen ? 1 : 0 },
          "&:hover .history-options-btn, &:focus-within .history-options-btn": {
            opacity: 1,
          },
          [TOUCH_DEVICE_QUERY]: {
            "& .history-options-btn": { opacity: 1 },
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: ICON_COL,
            width: ICON_COL,
            justifyContent: "center",
            color: isActive ? "success.main" : "text.secondary",
          }}
        >
          {isActive ? (
            <CheckCircleOutlineRoundedIcon
              sx={{ fontSize: 18, color: "success.main" }}
            />
          ) : (
            <QuestionAnswerOutlinedIcon
              sx={{ fontSize: 16, color: theme.palette.text.secondary }}
            />
          )}
        </ListItemIcon>
        <Typography
          sx={{
            ...theme.typography.uiNavItem,
            minWidth: 0,
            fontWeight: isActive ? 500 : 400,
            color: "text.primary",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "clip",
            maskImage: "linear-gradient(to right, black 78%, transparent 98%)",
            WebkitMaskImage:
              "linear-gradient(to right, black 78%, transparent 98%)",
          }}
        >
          {title}
        </Typography>
        <Tooltip title="Conversation options">
          <IconButton
            className="history-options-btn"
            size="small"
            onClick={handleMenuOpen}
            aria-label={`Options for ${title}`}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            sx={{
              ...utilityIconButtonSx,
              width: 26,
              height: 26,
              opacity: menuOpen ? 1 : 0,
              color: menuOpen ? "text.primary" : undefined,
              bgcolor: menuOpen
                ? alpha(theme.palette.text.primary, isDark ? 0.1 : 0.06)
                : undefined,
            }}
          >
            <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </ListItemButton>
      <Menu
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: getPopoverPaperSx(theme, isDark, {
              borderRadius: INTERFACE_RADIUS.row,
              minWidth: 160,
              mt: 0.75,
              p: 0,
            }),
          },
          list: { sx: getPopoverMenuListSx() },
        }}
      >
        {onRename && (
          <MenuItem onClick={handleRename} sx={renameMenuItemSx}>
            <ListItemIcon>
              <DriveFileRenameOutlineRoundedIcon />
            </ListItemIcon>
            Rename
          </MenuItem>
        )}
        <MenuItem onClick={handleDelete} sx={deleteMenuItemSx}>
          <ListItemIcon>
            <DeleteOutlineRoundedIcon />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </>
  );
});

// ─── HistoryListSkeleton ──────────────────────────────────────────────────────
export const HistoryListSkeleton = memo(function HistoryListSkeleton() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      role="status"
      aria-label="Loading recent conversations"
      sx={{ px: 1, pb: 1 }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Box
          key={i}
          sx={{
            display: "grid",
            alignItems: "center",
            gridTemplateColumns: `${ICON_COL}px minmax(0, 1fr)`,
            px: 0,
            py: 0,
            mb: 0.25,
            height: 36,
            minHeight: 36,
          }}
        >
          <Box sx={{ width: ICON_COL, display: "flex", justifyContent: "center" }}>
            <Skeleton
              variant="circular"
              width={16}
              height={16}
              animation="wave"
              sx={{
                bgcolor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06),
              }}
            />
          </Box>
          <Skeleton
            variant="rounded"
            animation="wave"
            sx={{
              width: `${88 - (i % 3) * 12}%`,
              maxWidth: 168,
              height: 10,
              borderRadius: 999,
              bgcolor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06),
            }}
          />
        </Box>
      ))}
    </Box>
  );
});
