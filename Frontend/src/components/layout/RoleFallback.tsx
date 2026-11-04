import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

export function RoleFallback() {
  const { profile } = useAuth();
  return <Navigate to={profile?.role === 'owner' ? '/owner-portal' : '/'} replace />;
}
