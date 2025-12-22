
import { 
  Box, 
  Typography, 
  IconButton,
  Tooltip,
  Drawer, 
  AppBar, 
  Toolbar,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  Snackbar,
  Alert,
  Dialog,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatInput from '../components/ChatInput';
import MessageList from '../components/MessageList';
import DatabaseModal from '../components/DatabaseModal';
import SQLResultsTable from '../components/SQLResultsTable';
import SettingsModal from '../components/SettingsModal';
import ConfirmDialog from '../components/ConfirmDialog';

const DRAWER_WIDTH = 260;
const COLLAPSED_WIDTH = 56;

function Chat() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [currentDatabase, setCurrentDatabase] = useState(null);
  const [isRemote, setIsRemote] = useState(false);
  const [dbType, setDbType] = useState(null);
  const [availableDatabases, setAvailableDatabases] = useState([]);
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [queryResults, setQueryResults] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, sql: '', onConfirm: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  const messagesContainerRef = useRef(null);
  const { user, logout } = useAuth();

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    // Small delay to ensure DOM has updated
    const timer = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timer);
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    checkDbStatus();
    fetchConversations();
  }, []);

  // Handle URL changes
  useEffect(() => {
    if (conversationId) {
      if (conversationId !== currentConversationId) {
        handleSelectConversation(conversationId);
      }
    } else {
      // No ID in URL = New Chat
      if (currentConversationId) {
        resetChatState();
      }
    }
  }, [conversationId]);

  useEffect(() => {
    document.title = 'DB-Genie - Chat';
  }, []);

  const checkDbStatus = async () => {
    try {
      const response = await fetch('/db_status');
      const data = await response.json();
      setIsDbConnected(data.connected || false);
      setCurrentDatabase(data.current_database || null);
      setIsRemote(data.is_remote || false);
      setDbType(data.db_type || null);
      setAvailableDatabases(data.databases || []);
    } catch (error) {
      console.error('Failed to check DB status:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('/get_conversations');
      const data = await response.json();
      if (data.status === 'success') {
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleSidebarToggle = () => setSidebarCollapsed(!sidebarCollapsed);
  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleLogout = async () => { handleMenuClose(); await logout(); };

  const handleNewChat = async () => {
    navigate('/chat');
    // State reset is handled by useEffect on conversationId param change
    
    try {
      const response = await fetch('/new_conversation', { method: 'POST' });
      const data = await response.json();
      if (data.status === 'success') {
        const newId = data.conversation_id;
        navigate(`/chat/${newId}`, { replace: true });
        // Fetch conversations to ensure sidebar is updated (though it might be empty initially)
        fetchConversations();
      }
    } catch (error) {
      console.error('Failed to create new conversation:', error);
    }
  };

  const handleSelectConversation = async (conversationId) => {
    try {
      const response = await fetch(`/get_conversation/${conversationId}`);
      const data = await response.json();
      if (data.status === 'success' && data.conversation) {
        setCurrentConversationId(conversationId);
        const formattedMessages = (data.conversation.messages || []).map((msg) => ({
          sender: msg.sender,
          content: msg.content,
          // Include tools if present (for AI messages with tool usage)
          tools: msg.tools || undefined,
        }));
        setMessages(formattedMessages);
        setQueryResults(null);
        setMobileOpen(false);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const resetChatState = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setQueryResults(null);
    setMobileOpen(false);
  };

  const handleDeleteConversation = async (conversationId) => {
    try {
      await fetch(`/delete_conversation/${conversationId}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (currentConversationId === conversationId) handleNewChat();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleDbConnect = (data) => {
    if (data) {
      setIsDbConnected(true);
      if (data.selectedDatabase) setCurrentDatabase(data.selectedDatabase);
      
      // Update advanced state for sidebar features
      if (data.is_remote !== undefined) setIsRemote(data.is_remote);
      
      // If db_type isn't in response, try to infer or keep existing (DatabaseModal usually sends it on connect)
      if (data.db_type) setDbType(data.db_type);
      
      // Update available databases list
      if (data.schemas) setAvailableDatabases(data.schemas);
      
      setSnackbar({ open: true, message: 'Connected to database!', severity: 'success' });
    } else {
      setIsDbConnected(false);
      setCurrentDatabase(null);
      setIsRemote(false);
      setDbType(null);
      setAvailableDatabases([]);
      setSnackbar({ open: true, message: 'Disconnected from database', severity: 'info' });
    }
  };

  // Ref to resolve the pending query promise (for spinner to work with confirmation)
  const queryResolverRef = useRef(null);

  const handleRunQuery = (sql) => {
    if (!isDbConnected) {
      setSnackbar({ open: true, message: 'Please connect to a database first', severity: 'warning' });
      setDbModalOpen(true);
      return Promise.resolve();
    }

    // Get settings
    const storedSettings = JSON.parse(localStorage.getItem('db-genie-settings') || '{}');
    const confirmBeforeRun = storedSettings.confirmBeforeRun ?? false;
    const maxRows = storedSettings.maxRows ?? 1000;
    const queryTimeout = storedSettings.queryTimeout ?? 30;

    // If confirmation needed, return a promise that resolves when dialog completes
    if (confirmBeforeRun) {
      return new Promise((resolve) => {
        queryResolverRef.current = resolve;
        setConfirmDialog({
          open: true,
          sql: sql,
          onConfirm: async () => {
            // Execute query - dialog's internal spinner shows during execution
            await executeQuery(sql, maxRows, queryTimeout);
            // Close dialog after query completes
            setConfirmDialog({ open: false, sql: '', onConfirm: null, onCancel: null });
            // Resolve promise to stop CodeBlock spinner  
            queryResolverRef.current?.();
          },
          onCancel: () => {
            setConfirmDialog({ open: false, sql: '', onConfirm: null, onCancel: null });
            queryResolverRef.current?.();
          },
        });
      });
    }

    // Execute directly if confirmation not required
    return executeQuery(sql, maxRows, queryTimeout);
  };

  // Actual query execution (separated for confirmation flow)
  const executeQuery = async (sql, maxRows, queryTimeout) => {

    try {
      const response = await fetch('/run_sql_query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sql_query: sql,
          max_rows: maxRows,
          timeout: queryTimeout,
        }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        // Transform backend data to SQLResultsTable format
        // Backend sends: { result: { fields: [...], rows: [[...], [...]] }, row_count, execution_time_ms }
        // SQLResultsTable expects: { columns: [...], result: [{col1: val1, col2: val2}, ...], row_count, execution_time }
        const columns = data.result?.fields || [];
        const rows = data.result?.rows || [];
        
        // Transform rows from array of arrays to array of objects with column names as keys
        const transformedResult = rows.map(row => {
          const obj = {};
          columns.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          return obj;
        });
        
        setQueryResults({
          columns,
          result: transformedResult,
          row_count: data.row_count,
          total_rows: data.total_rows,
          truncated: data.truncated,
          execution_time: data.execution_time_ms ? data.execution_time_ms / 1000 : null, // Convert ms to seconds
        });
        setSnackbar({ open: true, message: `Query returned ${data.row_count} rows`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: data.message || 'Query failed', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to execute query', severity: 'error' });
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    // Add user message and scroll immediately
    setMessages((prev) => [...prev, { sender: 'user', content: message }]);
    
    // Immediate scroll
    setTimeout(scrollToBottom, 10);

    // Get reasoning settings from localStorage
    const storedSettings = JSON.parse(localStorage.getItem('db-genie-settings') || '{}');
    const enableReasoning = storedSettings.enableReasoning ?? true;
    const reasoningEffort = storedSettings.reasoningEffort ?? 'medium';

    try {
      const response = await fetch('/pass_userinput_to_gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: message, 
          conversation_id: currentConversationId,
          enable_reasoning: enableReasoning,
          reasoning_effort: reasoningEffort,
        }),
      });

      const newConversationId = response.headers.get('X-Conversation-Id');
      if (newConversationId && !currentConversationId) {
        setCurrentConversationId(newConversationId);
        navigate(`/chat/${newConversationId}`, { replace: true });
        
        // Optimistically add the new conversation to the list immediately
        // Use the first part of the message as a temporary title
        const tempTitle = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        setConversations((prev) => [
          { id: newConversationId, title: tempTitle, created_at: new Date().toISOString() },
          ...prev,
        ]);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        // All content (including inline tool markers [[TOOL:...]]) flows into aiResponse
        // The MessageList component will parse and render tool indicators inline
        aiResponse += chunk;
        
        // Update the AI message with new content (mark as streaming)
        if (aiResponse) {
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[updated.length - 1]?.sender === 'ai') {
              updated[updated.length - 1] = { 
                ...updated[updated.length - 1], 
                content: aiResponse,
                isStreaming: true
              };
            } else {
              updated.push({ 
                sender: 'ai', 
                content: aiResponse,
                isStreaming: true
              });
            }
            return updated;
          });
        }
      }
      
      // Mark streaming as complete
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.sender === 'ai') {
          updated[updated.length - 1] = { 
            ...updated[updated.length - 1], 
            isStreaming: false
          };
        }
        return updated;
      });

      // Refresh conversations after streaming to get the real title from backend
      fetchConversations();
    } catch (error) {
      setMessages((prev) => [...prev, { sender: 'ai', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
  };

  const handleDatabaseSwitch = async (dbName) => {
    try {
      // Determine correct endpoint and payload based on connection type
      const endpoint = isRemote ? '/switch_remote_database' : '/connect_db';
      const payload = isRemote ? { database: dbName } : { db_name: dbName };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      // Handle different response formats (some return text, some json)
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid server response');
      }

      if (data.status === 'connected' || data.status === 'success') {
        setCurrentDatabase(dbName);
        // If remote switch returned new tables, we could show them, but for now just success
        setSnackbar({ open: true, message: `Switched to ${dbName}`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: data.message || 'Failed to switch', severity: 'error' });
      }
    } catch (err) {
      console.error('Database switch error:', err);
      setSnackbar({ open: true, message: 'Failed to switch database', severity: 'error' });
    }
  };

  // Sidebar width based on collapsed state
  const currentSidebarWidth = sidebarCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
      {/* Mobile AppBar */}
      <AppBar
        position="fixed"
        sx={{
          display: { md: 'none' },
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid',
          borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        }}
        elevation={0}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle}>
            <MenuRoundedIcon sx={{ color: 'text.secondary' }} />
          </IconButton>
          
          {/* Right side: New Chat button */}
          <IconButton 
            onClick={handleNewChat}
            sx={{ 
              color: 'text.primary',
            }}
          >
            <EditNoteRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* User Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{ sx: { minWidth: 180, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2">{user?.displayName}</Typography>
          <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
        </Box>
        <Divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
        <MenuItem onClick={() => { handleMenuClose(); setSettingsOpen(true); }}><ListItemIcon><SettingsOutlinedIcon fontSize="small" /></ListItemIcon>Settings</MenuItem>
        <MenuItem onClick={handleLogout}><ListItemIcon><LogoutRoundedIcon fontSize="small" /></ListItemIcon>Sign out</MenuItem>
      </Menu>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { 
            width: DRAWER_WIDTH, 
            bgcolor: isDarkMode ? '#000000' : '#f8f8f8', 
            borderRight: '1px solid', 
            borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' 
          },
        }}
      >
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onNewChat={() => { setMobileOpen(false); navigate('/chat'); }}
          onSelectConversation={(id) => { setMobileOpen(false); navigate(`/chat/${id}`); }}
          onDeleteConversation={handleDeleteConversation}
          isConnected={isDbConnected}
          currentDatabase={currentDatabase}
          dbType={dbType}
          availableDatabases={availableDatabases}
          onOpenDbModal={() => { setMobileOpen(false); setDbModalOpen(true); }}
          onDatabaseSwitch={handleDatabaseSwitch}
          onSchemaChange={(data) => {
            if (data) {
              setSnackbar({ 
                open: true, 
                message: `Selected schema: ${data.schema} (${data.tables?.length || 0} tables)`, 
                severity: 'success' 
              });
            }
          }}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onOpenSettings={() => { setMobileOpen(false); setSettingsOpen(true); }}
          user={user}
          onMenuOpen={(e) => { setMobileOpen(false); handleMenuOpen(e); }}
        />
      </Drawer>

      {/* Desktop Sidebar - Always visible, collapsible */}
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          width: currentSidebarWidth,
          flexShrink: 0,
          transition: 'width 0.2s ease',
        }}
      >
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onNewChat={() => navigate('/chat')}
          onSelectConversation={(id) => navigate(`/chat/${id}`)}
          onDeleteConversation={handleDeleteConversation}
          isConnected={isDbConnected}
          currentDatabase={currentDatabase}
          dbType={dbType}
          availableDatabases={availableDatabases}
          onOpenDbModal={() => setDbModalOpen(true)}
          onDatabaseSwitch={handleDatabaseSwitch}
          onSchemaChange={(data) => {
            if (data) {
              setSnackbar({ 
                open: true, 
                message: `Selected schema: ${data.schema} (${data.tables?.length || 0} tables)`, 
                severity: 'success' 
              });
            }
          }}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleSidebarToggle}
          onOpenSettings={() => setSettingsOpen(true)}
          user={user}
          onMenuOpen={handleMenuOpen}
        />
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          mt: { xs: '56px', md: 0 },
          // Mobile viewport fix: use svh (small viewport height) for mobile browsers
          height: { xs: 'calc(100svh - 56px)', md: '100vh' },
          // Fallback for browsers that don't support svh
          '@supports not (height: 100svh)': {
            height: { xs: 'calc(100vh - 56px)', md: '100vh' },
          },
          overflow: 'hidden',
          backgroundColor: 'transparent',
          position: 'relative',
        }}
      >
        {/* Empty state: Center logo + input together like Grok */}
        {messages.length === 0 && !isLoading ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: 3,
            }}
          >
            {/* Logo */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                mb: 4,
              }}
            >
              <Box
                component="img"
                src="/product-logo.png"
                alt="DB-Genie"
                sx={{ 
                  width: { xs: 36, sm: 42 }, 
                  height: { xs: 36, sm: 42 }, 
                  opacity: 0.95,
                }}
              />
              <Typography 
                variant="h3" 
                sx={{ 
                  fontWeight: 500,
                  fontSize: { xs: '2rem', sm: '2.5rem' },
                  color: 'text.primary',
                  letterSpacing: '-0.02em',
                }}
              >
                DB-Genie
              </Typography>
            </Box>

            {/* Input - centered with logo */}
            <Box sx={{ width: '100%', maxWidth: 760 }}>
              <ChatInput 
                onSend={handleSendMessage} 
                disabled={isLoading} 
                isConnected={isDbConnected}
                dbType={dbType}
                currentDatabase={currentDatabase}
              />
            </Box>
          </Box>
        ) : (
          <>
            {/* Messages Container */}
            <Box 
              ref={messagesContainerRef}
              sx={{ flex: 1, overflow: 'auto', scrollBehavior: 'smooth' }}
            >
              <MessageList
                messages={messages}
                user={user}
                onRunQuery={handleRunQuery}
                onSuggestionClick={handleSendMessage}
                isTyping={isLoading}
              />
            </Box>

            {/* Input at bottom when there are messages */}
            <ChatInput 
              onSend={handleSendMessage} 
              disabled={isLoading} 
              isConnected={isDbConnected}
              dbType={dbType}
              currentDatabase={currentDatabase}
              showSuggestions={false}
            />
          </>
        )}
      </Box>

      {/* Modals */}
      <DatabaseModal open={dbModalOpen} onClose={() => setDbModalOpen(false)} onConnect={handleDbConnect} isConnected={isDbConnected} currentDatabase={currentDatabase} />
      
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
      
      {/* SQL Results Modal */}
      <Dialog
        open={Boolean(queryResults)}
        onClose={() => setQueryResults(null)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            maxHeight: '85vh',
            borderRadius: 2,
          }
        }}
      >
        {queryResults && <SQLResultsTable data={queryResults} onClose={() => setQueryResults(null)} />}
      </Dialog>
      
      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      
      {/* Query Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => {
          confirmDialog.onCancel?.();
          setConfirmDialog({ open: false, sql: '', onConfirm: null, onCancel: null });
        }}
        onConfirm={confirmDialog.onConfirm}
        title="Execute Query?"
        message="You are about to execute the following SQL query:"
        sqlQuery={confirmDialog.sql}
        confirmText="Execute"
        confirmColor="success"
      />
    </Box>
  );
}

export default Chat;
