/**
 * Scheduled sweep.
 *
 * Does the slow work — list every requisition, pull each description, run the
 * matcher — then writes the result to a Netlify Blobs store. The public `jobs`
 * function only ever reads that store, so browser requests stay fast and never
 * touch Oracle directly (which also sidesteps CORS, since Oracle sends no
 * Access-Control-Allow-Origin header).
 *
 * Runs on the cron below once deployed. Locally, invoke it by hand:
 *   npx netlify functions:invoke sweep
 */

import { getStore } from "@netlify/blobs";
import {
  fetchRequisitionList,
  fetchRequisitionDetail,
  toJob,
  mapLimit,
} from "../../src/lib/sources/oracle.js";
import { filterJobs } from "../../src/lib/match.js";
import { WATCHES, LOCATIONS, SOURCE } from "../../src/config.js";

const STORE = "amexwatch";
const CONCURRENCY = 4;

export default async () => {
  const started = Date.now();
  const store = getStore(STORE);

  try {
    /* 1 — collect every requisition across configured locations */
    const scanned = [];
    for (const loc of LOCATIONS) {
      const rows = await fetchRequisitionList({
        ...SOURCE,
        locationId: loc.id,
      });

      const jobs = await mapLimit(rows, CONCURRENCY, async (row) => {
        const detail = await fetchRequisitionDetail({ ...SOURCE, id: row.Id });
        return toJob({ summary: row, detail, ...SOURCE });
      });

      scanned.push(...jobs);
    }

    /* 2 — apply watch rules */
    const matched = filterJobs(scanned, WATCHES);

    /* 3 — carry firstSeen forward so "new" survives across sweeps */
    const previous = await store
      .get("latest", { type: "json" })
      .catch(() => null);
    const firstSeenById = new Map(
      (previous?.jobs || []).map((j) => [j.id, j.firstSeen])
    );
    const now = new Date().toISOString();

    const jobs = matched.map((j) => ({
      // description is the bulk of the payload and the browser never shows it,
      // so it stays out of the stored blob
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      campus: j.campus,
      posted: j.posted,
      category: j.category,
      workplaceType: j.workplaceType,
      url: j.url,
      watchId: j.watchId,
      watchLabel: j.watchLabel,
      firstSeen: firstSeenById.get(j.id) || now,
    }));

    const payload = {
      ok: true,
      jobs,
      sweptAt: now,
      scannedCount: scanned.length,
      matchedCount: jobs.length,
      durationMs: Date.now() - started,
    };

    await store.setJSON("latest", payload);

    return Response.json({
      ok: true,
      scanned: scanned.length,
      matched: jobs.length,
      durationMs: payload.durationMs,
    });
  } catch (err) {
    // record the failure but leave the last good result in place, so a transient
    // Oracle outage doesn't blank the app
    await store.setJSON("lastError", {
      message: err.message,
      name: err.name,
      at: new Date().toISOString(),
    });

    return Response.json(
      { ok: false, error: err.message, name: err.name },
      { status: 500 }
    );
  }
};

/** Every six hours, on the hour. */
export const config = { schedule: "0 */6 * * *" };
