/**
 * Chat Page - Main Application Interface
 * 
 * This is the primary interface where users interact with the AI assistant
 * and manage database connections. It orchestrates several components:
 * - Sidebar: Navigation and conversation history
 * - MessageList: Display of chat messages
 * - ChatInput: User input field
 * - SQLEditorCanvas: SQL query editor panel
 * 
 * STATE ORGANIZATION:
 * - Database state: Managed via DatabaseContext (no prop drilling)
 * - UI state: Local useState for modals, sidebar, snackbar
 * - Chat state: Local useState for messages and conversations
 * - Settings: Accessed via ThemeContext (useTheme hook)
 * 
 * @module Chat
 */

import { 
  Box, 
  Typography, 
  IconButton,
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
import { useTheme as useMuiTheme, alpha } from '@mui/material/styles';
import { useTheme } from '../contexts/ThemeContext';
import { useDatabaseConnection } from '../contexts/DatabaseContext';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatInput from '../components/ChatInput';
import MessageList from '../components/MessageList';
import DatabaseModal from '../components/DatabaseModal';
import SQLResultsTable from '../components/SQLResultsTable';
import SettingsModal from '../components/SettingsModal';
import ConfirmDialog from '../components/ConfirmDialog';
import StarfieldCanvas from '../components/StarfieldCanvas';
import SQLEditorCanvas from '../components/SQLEditorCanvas';
import useIdleDetection from '../hooks/useIdleDetection';

const DRAWER_WIDTH = 260;
const COLLAPSED_WIDTH = 56;

function Chat() {
  // ===========================================================================
  // HOOKS - External State & Navigation
  // ===========================================================================
  
  const muiTheme = useMuiTheme();
  const isDarkMode = muiTheme.palette.mode === 'dark';
  const { settings } = useTheme();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Database connection state from context (replaces 5 local useState calls)
  const {
    isConnected: isDbConnected,
    currentDatabase,
    dbType,
    isRemote,
    availableDatabases,
    connect: connectDb,
    resetConnectionState,
    switchDatabase,
  } = useDatabaseConnection();
  
  // ===========================================================================
  // LOCAL STATE - UI Controls
  // ===========================================================================
  // These remain local because they're purely UI concerns for this component
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // ===========================================================================
  // LOCAL STATE - Chat & Conversations
  // ===========================================================================
  // Could be moved to ConversationContext in future if needed elsewhere
  
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  
  // ===========================================================================
  // LOCAL STATE - Query & Results
  // ===========================================================================
  
  const [queryResults, setQueryResults] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, sql: '', onConfirm: null });
  
  // ===========================================================================
  // LOCAL STATE - SQL Editor Canvas
  // ===========================================================================
  
  const [sqlEditorOpen, setSqlEditorOpen] = useState(false);
  const [sqlEditorQuery, setSqlEditorQuery] = useState('');
  const [sqlEditorResults, setSqlEditorResults] = useState(null);
  
  // ===========================================================================
  // REFS
  // ===========================================================================
  
  const messagesContainerRef = useRef(null);
  const queryResolverRef = useRef(null);
  
  // ===========================================================================
  // IDLE DETECTION - For Starfield Animation
  // ===========================================================================
  
  const isIdle = useIdleDetection(8000);
  const idleAnimationEnabled = settings.idleAnimation ?? true;

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // Check if currently streaming (last message is AI and isStreaming=true)
  const isCurrentlyStreaming = messages.length > 0 && 
    messages[messages.length - 1]?.sender === 'ai' && 
    messages[messages.length - 1]?.isStreaming;
  
  // Get last message content for dependency tracking
  const lastMessageContent = messages[messages.length - 1]?.content || '';

  // Auto-scroll: triggers on new messages AND during streaming content updates
  useEffect(() => {
    // Small delay to ensure DOM has updated
    const timer = setTimeout(scrollToBottom, 16);
    return () => clearTimeout(timer);
  }, [messages, lastMessageContent, scrollToBottom]);

  // ===========================================================================
  // INITIAL DATA FETCH
  // ===========================================================================
  // Database status is now handled by DatabaseContext on mount.
  // Only fetch conversations here.
  
  useEffect(() => {
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

  // =========================================================================
  // Tab/Browser Close Detection
  // =========================================================================
  // When user closes the tab/browser, notify backend to clear connection
  // if persistence setting is "Never" (0 minutes).
  // Uses sendBeacon for reliable delivery during page unload.
  // =========================================================================
  
  useEffect(() => {
    const handleTabClose = () => {
      // Get the persistence setting from ThemeContext settings
      const connectionPersistence = settings.connectionPersistence ?? 0;
      
      // Only send disconnect signal if persistence is "Never" (0)
      // Other values mean user wants connection to persist for that duration
      if (connectionPersistence === 0 && isDbConnected) {
        // Use sendBeacon with Blob for reliable delivery during page unload
        // The Blob ensures correct Content-Type header for Flask
        const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
        navigator.sendBeacon('/disconnect_db', blob);
      }
    };

    // Listen for both events to catch all unload scenarios
    window.addEventListener('beforeunload', handleTabClose);
    window.addEventListener('pagehide', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      window.removeEventListener('pagehide', handleTabClose);
    };
  }, [isDbConnected, settings.connectionPersistence]);

  // NOTE: checkDbStatus has been removed.
  // Database status is now managed by DatabaseContext which fetches on mount.

  // ===========================================================================
  // MEMOIZED FETCH FUNCTION
  // ===========================================================================
  
  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch('/get_conversations');
      const data = await response.json();
      if (data.status === 'success') {
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  }, []);

  // ===========================================================================
  // MEMOIZED UI HANDLERS
  // ===========================================================================
  // These are passed to child components as callbacks.
  // Memoization with useCallback prevents unnecessary re-renders.
  
  const handleDrawerToggle = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);
  
  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);
  
  const handleMenuOpen = useCallback((e) => {
    setAnchorEl(e.currentTarget);
  }, []);
  
  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);
  
  const handleLogout = useCallback(async () => {
    setAnchorEl(null);
    await logout();
  }, [logout]);

  // ===========================================================================
  // CONVERSATION HANDLERS
  // ===========================================================================
  
  const handleNewChat = useCallback(async () => {
    navigate('/chat');
    // State reset is handled by useEffect on conversationId param change
    
    try {
      const response = await fetch('/new_conversation', { method: 'POST' });
      const data = await response.json();
      if (data.status === 'success') {
        const newId = data.conversation_id;
        navigate(`/chat/${newId}`, { replace: true });
        fetchConversations();
      }
    } catch (error) {
      console.error('Failed to create new conversation:', error);
    }
  }, [navigate, fetchConversations]);

  const handleSelectConversation = useCallback(async (convId) => {
    try {
      const response = await fetch(`/get_conversation/${convId}`);
      const data = await response.json();
      if (data.status === 'success' && data.conversation) {
        setCurrentConversationId(convId);
        const formattedMessages = (data.conversation.messages || []).map((msg) => ({
          sender: msg.sender,
          content: msg.content,
          tools: msg.tools || undefined,
        }));
        setMessages(formattedMessages);
        setQueryResults(null);
        setMobileOpen(false);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }, []);

  const resetChatState = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setQueryResults(null);
    setMobileOpen(false);
  }, []);

  const handleDeleteConversation = useCallback(async (convId) => {
    try {
      await fetch(`/delete_conversation/${convId}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (currentConversationId === convId) {
        navigate('/chat');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }, [currentConversationId, navigate]);

  // ===========================================================================
  // HANDLER: Database Connection
  // ===========================================================================
  // Called by DatabaseModal after successful connection.
  // Uses connectDb from DatabaseContext to update global state.
  
  const handleDbConnect = useCallback((data) => {
    if (data) {
      // Update context with new connection data
      connectDb(data);
      setSnackbar({ open: true, message: 'Connected to database!', severity: 'success' });
    } else {
      // Reset context state to reflect disconnection
      // Note: DatabaseModal already called the API, this just syncs UI state
      resetConnectionState();
      setSnackbar({ open: true, message: 'Disconnected from database', severity: 'info' });
    }
  }, [connectDb, resetConnectionState]);

  const handleRunQuery = (sql) => {
    if (!isDbConnected) {
      setSnackbar({ open: true, message: 'Please connect to a database first', severity: 'warning' });
      setDbModalOpen(true);
      return Promise.resolve();
    }

    // Get settings from ThemeContext (not localStorage directly)
    const confirmBeforeRun = settings.confirmBeforeRun ?? false;
    const maxRows = settings.maxRows ?? 1000;
    const queryTimeout = settings.queryTimeout ?? 30;

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
    } catch {
      setSnackbar({ open: true, message: 'Failed to execute query', severity: 'error' });
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    // Add user message and scroll immediately
    setMessages((prev) => [...prev, { sender: 'user', content: message }]);
    
    // Immediate scroll
    setTimeout(scrollToBottom, 10);

    // Get reasoning settings from ThemeContext (not localStorage directly)
    const enableReasoning = settings.enableReasoning ?? true;
    const reasoningEffort = settings.reasoningEffort ?? 'medium';

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
      let lastUpdateTime = 0;
      const UPDATE_THROTTLE_MS = 16; // ~60fps for smooth updates

      const updateMessage = () => {
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
      };

      while (true) {
        const { done, value } = await reader.read();
        
        if (!done) {
          const chunk = decoder.decode(value, { stream: true });
          
          // All content (including inline tool markers [[TOOL:...]]) flows into aiResponse
          // The MessageList component will parse and render tool indicators inline
          aiResponse += chunk;
        }
        
        // Throttle state updates for better performance (industry standard)
        // Update on every chunk or when done to ensure final content is displayed
        const now = Date.now();
        if (done || now - lastUpdateTime >= UPDATE_THROTTLE_MS) {
          if (aiResponse) {
            updateMessage();
            // Note: scrollToBottom is handled by useEffect on messages change
          }
          lastUpdateTime = now;
          
          if (done) break;
        }
      }
      
      // Mark streaming as complete
      // Note: scrollToBottom is automatically handled by useEffect on messages change
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
    } catch {
      setMessages((prev) => [...prev, { sender: 'ai', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
  };

  // ===========================================================================
  // HANDLER: Database Switch
  // ===========================================================================
  // Uses switchDatabase from DatabaseContext for consistent state updates.
  
  const handleDatabaseSwitch = useCallback(async (dbName) => {
    const result = await switchDatabase(dbName);
    if (result.success) {
      setSnackbar({ open: true, message: `Switched to ${dbName}`, severity: 'success' });
    } else {
      setSnackbar({ open: true, message: result.error || 'Failed to switch', severity: 'error' });
    }
  }, [switchDatabase]);

  // Sidebar width based on collapsed state
  const currentSidebarWidth = sidebarCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh', 
      bgcolor: 'background.default', 
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Animated Starfield Background - Activates when user is idle (dark theme only) */}
      <StarfieldCanvas active={isIdle && idleAnimationEnabled} />
      
      {/* Immersive gradient overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse at top right, ${alpha(muiTheme.palette.info.main, 0.04)} 0%, transparent 50%)`,
        }}
      />
      
      {/* Mobile AppBar */}
      <AppBar
        position="fixed"
        sx={{
          display: { md: 'none' },
          backgroundColor: alpha(muiTheme.palette.background.paper, isDarkMode ? 0.05 : 0.8),
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: alpha(muiTheme.palette.divider, isDarkMode ? 0.1 : 0.15),
          zIndex: 2,
        }}
        elevation={0}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle}>
            <MenuOutlinedIcon sx={{ color: 'text.secondary' }} />
          </IconButton>
          
          {/* Right side: New Chat button */}
          <IconButton 
            onClick={handleNewChat}
            sx={{ 
              color: 'text.primary',
            }}
          >
            <EditNoteOutlinedIcon />
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
        <MenuItem onClick={handleLogout}><ListItemIcon><LogoutOutlinedIcon fontSize="small" /></ListItemIcon>Sign out</MenuItem>
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
            background: isDarkMode 
              ? alpha(muiTheme.palette.background.paper, 0.05)
              : alpha(muiTheme.palette.background.paper, 0.8),
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRight: '1px solid', 
            borderColor: alpha(muiTheme.palette.divider, isDarkMode ? 0.1 : 0.15),
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
          transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          zIndex: 1,
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
          zIndex: 1,
          // Shrink content when SQL Editor is open
          marginRight: sqlEditorOpen ? '520px' : 0,
          transition: 'margin-right 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Empty state: Center logo + input together like Grok */}
        {messages.length === 0 ? (
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
                disabled={false}
                isConnected={isDbConnected}
                dbType={dbType}
                currentDatabase={currentDatabase}
                availableDatabases={availableDatabases}
                onDatabaseSwitch={handleDatabaseSwitch}
                onOpenSqlEditor={() => setSqlEditorOpen(true)}
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
                onOpenSqlEditor={(query, results) => {
                  setSqlEditorQuery(query || '');
                  setSqlEditorResults(results || null);
                  setSqlEditorOpen(true);
                }}
              />
            </Box>

            {/* Input at bottom when there are messages */}
            <ChatInput 
              onSend={handleSendMessage} 
              disabled={false}
              isConnected={isDbConnected}
              dbType={dbType}
              currentDatabase={currentDatabase}
              availableDatabases={availableDatabases}
              onDatabaseSwitch={handleDatabaseSwitch}
              showSuggestions={false}
              onOpenSqlEditor={() => setSqlEditorOpen(true)}
            />
          </>
        )}
      </Box>

      {/* Modals */}
      <DatabaseModal open={dbModalOpen} onClose={() => setDbModalOpen(false)} onConnect={handleDbConnect} isConnected={isDbConnected} currentDatabase={currentDatabase} />
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
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
      
      {/* SQL Editor Canvas */}
      <SQLEditorCanvas
        open={sqlEditorOpen}
        onClose={() => setSqlEditorOpen(false)}
        initialQuery={sqlEditorQuery}
        initialResults={sqlEditorResults}
        onRunQuery={handleRunQuery}
        isConnected={isDbConnected}
        currentDatabase={currentDatabase}
      />
    </Box>
  );
}

export default Chat;
