import { Navigate } from 'react-router-dom';
import PageLoader from '@/components/common/PageLoader';
import { useAuth } from '@/contexts/AuthContext';
import { getProtectedRouteDecision } from '@/guards/routeGuardModel';

function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const decision = getProtectedRouteDecision({ loading, isAuthenticated });

  if (decision === 'loading') {
    return <PageLoader />;
  }

  if (decision.redirectTo) {
    return <Navigate to={decision.redirectTo} replace />;
  }

  return children;
}

export default ProtectedRoute;
