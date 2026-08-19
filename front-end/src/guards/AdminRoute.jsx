import { Navigate } from 'react-router-dom';
import PageLoader from '@/components/common/PageLoader';
import { useAuth } from '@/contexts/AuthContext';
import { getAdminRouteDecision } from '@/guards/routeGuardModel';

function AdminRoute({ children }) {
  const { loading, isAuthenticated, user } = useAuth();
  const adminUid = import.meta.env.VITE_ADMIN_UID;
  const decision = getAdminRouteDecision({
    loading,
    isAuthenticated,
    userUid: user?.uid,
    adminUid,
  });

  if (decision === 'loading') {
    return <PageLoader />;
  }

  if (decision.redirectTo) {
    return <Navigate to={decision.redirectTo} replace />;
  }

  return children;
}

export default AdminRoute;
