/**
 * Login and signup.
 *
 * Optional. Guests reach this only by tapping "Sign in" on the job list, and
 * onBack takes them straight back without an account.
 *
 * One component, two modes. Supabase handles the password hashing, session
 * issuing and email uniqueness, so this is mostly form state and error display.
 *
 * Note: the profiles row is created by a database trigger on signup, not here.
 * Nothing in the client needs to know that — it just works.
 */

import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useToast } from "./lib/useToast.jsx";

/** Supabase's wording for a bad email/password pair, in plainer words. */
function friendly(message) {
  if (/invalid login credentials/i.test(message)) {
    return "Wrong email or password. Please try again.";
  }
  return message;
}

export default function Auth({ onBack }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const toast = useToast();

  const isLogin = mode === "login";

  async function handleSubmit() {
    setNotice(null);

    if (!email.trim() || !password) {
      toast.error("Please enter both your email and password.");
      return;
    }

    if (!isLogin && password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);

    const fn = isLogin
      ? supabase.auth.signInWithPassword({ email: email.trim(), password })
      : supabase.auth.signUp({ email: email.trim(), password });

    const { data, error: authError } = await fn;

    setBusy(false);

    if (authError) {
      toast.error(friendly(authError.message));
      return;
    }

    if (isLogin) {
      toast.success("Signed in successfully.");
      return;
    }

    // Signup with email confirmation on returns a user but no session. The
    // instruction stays on screen, since they need it after the toast goes.
    if (!data.session) {
      toast.success("Account created!");
      setNotice("Check your email to confirm your account, then sign in.");
      return;
    }

    toast.success("Account created. You're signed in.");
  }

  function switchMode() {
    setMode(isLogin ? "signup" : "login");
    setNotice(null);
  }

  return (
    <div className="auth">
      <h1 className="auth-title">
        AMEX<span className="auth-slash">/</span>WATCH
      </h1>

      <p className="auth-sub">
        {isLogin
          ? "Sign in to send feedback and use extra features."
          : "Create a free account to send feedback and use extra features."}
      </p>

      <div className="auth-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={busy}
        />
      </div>

      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={busy}
        />
      </div>

      {notice && <div className="auth-notice">{notice}</div>}

      <button className="auth-submit" onClick={handleSubmit} disabled={busy}>
        {busy ? "Working…" : isLogin ? "Sign in" : "Create account"}
      </button>

      <button className="auth-switch" onClick={switchMode} disabled={busy}>
        {isLogin
          ? "No account? Create one"
          : "Already have an account? Sign in"}
      </button>

      {onBack && (
        <button className="auth-switch" onClick={onBack} disabled={busy}>
          ← Back to jobs
        </button>
      )}
    </div>
  );
}
