import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  FormControl, 
  Select, 
  MenuItem, 
  CircularProgress,
  Chip 
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';

function SchemaSelector({ isConnected, currentDatabase, dbType, onSchemaChange }) {
  const [schemas, setSchemas] = useState([]);
  const [currentSchema, setCurrentSchema] = useState('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Only show for PostgreSQL
  const isPostgreSQL = dbType?.toLowerCase() === 'postgresql';

  // Fetch schemas when connected to PostgreSQL
  useEffect(() => {
    if (isConnected && currentDatabase && isPostgreSQL) {
      fetchSchemas();
    } else {
      setSchemas([]);
      setCurrentSchema('public');
    }
  }, [isConnected, currentDatabase, isPostgreSQL]);

  const fetchSchemas = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/get_schemas');
      const data = await response.json();
      
      if (data.status === 'success') {
        setSchemas(data.schemas || []);
        setCurrentSchema(data.current_schema || 'public');
      } else if (data.status === 'error' && data.message?.includes('only available for PostgreSQL')) {
        // Not PostgreSQL, hide the selector
        setSchemas([]);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Failed to fetch schemas:', err);
      setError('Failed to load schemas');
    } finally {
      setLoading(false);
    }
  };

  const handleSchemaChange = async (event) => {
    const schema = event.target.value;
    setLoading(true);
    
    try {
      const response = await fetch('/select_schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema }),
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentSchema(schema);
        onSchemaChange?.(data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Failed to select schema:', err);
      setError('Failed to select schema');
    } finally {
      setLoading(false);
    }
  };

  // Don't show if not connected, no schemas, or not PostgreSQL
  if (!isConnected || !isPostgreSQL || schemas.length === 0) {
    return null;
  }

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Box 
        sx={{ 
          p: 1.5,
          borderRadius: 2,
          backgroundColor: 'rgba(6, 182, 212, 0.04)',
          border: '1px solid rgba(6, 182, 212, 0.1)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AccountTreeOutlinedIcon sx={{ fontSize: 14, color: 'secondary.main' }} />
          <Typography variant="caption" color="text.secondary" fontWeight={500}>
            Schema
          </Typography>
          {loading && <CircularProgress size={10} sx={{ ml: 'auto' }} />}
        </Box>
        
        <FormControl fullWidth size="small">
          <Select
            value={currentSchema}
            onChange={handleSchemaChange}
            disabled={loading}
            sx={{
              fontSize: '0.8rem',
              backgroundColor: 'rgba(0,0,0,0.2)',
              '& .MuiSelect-select': {
                py: 0.75,
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,255,255,0.1)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(6, 182, 212, 0.3)',
              },
            }}
          >
            {schemas.map((schema) => (
              <MenuItem key={schema} value={schema} sx={{ fontSize: '0.8rem' }}>
                {schema}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {error && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
            {error}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default SchemaSelector;
