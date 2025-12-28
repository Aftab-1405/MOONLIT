import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PageLoader from '../components/PageLoader';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

export default ProtectedRoute;
