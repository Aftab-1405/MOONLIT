import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
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
import { useTheme, alpha } from '@mui/material/styles';
import { useSettings } from '../contexts/SettingsContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';

// Centralized API layer
import {
  getDatabases,
  getTables,
  connectDb,
  disconnectDb,
  switchDatabase,
} from '../api';

// Form validation
import {
  useFormValidation,
  credentialsSchema,
  connectionStringSchema,
  sqliteSchema,
  dbFieldSchemas,
} from '../validation';

const DB_TYPES = [
  { value: 'mysql', label: 'MySQL', defaultPort: 3306, supportsConnectionString: true },
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432, supportsConnectionString: true },
  { value: 'sqlserver', label: 'SQL Server', defaultPort: 1433, supportsConnectionString: true },
  { value: 'oracle', label: 'Oracle', defaultPort: 1521, supportsConnectionString: true },
  { value: 'sqlite', label: 'SQLite', defaultPort: null, supportsConnectionString: false },
];

// Reusable visibility toggle adornment for password fields (DRY)
const VisibilityToggleAdornment = memo(function VisibilityToggleAdornment({ show, onToggle }) {
  return (
    <InputAdornment position="end">
      <IconButton size="small" onClick={onToggle}>
        {show ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
      </IconButton>
    </InputAdornment>
  );
});

function DatabaseModal({ open, onClose, onConnect, isConnected, currentDatabase }) {
  const theme = useTheme();
  
  // Get settings from SettingsContext
  const { settings } = useSettings();
  const defaultDbType = settings.defaultDbType || 'postgresql';
  const rememberConnection = settings.rememberConnection ?? false;
  
  // Saved connection using useLocalStorage hook (cross-tab sync, SSR-safe)
  const [savedConnection, setSavedConnection] = useLocalStorage('moonlit-saved-connection', null);
  
  const [dbType, setDbType] = useState(defaultDbType);
  const [connectionMode, setConnectionMode] = useState('credentials');
  const [connectionString, setConnectionString] = useState('');
  const [formData, setFormData] = useState({
    host: 'localhost',
    port: DB_TYPES.find(d => d.value === defaultDbType)?.defaultPort?.toString() || '5432',
    user: '',
    password: '',
    database: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConnectionString, setShowConnectionString] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [isRemote, setIsRemote] = useState(false);

  // Form validation
  const {
    errors: fieldErrors,
    validateField,
    validateForm,
    clearError,
    resetErrors,
  } = useFormValidation(dbFieldSchemas);

  // Refs for timeout cleanup
  const timeoutRefs = useRef([]);

  // Memoize current DB config to avoid repeated lookups (DRY)
  const currentDbConfig = useMemo(
    () => DB_TYPES.find(d => d.value === dbType) || DB_TYPES[1],
    [dbType]
  );
  
  const isSQLite = dbType === 'sqlite';
  const supportsConnectionString = currentDbConfig.supportsConnectionString;

  // Safe JSON parse with error handling
  const safeJsonParse = useCallback((text, fallback = null) => {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('JSON parse error:', e);
      return fallback;
    }
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout);
    };
  }, []);

  // Load saved connection on mount if rememberConnection is enabled
  useEffect(() => {
    if (rememberConnection && open && savedConnection) {
      if (savedConnection.dbType) setDbType(savedConnection.dbType);
      if (savedConnection.connectionMode) setConnectionMode(savedConnection.connectionMode);
      if (savedConnection.formData) {
        setFormData(prev => ({
          ...prev,
          host: savedConnection.formData.host || prev.host,
          port: savedConnection.formData.port || prev.port,
          user: savedConnection.formData.user || prev.user,
          database: savedConnection.formData.database || prev.database,
          // NOTE: Password is intentionally NOT saved for security
        }));
      }
    }
  }, [open, rememberConnection, savedConnection]);

  // Safe setTimeout that tracks refs
  const safeSetTimeout = useCallback((callback, delay) => {
    const id = setTimeout(callback, delay);
    timeoutRefs.current.push(id);
    return id;
  }, []);

  // Fetch databases - extracted and memoized
  const fetchDatabases = useCallback(async () => {
    try {
      const data = await getDatabases();
      if (data.status === 'success' && data.databases) {
        setDatabases(data.databases);
        if (data.is_remote) {
          setIsRemote(true);
          setDbType('postgresql');
          setConnectionMode('connection_string');
        }
      }
    } catch (err) {
      console.error('Failed to fetch databases:', err);
    }
  }, []);

  // Fetch databases when modal opens and already connected
  useEffect(() => {
    if (open && isConnected) {
      fetchDatabases();
    }
  }, [open, isConnected, fetchDatabases]);

  const handleDbTypeChange = useCallback((event, newType) => {
    if (newType) {
      setDbType(newType);
      const dbConfig = DB_TYPES.find((d) => d.value === newType);
      setFormData((prev) => ({
        ...prev,
        port: dbConfig?.defaultPort?.toString() || '',
      }));
      setError(null);
      setSuccess(null);
    }
  }, []);

  // Shared toggle button styles (DRY)
  const toggleButtonStyles = useMemo(() => ({
    '& .MuiToggleButton-root': {
      py: 1.5,
      textTransform: 'none',
      '&.Mui-selected': {
        backgroundColor: alpha(theme.palette.text.primary, 0.05),
        borderColor: 'text.primary',
        color: 'text.primary',
        '&:hover': {
          backgroundColor: alpha(theme.palette.text.primary, 0.1),
        },
      },
    },
  }), [theme.palette.text.primary]);

  const connectionModeToggleStyles = useMemo(() => ({
    '& .MuiToggleButton-root': {
      py: 0.75,
      textTransform: 'none',
      fontSize: '0.8rem',
      '&.Mui-selected': {
        backgroundColor: alpha(theme.palette.secondary.main, 0.15),
        borderColor: 'secondary.main',
        color: 'secondary.main',
      },
    },
  }), [theme.palette.secondary.main]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearError(name);
    setError(null);
  }, [clearError]);

  const handleConnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let payload;
      
      if (isSQLite) {
        // Validate SQLite path
        if (!validateForm(sqliteSchema, { database: formData.database })) {
          setLoading(false);
          return;
        }
        payload = { db_type: dbType, db_name: formData.database };
      } else if (connectionMode === 'connection_string' && supportsConnectionString) {
        // Validate connection string
        if (!validateForm(connectionStringSchema, { connectionString })) {
          setLoading(false);
          return;
        }
        payload = { 
          db_type: dbType, 
          connection_string: connectionString 
        };
      } else {
        // Validate credentials
        if (!validateForm(credentialsSchema, formData)) {
          setLoading(false);
          return;
        }
        payload = {
          db_type: dbType,
          host: formData.host,
          port: formData.port,
          user: formData.user,
          password: formData.password,
        };
      }

      const data = await connectDb(payload);

      if (data.status === 'connected') {
        setSuccess(data.message);
        setDatabases(data.schemas || []);
        setIsRemote(data.is_remote || false);
        onConnect?.({ ...data, db_type: dbType });
        
        // Save connection details if rememberConnection is enabled
        if (rememberConnection) {
          setSavedConnection({
            dbType,
            connectionMode,
            formData: {
              host: formData.host,
              port: formData.port,
              user: formData.user,
              database: formData.database,
              // NOTE: Password is intentionally NOT saved for security
            },
            // NOTE: Connection string is NOT saved (may contain password)
          });
        }
        
        if (data.is_remote && data.selectedDatabase) {
          try {
            const tablesData = await getTables();
            if (tablesData.status === 'success' && tablesData.tables?.length > 0) {
              setSuccess(`Connected to ${data.selectedDatabase}. Found ${tablesData.tables.length} tables: ${tablesData.tables.slice(0, 5).join(', ')}${tablesData.tables.length > 5 ? '...' : ''}`);
            }
          } catch (e) {
            console.warn('Failed to fetch tables:', e);
          }
          safeSetTimeout(() => onClose(), 2500);
        }
      } else {
        setError(data.message || 'Failed to connect');
      }
    } catch (err) {
      setError(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  }, [isSQLite, dbType, formData, connectionMode, supportsConnectionString, connectionString, onConnect, onClose, safeSetTimeout]);

  const handleSelectDatabase = useCallback(async (dbName) => {
    setLoading(true);
    setError(null);

    try {
      const data = isRemote 
        ? await switchDatabase(dbName)
        : await connectDb({ db_name: dbName });

      if (data.status === 'connected') {
        setSuccess(`Connected to ${dbName}${data.tables?.length ? ` (${data.tables.length} tables)` : ''}`);
        onConnect?.({ ...data, selectedDatabase: dbName });
        safeSetTimeout(() => onClose(), 1500);
      } else {
        setError(data.message || 'Failed to select database');
      }
    } catch (err) {
      console.error('Database switch error:', err);
      setError(err.message || 'Failed to select database. Try restarting the backend.');
    } finally {
      setLoading(false);
    }
  }, [isRemote, onConnect, onClose, safeSetTimeout]);

  const handleDisconnect = useCallback(async () => {
    setLoading(true);
    try {
      await disconnectDb();
      setDatabases([]);
      setSuccess(null);
      onConnect?.(null);
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setLoading(false);
    }
  }, [onConnect]);

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

      <DialogContent sx={{ minHeight: 400 }}>
        {/* Connection Status Banner */}
        {isConnected && currentDatabase && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.text.primary, 0.05),
              border: `1px solid ${alpha(theme.palette.text.primary, 0.1)}`,
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
            sx={toggleButtonStyles}
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
          <TextField
            fullWidth
            name="database"
            label="Database File Path"
            placeholder="/path/to/database.db"
            value={formData.database}
            onChange={handleInputChange}
            onBlur={() => validateField('database', formData.database)}
            error={!!fieldErrors.database}
            helperText={fieldErrors.database}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {supportsConnectionString && (
              <Box sx={{ mb: 1 }}>
              <ToggleButtonGroup
                  value={connectionMode}
                  exclusive
                  onChange={(e, val) => val && setConnectionMode(val)}
                  size="small"
                  fullWidth
                  sx={connectionModeToggleStyles}
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

            {connectionMode === 'connection_string' && supportsConnectionString ? (
              <TextField
                fullWidth
                name="connectionString"
                label="Connection String"
                placeholder="postgresql://user:password@host/database?sslmode=require"
                value={connectionString}
                onChange={(e) => { setConnectionString(e.target.value); clearError('connectionString'); }}
                onBlur={() => validateField('connectionString', connectionString)}
                error={!!fieldErrors.connectionString}
                type={showConnectionString ? 'text' : 'password'}
                multiline={showConnectionString}
                rows={showConnectionString ? 2 : 1}
                InputProps={{
                  endAdornment: (
                    <VisibilityToggleAdornment 
                      show={showConnectionString} 
                      onToggle={() => setShowConnectionString(!showConnectionString)} 
                    />
                  ),
                }}
                helperText={fieldErrors.connectionString || 'Paste your connection string from your database provider'}
              />
            ) : (
              <>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    fullWidth
                    name="host"
                    label="Host"
                    placeholder="localhost"
                    value={formData.host}
                    onChange={handleInputChange}
                    onBlur={() => validateField('host', formData.host)}
                    error={!!fieldErrors.host}
                    helperText={fieldErrors.host}
                  />
                  <TextField
                    name="port"
                    label="Port"
                    placeholder={currentDbConfig.defaultPort?.toString()}
                    value={formData.port}
                    onChange={handleInputChange}
                    onBlur={() => validateField('port', formData.port)}
                    error={!!fieldErrors.port}
                    helperText={fieldErrors.port}
                    sx={{ width: 140 }}
                  />
                </Box>
                <TextField
                  fullWidth
                  name="user"
                  label="Username"
                  placeholder="root"
                  value={formData.user}
                  onChange={handleInputChange}
                  onBlur={() => validateField('user', formData.user)}
                  error={!!fieldErrors.user}
                  helperText={fieldErrors.user}
                />
                <TextField
                  fullWidth
                  name="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  onBlur={() => validateField('password', formData.password)}
                  error={!!fieldErrors.password}
                  helperText={fieldErrors.password}
                  InputProps={{
                    endAdornment: (
                      <VisibilityToggleAdornment 
                        show={showPassword} 
                        onToggle={() => setShowPassword(!showPassword)} 
                      />
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
                      backgroundColor: alpha(theme.palette.primary.main, 0.06),
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
            isConnected ||
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

export default memo(DatabaseModal);
