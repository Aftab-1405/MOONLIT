import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <CssBaseline />
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
