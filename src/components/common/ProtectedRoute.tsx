import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Loading } from "./Feedback";
import { Button } from "./Button";
import { useState } from "react";
import type { AppRole } from "../../types";
import { ForbiddenPage } from "../../pages/NotFound";

/** Full-screen loader shown while the session is resolving. */
export function AuthGate() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <Loading label="Loading iWriter…" />
    </div>
  );
}

function ProfileUnavailable() {
  const { user, profileError, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const retry = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const profile = await refreshProfile();
      if (!profile) setMessage("No matching profile was returned. Verify that public.profiles.id matches this Auth user’s UUID and that profile SELECT policies allow the user to read their own row.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load your profile.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="iw-auth-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="iw-card" style={{ maxWidth: 520, padding: 28 }}>
        <h1 className="iw-page-head__title">Could not load your account profile</h1>
        <p className="iw-page-head__desc">
          Signed in as {user?.email ?? "your account"}. iWriter needs the matching Supabase profile to determine your role.
          Access is paused instead of assuming this is a writer account.
        </p>
        {(message || profileError) && (
          <p role="alert" className="iw-alert iw-alert--warning" style={{ marginTop: 16 }}>
            {message || profileError}
          </p>
        )}
        <div className="iw-inline iw-gap-3" style={{ marginTop: 20 }}>
          <Button variant="primary" loading={checking} onClick={() => void retry()}>Retry profile lookup</Button>
          <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </section>
    </main>
  );
}

/** Requires an authenticated user. Redirects to /login otherwise. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthGate />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children ? <>{children}</> : <Outlet />;
}

/** Requires a specific role. */
export function RequireRole({ role, children }: { role: AppRole; children?: ReactNode }) {
  const { profile, loading, user } = useAuth();

  if (loading) return <AuthGate />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <ProfileUnavailable />;
  if (profile.role !== role) {
    return <Navigate to={profile.role === "admin" ? "/admin" : "/writer"} replace />;
  }
  return children ? <>{children}</> : <Outlet />;
}

/** Sends an authenticated user to the correct home for their role. */
export function RoleHomeRedirect() {
  const { user, profile, loading } = useAuth();

  if (loading) return <AuthGate />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <ProfileUnavailable />;
  return <Navigate to={profile.role === "admin" ? "/admin" : "/writer"} replace />;
}

/** Blocks suspended accounts from action-heavy areas. */
export function SuspensionNotice() {
  return <ForbiddenPage />;
}
