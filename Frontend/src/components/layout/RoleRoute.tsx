import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

export function RoleRoute({ allowed }: { allowed: Array<'staff' | 'vet' | 'owner'> }) {
  const { profile } = useAuth();
  return profile && allowed.includes(profile.role) ? <Outlet /> : <Navigate to={profile?.role === 'owner' ? '/owner-portal' : '/'} replace />;
}
