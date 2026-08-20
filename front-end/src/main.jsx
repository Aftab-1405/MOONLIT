import CssBaseline from '@mui/material/CssBaseline';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { queryClient } from '@/api/queryClient';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { UserSettingsSync } from '@/contexts/UserSettingsSync';

/**
 * Application Entry Point
 *
 * Provider Hierarchy (outermost to innermost):
 * 1. StrictMode - Development checks
 * 2. BrowserRouter - Routing
 * 3. ThemeProvider - MUI theme + app settings (localStorage)
 * 4. ErrorBoundary - Catches unhandled errors
 * 5. AuthProvider - Firebase authentication
 * 6. DatabaseProvider - Database connection state
 *
 * This order ensures:
 * - Theme is available everywhere (including error fallback UI)
 * - Errors are caught before they crash the entire app
 * - Auth is available to Database (for user-specific connections in future)
 * - Database state is available to all authenticated components
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <CssBaseline />
          <ErrorBoundary>
            <AuthProvider>
              <UserSettingsSync />
              <DatabaseProvider>
                <App />
              </DatabaseProvider>
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
