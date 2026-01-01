import { useState, memo, useRef } from 'react';
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
  SwipeableDrawer,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
  CircularProgress,
  useMediaQuery,
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

// Centralized API layer
import { getUserContext } from '../api';

// Sidebar widths
const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 56;

// ============================================================================
// MUI Mini Variant Drawer Pattern - Industry Standard
// ============================================================================
// Uses styled component with openedMixin/closedMixin for smooth transitions
// Reference: https://mui.com/material-ui/react-drawer/#mini-variant-drawer

// Shared glassmorphism styles for drawer
const getGlassmorphismStyles = (theme, isDarkMode) => ({
  background: isDarkMode 
    ? alpha(theme.palette.background.paper, 0.05)
    : theme.palette.background.default, // Use same background as Chat.jsx
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRight: '1px solid',
  borderColor: theme.palette.divider,
});

const openedMixin = (theme, isDarkMode) => ({
  width: EXPANDED_WIDTH,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen, // 225ms
  }),
  overflowX: 'hidden',
  ...getGlassmorphismStyles(theme, isDarkMode),
});

const closedMixin = (theme, isDarkMode) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen, // 195ms
  }),
  overflowX: 'hidden',
  width: COLLAPSED_WIDTH,
  ...getGlassmorphismStyles(theme, isDarkMode),
});

// Styled Drawer component following MUI Mini Variant pattern
const StyledDrawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open' && prop !== 'isDarkMode',
})(({ theme, open, isDarkMode }) => ({
  width: EXPANDED_WIDTH,
  height: '100%', // Fill container height (critical for mobile drawer)
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
  // Collapse control (desktop only)
  isCollapsed = false,
  onToggleCollapse,
  // Profile
  user = null,
  onMenuOpen,
  // Mobile drawer control
  mobileOpen = false,
  onMobileClose,
}) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [dbPopoverAnchor, setDbPopoverAnchor] = useState(null);
  const [historyPopoverAnchor, setHistoryPopoverAnchor] = useState(null);
  const profileButtonRef = useRef(null);
  const historyButtonRef = useRef(null);
  const isPopoverOpen = Boolean(dbPopoverAnchor);
  const isHistoryPopoverOpen = Boolean(historyPopoverAnchor);

  // Reusable collapse transition helper
  const getCollapseTransition = (properties) => ({
    transition: theme.transitions.create(properties, {
      easing: theme.transitions.easing.sharp,
      duration: isCollapsed
        ? theme.transitions.duration.leavingScreen
        : theme.transitions.duration.enteringScreen,
    }),
  });

  // Common styles for elements that hide when collapsed
  const collapsedHiddenStyles = {
    opacity: isCollapsed ? 0 : 1,
    visibility: isCollapsed ? 'hidden' : 'visible',
    width: isCollapsed ? 0 : 'auto',
    overflow: 'hidden',
    ...getCollapseTransition(['opacity', 'visibility', 'width']),
  };

  // Delete button styles (DRY - used in main list and popover)
  const deleteButtonStyles = {
    padding: 0.5,
    color: theme.palette.text.secondary,
    transition: 'all 0.15s ease',
    '&:hover': { 
      color: theme.palette.error.main, 
      backgroundColor: alpha(theme.palette.error.main, 0.1), 
    }
  };

  const handleDatabaseSelect = (dbName) => {
    setDbPopoverAnchor(null);
    if (dbName !== currentDatabase) {
      onDatabaseSwitch?.(dbName);
    }
  };

  const handleHistoryClick = () => {
    if (isCollapsed && conversations.length > 0 && historyButtonRef.current) {
      setHistoryPopoverAnchor(historyButtonRef.current);
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
      const data = await getUserContext();
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

  // Shared content styles for both wrapper modes
  const contentContainerStyles = {
    position: 'relative',
    height: '100%',
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
  };

  // Content that goes inside the wrapper (shared by both modes)
  const sidebarContent = (
    <>
      {/* ===== TOP: Logo Area (No toggle on click) ===== */}
      <Box 
        sx={{ 
          p: isCollapsed ? 0 : 2,
          py: isCollapsed ? 1.5 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: isCollapsed ? 0 : 1.5,
          minHeight: 56,
          transition: theme.transitions.create(['padding', 'justify-content'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Box
          component="img" 
          src="/product-logo.png" 
          alt="Moonlit" 
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
            color: theme.palette.text.primary,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            ...collapsedHiddenStyles,
          }}
        >
          Moonlit
        </Typography>
      </Box>

      {/* ===== NAVIGATION ITEMS ===== */}
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: isCollapsed ? 'center' : 'stretch',
        px: isCollapsed ? 0 : 1.5, 
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
                color={theme.palette.text.secondary} 
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
            <Tooltip key={index} title={isCollapsed ? item.tooltip : ''} placement="right" arrow>
              {isCollapsed ? (
                // Collapsed: Use IconButton for proper theme styling
                <IconButton
                  ref={item.label === 'History' ? historyButtonRef : undefined}
                  onClick={item.action}
                  size="small"
                  sx={{
                    mb: 0.5,
                    ...(item.label === 'Database' && isConnected && {
                      position: 'relative',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.success.main,
                      },
                    }),
                  }}
                >
                  {item.icon}
                </IconButton>
              ) : (
                // Expanded: Use Box for full row with label
                <Box
                  ref={item.label === 'History' ? historyButtonRef : undefined}
                  onClick={item.action}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    width: '100%',
                    p: 1.25,
                    mb: 0.25,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    color: theme.palette.text.secondary,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                    },
                    ...(item.label === 'Database' && isConnected && {
                      position: 'relative',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 10,
                        left: 28,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.success.main,
                      },
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
                    }}
                  >
                    {item.label}
                  </Typography>
                </Box>
              )}
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
            px: isCollapsed ? 0 : 1,
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
              ...getCollapseTransition(['opacity', 'visibility']),
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
                <Typography variant="caption" color={theme.palette.text.secondary}>
                  No conversations yet
                </Typography>
              </Box>
            ) : (
            conversations.map((conv) => (
              <Tooltip key={conv.id} title={isCollapsed ? (conv.title || 'Conversation') : ''} placement="right" arrow>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    p: isCollapsed ? 1 : 1.25,
                    mb: 0.25,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    backgroundColor: conv.id === currentConversationId 
                      ? theme.palette.action.selected
                      : 'transparent',
                    transition: 'all 0.2s ease',
                    '&:hover .delete-btn': { opacity: 1 },
                  }}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <QuestionAnswerOutlinedIcon 
                    sx={{ 
                      fontSize: 16, 
                      color: conv.id === currentConversationId ? theme.palette.text.primary : theme.palette.text.secondary, 
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
                      ...getCollapseTransition(['opacity', 'width']),
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      noWrap 
                      sx={{ 
                        color: conv.id === currentConversationId ? theme.palette.text.primary : theme.palette.text.secondary,
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
                    sx={{ opacity: 0, ml: 0.5, ...deleteButtonStyles }}
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
          <Typography variant="overline" color={theme.palette.text.secondary}>
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
                  <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                ) : (
                  <StorageOutlinedIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
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
              <AddCircleOutlineRoundedIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
            </ListItemIcon>
            <ListItemText 
              primary="New Connection" 
              primaryTypographyProps={{ variant: 'body2', color: theme.palette.primary.main }}
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
                    <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                  ) : (
                    <QuestionAnswerOutlinedIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
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
                  sx={{ opacity: 0.5, '&:hover': { opacity: 1 }, ...deleteButtonStyles }}
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
          borderColor: 'divider',
          p: isCollapsed ? 0.75 : 1,
          display: 'flex',
          flexDirection: isCollapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          gap: isCollapsed ? 1 : 0,
          transition: theme.transitions.create(['padding', 'flex-direction', 'gap', 'justify-content'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        {/* Profile button */}
        <Tooltip title={isCollapsed ? (user?.displayName || 'Profile') : ''} placement="right" arrow>
          <IconButton 
            ref={profileButtonRef}
            onClick={() => onMenuOpen({ currentTarget: profileButtonRef.current })} 
            size="small" 
           
          >
            {user?.photoURL ? (
              <Avatar src={user.photoURL} sx={{ width: 24, height: 24 }} />
            ) : (
              <AccountCircleOutlinedIcon sx={{ fontSize: 24 }} />
            )}
          </IconButton>
        </Tooltip>

        {/* Collapse/Expand toggle - On mobile: close drawer, On desktop: collapse/expand */}
        <Tooltip title={isMobile ? 'Close sidebar' : (isCollapsed ? 'Expand sidebar' : '')} placement="right" arrow>
          <IconButton onClick={isMobile ? onMobileClose : onToggleCollapse} size="small">
            {isMobile ? (
              <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: 20 }} />
            ) : isCollapsed ? (
              <KeyboardDoubleArrowRightRoundedIcon sx={{ fontSize: 20 }} />
            ) : (
              <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: 20 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Schema Mindmap Dialog */}
      <Dialog
        open={mindmapOpen}
        onClose={() => setMindmapOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{
          // Fullscreen on mobile only
          '& .MuiDialog-paper': {
            margin: { xs: 0, sm: 2 },
            width: { xs: '100%', sm: 'calc(100% - 32px)' },
            height: { xs: '100%', sm: '80vh' },
            maxHeight: { xs: '100%', sm: 700 },
            borderRadius: { xs: 0, sm: 2 },
          },
        }}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            backgroundImage: 'none',
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
                sx={{ ml: 1, display: { xs: 'none', sm: 'flex' } }}
              />
            )}
          </Box>
          <IconButton
            size="small"
            onClick={() => setMindmapOpen(false)}
            sx={{ color: theme.palette.text.secondary }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 1, sm: 2 } }}>
          {schemaLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: { xs: 300, sm: 400 } }}>
              <CircularProgress />
            </Box>
          ) : schemaData ? (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, mb: 1.5 }}>
                Click on table nodes to expand/collapse columns. Use mouse to pan and scroll to zoom.
              </Typography>
              <SchemaFlowDiagram
                database={schemaData.database}
                tables={schemaData.tables || []}
                columns={schemaData.columns || {}}
              />
            </>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: { xs: 300, sm: 400 } }}>
              <Typography color={theme.palette.text.secondary}>
                No schema data available. Connect to a database first.
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  // Mobile: SwipeableDrawer (temporary)
  if (isMobile) {
    return (
      <SwipeableDrawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        onOpen={() => {}} // Required for SwipeableDrawer but controlled externally
        disableSwipeToOpen
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: EXPANDED_WIDTH,
            height: '100%',
            ...getGlassmorphismStyles(theme, isDarkMode),
            borderRight: '1px solid',
            borderColor: theme.palette.divider,
          },
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {sidebarContent}
        </Box>
      </SwipeableDrawer>
    );
  }

  // Desktop: StyledDrawer (permanent)
  return (
    <StyledDrawer 
      variant="permanent"
      open={!isCollapsed}
      isDarkMode={isDarkMode}
      PaperProps={{
        sx: contentContainerStyles
      }}
    >
      {sidebarContent}
    </StyledDrawer>
  );
}

export default memo(Sidebar);
