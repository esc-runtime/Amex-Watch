/**
 * The sweep: fetch every open requisition for every enabled source and store
 * it in Postgres.
 *
 * Note what this no longer does: matching. With multiple users holding
 * different watch rules there is no single "matched" set to compute here —
 * the jobs table is shared, and each user's rules run at read time instead.
 *
 * Two entry points share this:
 *   functions/sweep.js             — cron
 *   functions/sweep-background.js  — manual trigger
 */

import {
  fetchRequisitionList,
  fetchRequisitionDetail,
  toJob,
  mapLimit,
} from "../../src/lib/sources/oracle.js";
import { getServiceClient } from "./supabase.js";

const CONCURRENCY = 4;
const UPSERT_BATCH = 50;

/** Pull every open requisition for one source and normalise it. */
async function collectJobs(source) {
  const params = {
    host: source.host,
    site: source.site,
    locationId: source.location_id,
    companyName: source.company_name,
    applyUrlBase: source.apply_url_base,
  };

  const rows = await fetchRequisitionList(params);

  return mapLimit(rows, CONCURRENCY, async (row) => {
    const detail = await fetchRequisitionDetail({ ...params, id: row.Id });
    return toJob({ summary: row, detail, ...params });
  });
}

/** Shape a normalised job for the jobs table. */
function toRow(job, sourceId, seenAt) {
  return {
    source_id: sourceId,
    external_id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    campus: job.campus,
    description: job.description,
    posted: job.posted || null,
    workplace_type: job.workplaceType,
    category: job.category,
    url: job.url,
    last_seen: seenAt,
    closed_at: null, // a requisition we can see again is not closed
  };
}

/** Sweep one source. Returns a summary; never throws. */
async function sweepSource(supabase, source, trigger) {
  const startedAt = new Date().toISOString();

  const { data: runRow } = await supabase
    .from("sweep_runs")
    .insert({ source_id: source.id, started_at: startedAt, trigger })
    .select("id")
    .single();

  const runId = runRow?.id;

  try {
    const jobs = await collectJobs(source);
    const seenAt = new Date().toISOString();
    const rows = jobs.map((j) => toRow(j, source.id, seenAt));

    // first_seen is deliberately absent from the payload: on insert Postgres
    // fills it with now(), and on conflict it is left untouched, so the
    // original sighting date survives every later sweep
    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const batch = rows.slice(i, i + UPSERT_BATCH);
      const { error } = await supabase
        .from("jobs")
        .upsert(batch, { onConflict: "source_id,external_id" });
      if (error) throw new Error(`upsert failed: ${error.message}`);
    }

    // anything this source stopped returning is no longer posted
    const { count: closedCount } = await supabase
      .from("jobs")
      .update({ closed_at: seenAt }, { count: "exact" })
      .eq("source_id", source.id)
      .lt("last_seen", startedAt)
      .is("closed_at", null);

    if (runId) {
      await supabase
        .from("sweep_runs")
        .update({
          finished_at: new Date().toISOString(),
          scanned_count: rows.length,
          ok: true,
        })
        .eq("id", runId);
    }

    return {
      source: source.name,
      scanned: rows.length,
      closed: closedCount ?? 0,
      ok: true,
    };
  } catch (err) {
    if (runId) {
      await supabase
        .from("sweep_runs")
        .update({
          finished_at: new Date().toISOString(),
          ok: false,
          error: err.message,
        })
        .eq("id", runId);
    }

    return { source: source.name, ok: false, error: err.message };
  }
}

/**
 * Sweep every enabled source, or one specific source when sourceId is given.
 * One source failing does not stop the others.
 */
export async function runSweep({ trigger = "unknown", sourceId = null } = {}) {
  const started = Date.now();
  const supabase = getServiceClient();

  let query = supabase.from("sources").select("*").eq("enabled", true);
  if (sourceId) query = query.eq("id", sourceId);

  const { data: sources, error } = await query;

  if (error) {
    return { ok: false, error: `could not read sources: ${error.message}` };
  }
  if (!sources?.length) {
    return { ok: false, error: "no enabled sources configured" };
  }

  const results = [];
  for (const source of sources) {
    results.push(await sweepSource(supabase, source, trigger));
  }

  return {
    ok: results.every((r) => r.ok),
    trigger,
    durationMs: Date.now() - started,
    results,
  };
}
