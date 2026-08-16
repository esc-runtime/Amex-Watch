/**
 * Public read endpoint — what the browser calls.
 *
 * Reads whatever the last sweep wrote. Never touches Oracle, so it returns in
 * milliseconds and can't time out.
 *
 * Deliberately uncached: the payload is small and the whole point of the app is
 * showing the current state. A cached response after a fresh sweep is worse
 * than a slightly slower one.
 */

import { getStore } from "@netlify/blobs";

const STORE = "amexwatch";

const NO_CACHE = {
  "cache-control": "no-store, max-age=0",
};

export default async () => {
  const store = getStore(STORE);

  const data = await store.get("latest", { type: "json" }).catch(() => null);

  if (!data) {
    const lastError = await store
      .get("lastError", { type: "json" })
      .catch(() => null);

    return Response.json(
      {
        ok: false,
        jobs: [],
        sweptAt: null,
        message: "No sweep has completed yet.",
        lastError: lastError || null,
      },
      { headers: NO_CACHE }
    );
  }

  return Response.json(data, { headers: NO_CACHE });
};
