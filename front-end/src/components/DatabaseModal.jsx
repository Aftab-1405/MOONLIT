import { useState } from 'react';
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
import CloseIcon from '@mui/icons-material/Close';
import StorageIcon from '@mui/icons-material/Storage';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

const DB_TYPES = [
  { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'sqlite', label: 'SQLite', defaultPort: null },
];

function DatabaseModal({ open, onClose, onConnect, isConnected, currentDatabase }) {
  const [dbType, setDbType] = useState('mysql');
  const [formData, setFormData] = useState({
    host: 'localhost',
    port: '3306',
    user: '',
    password: '',
    database: '', // For SQLite, this is the file path
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [databases, setDatabases] = useState([]);

  const isSQLite = dbType === 'sqlite';

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
      const payload = isSQLite
        ? { db_type: dbType, db_name: formData.database }
        : {
            db_type: dbType,
            host: formData.host,
            port: formData.port,
            user: formData.user,
            password: formData.password,
          };

      const response = await fetch('/connect_db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.status === 'connected') {
        setSuccess(data.message);
        setDatabases(data.schemas || []);
        onConnect?.(data);
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
      const response = await fetch('/connect_db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_name: dbName }),
      });

      const data = await response.json();

      if (data.status === 'connected') {
        setSuccess(`Connected to ${dbName}`);
        onConnect?.({ ...data, selectedDatabase: dbName });
        setTimeout(() => onClose(), 1000);
      } else {
        setError(data.message || 'Failed to select database');
      }
    } catch (err) {
      setError(err.message || 'Failed to select database');
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
          <StorageIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Database Connection
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
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
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'rgba(139, 92, 246, 0.25)',
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
                    <FolderOpenIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        ) : (
          // MySQL/PostgreSQL - Full connection form
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
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
                  variant={db === currentDatabase ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => handleSelectDatabase(db)}
                  disabled={loading}
                  sx={{
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    px: 2,
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
            onClick={handleDisconnect}
            color="error"
            disabled={loading}
          >
            Disconnect
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConnect}
          disabled={loading || (isSQLite ? !formData.database : !formData.host || !formData.user)}
          startIcon={loading && <CircularProgress size={16} color="inherit" />}
        >
          {loading ? 'Connecting...' : 'Connect'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DatabaseModal;
