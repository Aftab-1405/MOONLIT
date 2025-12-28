import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import PageLoader from './components/PageLoader';
import ProtectedRoute from './guards/ProtectedRoute';

// Minimum delay to show loader (prevents jarring instant-load on fast connections)
const MIN_LOADER_DELAY = 3500; // ms

// Helper: adds minimum delay to lazy import for smooth UX
const lazyWithDelay = (importFn) =>
  lazy(() =>
    Promise.all([
      importFn(),
      new Promise((resolve) => setTimeout(resolve, MIN_LOADER_DELAY)),
    ]).then(([module]) => module)
  );

// Route-level lazy loading with minimum display time
const Landing = lazyWithDelay(() => import('./pages/Landing'));
const Auth = lazyWithDelay(() => import('./pages/Auth'));
const Chat = lazyWithDelay(() => import('./pages/Chat'));

function App() {
  return (
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
      </Routes>
    </Suspense>
  );
}

export default App;
