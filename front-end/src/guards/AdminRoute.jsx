import { Navigate } from 'react-router-dom';
import PageLoader from '@/components/common/PageLoader';
import { useAuth } from '@/contexts/AuthContext';

function AdminRoute({ children }) {
  const { loading, isAuthenticated, user } = useAuth();
  const adminUid = import.meta.env.VITE_ADMIN_UID;

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (!adminUid || user?.uid !== adminUid) {
    return <Navigate to="/chat" replace />;
  }

  return children;
}

export default AdminRoute;
