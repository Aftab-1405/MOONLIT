import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Divider,
} from '@mui/material';
import { useTheme as useMuiTheme, alpha } from '@mui/material/styles';
import { useTheme } from '../contexts/ThemeContext';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';

const DB_TYPES = [
  { value: 'mysql', label: 'MySQL', defaultPort: 3306, supportsConnectionString: true },
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432, supportsConnectionString: true },
  { value: 'sqlite', label: 'SQLite', defaultPort: null, supportsConnectionString: false },
];

function DatabaseModal({ open, onClose, onConnect, isConnected, currentDatabase }) {
  const muiTheme = useMuiTheme();
  
  // Get default DB type from ThemeContext settings (not localStorage directly)
  const { settings } = useTheme();
  const defaultDbType = settings.defaultDbType || 'postgresql';
  
  const [dbType, setDbType] = useState(defaultDbType);
  const [connectionMode, setConnectionMode] = useState('credentials'); // 'credentials' or 'connection_string'
  const [connectionString, setConnectionString] = useState('');
  const [formData, setFormData] = useState({
    host: 'localhost',
    port: DB_TYPES.find(d => d.value === defaultDbType)?.defaultPort?.toString() || '5432',
    user: '',
    password: '',
    database: '', // For SQLite, this is the file path
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConnectionString, setShowConnectionString] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [isRemote, setIsRemote] = useState(false); // Track if connected via connection string

  const isSQLite = dbType === 'sqlite';
  const supportsConnectionString = DB_TYPES.find(d => d.value === dbType)?.supportsConnectionString;

  // Fetch databases when modal opens and already connected
  useEffect(() => {
    if (open && isConnected) {
      // Fetch available databases from backend
      const fetchDatabases = async () => {
        try {
          const response = await fetch('/get_databases');
          const data = await response.json();
          if (data.status === 'success' && data.databases) {
            setDatabases(data.databases);
            // If it's a remote connection (PostgreSQL with connection string)
            if (data.is_remote) {
              setIsRemote(true);
              setDbType('postgresql');
              setConnectionMode('connection_string');
            }
          }
        } catch (err) {
          console.error('Failed to fetch databases:', err);
        }
      };
      fetchDatabases();
    }
  }, [open, isConnected]);

  const handleDbTypeChange = (event, newType) => {
    if (newType) {
      setDbType(newType);
      const dbConfig = DB_TYPES.find((d) => d.value === newType);
      setFormData((prev) => ({
        ...prev,
        port: dbConfig.defaultPort?.toString() || '',
      }));
      setError(null);
      setSuccess(null);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let payload;
      
      if (isSQLite) {
        payload = { db_type: dbType, db_name: formData.database };
      } else if (connectionMode === 'connection_string' && supportsConnectionString) {
        // Use connection string for remote databases
        payload = { 
          db_type: dbType, 
          connection_string: connectionString 
        };
      } else {
        // Use credentials for local databases
        payload = {
          db_type: dbType,
          host: formData.host,
          port: formData.port,
          user: formData.user,
          password: formData.password,
        };
      }

      const response = await fetch('/connect_db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.status === 'connected') {
        setSuccess(data.message);
        setDatabases(data.schemas || []);
        setIsRemote(data.is_remote || false);  // Track if this is a remote connection
        onConnect?.({ ...data, db_type: dbType }); // Include dbType from state
        
        // For remote DBs, fetch tables to show what's available
        if (data.is_remote && data.selectedDatabase) {
          try {
            const tablesRes = await fetch('/get_tables');
            const tablesData = await tablesRes.json();
            if (tablesData.status === 'success' && tablesData.tables?.length > 0) {
              setSuccess(`Connected to ${data.selectedDatabase}. Found ${tablesData.tables.length} tables: ${tablesData.tables.slice(0, 5).join(', ')}${tablesData.tables.length > 5 ? '...' : ''}`);
            }
          } catch (e) {
            console.warn('Failed to fetch tables:', e);
          }
          // Auto-close after showing success
          setTimeout(() => onClose(), 2500);
        }
      } else {
        setError(data.message || 'Failed to connect');
      }
    } catch (err) {
      setError(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDatabase = async (dbName) => {
    setLoading(true);
    setError(null);

    try {
      // Use different endpoint for remote vs local connections
      const endpoint = isRemote ? '/switch_remote_database' : '/connect_db';
      const payload = isRemote ? { database: dbName } : { db_name: dbName };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Server error: ${response.status}`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server. Please restart the backend.');
      }
      
      const data = JSON.parse(text);

      if (data.status === 'connected') {
        setSuccess(`Connected to ${dbName}${data.tables?.length ? ` (${data.tables.length} tables)` : ''}`);
        onConnect?.({ ...data, selectedDatabase: dbName });
        setTimeout(() => onClose(), 1500);
      } else {
        setError(data.message || 'Failed to select database');
      }
    } catch (err) {
      console.error('Database switch error:', err);
      setError(err.message || 'Failed to select database. Try restarting the backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch('/disconnect_db', { method: 'POST' });
      setDatabases([]);
      setSuccess(null);
      onConnect?.(null);
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorageRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Database Connection
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Connection Status Banner */}
        {isConnected && currentDatabase && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 1,

              backgroundColor: alpha(muiTheme.palette.text.primary, 0.05),
              border: `1px solid ${alpha(muiTheme.palette.text.primary, 0.1)}`,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'text.primary',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            />
            <Typography variant="body2" fontWeight={500} sx={{ color: 'text.primary' }}>
              Connected to: {currentDatabase}
            </Typography>
          </Box>
        )}
        
        {/* Database Type Selector */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Select database type
          </Typography>
          <ToggleButtonGroup
            value={dbType}
            exclusive
            onChange={handleDbTypeChange}
            fullWidth
            sx={{
              '& .MuiToggleButton-root': {
                py: 1.5,
                textTransform: 'none',
                '&.Mui-selected': {
                  backgroundColor: alpha(muiTheme.palette.text.primary, 0.05),
                  borderColor: 'text.primary',
                  color: 'text.primary',
                  '&:hover': {
                    backgroundColor: alpha(muiTheme.palette.text.primary, 0.1),
                  },
                },
              },
            }}
          >
            {DB_TYPES.map((db) => (
              <ToggleButton key={db.value} value={db.value}>
                {db.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {/* Connection Form */}
        {isSQLite ? (
          // SQLite - Just file path
          <TextField
            fullWidth
            name="database"
            label="Database File Path"
            placeholder="/path/to/database.db"
            value={formData.database}
            onChange={handleInputChange}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" disabled>
                    <FolderOpenOutlinedIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        ) : (
          // MySQL/PostgreSQL - Connection form
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Connection Mode Toggle (PostgreSQL only) */}
            {supportsConnectionString && (
              <Box sx={{ mb: 1 }}>
                <ToggleButtonGroup
                  value={connectionMode}
                  exclusive
                  onChange={(e, val) => val && setConnectionMode(val)}
                  size="small"
                  fullWidth
                  sx={{
                    '& .MuiToggleButton-root': {
                      py: 0.75,
                      textTransform: 'none',
                      fontSize: '0.8rem',
                      '&.Mui-selected': {
                        backgroundColor: alpha(muiTheme.palette.secondary.main, 0.15),
                        borderColor: 'secondary.main',
                        color: 'secondary.main',
                      },
                    },
                  }}
                >
                  <ToggleButton value="credentials">
                    Local / Credentials
                  </ToggleButton>
                  <ToggleButton value="connection_string">
                    <LinkRoundedIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    Connection String
                  </ToggleButton>
                </ToggleButtonGroup>
                {connectionMode === 'connection_string' && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    For remote databases like Neon, Supabase, Railway, etc.
                  </Typography>
                )}
              </Box>
            )}

            {/* Connection String Input */}
            {connectionMode === 'connection_string' && supportsConnectionString ? (
              <TextField
                fullWidth
                name="connectionString"
                label="Connection String"
                placeholder="postgresql://user:password@host/database?sslmode=require"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                type={showConnectionString ? 'text' : 'password'}
                multiline={showConnectionString}
                rows={showConnectionString ? 2 : 1}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowConnectionString(!showConnectionString)}
                      >
                        {showConnectionString ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                helperText="Paste your connection string from your database provider"
              />
            ) : (
              // Credentials form
              <>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    fullWidth
                    name="host"
                    label="Host"
                    placeholder="localhost"
                    value={formData.host}
                    onChange={handleInputChange}
                  />
                  <TextField
                    name="port"
                    label="Port"
                    placeholder={DB_TYPES.find((d) => d.value === dbType)?.defaultPort?.toString()}
                    value={formData.port}
                    onChange={handleInputChange}
                    sx={{ width: 120 }}
                  />
                </Box>
                <TextField
                  fullWidth
                  name="user"
                  label="Username"
                  placeholder="root"
                  value={formData.user}
                  onChange={handleInputChange}
                />
                <TextField
                  fullWidth
                  name="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </>
            )}
          </Box>
        )}

        {/* Error/Success Messages */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        )}

        {/* Database List */}
        {databases.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Select a database
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 1,
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {databases.map((db) => (
                <Button
                  key={db}
                  variant="outlined"
                  color={db === currentDatabase ? 'primary' : 'inherit'}
                  size="small"
                  onClick={() => handleSelectDatabase(db)}
                  disabled={loading}
                  sx={{
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    px: 2,
                    borderWidth: 1.25,
                    ...(db === currentDatabase && {
                      borderColor: 'primary.main',
                      backgroundColor: alpha(muiTheme.palette.primary.main, 0.06),
                    }),
                  }}
                >
                  {db}
                </Button>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {isConnected && (
          <Button
            variant="outlined"
            onClick={handleDisconnect}
            color="error"
            disabled={loading}
          >
            Disconnect
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" onClick={onClose} color="inherit" disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="outlined"
          onClick={handleConnect}
          disabled={
            loading || 
            isConnected ||  // Disable when already connected
            (isSQLite 
              ? !formData.database 
              : connectionMode === 'connection_string' && supportsConnectionString
                ? !connectionString.trim()
                : !formData.host || !formData.user
            )
          }
          color="primary"
          startIcon={loading && <CircularProgress size={16} color="inherit" />}
        >
          {loading ? 'Connecting...' : isConnected ? `Connected to ${currentDatabase}` : 'Connect'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DatabaseModal;
