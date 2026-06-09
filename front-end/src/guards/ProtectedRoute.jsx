import { Navigate } from 'react-router-dom';
import { PageLoader } from '@/components';
import { useAuth } from '@/contexts/AuthContext';

function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

export default ProtectedRoute;
