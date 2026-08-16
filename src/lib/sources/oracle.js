/**
 * Oracle Recruiting Cloud adapter.
 *
 * Works for any employer running Oracle Fusion HCM career sites — Amex is just
 * the first. Point it at a different host + siteNumber and it behaves the same.
 *
 * Two-stage fetch, because Oracle splits the data:
 *   1. list    — cheap, returns every requisition's id/title/location, no body
 *   2. details — per requisition, carries the actual description HTML
 *
 * Stage 2 is the expensive one, so callers should cache by id and only fetch
 * details for requisitions they haven't seen before.
 */

const DEFAULT_HEADERS = {
  "ora-irc-language": "en",
  accept: "application/json",
};

/* ---------- html ---------- */

const ENTITIES = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"',
  "&ndash;": "-",
  "&mdash;": "-",
};

/** Strip tags and decode the entities Oracle actually emits. */
export function htmlToText(html) {
  if (!html) return "";
  let out = String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|div|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  for (const [entity, char] of Object.entries(ENTITIES)) {
    out = out.split(entity).join(char);
  }
  return out
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- requests ---------- */

function listUrl({ host, site, locationId, limit, offset }) {
  const parts = [
    `siteNumber=${site}`,
    locationId ? `locationId=${locationId}` : null,
    `limit=${limit}`,
    `offset=${offset}`,
    "sortBy=POSTING_DATES_DESC",
  ].filter(Boolean);

  return (
    `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&expand=requisitionList&finder=findReqs;${parts.join(",")}`
  );
}

function detailUrl({ host, site, id }) {
  return (
    `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails` +
    `?expand=all&finder=ById;Id=${encodeURIComponent(id)},siteNumber=${site}`
  );
}

async function getJson(url) {
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} ${res.statusText} for ${url.slice(0, 90)}…`
    );
  }
  return res.json();
}

/**
 * Thrown when the location filter didn't actually apply.
 *
 * Oracle answers an unrecognised filter with HTTP 200 and the *unfiltered* set
 * rather than an error, so a stale location ID looks like success while
 * silently returning every job worldwide. This error carries the live facet
 * list so the fix is visible in the message itself.
 */
export class LocationFilterError extends Error {
  constructor(message, availableLocations) {
    super(message);
    this.name = "LocationFilterError";
    this.availableLocations = availableLocations;
  }
}

/**
 * Confirm the location filter bit, using only data already in the response.
 *
 * The response's own locationsFacet is computed over the returned set, so the
 * facet entry for our ID should account for every row. If it accounts for
 * fewer, the filter was ignored and we're looking at the global list.
 */
function assertLocationFiltered(block, locationId) {
  const facet = block.locationsFacet || [];
  const total = block.TotalJobsCount ?? 0;
  const entry = facet.find((f) => String(f.Id) === String(locationId));

  const available = facet.map((f) => ({
    id: String(f.Id),
    name: f.Name,
    count: f.TotalCount,
  }));
  const listing = available
    .map((f) => `    ${f.id}  ${f.name} (${f.count})`)
    .join("\n");

  if (!entry) {
    throw new LocationFilterError(
      `Location id ${locationId} no longer exists in this Oracle instance.\n` +
        `  Update LOCATIONS in src/config.js. Currently available:\n${listing}`,
      available
    );
  }

  if (entry.TotalCount !== total) {
    throw new LocationFilterError(
      `Location filter was ignored — asked for ${entry.Name} (${entry.TotalCount} jobs) ` +
        `but got ${total} back, which looks like the unfiltered set.\n` +
        `  Update LOCATIONS in src/config.js. Currently available:\n${listing}`,
      available
    );
  }
}

/**
 * Stage 1 — every open requisition for a location.
 * Pages automatically; Oracle caps a single response below most job counts.
 */
export async function fetchRequisitionList({
  host,
  site,
  locationId = null,
  pageSize = 200,
  maxPages = 10,
  verifyFilter = true,
}) {
  const rows = [];
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const data = await getJson(
      listUrl({ host, site, locationId, limit: pageSize, offset })
    );
    const block = data?.items?.[0] || {};

    if (page === 0 && locationId && verifyFilter) {
      assertLocationFiltered(block, locationId);
    }

    const batch = block.requisitionList || [];
    rows.push(...batch);

    const total = block.TotalJobsCount ?? rows.length;
    offset += batch.length;
    if (batch.length === 0 || rows.length >= total) break;
  }

  return rows;
}

/**
 * Read the live location list straight off the API.
 * Use this to re-derive an ID when the guard above fires.
 */
export async function fetchLocations({ host, site }) {
  const data = await getJson(
    listUrl({ host, site, locationId: null, limit: 1, offset: 0 })
  );
  const facet = data?.items?.[0]?.locationsFacet || [];
  return facet.map((f) => ({
    id: String(f.Id),
    name: f.Name,
    count: f.TotalCount,
  }));
}

/** Stage 2 — full record for one requisition. */
export async function fetchRequisitionDetail({ host, site, id }) {
  const data = await getJson(detailUrl({ host, site, id }));
  return data?.items?.[0] || null;
}

/* ---------- normalisation ---------- */

/**
 * Collapse a summary row + detail record into the shape match.js expects.
 * `companyName` comes from config: we're querying an employer's own ATS, so
 * every requisition belongs to that employer — Oracle doesn't repeat it per row.
 */
export function toJob({ summary, detail, companyName, applyUrlBase }) {
  const d = detail || {};
  const s = summary || {};

  const description = [
    d.ExternalDescriptionStr,
    d.ExternalResponsibilitiesStr,
    d.ExternalQualificationsStr,
  ]
    .map(htmlToText)
    .filter(Boolean)
    .join(" ");

  const secondary = (d.secondaryLocations || [])
    .map((l) => l.Name)
    .filter(Boolean);
  const campus = (d.workLocation || [])[0]?.LocationName || null;

  return {
    id: String(s.Id ?? d.Id),
    title: d.Title || s.Title || "",
    company: companyName,
    location: d.PrimaryLocation || s.PrimaryLocation || "",
    secondaryLocations: secondary,
    campus,
    description,
    posted:
      (d.ExternalPostedStartDate || s.PostedDate || "").slice(0, 10) || null,
    category: d.Category || null,
    jobFunction: d.JobFunction || null,
    workplaceType: d.WorkplaceType || s.WorkplaceType || null,
    schedule: d.JobSchedule || null,
    url: applyUrlBase ? `${applyUrlBase}${s.Id ?? d.Id}` : null,
  };
}

/** Run a list of tasks with bounded concurrency, so we stay polite. */
export async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}
