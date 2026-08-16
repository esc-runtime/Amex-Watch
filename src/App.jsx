import { useState, useEffect, useCallback, useRef } from "react";
import { LOCATIONS, APP_NAME, APP_SUFFIX, STORAGE_KEY } from "./config";
import "./App.css";

const JOBS_ENDPOINT = "/.netlify/functions/jobs";
const SWEEP_ENDPOINT = "/.netlify/functions/sweep-background";

/** Must match COOLDOWN_MS in netlify/functions/sweep-background.js. */
const COOLDOWN_MS = 15 * 60 * 1000;

/** A sweep takes ~9s; poll a little beyond that before giving up. */
const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 20;

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

/** Milliseconds until another sweep is allowed. 0 means go ahead. */
function cooldownRemaining(sweptAt) {
  if (!sweptAt) return 0;
  const elapsed = Date.now() - new Date(sweptAt).getTime();
  return Math.max(0, COOLDOWN_MS - elapsed);
}

function formatRemaining(ms) {
  const mins = Math.ceil(ms / 60000);
  if (mins <= 1) return "under a minute";
  return `${mins} minutes`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Only read/unread flags live in the browser; job data always comes fresh. */
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
  const [phase, setPhase] = useState("loading"); // loading | sweeping | idle
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [, forceTick] = useState(0);

  const sweptAtRef = useRef(null);

  /** Read whatever the last sweep stored. Cheap — no Oracle call. */
  const loadJobs = useCallback(async () => {
    const res = await fetch(JOBS_ENDPOINT);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();

    setJobs(data.jobs || []);
    setSweptAt(data.sweptAt || null);
    setScanned(data.scannedCount ?? null);
    sweptAtRef.current = data.sweptAt || null;

    return data;
  }, []);

  /* initial load */
  useEffect(() => {
    setRead(loadRead());
    (async () => {
      try {
        const data = await loadJobs();
        if (data.ok === false)
          setNotice(data.message || "No sweep has run yet.");
      } catch (e) {
        setError(e.message || "Could not reach the server.");
      } finally {
        setPhase("idle");
      }
    })();
  }, [loadJobs]);

  /* keep the countdown honest without a full re-render loop */
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  /**
   * Trigger a real sweep, then poll until the stored timestamp changes.
   * Background functions answer 202 straight away, so the new result only
   * appears once the work behind it finishes.
   */
  const checkForJobs = useCallback(async () => {
    const remaining = cooldownRemaining(sweptAtRef.current);
    if (remaining > 0) {
      setNotice(
        `Already checked recently. Try again in ${formatRemaining(remaining)}.`
      );
      return;
    }

    setPhase("sweeping");
    setError(null);
    setNotice(null);

    const before = sweptAtRef.current;

    try {
      const res = await fetch(SWEEP_ENDPOINT, { method: "POST" });
      if (!res.ok && res.status !== 202) {
        throw new Error(`Sweep request failed (${res.status})`);
      }

      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        await sleep(POLL_INTERVAL_MS);
        const data = await loadJobs();
        if (data.sweptAt && data.sweptAt !== before) {
          setNotice(null);
          return;
        }
      }

      setNotice(
        "The sweep is taking longer than usual. Results will appear on the next refresh."
      );
    } catch (e) {
      setError(e.message || "Could not run the sweep.");
    } finally {
      setPhase("idle");
    }
  }, [loadJobs]);

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

  const busy = phase !== "idle";
  const remaining = cooldownRemaining(sweptAt);
  const unread = jobs.filter((j) => !read[j.id]);

  const ordered = [...jobs].sort((a, b) => {
    const au = read[a.id] ? 1 : 0;
    const bu = read[b.id] ? 1 : 0;
    if (au !== bu) return au - bu;
    return new Date(b.firstSeen) - new Date(a.firstSeen);
  });

  const buttonLabel =
    phase === "sweeping"
      ? "Checking…"
      : phase === "loading"
        ? "Loading…"
        : "Check jobs";

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
          <button className="aw-btn" onClick={checkForJobs} disabled={busy}>
            {buttonLabel}
          </button>
        </header>

        <div className={`aw-rail ${busy ? "live" : ""}`}>
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
          {remaining > 0 && (
            <>
              <span className="aw-sep">/</span>
              <span className="aw-cell">
                NEXT CHECK IN {formatRemaining(remaining).toUpperCase()}
              </span>
            </>
          )}
        </div>

        <div className="aw-counts">
          <span className="aw-big">{unread.length}</span>
          <span>NEW</span>
          <span className="aw-sep">/</span>
          <span>{jobs.length} MATCHED</span>
          <span className="aw-sep">/</span>
          <span>CHECKED {timeAgo(sweptAt).toUpperCase()}</span>
          {unread.length > 0 && (
            <button className="aw-ghost" onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>

        {error && <div className="aw-err">{error}</div>}
        {notice && !error && <div className="aw-notice">{notice}</div>}

        {jobs.length === 0 && !busy ? (
          <div className="aw-empty">
            <b>Nothing matching</b>
            No open role matched your watch rules. That&apos;s the expected
            state until one appears.
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
          CHECKS AUTOMATICALLY EVERY SIX HOURS · MANUAL CHECK ALLOWED ONCE AN
          HOUR.
          <div className="aw-credit">
            BUILT BY{" "}
            <a
              href="https://github.com/esc-runtime"
              target="_blank"
              rel="noopener noreferrer"
            >
              ASHUTOSH CHOUBEY
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
