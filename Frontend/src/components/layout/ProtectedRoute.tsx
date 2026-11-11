// Function map (line numbers include this header):
// 1. ProtectedRoute - line 9: Renders or handles this feature.
// 2. logout - line 24: Renders or handles this feature.
//
import { LogOut } from "lucide-react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";

export function ProtectedRoute() {
  const { session, profile, loading, configurationError, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-page text-sm text-text-muted">
        Loading your workspaceâ€¦
      </div>
    );
  if (!session)
    return (
      <Navigate to="/sign-in" state={{ from: location.pathname }} replace />
    );
  if (!profile) {
    const logout = async () => {
      await signOut();
      navigate("/sign-in", { replace: true });
    };
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-page p-5">
        <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-primary">
          <p className="text-sm text-text-muted">
            Your account is signed in, but no clinic profile is available.
          </p>
          <p className="mt-3 text-xs leading-5 text-text-muted">
            {configurationError ??
              "Create a matching row in public.profiles in Supabase, or sign out and use another account."}
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            className="button-primary mt-6 w-full"
          >
            <LogOut size={16} /> Sign out
          </button>
        </section>
      </main>
    );
  }
  return <Outlet />;
}
