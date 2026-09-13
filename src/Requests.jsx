/**
 * Keyword requests — admin only.
 *
 * Users can't edit the global rule, but they can ask for a keyword. This is
 * where those asks land. Approving one adds the keyword to the live rule in the
 * same action, so there's no separate step of going and editing it by hand.
 *
 * Nothing is deleted on review — the point of this table is accumulating
 * evidence about whether per-user rules are worth building.
 */

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

function stamp(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export default function Requests({ onBack }) {
  const [rows, setRows] = useState([]);
  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    let active = true;

    (async () => {
      const [reqRes, ruleRes] = await Promise.all([
        supabase
          .from("keyword_requests")
          .select("id, keyword, status, created_at, reviewed_at, user_id")
          .order("created_at", { ascending: false }),
        supabase
          .from("watch_rules")
          .select("id, keywords")
          .is("user_id", null)
          .maybeSingle(),
      ]);

      if (!active) return;

      if (reqRes.error) {
        setError(reqRes.error.message);
        setLoading(false);
        return;
      }

      // Emails live on profiles, not on the request row — fetch them in one go.
      const ids = [...new Set((reqRes.data || []).map((r) => r.user_id))];
      const emails = {};

      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", ids);

        (profiles || []).forEach((p) => {
          emails[p.id] = p.email;
        });
      }

      if (!active) return;

      setRows(
        (reqRes.data || []).map((r) => ({ ...r, email: emails[r.user_id] }))
      );
      setRule(ruleRes.data || null);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  async function review(row, status) {
    setBusyId(row.id);
    setError(null);

    // Accepting adds the keyword to the live rule as part of the same action.
    // Rule first: if that fails the request stays pending, rather than being
    // marked accepted with nothing actually added.
    if (status === "accepted" && rule) {
      const word = row.keyword.trim().toLowerCase();

      if (!rule.keywords.includes(word)) {
        const next = [...rule.keywords, word];
        const { error: ruleErr } = await supabase
          .from("watch_rules")
          .update({ keywords: next })
          .eq("id", rule.id);

        if (ruleErr) {
          setError(ruleErr.message);
          setBusyId(null);
          return;
        }

        setRule({ ...rule, keywords: next });
      }
    }

    const { error: err } = await supabase
      .from("keyword_requests")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", row.id);

    setBusyId(null);

    if (err) {
      setError(err.message);
      return;
    }

    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, status } : r))
    );
  }

  const counts = rows.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    {}
  );

  const shown =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);

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

  return (
    <div className="aw">
      <div className="aw-wrap">
        <header className="aw-head">
          <div>
            <h1 className="aw-title">REQUESTS</h1>
            <p className="aw-sub">
              Keywords users have asked for. Accepting one adds it to the live
              rule straight away.
            </p>
          </div>
          <button className="aw-ghost" onClick={onBack}>
            Back to jobs
          </button>
        </header>

        <div className="aw-rail">
          <span className="aw-dot" />
          <span className="aw-cell">{counts.pending || 0} PENDING</span>
          <span className="aw-sep">/</span>
          <span className="aw-cell">{counts.accepted || 0} ACCEPTED</span>
          <span className="aw-sep">/</span>
          <span className="aw-cell">{counts.rejected || 0} REJECTED</span>
        </div>

        <div className="req-filters">
          {["pending", "accepted", "rejected", "all"].map((f) => (
            <button
              key={f}
              className={`aw-ghost ${filter === f ? "on" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {error && <div className="aw-err">{error}</div>}

        {shown.length === 0 ? (
          <div className="aw-empty">
            <b>Nothing here</b>
            No {filter === "all" ? "" : filter} requests to show.
          </div>
        ) : (
          <div className="aw-list">
            {shown.map((r) => (
              <article key={r.id} className="aw-job">
                <div className="aw-jobtop">
                  <span className={`req-status ${r.status}`}>{r.status}</span>
                  <span className="aw-jobtitle">{r.keyword}</span>
                </div>
                <div className="aw-meta">
                  <span>{r.email || "unknown user"}</span>
                  <span>· ASKED {stamp(r.created_at).toUpperCase()}</span>
                </div>
                {r.status === "pending" && (
                  <div className="aw-jobfoot">
                    <button
                      className="aw-ghost"
                      onClick={() => review(r, "rejected")}
                      disabled={busyId === r.id}
                    >
                      Reject
                    </button>
                    <button
                      className="aw-ghost"
                      onClick={() => review(r, "accepted")}
                      disabled={busyId === r.id}
                    >
                      Accept and add
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
