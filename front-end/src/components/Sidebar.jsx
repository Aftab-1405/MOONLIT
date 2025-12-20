import { Box, Typography, Button, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StorageIcon from '@mui/icons-material/Storage';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

function Sidebar({ 
  conversations = [], 
  currentConversationId, 
  onNewChat, 
  onSelectConversation, 
  onDeleteConversation,
  isConnected,
  currentDatabase,
  onOpenDbModal 
}) {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden' }}>
      
      {/* New Chat Button */}
      <Button
        fullWidth
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={onNewChat}
        sx={{
          justifyContent: 'flex-start',
          mb: 3,
          py: 1.5,
          px: 2,
          borderRadius: 2,
          borderColor: 'rgba(255,255,255,0.1)',
          color: 'text.primary',
          textTransform: 'none',
          backgroundColor: 'transparent',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderColor: 'rgba(255,255,255,0.2)',
          }
        }}
      >
        New Chat
      </Button>

      {/* Database Status Card */}
      <Box
        onClick={onOpenDbModal}
        sx={{
          mb: 4,
          p: 2,
          borderRadius: 2,
          cursor: 'pointer',
          backgroundColor: isConnected ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
          border: '1px solid',
          borderColor: isConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          transition: 'all 0.2s',
          '&:hover': {
            backgroundColor: isConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <FiberManualRecordIcon 
            sx={{ 
              fontSize: 10, 
              color: isConnected ? 'success.main' : 'error.main' 
            }} 
          />
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {isConnected ? 'Connected' : 'Not Connected'}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2.75 }}>
          {isConnected ? (currentDatabase || 'Database ready') : 'Click to connect'}
        </Typography>
      </Box>

      {/* Recent Chats Label */}
      <Typography 
        variant="caption" 
        fontWeight={600} 
        color="text.secondary" 
        sx={{ px: 1, mb: 1.5, display: 'block', letterSpacing: '0.5px' }}
      >
        RECENT
      </Typography>

      {/* Conversations List */}
      <Box sx={{ flex: 1, overflowY: 'auto', mx: -1, px: 1 }}>
        {conversations.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center', opacity: 0.6 }}>
            No recent chats
          </Typography>
        ) : (
          conversations.map((conv) => (
            <Box
              key={conv.id}
              sx={{
                group: 'true',
                display: 'flex',
                alignItems: 'center',
                p: 1.5,
                mb: 0.5,
                borderRadius: 2,
                cursor: 'pointer',
                backgroundColor: conv.id === currentConversationId ? 'rgba(255,255,255,0.08)' : 'transparent',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: conv.id === currentConversationId ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  '& .delete-btn': { opacity: 1 }
                }
              }}
              onClick={() => onSelectConversation(conv.id)}
            >
              <ChatBubbleOutlineIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 2 }} />
              
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                  variant="body2" 
                  noWrap 
                  sx={{ 
                    color: conv.id === currentConversationId ? 'text.primary' : 'text.secondary',
                    fontWeight: conv.id === currentConversationId ? 500 : 400
                  }}
                >
                  {conv.title || 'New Conversation'}
                </Typography>
              </Box>

              <Tooltip title="Delete">
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
                    color: 'text.secondary',
                    '&:hover': { color: 'error.main', backgroundColor: 'rgba(239, 68, 68, 0.1)' }
                  }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

export default Sidebar;
