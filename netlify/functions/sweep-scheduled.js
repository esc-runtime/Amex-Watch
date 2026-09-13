/**
 * Scheduled sweep.
 *
 * Runs every six hours whether or not anyone opens the app — the whole point is
 * catching a posting the day it appears, not the day someone thinks to look.
 *
 * No cooldown check here. The schedule is the rate limit, and skipping a run
 * because a user swept manually forty minutes ago would just delay the data.
 *
 * Scheduled functions get a 30 second budget, not the background function's 15
 * minutes. A sweep takes ~9, so there's headroom, but not unlimited headroom —
 * if the source list grows a lot this needs revisiting.
 */

import { runSweep } from "../lib/runSweep.js";

export default async () => {
  const result = await runSweep({ trigger: "scheduled" });
  console.log("[sweep-scheduled]", JSON.stringify(result));

  return new Response(null, { status: 200 });
};

export const config = {
  schedule: "0 */6 * * *",
};
