import { useState, useEffect, memo } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Tooltip, 
  Divider, 
  Popover, 
  List, 
  ListItemButton, 
  ListItemText, 
  ListItemIcon, 
  Avatar,
  Drawer as MuiDrawer,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
  CircularProgress,
} from '@mui/material';
import { styled, useTheme, alpha } from '@mui/material/styles';

// Icons - Using outlined/transparent versions for Grok-style look
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CloseIcon from '@mui/icons-material/Close';
import SchemaFlowDiagram from './SchemaFlowDiagram';

// Sidebar widths
const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 56;

// ============================================================================
// MUI Mini Variant Drawer Pattern - Industry Standard
// ============================================================================
// Uses styled component with openedMixin/closedMixin for smooth transitions
// Reference: https://mui.com/material-ui/react-drawer/#mini-variant-drawer

const openedMixin = (theme, isDarkMode) => ({
  width: EXPANDED_WIDTH,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen, // 225ms
  }),
  overflowX: 'hidden',
  // Glassmorphism effect
  background: isDarkMode 
    ? alpha(theme.palette.background.paper, 0.05)
    : alpha(theme.palette.background.paper, 0.8),
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRight: '1px solid',
  borderColor: alpha(theme.palette.divider, isDarkMode ? 0.1 : 0.15),
});

const closedMixin = (theme, isDarkMode) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen, // 195ms
  }),
  overflowX: 'hidden',
  width: COLLAPSED_WIDTH,
  // Glassmorphism effect
  background: isDarkMode 
    ? alpha(theme.palette.background.paper, 0.05)
    : alpha(theme.palette.background.paper, 0.8),
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRight: '1px solid',
  borderColor: alpha(theme.palette.divider, isDarkMode ? 0.1 : 0.15),
});

// Styled Drawer component following MUI Mini Variant pattern
const StyledDrawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open' && prop !== 'isDarkMode',
})(({ theme, open, isDarkMode }) => ({
  width: EXPANDED_WIDTH,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme, isDarkMode),
    '& .MuiDrawer-paper': openedMixin(theme, isDarkMode),
  }),
  ...(!open && {
    ...closedMixin(theme, isDarkMode),
    '& .MuiDrawer-paper': closedMixin(theme, isDarkMode),
  }),
}))

function Sidebar({ 
  conversations = [], 
  currentConversationId, 
  onNewChat, 
  onSelectConversation, 
  onDeleteConversation,
  isConnected,
  currentDatabase,
  availableDatabases = [],
  onOpenDbModal,
  onDatabaseSwitch,
  // New props for collapse control
  isCollapsed = false,
  onToggleCollapse,
  // New props for profile
  user = null,
  onMenuOpen,
}) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [dbPopoverAnchor, setDbPopoverAnchor] = useState(null);
  const [historyPopoverAnchor, setHistoryPopoverAnchor] = useState(null);
  const isPopoverOpen = Boolean(dbPopoverAnchor);
  const isHistoryPopoverOpen = Boolean(historyPopoverAnchor);

  const handleDatabaseSelect = (dbName) => {
    setDbPopoverAnchor(null);
    if (dbName !== currentDatabase) {
      onDatabaseSwitch?.(dbName);
    }
  };

  const handleHistoryClick = (event) => {
    if (isCollapsed && conversations.length > 0) {
      setHistoryPopoverAnchor(event.currentTarget);
    }
  };

  // Schema mindmap state
  const [mindmapOpen, setMindmapOpen] = useState(false);
  const [schemaData, setSchemaData] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Fetch schema when opening mindmap
  const handleOpenMindmap = async () => {
    if (!isConnected || !currentDatabase) return;
    
    setMindmapOpen(true);
    setSchemaLoading(true);
    
    try {
      const response = await fetch('/api/user/context', { credentials: 'include' });
      const data = await response.json();
      if (data.status === 'success') {
        // Find schema for current database
        const currentSchema = data.schemas?.find(s => s.database === currentDatabase);
        setSchemaData(currentSchema || null);
      }
    } catch (err) {
      console.error('Failed to fetch schema:', err);
    } finally {
      setSchemaLoading(false);
    }
  };

  // Navigation items for Grok-style nav - Using distinct outlined icons
  const navItems = [
    { icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 20 }} />, label: 'New Chat', tooltip: 'New Chat', action: onNewChat },
    { icon: <StorageOutlinedIcon sx={{ fontSize: 20 }} />, label: 'Database', tooltip: isConnected ? currentDatabase : 'Connect Database', action: onOpenDbModal },
    // Schema mindmap - only show when connected
    ...(isConnected ? [{ 
      icon: <AccountTreeOutlinedIcon sx={{ fontSize: 20 }} />, 
      label: 'Mindmap', 
      tooltip: 'View Database Mindmap', 
      action: handleOpenMindmap 
    }] : []),
    { icon: <HistoryOutlinedIcon sx={{ fontSize: 20 }} />, label: 'History', tooltip: 'History', isSection: !isCollapsed, action: isCollapsed ? handleHistoryClick : undefined },
  ];

  return (
    <StyledDrawer 
      variant="permanent"
      open={!isCollapsed}
      isDarkMode={isDarkMode}
      PaperProps={{
        sx: {
          position: 'relative', // Important: keeps it in flow, not fixed
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      {/* ===== TOP: Logo Area (No toggle on click) ===== */}
      <Box 
        sx={{ 
          p: isCollapsed ? 1.5 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: 1.5,
          minHeight: 56,
          // Use MUI standard transition timing
          transition: theme.transitions.create(['padding', 'justify-content'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Box
          component="img" 
          src="/product-logo.png" 
          alt="DB-Genie" 
          sx={{ 
            height: 24,
            width: 24,
            opacity: 0.95,
          }} 
        />
        <Typography 
          variant="subtitle1" 
          sx={{ 
            fontWeight: 600,
            color: 'text.primary',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            // Smooth fade out/in instead of instant unmount
            opacity: isCollapsed ? 0 : 1,
            visibility: isCollapsed ? 'hidden' : 'visible',
            width: isCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            transition: theme.transitions.create(['opacity', 'visibility', 'width'], {
              easing: theme.transitions.easing.sharp,
              duration: isCollapsed 
                ? theme.transitions.duration.leavingScreen   // 195ms - faster fade out
                : theme.transitions.duration.enteringScreen, // 225ms - slower fade in
            }),
          }}
        >
          DB-Genie
        </Typography>
      </Box>

      {/* ===== NAVIGATION ITEMS ===== */}
      <Box sx={{ 
        px: isCollapsed ? 0.75 : 1.5, 
        py: 1, 
        transition: theme.transitions.create('padding', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }}>
        {navItems.map((item, index) => (
          item.isSection ? (
            // Section header
            !isCollapsed && (
              <Typography 
                key={index}
                variant="overline" 
                color="text.secondary" 
                sx={{ 
                  display: 'block',
                  px: 1,
                  pt: 2,
                  pb: 0.5,
                  fontSize: '0.65rem',
                }}
              >
                {item.label}
              </Typography>
            )
          ) : (
            <Tooltip 
              key={index}
              title={isCollapsed ? item.tooltip : ''} 
              placement="right"
              arrow
            >
              <Box
                onClick={item.action}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: isCollapsed ? 1 : 1.25,
                  height: 40, // Fixed height for consistency
                  mb: 0.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  color: 'text.secondary',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.text.primary, 0.06),
                    color: 'text.primary',
                  },
                  // Database connection indicator
                  ...(item.label === 'Database' && {
                    position: 'relative',
                    '&::after': isConnected ? {
                      content: '""',
                      position: 'absolute',
                      top: isCollapsed ? 8 : 10,
                      right: isCollapsed ? 8 : 'auto',
                      left: isCollapsed ? 'auto' : 28,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: 'success.main',
                    } : {},
                  }),
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}>
                  {item.icon}
                </Box>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 450,
                    whiteSpace: 'nowrap',
                    // Smooth fade out/in instead of instant unmount
                    opacity: isCollapsed ? 0 : 1,
                    visibility: isCollapsed ? 'hidden' : 'visible',
                    width: isCollapsed ? 0 : 'auto',
                    overflow: 'hidden',
                    transition: theme.transitions.create(['opacity', 'visibility', 'width'], {
                      easing: theme.transitions.easing.sharp,
                      duration: isCollapsed 
                        ? theme.transitions.duration.leavingScreen
                        : theme.transitions.duration.enteringScreen,
                    }),
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            </Tooltip>
          )
        ))}
      </Box>

      {/* ===== CONVERSATIONS LIST (Scrollable - Always present for spacing) ===== */}
      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Conversations Container */}
        <Box 
          sx={{ 
            flex: 1, 
            overflowY: 'auto',
            overflowX: 'hidden',
            px: isCollapsed ? 0.5 : 1,
            py: 0.5,
            transition: theme.transitions.create('padding', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            '&::-webkit-scrollbar': {
              width: 4,
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: alpha(theme.palette.text.secondary, 0.15),
              borderRadius: 2,
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.secondary, 0.25),
              }
            },
          }}
        >
          <Box
            sx={{
              opacity: isCollapsed ? 0 : 1,
              visibility: isCollapsed ? 'hidden' : 'visible',
              transition: theme.transitions.create(['opacity', 'visibility'], {
                easing: theme.transitions.easing.sharp,
                duration: isCollapsed 
                  ? theme.transitions.duration.leavingScreen
                  : theme.transitions.duration.enteringScreen,
              }),
            }}
          >
            {conversations.length === 0 ? (
              <Box 
                sx={{ 
                  p: 2, 
                  textAlign: 'center',
                  opacity: 0.4,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  No conversations yet
                </Typography>
              </Box>
            ) : (
            conversations.map((conv) => (
              <Tooltip 
                key={conv.id}
                title={isCollapsed ? (conv.title || 'Conversation') : ''} 
                placement="right"
                arrow
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: isCollapsed ? 1 : 1.25,
                    mb: 0.25,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    backgroundColor: conv.id === currentConversationId 
                      ? alpha(theme.palette.text.primary, 0.08)
                      : 'transparent',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: conv.id === currentConversationId 
                        ? alpha(theme.palette.text.primary, 0.1)
                        : alpha(theme.palette.text.primary, 0.04),
                      '& .delete-btn': { opacity: 1 }
                    }
                  }}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <QuestionAnswerOutlinedIcon 
                    sx={{ 
                      fontSize: 16, 
                      color: conv.id === currentConversationId ? 'text.primary' : 'text.secondary', 
                      mr: isCollapsed ? 0 : 1.5,
                      flexShrink: 0,
                      transition: theme.transitions.create('margin', {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                      }),
                    }} 
                  />
                  <Box 
                    sx={{ 
                      flex: 1, 
                      minWidth: 0,
                      opacity: isCollapsed ? 0 : 1,
                      width: isCollapsed ? 0 : 'auto',
                      overflow: 'hidden',
                      transition: theme.transitions.create(['opacity', 'width'], {
                        easing: theme.transitions.easing.sharp,
                        duration: isCollapsed 
                          ? theme.transitions.duration.leavingScreen
                          : theme.transitions.duration.enteringScreen,
                      }),
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      noWrap 
                      sx={{ 
                        color: conv.id === currentConversationId ? 'text.primary' : 'text.secondary',
                        fontWeight: conv.id === currentConversationId ? 500 : 400,
                        fontSize: '0.85rem',
                      }}
                    >
                      {conv.title || 'New Conversation'}
                    </Typography>
                  </Box>
                  <IconButton
                    className="delete-btn"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    sx={{ 
                      opacity: 0, 
                      padding: 0.5,
                      ml: 0.5,
                      color: 'text.secondary',
                      transition: 'all 0.15s ease',
                      '&:hover': { 
                        color: 'error.main', 
                        backgroundColor: alpha(theme.palette.error.main, 0.1), 
                      }
                    }}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              </Tooltip>
            ))
          )}
          </Box>
        </Box>
      </Box>

      {/* Database Switcher Popover */}
      <Popover
        open={isPopoverOpen}
        anchorEl={dbPopoverAnchor}
        onClose={() => setDbPopoverAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 200,
            maxHeight: 300,
            overflow: 'auto',
          }
        }}
      >
        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="overline" color="text.secondary">
            Switch Database
          </Typography>
        </Box>
        <List dense sx={{ p: 0.5 }}>
          {availableDatabases.map((db) => (
            <ListItemButton
              key={db}
              selected={db === currentDatabase}
              onClick={() => handleDatabaseSelect(db)}
              sx={{ borderRadius: 1, py: 0.75 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {db === currentDatabase ? (
                  <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16, color: 'success.main' }} />
                ) : (
                  <StorageOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                )}
              </ListItemIcon>
              <ListItemText 
                primary={db} 
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItemButton>
          ))}
          <Divider sx={{ my: 0.5 }} />
          <ListItemButton
            onClick={() => { setDbPopoverAnchor(null); onOpenDbModal?.(); }}
            sx={{ borderRadius: 1, py: 0.75 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <AddCircleOutlineRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            </ListItemIcon>
            <ListItemText 
              primary="New Connection" 
              primaryTypographyProps={{ variant: 'body2', color: 'primary.main' }}
            />
          </ListItemButton>
        </List>
      </Popover>

      {/* History Popover (for collapsed sidebar) */}
      <Popover
        open={isHistoryPopoverOpen}
        anchorEl={historyPopoverAnchor}
        onClose={() => setHistoryPopoverAnchor(null)}
        anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
        transformOrigin={{ vertical: 'center', horizontal: 'left' }}
        PaperProps={{
          sx: {
            ml: 1,
            minWidth: 240,
            maxWidth: 320,
            maxHeight: 400,
            overflow: 'auto',
          }
        }}
      >
        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="overline" color="text.secondary">
            Conversation History
          </Typography>
        </Box>
        <List dense sx={{ p: 0.5 }}>
          {conversations.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                No conversations yet
              </Typography>
            </Box>
          ) : (
            conversations.map((conv) => (
              <ListItemButton
                key={conv.id}
                selected={conv.id === currentConversationId}
                onClick={() => {
                  setHistoryPopoverAnchor(null);
                  onSelectConversation(conv.id);
                }}
                sx={{ borderRadius: 1, py: 0.75 }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  {conv.id === currentConversationId ? (
                    <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  ) : (
                    <QuestionAnswerOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  )}
                </ListItemIcon>
                <ListItemText 
                  primary={conv.title || 'New Conversation'} 
                  primaryTypographyProps={{ 
                    variant: 'body2',
                    noWrap: true,
                    sx: { fontWeight: conv.id === currentConversationId ? 500 : 400 }
                  }}
                />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  sx={{ 
                    opacity: 0.5,
                    padding: 0.5,
                    color: 'text.secondary',
                    '&:hover': { 
                      opacity: 1,
                      color: 'error.main', 
                    }
                  }}
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </ListItemButton>
            ))
          )}
        </List>
      </Popover>

      {/* ===== BOTTOM: Profile + Settings + Collapse Toggle ===== */}
      <Box 
        sx={{ 
          borderTop: '1px solid',
          borderColor: isDarkMode ? '#1F1F1F' : '#D0D7DE',
          p: isCollapsed ? 0.75 : 1,
          display: 'flex',
          flexDirection: isCollapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          gap: isCollapsed ? 1 : 0,
          transition: theme.transitions.create(['padding', 'flex-direction', 'gap'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        {/* Left side: Profile + Settings */}
        <Box sx={{ display: 'flex', flexDirection: isCollapsed ? 'column' : 'row', alignItems: 'center', gap: isCollapsed ? 1 : 0.5 }}>
          {/* Profile button */}
          <Tooltip title={isCollapsed ? (user?.displayName || 'Profile') : ''} placement="right" arrow>
            <IconButton
              onClick={onMenuOpen}
              size="small"
              sx={{
                p: 1, // Standardize padding
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.divider, 0.8),
                  color: 'text.primary',
                }
              }}
            >
              {user?.photoURL ? (
                <Avatar src={user.photoURL} sx={{ width: 24, height: 24 }} />
              ) : (
                <AccountCircleOutlinedIcon sx={{ fontSize: 24 }} />
              )}
            </IconButton>
          </Tooltip>


        </Box>

        {/* Collapse/Expand toggle - Chevron */}
        {isCollapsed ? (
          <Tooltip title="Expand sidebar" placement="right" arrow>
            <IconButton
              onClick={onToggleCollapse}
              size="small"
              sx={{
                p: 1, // Standardize padding
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.divider, 0.8),
                  color: 'text.primary',
                }
              }}
            >
              <KeyboardDoubleArrowRightRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <IconButton
            onClick={onToggleCollapse}
            size="small"
            sx={{
              p: 1, // Standardize padding
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: alpha(theme.palette.divider, 0.8),
                color: 'text.primary',
              }
            }}
          >
            <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}
      </Box>

      {/* Schema Mindmap Dialog */}
      <Dialog
        open={mindmapOpen}
        onClose={() => setMindmapOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '80vh',
            maxHeight: 700,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AccountTreeOutlinedIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Schema Mindmap
            </Typography>
            {currentDatabase && (
              <Chip
                size="small"
                icon={<StorageOutlinedIcon sx={{ fontSize: 14 }} />}
                label={currentDatabase}
                sx={{ ml: 1 }}
              />
            )}
          </Box>
          <IconButton
            size="small"
            onClick={() => setMindmapOpen(false)}
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {schemaLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
              <CircularProgress />
            </Box>
          ) : schemaData ? (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Click on table nodes to expand/collapse columns. Use mouse to pan and scroll to zoom.
              </Typography>
              <SchemaFlowDiagram
                database={schemaData.database}
                tables={schemaData.tables || []}
                columns={schemaData.columns || {}}
              />
            </>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
              <Typography color="text.secondary">
                No schema data available. Connect to a database first.
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </StyledDrawer>
  );
}

export default memo(Sidebar);
