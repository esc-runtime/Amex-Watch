/**
 * Feedback — anyone can write, admins read.
 *
 * Guests and signed-in users both send through the feedback Netlify function,
 * which applies the daily limits. Signed-in users also see what they've sent
 * before; guests just get a thank-you, since there's no account to tie a
 * history to.
 *
 * Not approved or rejected like keyword requests, just acknowledged. The
 * status flips new → read when the admin has seen it, which is what clears
 * it from the notification count.
 */

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useAuth } from "./lib/useAuth.jsx";
import { useToast } from "./lib/useToast.jsx";

const FEEDBACK_ENDPOINT = "/.netlify/functions/feedback";

/** Must match MAX_LENGTH in netlify/functions/feedback.js and the SQL. */
const MAX_LENGTH = 1000;

/** Counter turns amber with this many characters left. */
const WARN_AT = 100;

function stamp(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export default function Feedback({ onBack }) {
  const { session, isAdmin } = useAuth();
  const userId = session?.user?.id ?? null;
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [body, setBody] = useState("");
  // Guests have no history to fetch, so they never start in a loading state.
  const [loading, setLoading] = useState(() => Boolean(userId));
  const [busy, setBusy] = useState(false);
  // Only for a failed load — everything else is a toast.
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    (async () => {
      // RLS returns everything for admins, own rows for everyone else.
      const { data, error: err } = await supabase
        .from("feedback")
        .select("id, body, status, created_at, user_id")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (err) {
        setError("Couldn't load messages. Please reload the page.");
        setLoading(false);
        return;
      }

      // Guest messages have no user_id, so leave them out of the lookup.
      const ids = [
        ...new Set((data || []).map((r) => r.user_id).filter(Boolean)),
      ];
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
  }, [isAdmin, userId]);

  async function submit() {
    const text = body.trim();

    if (!text) {
      toast.error("Write something first.");
      return;
    }

    setBusy(true);

    const headers = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    let result;
    try {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ body: text }),
      });
      result = await res.json();
    } catch {
      result = {
        ok: false,
        message: "Could not send your message right now. Please try again.",
      };
    }

    setBusy(false);

    if (!result.ok) {
      toast.error(result.message || "Could not send your message.");
      return;
    }

    setBody("");
    toast.success("Thanks! We've got your message.");

    // Signed-in users see their own history, so show the new one straight
    // away instead of refetching.
    if (userId) {
      setRows((prev) => [
        {
          id: `local-${Date.now()}`,
          body: text,
          status: "new",
          created_at: new Date().toISOString(),
          user_id: userId,
        },
        ...prev,
      ]);
    }
  }

  async function markRead(row) {
    setBusy(true);

    const { error: err } = await supabase
      .from("feedback")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("id", row.id);

    setBusy(false);

    if (err) {
      toast.error(`Couldn't mark as read: ${err.message}`);
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
  const left = MAX_LENGTH - body.length;
  const counterClass =
    left === 0
      ? "fb-count zero"
      : left <= WARN_AT
        ? "fb-count warn"
        : "fb-count";

  return (
    <div className="aw">
      <div className="aw-wrap">
        <header className="aw-head">
          <div>
            <h1 className="aw-title">{isAdmin ? "FEEDBACK" : "TELL US"}</h1>
            <p className="aw-sub">
              {isAdmin
                ? "What people have said about the app."
                : "A new feature, a company you want added, or something that bugs you. We read every message."}
            </p>
          </div>
          <button className="aw-ghost" onClick={onBack}>
            ← Back to jobs
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

        {!isAdmin && (
          <div className="fb-compose">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your idea here"
              rows={5}
              maxLength={MAX_LENGTH}
              disabled={busy}
              aria-describedby="fb-count"
            />
            <span id="fb-count" className={counterClass} aria-live="polite">
              {left} {left === 1 ? "character" : "characters"} left
            </span>
            <button
              className="aw-btn"
              onClick={submit}
              disabled={busy || !body.trim()}
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        )}

        {userId &&
          (rows.length === 0 ? (
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
                      {isAdmin
                        ? r.email || (r.user_id ? "unknown user" : "Guest")
                        : "You"}{" "}
                      · {stamp(r.created_at).toUpperCase()}
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
          ))}
      </div>
    </div>
  );
}
