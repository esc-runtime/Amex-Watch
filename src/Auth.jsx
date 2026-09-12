/**
 * Login and signup.
 *
 * One component, two modes. Supabase handles the password hashing, session
 * issuing and email uniqueness, so this is mostly form state and error display.
 *
 * Note: the profiles row is created by a database trigger on signup, not here.
 * Nothing in the client needs to know that — it just works.
 */

import { useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const isLogin = mode === "login";

  async function handleSubmit() {
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError("Email and password are both required.");
      return;
    }

    if (!isLogin && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);

    const fn = isLogin
      ? supabase.auth.signInWithPassword({ email: email.trim(), password })
      : supabase.auth.signUp({ email: email.trim(), password });

    const { data, error: authError } = await fn;

    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // Signup with email confirmation on returns a user but no session.
    if (!isLogin && !data.session) {
      setNotice("Check your email to confirm your account, then sign in.");
    }
  }

  function switchMode() {
    setMode(isLogin ? "signup" : "login");
    setError(null);
    setNotice(null);
  }

  return (
    <div className="auth">
      <h1 className="auth-title">
        AMEX<span className="auth-slash">/</span>WATCH
      </h1>

      <p className="auth-sub">
        {isLogin
          ? "Sign in to see roles matching the watch rules."
          : "Create an account to start watching."}
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

      {error && <div className="auth-error">{error}</div>}
      {notice && <div className="auth-notice">{notice}</div>}

      <button className="auth-submit" onClick={handleSubmit} disabled={busy}>
        {busy ? "Working…" : isLogin ? "Sign in" : "Create account"}
      </button>

      <button className="auth-switch" onClick={switchMode} disabled={busy}>
        {isLogin
          ? "No account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
