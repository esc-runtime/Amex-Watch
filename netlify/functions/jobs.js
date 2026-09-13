/**
 * Public read endpoint — what the browser calls.
 *
 * Reads open jobs from Postgres and matches them against the enabled watch
 * rules at request time. Matching is no longer done by the sweep: rules can
 * change between sweeps, and a rule edit should show up on the next refresh
 * rather than six hours later.
 *
 * Still never touches Oracle, so it returns in milliseconds.
 */

import { getServiceClient } from "../lib/supabase.js";
import { filterJobs } from "../../src/lib/match.js";

const NO_CACHE = {
  "cache-control": "no-store, max-age=0",
};

export default async () => {
  const db = getServiceClient();

  const [rulesRes, jobsRes] = await Promise.all([
    db.from("watch_rules").select("id, label, keywords, exclude, enabled"),
    db
      .from("jobs")
      .select(
        "external_id, title, company, location, campus, description, url, posted, workplace_type, first_seen, last_seen"
      )
      .is("closed_at", null),
  ]);

  if (rulesRes.error || jobsRes.error) {
    return Response.json(
      {
        ok: false,
        jobs: [],
        sweptAt: null,
        message: "Could not read from the database.",
        lastError: (rulesRes.error || jobsRes.error).message,
      },
      { status: 500, headers: NO_CACHE }
    );
  }

  const rows = jobsRes.data || [];

  // match.js expects camelCase and an `id`; the table is snake_case.
  const jobs = rows.map((r) => ({
    id: r.external_id,
    title: r.title,
    company: r.company,
    location: r.location,
    campus: r.campus,
    description: r.description,
    url: r.url,
    posted: r.posted,
    workplaceType: r.workplace_type,
    firstSeen: r.first_seen,
  }));

  // Explicit allowlist — descriptions stay server-side, and a column added to
  // the table later can't leak into the response by accident.
  const matched = filterJobs(jobs, rulesRes.data || []).map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    campus: j.campus,
    url: j.url,
    posted: j.posted,
    workplaceType: j.workplaceType,
    firstSeen: j.firstSeen,
    watchId: j.watchId,
    watchLabel: j.watchLabel,
  }));

  const sweptAt = rows.reduce(
    (latest, r) => (!latest || r.last_seen > latest ? r.last_seen : latest),
    null
  );

  return Response.json(
    {
      ok: true,
      jobs: matched,
      sweptAt,
      scannedCount: rows.length,
    },
    { headers: NO_CACHE }
  );
};
