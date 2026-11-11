// Function map (line numbers include this header):
// 1. RoleFallback - line 7: Renders or handles this feature.
//
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";

export function RoleFallback() {
  const { profile } = useAuth();
  return (
    <Navigate to={profile?.role === "owner" ? "/owner-portal" : "/"} replace />
  );
}
