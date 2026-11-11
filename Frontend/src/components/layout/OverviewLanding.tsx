// Function map (line numbers include this header):
// 1. OverviewLanding - line 8: Renders or handles this feature.
//
import { useAuth } from "../../auth/AuthProvider";
import { OverviewPage } from "../../pages/OverviewPage";
import { OwnerOverviewPage } from "../../pages/OwnerOverviewPage";

export function OverviewLanding() {
  const { profile } = useAuth();
  return profile?.role === "owner" ? <OwnerOverviewPage /> : <OverviewPage />;
}
