/**
 * Plumbing check — no external calls, no storage.
 *
 * If GET /.netlify/functions/health returns JSON, then the Netlify runtime is
 * wired up correctly and any later failure is in our sweep logic, not the
 * deployment. Delete this once the real functions are in.
 */
export default async () => {
  return Response.json({
    ok: true,
    runtime: process.version,
    checkedAt: new Date().toISOString(),
  });
};
