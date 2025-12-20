import { useState } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Divider, Popover, List, ListItemButton, ListItemText, ListItemIcon } from '@mui/material';

// Modern, relevant icons
import EditNoteIcon from '@mui/icons-material/EditNote';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import CircleIcon from '@mui/icons-material/Circle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import SchemaSelector from './SchemaSelector';

function Sidebar({ 
  conversations = [], 
  currentConversationId, 
  onNewChat, 
  onSelectConversation, 
  onDeleteConversation,
  isConnected,
  currentDatabase,
  dbType,
  availableDatabases = [],
  onOpenDbModal,
  onDatabaseSwitch,
  onSchemaChange
}) {
  const [dbPopoverAnchor, setDbPopoverAnchor] = useState(null);
  const isPopoverOpen = Boolean(dbPopoverAnchor);

  const handleDbCardClick = (event) => {
    if (isConnected && availableDatabases.length > 0) {
      setDbPopoverAnchor(event.currentTarget);
    } else {
      onOpenDbModal?.();
    }
  };

  const handleDatabaseSelect = (dbName) => {
    setDbPopoverAnchor(null);
    if (dbName !== currentDatabase) {
      onDatabaseSwitch?.(dbName);
    }
  };

  return (
    <Box 
      sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* ===== TOP SECTION: Actions ===== */}
      <Box sx={{ p: 2, pb: 0 }}>
        {/* New Chat Button */}
        <Button
          fullWidth
          variant="outlined"
          startIcon={<EditNoteIcon />}
          onClick={onNewChat}
          sx={{
            justifyContent: 'flex-start',
            py: 1.25,
            px: 2,
            borderRadius: 2,
            borderColor: 'divider',
            color: 'text.primary',
            textTransform: 'none',
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: 'action.hover',
              borderColor: 'primary.main',
            }
          }}
        >
          New Chat
        </Button>
      </Box>

      {/* ===== DATABASE STATUS SECTION ===== */}
      <Box sx={{ px: 2, py: 2 }}>
        <Box
          onClick={handleDbCardClick}
          sx={{
            p: 1.5,
            borderRadius: 2,
            cursor: 'pointer',
            backgroundColor: isConnected 
              ? 'rgba(34, 197, 94, 0.06)' 
              : 'rgba(239, 68, 68, 0.06)',
            border: '1px solid',
            borderColor: isConnected 
              ? 'rgba(34, 197, 94, 0.15)' 
              : 'rgba(239, 68, 68, 0.15)',
            transition: 'all 0.2s',
            '&:hover': {
              backgroundColor: isConnected 
                ? 'rgba(34, 197, 94, 0.12)' 
                : 'rgba(239, 68, 68, 0.12)',
              borderColor: isConnected 
                ? 'rgba(34, 197, 94, 0.25)' 
                : 'rgba(239, 68, 68, 0.25)',
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CircleIcon 
              sx={{ 
                fontSize: 8, 
                color: isConnected ? 'success.main' : 'error.main',
                filter: isConnected 
                  ? 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.6))' 
                  : 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))',
              }} 
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography 
                variant="subtitle2" 
                color="text.primary"
              >
                {isConnected ? 'Connected' : 'Not Connected'}
              </Typography>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                noWrap
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                {isConnected ? (
                  <>
                    <StorageRoundedIcon sx={{ fontSize: 10 }} />
                    {currentDatabase || 'Database ready'}
                  </>
                ) : (
                  'Click to connect'
                )}
              </Typography>
            </Box>
            {/* Switch indicator when connected */}
            {isConnected && availableDatabases.length > 1 && (
              <Tooltip title="Switch database">
                <SwapHorizRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </Tooltip>
            )}
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
                    <CheckCircleRoundedIcon sx={{ fontSize: 16, color: 'success.main' }} />
                  ) : (
                    <StorageRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
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
      </Box>

      {/* ===== SCHEMA SELECTOR (PostgreSQL only) ===== */}
      <SchemaSelector 
        isConnected={isConnected} 
        currentDatabase={currentDatabase}
        dbType={dbType}
        onSchemaChange={onSchemaChange}
      />

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', mx: 2 }} />

      {/* ===== MIDDLE SECTION: Conversations (Scrollable) ===== */}
      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Section Header */}
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <Typography 
            variant="overline" 
            color="text.secondary" 
            sx={{ display: 'block' }}
          >
            Recent Conversations
          </Typography>
        </Box>

        {/* Conversations List Container (Scrollable) */}
        <Box 
          sx={{ 
            flex: 1, 
            overflowY: 'auto',
            overflowX: 'hidden',
            px: 1,
            pb: 1,
            '&::-webkit-scrollbar': {
              width: 4,
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(148, 163, 184, 0.2)',
              borderRadius: 2,
              '&:hover': {
                backgroundColor: 'rgba(148, 163, 184, 0.3)',
              }
            },
          }}
        >
          {conversations.length === 0 ? (
            <Box 
              sx={{ 
                p: 3, 
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                opacity: 0.5,
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 24, color: 'secondary.main' }} />
              <Typography variant="caption" color="text.secondary">
                Start a new conversation
              </Typography>
            </Box>
          ) : (
            conversations.map((conv) => (
              <Box
                key={conv.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1.25,
                  mx: 0.5,
                  mb: 0.5,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  backgroundColor: conv.id === currentConversationId 
                    ? 'rgba(6, 182, 212, 0.1)' 
                    : 'transparent',
                  border: '1px solid',
                  borderColor: conv.id === currentConversationId 
                    ? 'rgba(6, 182, 212, 0.2)' 
                    : 'transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    backgroundColor: conv.id === currentConversationId 
                      ? 'rgba(6, 182, 212, 0.15)' 
                      : 'rgba(148, 163, 184, 0.06)',
                    borderColor: conv.id === currentConversationId 
                      ? 'rgba(6, 182, 212, 0.25)' 
                      : 'rgba(148, 163, 184, 0.1)',
                    '& .delete-btn': { opacity: 1 }
                  }
                }}
                onClick={() => onSelectConversation(conv.id)}
              >
                <QuestionAnswerOutlinedIcon 
                  sx={{ 
                    fontSize: 16, 
                    color: conv.id === currentConversationId 
                      ? 'secondary.main' 
                      : 'text.secondary', 
                    mr: 1.5,
                    flexShrink: 0,
                  }} 
                />
                
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography 
                    variant="body2" 
                    noWrap 
                    sx={{ 
                      color: conv.id === currentConversationId 
                        ? 'text.primary' 
                        : 'text.secondary',
                      fontWeight: conv.id === currentConversationId ? 500 : 400,
                    }}
                  >
                    {conv.title || 'New Conversation'}
                  </Typography>
                </Box>

                <Tooltip title="Delete" placement="right">
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
                        backgroundColor: 'rgba(239, 68, 68, 0.1)' 
                      }
                    }}
                  >
                    <DeleteForeverOutlinedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default Sidebar;
