/**
 * The sweep itself, with no assumptions about how it was triggered.
 *
 * Two entry points share this:
 *   functions/sweep.js             — cron, four times a day
 *   functions/sweep-background.js  — manual HTTP trigger, 15 minute budget
 *
 * Lives outside src/ deliberately: it imports @netlify/blobs, which is
 * server-only, and nothing here should ever end up in the browser bundle.
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

export async function runSweep({ trigger = "unknown" } = {}) {
  const started = Date.now();
  const store = getStore(STORE);

  try {
    /* 1 — every requisition across configured locations */
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
      // description is most of the payload and the UI never renders it
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
      trigger,
    };

    await store.setJSON("latest", payload);

    return {
      ok: true,
      scanned: scanned.length,
      matched: jobs.length,
      durationMs: payload.durationMs,
      trigger,
    };
  } catch (err) {
    // keep the last good result in place — a transient Oracle outage
    // should not blank the app
    await store
      .setJSON("lastError", {
        message: err.message,
        name: err.name,
        at: new Date().toISOString(),
        trigger,
      })
      .catch(() => {});

    return { ok: false, error: err.message, name: err.name, trigger };
  }
}
