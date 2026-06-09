import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import { PageLoader } from '@/components';
import ProtectedRoute from '@/guards/ProtectedRoute';
import Landing from '@/pages/Landing';
import Auth from '@/pages/Auth';
const Chat = lazy(() => import('@/pages/Chat'));

import AdminDashboard from '@/pages/AdminDashboard';

function App() {
  return (
    <Box
      id="app-root"
      sx={{
        display: 'grid',
        gridTemplateRows: '0px 1fr',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Row 0: reserved header slot (0px) — mirrors Claude's grid-template-rows: 0px 1fr */}
      <Box />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:conversationId"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </Box>
  );
}

export default App;
