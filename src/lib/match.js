/**
 * Matching engine.
 *
 * Dependency-free and DOM-free on purpose — this file drops into the browser
 * extension later without changes, so both surfaces filter identically.
 *
 * Normalisation strategy:
 *   clean()  → lowercase, punctuation becomes spaces, whitespace collapsed.
 *              "Senior Engineer  -  ServiceNow" → "senior engineer servicenow"
 *   squash() → lowercase, everything non-alphanumeric removed entirely.
 *              "Service-Now" / "Service Now" / "ServiceNow" → "servicenow"
 *
 * squash() is what makes spelling variants stop mattering. But it destroys word
 * boundaries, so short terms can match accidentally across two words — squashing
 * "records application" yields "...rdsapplication", which contains "sap".
 * So terms of 4 characters or fewer fall back to whole-word matching instead.
 */

const clean = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const squash = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const SHORT_TERM_MAX = 4;

/** Does `term` appear in the already-normalised text? */
function termAppears(term, cleaned, squashed) {
  const s = squash(term);
  if (!s) return false;

  if (s.length <= SHORT_TERM_MAX) {
    // whole-word only — "itsm" must not match inside "britsmart"
    return new RegExp(`\\b${s}\\b`).test(cleaned);
  }
  return squashed.includes(s);
}

/** Does one job satisfy one watch rule? */
export function jobMatchesWatch(job, watch) {
  const titleClean = clean(job.title);
  const titleSquash = squash(job.title);

  // exclusions look at the title only — a senior role whose description
  // mentions "you'll mentor interns" should not be thrown away
  if (
    watch.exclude?.some((word) => termAppears(word, titleClean, titleSquash))
  ) {
    return false;
  }

  const companyClean = clean(job.company);
  const companySquash = squash(job.company);
  const bodyClean = `${titleClean} ${clean(job.description)}`;
  const bodySquash = `${titleSquash}${squash(job.description)}`;

  const companyHit = watch.company.some(
    (c) =>
      termAppears(c, companyClean, companySquash) ||
      termAppears(c, bodyClean, bodySquash)
  );
  if (!companyHit) return false;

  return watch.keywords.some((k) => termAppears(k, bodyClean, bodySquash));
}

/**
 * Filter a job list against active watches.
 * Returns matched jobs tagged with which watch caught them.
 */
export function filterJobs(jobs, watches) {
  const active = watches.filter((w) => w.enabled);

  return jobs.reduce((out, job) => {
    const hit = active.find((w) => jobMatchesWatch(job, w));
    if (hit) out.push({ ...job, watchId: hit.id, watchLabel: hit.label });
    return out;
  }, []);
}

/** Drop duplicate postings by id, keeping first occurrence. */
export function dedupe(jobs) {
  const seen = new Set();
  return jobs.filter((j) => {
    if (!j?.id || seen.has(j.id)) return false;
    seen.add(j.id);
    return true;
  });
}
