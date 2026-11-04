import { useAuth } from '../../auth/AuthProvider';
import { OverviewPage } from '../../pages/OverviewPage';
import { OwnerOverviewPage } from '../../pages/OwnerOverviewPage';

export function OverviewLanding() {
  const { profile } = useAuth();
  return profile?.role === 'owner' ? <OwnerOverviewPage /> : <OverviewPage />;
}
