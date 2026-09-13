/**
 * Watch rules — read-only for users, editable for admins.
 *
 * Rules are global: one row in watch_rules with a null user_id. Because
 * matching happens at read time, an edit here changes what the job list shows
 * on the next refresh. No deploy, no sweep required.
 *
 * Users can't edit, but they can ask. Requests land in keyword_requests for
 * the admin to review — which also tells us whether per-user rules are worth
 * building later.
 */

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useAuth } from "./lib/useAuth.jsx";

export default function Rules({ onBack }) {
  const { user, isAdmin } = useAuth();

  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const [newKeyword, setNewKeyword] = useState("");
  const [asking, setAsking] = useState(false);
  const [requested, setRequested] = useState("");

  useEffect(() => {
    let active = true;

    supabase
      .from("watch_rules")
      .select("id, label, keywords, exclude, enabled")
      .is("user_id", null)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError(err.message);
        else setRule(data);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveKeywords(next) {
    setBusy(true);
    setError(null);
    setNotice(null);

    const { error: err } = await supabase
      .from("watch_rules")
      .update({ keywords: next })
      .eq("id", rule.id);

    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }

    setRule({ ...rule, keywords: next });
  }

  function addKeyword() {
    const word = newKeyword.trim().toLowerCase();
    if (!word) return;

    if (rule.keywords.includes(word)) {
      setError(`"${word}" is already in the list.`);
      return;
    }

    setNewKeyword("");
    saveKeywords([...rule.keywords, word]);
  }

  function removeKeyword(word) {
    saveKeywords(rule.keywords.filter((k) => k !== word));
  }

  async function submitRequest() {
    const word = requested.trim().toLowerCase();
    if (!word) {
      setError("Enter a keyword first.");
      return;
    }

    setBusy(true);
    setError(null);

    const { error: err } = await supabase.from("keyword_requests").insert({
      user_id: user.id,
      rule_id: rule.id,
      keyword: word,
    });

    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }

    setRequested("");
    setAsking(false);
    setNotice("Submitted for review.");
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

  if (!rule) {
    return (
      <div className="aw">
        <div className="aw-wrap">
          <button className="aw-ghost" onClick={onBack}>
            Back
          </button>
          <div className="aw-empty">
            <b>No rule configured</b>
            Nothing is being watched yet.
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
            <h1 className="aw-title">RULES</h1>
            <p className="aw-sub">
              {isAdmin
                ? "Edits apply immediately — the job list uses these on its next refresh."
                : "These are set by the admin. A role matches if any keyword appears in its title or description."}
            </p>
          </div>
          <button className="aw-ghost" onClick={onBack}>
            Back to jobs
          </button>
        </header>

        <div className="aw-rail">
          <span className="aw-dot" />
          <span className="aw-cell">{rule.label}</span>
          <span className="aw-sep">/</span>
          <span className="aw-cell">{rule.keywords.length} KEYWORDS</span>
          <span className="aw-sep">/</span>
          <span className="aw-cell">{rule.exclude.length} EXCLUDED</span>
        </div>

        {error && <div className="aw-err">{error}</div>}
        {notice && !error && <div className="aw-notice">{notice}</div>}

        {isAdmin && (
          <div className="rule-add">
            <input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              placeholder="Add a keyword"
              disabled={busy}
            />
            <button className="aw-ghost" onClick={addKeyword} disabled={busy}>
              Add
            </button>
          </div>
        )}

        <div className="rule-chips">
          {rule.keywords.map((k) => (
            <span key={k} className="rule-chip">
              {k}
              {isAdmin && (
                <button
                  className="rule-x"
                  onClick={() => removeKeyword(k)}
                  disabled={busy}
                  aria-label={`Remove ${k}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>

        <div className="rule-section">
          <h2 className="rule-h">Excluded from titles</h2>
          <div className="rule-chips">
            {rule.exclude.map((k) => (
              <span key={k} className="rule-chip muted">
                {k}
              </span>
            ))}
          </div>
        </div>

        {!isAdmin && (
          <div className="rule-section">
            {!asking ? (
              <>
                <h2 className="rule-h">Want another keyword watched?</h2>
                <button className="aw-ghost" onClick={() => setAsking(true)}>
                  Yes, suggest one
                </button>
              </>
            ) : (
              <div className="rule-add">
                <input
                  value={requested}
                  onChange={(e) => setRequested(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitRequest()}
                  placeholder="e.g. workday"
                  disabled={busy}
                />
                <button
                  className="aw-ghost"
                  onClick={submitRequest}
                  disabled={busy}
                >
                  Send
                </button>
                <button className="aw-ghost" onClick={() => setAsking(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
