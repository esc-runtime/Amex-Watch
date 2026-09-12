/**
 * Session state for the whole app.
 *
 * Wraps the tree in a provider so any component can ask "who is this?" without
 * re-querying Supabase. The profile row is fetched alongside the session
 * because that is where role lives — auth.users has no concept of admin.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    let active = true;

    supabase
      .from("profiles")
      .select("id, email, role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (active) setProfile(data ?? null);
      });

    return () => {
      active = false;
    };
  }, [session]);

  // Derived rather than stored — avoids a synchronous setState when the
  // session disappears, which would cause a cascading render.
  const currentProfile = session?.user ? profile : null;

  const value = {
    session,
    user: session?.user ?? null,
    profile: currentProfile,
    isAdmin: currentProfile?.role === "admin",
    loading,
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
