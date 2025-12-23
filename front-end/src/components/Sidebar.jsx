import { useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Divider, Popover, List, ListItemButton, ListItemText, ListItemIcon, Avatar } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

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

// Sidebar widths
const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 56;

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

  // Navigation items for Grok-style nav - Using distinct outlined icons
  const navItems = [
    { icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 20 }} />, label: 'New Chat', tooltip: 'New Chat', action: onNewChat },
    { icon: <StorageOutlinedIcon sx={{ fontSize: 20 }} />, label: 'Database', tooltip: isConnected ? currentDatabase : 'Connect Database', action: onOpenDbModal },
    { icon: <HistoryOutlinedIcon sx={{ fontSize: 20 }} />, label: 'History', tooltip: 'History', isSection: !isCollapsed, action: isCollapsed ? handleHistoryClick : undefined },
  ];

  return (
    <Box 
      sx={{ 
        width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        minWidth: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        height: '100%',
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        // Glassmorphism effect
        background: isDarkMode 
          ? alpha(theme.palette.background.paper, 0.05)
          : alpha(theme.palette.background.paper, 0.8),
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRight: '1px solid',
        borderColor: alpha(theme.palette.divider, isDarkMode ? 0.1 : 0.15),
        // Smooth transition for ALL properties
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
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
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
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
        {!isCollapsed && (
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontWeight: 600,
              color: 'text.primary',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              opacity: isCollapsed ? 0 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            DB-Genie
          </Typography>
        )}
      </Box>

      {/* ===== NAVIGATION ITEMS ===== */}
      <Box sx={{ px: isCollapsed ? 0.75 : 1.5, py: 1, transition: 'padding 0.25s ease' }}>
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
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
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
                {!isCollapsed && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 450,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </Typography>
                )}
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
            transition: 'padding 0.25s ease',
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
          {isCollapsed ? null : (
            conversations.length === 0 ? (
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
                      ? (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
                      : 'transparent',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: conv.id === currentConversationId 
                        ? (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                        : (isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                      '& .delete-btn': { opacity: 1 }
                    }
                  }}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  {isCollapsed ? (
                    <QuestionAnswerOutlinedIcon 
                      sx={{ 
                        fontSize: 18, 
                        color: conv.id === currentConversationId ? 'text.primary' : 'text.secondary',
                      }} 
                    />
                  ) : (
                    <>
                      <QuestionAnswerOutlinedIcon 
                        sx={{ 
                          fontSize: 16, 
                          color: conv.id === currentConversationId ? 'text.primary' : 'text.secondary', 
                          mr: 1.5,
                          flexShrink: 0,
                        }} 
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
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
                    </>
                  )}
                </Box>
              </Tooltip>
            ))
          ))}
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
          transition: 'all 0.25s ease',
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
                  backgroundColor: isDarkMode ? 'rgba(31, 31, 31, 0.8)' : 'rgba(208, 215, 222, 0.6)',
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
        <Tooltip title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right" arrow>
          <IconButton
            onClick={onToggleCollapse}
            size="small"
            sx={{
              p: 1, // Standardize padding
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: isDarkMode ? 'rgba(31, 31, 31, 0.8)' : 'rgba(208, 215, 222, 0.6)',
                color: 'text.primary',
              }
            }}
          >
            {isCollapsed ? (
              <KeyboardDoubleArrowRightRoundedIcon sx={{ fontSize: 20 }} />
            ) : (
              <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: 20 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default Sidebar;
