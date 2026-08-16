/**
 * Manual sweep trigger.
 *
 * The -background suffix gives this a 15 minute budget instead of the usual 10
 * seconds, which matters because a sweep already takes ~9. Background functions
 * reply 202 immediately and finish the work afterwards, so the caller never
 * waits — which is why the UI polls the jobs endpoint until sweptAt changes.
 *
 *   POST /.netlify/functions/sweep-background
 *
 * Publicly reachable, so there's a cooldown: repeat calls inside the window are
 * answered 202 and quietly dropped. Nothing here is expensive enough to be worth
 * real rate limiting, but hammering Oracle on someone else's behalf isn't on.
 */

import { getStore } from "@netlify/blobs";
import { runSweep } from "../lib/runSweep.js";

const COOLDOWN_MS = 15 * 60 * 1000; // one hour

export default async () => {
  const store = getStore("amexwatch");

  const previous = await store
    .get("latest", { type: "json" })
    .catch(() => null);
  const lastSwept = previous?.sweptAt
    ? new Date(previous.sweptAt).getTime()
    : 0;
  const sinceLast = Date.now() - lastSwept;

  if (sinceLast < COOLDOWN_MS) {
    console.log(
      `[sweep-background] skipped, last sweep was ${Math.round(sinceLast / 1000)}s ago`
    );
    return new Response(null, { status: 202 });
  }

  const result = await runSweep({ trigger: "manual" });
  console.log("[sweep-background]", JSON.stringify(result));

  return new Response(null, { status: 202 });
};
