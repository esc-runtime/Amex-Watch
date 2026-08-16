/**
 * End-to-end dry run against live Amex data. Nothing is saved.
 *
 *   node scripts/dryrun.mjs
 *
 * Fetches every India requisition, pulls each description, runs the real
 * matcher over it, and reports what survives. This is the moment we find out
 * whether Amex India actually has ServiceNow roles open right now.
 */

import {
  fetchRequisitionList,
  fetchRequisitionDetail,
  toJob,
  mapLimit,
} from "../src/lib/sources/oracle.js";
import { filterJobs, jobMatchesWatch } from "../src/lib/match.js";
import { WATCHES } from "../src/config.js";

const SOURCE = {
  host: "egug.fa.us2.oraclecloud.com",
  site: "CX_1",
  locationId: "300000000228786", // India
  companyName: "American Express",
  applyUrlBase: "https://careers.americanexpress.com/en/sites/CX_1/job/",
};

console.log("Fetching requisition list…");
const rows = await fetchRequisitionList(SOURCE);
console.log(`  ${rows.length} open requisitions in India\n`);

console.log("Fetching descriptions (4 at a time)…");
let done = 0;
const jobs = await mapLimit(rows, 4, async (row) => {
  const detail = await fetchRequisitionDetail({ ...SOURCE, id: row.Id });
  done++;
  if (done % 10 === 0) process.stdout.write(`  ${done}/${rows.length}\n`);
  return toJob({ summary: row, detail, ...SOURCE });
});
console.log(`  ${jobs.length} descriptions retrieved\n`);

const matched = filterJobs(jobs, WATCHES);

console.log("=".repeat(64));
console.log(`MATCHED: ${matched.length} of ${jobs.length}`);
console.log("=".repeat(64));

for (const j of matched) {
  console.log(`\n  ${j.title}`);
  console.log(
    `  ${j.location}${j.campus ? " · " + j.campus : ""} · posted ${j.posted}`
  );
  console.log(`  ${j.url}`);
}

// which keywords are actually earning their place
console.log("\n" + "=".repeat(64));
console.log("KEYWORD HIT COUNTS (across all India roles)");
console.log("=".repeat(64));
for (const w of WATCHES.filter((x) => x.enabled)) {
  for (const kw of w.keywords) {
    const probe = { ...w, keywords: [kw] };
    const n = jobs.filter((j) => jobMatchesWatch(j, probe)).length;
    console.log(`  ${String(n).padStart(3)}  ${kw}`);
  }
}

console.log("\ndone.");
