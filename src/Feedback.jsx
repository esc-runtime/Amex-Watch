/**
 * Feedback — write for users, read for admins.
 *
 * Not approved or rejected like keyword requests, just acknowledged. The
 * status flips new → read when the admin has seen it, which is what clears
 * it from the notification count.
 */

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useAuth } from "./lib/useAuth.jsx";

function stamp(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export default function Feedback({ onBack }) {
  const { user, isAdmin } = useAuth();

  const [rows, setRows] = useState([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let active = true;

    (async () => {
      // RLS returns everything for admins, own rows for everyone else.
      const { data, error: err } = await supabase
        .from("feedback")
        .select("id, body, status, created_at, user_id")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const ids = [...new Set((data || []).map((r) => r.user_id))];
      const emails = {};

      if (isAdmin && ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", ids);

        (profiles || []).forEach((p) => {
          emails[p.id] = p.email;
        });
      }

      if (!active) return;

      setRows((data || []).map((r) => ({ ...r, email: emails[r.user_id] })));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [isAdmin]);

  async function submit() {
    const text = body.trim();

    if (!text) {
      setError("Write something first.");
      return;
    }

    setBusy(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("feedback")
      .insert({ user_id: user.id, body: text })
      .select("id, body, status, created_at, user_id")
      .single();

    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }

    setBody("");
    setNotice("Sent. Thanks.");
    setRows((prev) => [data, ...prev]);
  }

  async function markRead(row) {
    setBusy(true);
    setError(null);

    const { error: err } = await supabase
      .from("feedback")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("id", row.id);

    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }

    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, status: "read" } : r))
    );
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

  const unread = rows.filter((r) => r.status === "new").length;

  return (
    <div className="aw">
      <div className="aw-wrap">
        <header className="aw-head">
          <div>
            <h1 className="aw-title">FEEDBACK</h1>
            <p className="aw-sub">
              {isAdmin
                ? "What users have said about the app."
                : "What's annoying, what's missing, what would make this worth opening. It goes straight to the admin."}
            </p>
          </div>
          <button className="aw-ghost" onClick={onBack}>
            Back to jobs
          </button>
        </header>

        {isAdmin && (
          <div className="aw-rail">
            <span className="aw-dot" />
            <span className="aw-cell">{unread} UNREAD</span>
            <span className="aw-sep">/</span>
            <span className="aw-cell">{rows.length} TOTAL</span>
          </div>
        )}

        {error && <div className="aw-err">{error}</div>}
        {notice && !error && <div className="aw-notice">{notice}</div>}

        {!isAdmin && (
          <div className="fb-compose">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Anything at all"
              rows={4}
              disabled={busy}
            />
            <button className="aw-btn" onClick={submit} disabled={busy}>
              {busy ? "Sending…" : "Send feedback"}
            </button>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="aw-empty">
            <b>Nothing yet</b>
            {isAdmin
              ? "No feedback has come in."
              : "You haven't sent any feedback."}
          </div>
        ) : (
          <div className="aw-list">
            {rows.map((r) => (
              <article key={r.id} className="aw-job">
                <div className="aw-jobtop">
                  {r.status === "new" && isAdmin && (
                    <span className="aw-tag">NEW</span>
                  )}
                  <span className="aw-meta">
                    {isAdmin ? r.email || "unknown user" : "You"} ·{" "}
                    {stamp(r.created_at).toUpperCase()}
                  </span>
                </div>
                <p className="fb-body">{r.body}</p>
                {isAdmin && r.status === "new" && (
                  <div className="aw-jobfoot">
                    <button
                      className="aw-ghost"
                      onClick={() => markRead(r)}
                      disabled={busy}
                    >
                      Mark read
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
