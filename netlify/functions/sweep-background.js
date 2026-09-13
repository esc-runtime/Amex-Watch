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

import { getServiceClient } from "../lib/supabase.js";
import { runSweep } from "../lib/runSweep.js";

const COOLDOWN_MS = 60 * 60 * 1000; // one hour

/** When did the last sweep touch the jobs table? */
async function lastSweptAt() {
  const db = getServiceClient();

  const { data, error } = await db
    .from("jobs")
    .select("last_seen")
    .order("last_seen", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.last_seen) return 0;
  return new Date(data.last_seen).getTime();
}

export default async () => {
  const sinceLast = Date.now() - (await lastSweptAt());

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
