/**
 * Manual sweep trigger.
 *
 * The -background suffix is what gives this a 15 minute budget instead of the
 * usual 10 seconds, which matters because a sweep already takes ~9. Background
 * functions reply 202 immediately and finish the work after the response, so
 * the caller never waits.
 *
 *   POST /.netlify/functions/sweep-background
 *
 * Results land in the same blob the scheduled sweep writes, so the app picks
 * them up on its next refresh.
 */

import { runSweep } from "../lib/runSweep.js";

export default async () => {
  const result = await runSweep({ trigger: "manual" });
  console.log("[sweep-background]", JSON.stringify(result));
  return new Response(null, { status: 202 });
};
