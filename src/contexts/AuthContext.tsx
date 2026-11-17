import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { normalizeProfile, type AppRole, type Profile } from "../types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  profileError: string | null;
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  isWriter: boolean;
  isSuspended: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; profile: Profile | null }>;
  signUp: (input: {
    email: string;
    password: string;
    fullName: string;
  }) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<Profile | null>;
  setProfile: (profile: Profile | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileErrorRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const fetchProfile = useCallback(async (authUser: User | null): Promise<Profile | null> => {
    if (!authUser) {
      profileErrorRef.current = null;
      setProfileError(null);
      return null;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (error) {
      console.error("[auth] failed to load profile:", error.message);
      // Never fabricate a writer role on a database/RLS failure: that masks
      // role-sync problems and can route an administrator into the wrong portal.
      const reason = `Profile lookup failed (${error.code ?? "database error"}): ${error.message}`;
      profileErrorRef.current = reason;
      setProfileError(reason);
      return null;
    }

    if (!data) {
      // Self-heal: create the profile row for a brand new signup. The DB trigger
      // normally does this; this is a belt-and-braces fallback.
      const meta = authUser.user_metadata ?? {};
      const insert = {
        id: authUser.id,
        email: authUser.email,
        full_name: meta.full_name ?? meta.name ?? null,
        role: "writer",
        status: "active",
      };
      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert(insert)
        .select("*")
        .maybeSingle();
      if (insertError || !created) {
        console.error("[auth] failed to create missing profile:", insertError?.message ?? "No profile returned");
        const reason = `No profile exists for Auth user ${authUser.id}, and profile creation failed: ${insertError?.message ?? "No profile returned"}`;
        profileErrorRef.current = reason;
        setProfileError(reason);
        return null;
      }
      profileErrorRef.current = null;
      setProfileError(null);
      return normalizeProfile(created, authUser.email);
    }

    profileErrorRef.current = null;
    setProfileError(null);
    return normalizeProfile(data, authUser.email);
  }, []);

  useEffect(() => {
    mounted.current = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted.current) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      const p = await fetchProfile(data.session?.user ?? null);
      if (!mounted.current) return;
      setProfileState(p);
      setLoading(false);
    };

    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted.current) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (event === "SIGNED_OUT" || !nextSession) {
        setProfileState(null);
        return;
      }

      // Defer profile fetch to avoid deadlocks inside the auth callback.
      setTimeout(() => {
        void fetchProfile(nextSession.user).then((p) => {
          if (mounted.current) setProfileState(p);
        });
      }, 0);
    });

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // A role can be promoted in Supabase while the user is already signed in.
  // Refresh their authoritative profile when the tab becomes active again.
  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void fetchProfile(user).then((nextProfile) => {
        if (active) setProfileState(nextProfile);
      });
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message, profile: null };
      const p = await fetchProfile(data.user);
      setProfileState(p);
      if (!p) {
        return {
          error: profileErrorRef.current ?? "Signed in, but no profile was returned for this Auth user.",
          profile: null,
        };
      }
      return { error: null, profile: p };
    },
    [fetchProfile],
  );

  const signUp = useCallback(
    async ({
      email,
      password,
      fullName,
    }: {
      email: string;
      password: string;
      fullName: string;
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (error) return { error: error.message, needsConfirmation: false };
      const needsConfirmation = !data.session;
      return { error: null, needsConfirmation };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfileState(null);
    setSession(null);
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }, []);

  const refreshProfile = useCallback(async () => {
    const p = await fetchProfile(user);
    setProfileState(p);
    return p;
  }, [fetchProfile, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      profileError,
      role: profile?.role ?? null,
      loading,
      isAdmin: profile?.role === "admin",
      isWriter: profile?.role === "writer",
      isSuspended: profile?.status === "suspended",
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshProfile,
      setProfile: setProfileState,
    }),
    [user, session, profile, profileError, loading, signIn, signUp, signOut, requestPasswordReset, updatePassword, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
