/**
 * Audience — admin only.
 *
 * Everyone who has actually created an account. Someone who opened the login
 * screen and left never gets a profiles row, so they don't appear here.
 *
 * last_seen_at is stamped client-side each time a session loads, so it answers
 * "did they come back" rather than "how long were they here".
 *
 * Role changes are owner-only. Admins can see this screen but not act on it —
 * enforced in the database by is_owner(), not just by hiding the buttons.
 */

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useAuth } from "./lib/useAuth.jsx";

function stamp(iso) {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function timeAgo(iso, now) {
  if (!iso) return "never";
  const m = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Audience({ onBack }) {
  const { isOwner } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error: err } = await supabase
        .from("profiles")
        .select("id, email, role, created_at, last_seen_at, onboarded_at")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (err) setError(err.message);
      else setRows(data || []);

      // Captured once, outside render, so the component stays pure.
      setNow(Date.now());
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  async function setRole(row, role) {
    setBusyId(row.id);
    setError(null);

    const { error: err } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", row.id);

    setBusyId(null);

    if (err) {
      setError(err.message);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, role } : r)));
  }

  if (loading) {
    return (
      <div className="aw">
        <div className="aw-wrap">
          <div className="aw-counts">
            <span>LOADING…</span>
          </div>
        </div>
      </div>
    );
  }

  const week = now - 7 * 24 * 60 * 60 * 1000;
  const active = rows.filter(
    (r) => r.last_seen_at && new Date(r.last_seen_at).getTime() > week
  ).length;

  return (
    <div className="aw">
      <div className="aw-wrap">
        <header className="aw-head">
          <div>
            <h1 className="aw-title">AUDIENCE</h1>
            <p className="aw-sub">
              Everyone who has signed up. Last seen is stamped each time someone
              opens the app.
            </p>
          </div>
          <button className="aw-ghost" onClick={onBack}>
            Back to jobs
          </button>
        </header>

        <div className="aw-rail">
          <span className="aw-dot" />
          <span className="aw-cell">{rows.length} SIGNED UP</span>
          <span className="aw-sep">/</span>
          <span className="aw-cell">{active} ACTIVE THIS WEEK</span>
        </div>

        {error && <div className="aw-err">{error}</div>}

        {rows.length === 0 ? (
          <div className="aw-empty">
            <b>Nobody yet</b>
            No accounts have been created.
          </div>
        ) : (
          <div className="aw-list">
            {rows.map((r) => {
              const staff = r.role === "admin" || r.role === "owner";

              return (
                <article key={r.id} className="aw-job">
                  <div className="aw-jobtop">
                    {staff && (
                      <span className="aw-tag">{r.role.toUpperCase()}</span>
                    )}
                    <span className="aw-jobtitle">{r.email}</span>
                  </div>
                  <div className="aw-meta">
                    <span>JOINED {stamp(r.created_at).toUpperCase()}</span>
                    <span>
                      · LAST SEEN {timeAgo(r.last_seen_at, now).toUpperCase()}
                    </span>
                    {!r.onboarded_at && !staff && <span>· NOT ONBOARDED</span>}
                  </div>

                  {isOwner && r.role !== "owner" && (
                    <div className="aw-jobfoot">
                      {r.role === "admin" ? (
                        <button
                          className="aw-ghost"
                          onClick={() => setRole(r, "user")}
                          disabled={busyId === r.id}
                        >
                          Remove admin
                        </button>
                      ) : (
                        <button
                          className="aw-ghost"
                          onClick={() => setRole(r, "admin")}
                          disabled={busyId === r.id}
                        >
                          Make admin
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
