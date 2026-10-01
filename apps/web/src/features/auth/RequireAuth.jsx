import { Navigate, useLocation } from 'react-router-dom';
import { FullPageLoader } from '../../components/FullPageLoader.jsx';
import { homePathFor } from './auth-api.js';
import { useCurrentUser } from './auth-hooks.js';

export function RequireAuth({ roles, children }) {
  const location = useLocation();
  const { data: user, isPending, isError } = useCurrentUser();

  if (isPending) {
    return <FullPageLoader />;
  }
  if (isError || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return children;
}
