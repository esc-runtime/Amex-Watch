import { useState, useEffect, useCallback } from "react";
import { LOCATIONS, APP_NAME, APP_SUFFIX, STORAGE_KEY } from "./config";
import "./App.css";

const JOBS_ENDPOINT = "/.netlify/functions/jobs";

/* ---------- helpers ---------- */

function timeAgo(iso) {
  if (!iso) return "never";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function stamp(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

/**
 * Only the read/unread flags live in the browser. Job data comes from the
 * server every time, so it's never stale and never diverges between devices.
 */
function loadRead() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw).read || {} : {};
  } catch {
    return {};
  }
}

function saveRead(read) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ read }));
  } catch {
    /* private browsing or quota — flags just won't persist */
  }
}

/* ---------- app ---------- */

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [read, setRead] = useState({});
  const [sweptAt, setSweptAt] = useState(null);
  const [scanned, setScanned] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(JOBS_ENDPOINT);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();

      setJobs(data.jobs || []);
      setSweptAt(data.sweptAt || null);
      setScanned(data.scannedCount ?? null);

      if (data.ok === false) {
        setNotice(data.message || "No sweep has completed yet.");
      }
    } catch (e) {
      setError(e.message || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRead(loadRead());
    refresh();
  }, [refresh]);

  const markRead = (id) => {
    const next = { ...read, [id]: true };
    setRead(next);
    saveRead(next);
  };

  const markAllRead = () => {
    const next = { ...read };
    jobs.forEach((j) => {
      next[j.id] = true;
    });
    setRead(next);
    saveRead(next);
  };

  const unread = jobs.filter((j) => !read[j.id]);

  // unread first, then most recently seen
  const ordered = [...jobs].sort((a, b) => {
    const au = read[a.id] ? 1 : 0;
    const bu = read[b.id] ? 1 : 0;
    if (au !== bu) return au - bu;
    return new Date(b.firstSeen) - new Date(a.firstSeen);
  });

  return (
    <div className="aw">
      <div className="aw-wrap">
        <header className="aw-head">
          <div>
            <h1 className="aw-title">
              {APP_NAME}
              <span>/</span>
              {APP_SUFFIX}
            </h1>
            <p className="aw-sub">
              Watches for roles matching your rules. Anything you haven&apos;t
              opened yet is flagged.
            </p>
          </div>
          <button className="aw-btn" onClick={refresh} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </header>

        <div className={`aw-rail ${loading ? "live" : ""}`}>
          <span className="aw-dot" />
          {LOCATIONS.map((loc, i) => (
            <span key={loc.id}>
              {i > 0 && <span className="aw-sep">/</span>}
              <span className="aw-cell">{loc.label}</span>
            </span>
          ))}
          {scanned != null && (
            <>
              <span className="aw-sep">/</span>
              <span className="aw-cell">{scanned} SCANNED</span>
            </>
          )}
        </div>

        <div className="aw-counts">
          <span className="aw-big">{unread.length}</span>
          <span>NEW</span>
          <span className="aw-sep">/</span>
          <span>{jobs.length} MATCHED</span>
          <span className="aw-sep">/</span>
          <span>SWEPT {timeAgo(sweptAt).toUpperCase()}</span>
          {unread.length > 0 && (
            <button className="aw-ghost" onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>

        {error && <div className="aw-err">{error}</div>}

        {jobs.length === 0 && !loading ? (
          <div className="aw-empty">
            <b>{notice ? "Waiting on first sweep" : "Nothing matching"}</b>
            {notice ||
              "The sweep ran but no open role matched your watch rules. That's the expected state until one appears."}
          </div>
        ) : (
          <div className="aw-list">
            {ordered.map((j) => {
              const isNew = !read[j.id];
              return (
                <article key={j.id} className={`aw-job ${isNew ? "new" : ""}`}>
                  <div className="aw-jobtop">
                    {isNew && <span className="aw-tag">NEW</span>}
                    <a
                      className="aw-jobtitle"
                      href={j.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markRead(j.id)}
                    >
                      {j.title}
                    </a>
                  </div>
                  <div className="aw-org">
                    <b>{j.company}</b> · {j.location}
                    {j.campus ? ` · ${j.campus}` : ""}
                  </div>
                  <div className="aw-meta">
                    <span>FIRST SEEN {stamp(j.firstSeen).toUpperCase()}</span>
                    {j.posted && <span>· POSTED {j.posted}</span>}
                    {j.workplaceType && (
                      <span>· {j.workplaceType.toUpperCase()}</span>
                    )}
                    {j.watchLabel && (
                      <span>· {j.watchLabel.toUpperCase()}</span>
                    )}
                  </div>
                  {isNew && (
                    <div className="aw-jobfoot">
                      <button
                        className="aw-ghost"
                        onClick={() => markRead(j.id)}
                      >
                        Mark read
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <footer className="aw-foot">
          LIVE DATA FROM THE AMERICAN EXPRESS CAREERS API.
          <br />
          SWEEPS RUN EVERY SIX HOURS ONCE DEPLOYED — REFRESH SHOWS THE LATEST
          RESULT.
        </footer>
      </div>
    </div>
  );
}
