/**
 * Scheduled sweep — four times a day.
 *
 * Cron is UTC: 00:00, 06:00, 12:00, 18:00 → 05:30, 11:30, 17:30, 23:30 IST.
 * Netlify blocks HTTP access to scheduled functions, so use
 * sweep-background.js when you want to trigger one by hand.
 */

import { runSweep } from "../lib/runSweep.js";

export default async () => {
  const result = await runSweep({ trigger: "schedule" });
  return Response.json(result, { status: result.ok ? 200 : 500 });
};

export const config = { schedule: "0 */6 * * *" };
