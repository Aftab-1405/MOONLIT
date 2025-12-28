import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import PageLoader from './components/PageLoader';
import ProtectedRoute from './guards/ProtectedRoute';

// Direct imports for light pages (instant load)
import Landing from './pages/Landing';
import Auth from './pages/Auth';

// Lazy load Chat with minimum delay to show branding loader
// 800ms ensures at least one breathing animation cycle completes
const Chat = lazy(() => 
  Promise.all([
    import('./pages/Chat'),
    new Promise(resolve => setTimeout(resolve, 800)),
  ]).then(([module]) => module)
);

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
