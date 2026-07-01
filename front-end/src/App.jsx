import { Box } from '@mui/material';
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PageLoader } from '@/components';
import AdminRoute from '@/guards/AdminRoute';
import ProtectedRoute from '@/guards/ProtectedRoute';

const Landing = lazy(() => import('@/pages/Landing'));
const Auth = lazy(() => import('@/pages/Auth'));
const Chat = lazy(() => import('@/pages/Chat'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));

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
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
        </Routes>
      </Suspense>
    </Box>
  );
}

export default App;
