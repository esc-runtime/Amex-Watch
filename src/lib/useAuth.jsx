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

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, email, role, onboarded_at, admin_onboarded_at, last_seen_at"
        )
        .eq("id", session.user.id)
        .single();

      if (!active) return;
      setProfile(data ?? null);

      // Fire and forget — the stamp is for the admin's audience view, so a
      // failure here should never block the app loading.
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", session.user.id)
        .then(() => {});
    })();

    return () => {
      active = false;
    };
  }, [session]);

  // Derived rather than stored — avoids a synchronous setState when the
  // session disappears, which would cause a cascading render.
  const currentProfile = session?.user ? profile : null;

  /**
   * Stamp a welcome screen as seen so it doesn't reappear. Two separate flags:
   * one for the first-run tour, one for the note someone gets when promoted.
   */
  async function markSeen(column) {
    if (!currentProfile) return;

    const now = new Date().toISOString();

    // Optimistic — the modal should close instantly, not after a round trip.
    setProfile({ ...currentProfile, [column]: now });

    await supabase
      .from("profiles")
      .update({ [column]: now })
      .eq("id", currentProfile.id);
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile: currentProfile,
    isAdmin: ["admin", "owner"].includes(currentProfile?.role),
    isOwner: currentProfile?.role === "owner",
    onboarded: Boolean(currentProfile?.onboarded_at),
    adminOnboarded: Boolean(currentProfile?.admin_onboarded_at),
    markOnboarded: () => markSeen("onboarded_at"),
    markAdminOnboarded: () => markSeen("admin_onboarded_at"),
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
