/**
 * Watch rules.
 *
 * Each entry is one "thing I'm watching for". Rules are evaluated in order and
 * the first match wins, so strict rules must sit above loose ones.
 *
 * company  : employer names to accept (case- and punctuation-insensitive)
 * keywords : role signals — at least one must appear in title or description
 * exclude  : kill-words, checked against the title only
 *
 * KEYWORD DISCIPLINE
 * A term earns its place only if its presence implies the role. Measured against
 * 58 live Amex India postings, these generic terms matched almost everything and
 * were removed: custom (40), model (30), ai (25), sql (18), workflow (15),
 * transform (15), discovery (4), flow (3), portal (3), scripting (1),
 * javascript (1), jdbc (1). Anything matching a third of all corporate JDs is
 * noise, not signal.
 *
 * Note on matching: match.js strips punctuation before comparing, so one entry
 * covers every spelling variant. "servicenow" already catches "Service-Now",
 * "Service Now" and "SERVICENOW" — no need to list them separately.
 */
export const WATCHES = [
  {
    id: "amex-servicenow",
    label: "ServiceNow",
    enabled: true,
    company: [
      "american express",
      "amex",
      "amex gcc",
      "american express india",
      "american express banking corp",
      "aexp",
    ],
    keywords: [
      /* --- the platform itself --- */
      "servicenow",
      "now platform",
      "now assist",
      "now experience",
      "now mobile",
      "now create",

      /* --- product lines / modules --- */
      "itsm",
      "itom",
      "itbm",
      "itam",
      "hrsd",
      "secops",
      "sec ops",
      "software asset management",
      "hardware asset management",
      "strategic portfolio management",
      "integrated risk management",
      "customer service management",
      "incident management",
      "problem management",
      "configuration management",

      /* --- CMDB & discovery --- */
      "cmdb",
      "ci class",
      "ci relationship",
      "service mapping",
      "service graph",
      "discovery pattern",
      "identification and reconciliation",
      "mid server",

      /* --- platform vocabulary that exists nowhere else --- */
      "glide",
      "gliderecord",
      "glideajax",
      "script include",
      "client script",
      "ui policy",
      "ui action",
      "ui builder",
      "ui macro",
      "update set",
      "scoped application",
      "application scope",
      "transform map",
      "import set",
      "flow designer",
      "integrationhub",
      "integration hub",
      "acl rules",

      /* --- catalog & portal surfaces --- */
      "service catalog",
      "catalog item",
      "record producer",
      "order guide",
      "service portal",
      "employee center",
      "agent workspace",
      "virtual agent",

      /* --- platform features --- */
      "performance analytics",
      "predictive intelligence",
      "domain separation",

      /* --- certifications & role naming --- */
      "certified system administrator",
      "certified implementation specialist",
      "cis itsm",
      "cis discovery",
      "servicenow developer",
      "servicenow administrator",
      "servicenow architect",
    ],
    exclude: ["intern", "internship", "trainee", "apprentice"],
  },

  {
    id: "amex-adjacent",
    label: "Adjacent",
    enabled: false,
    company: [
      "american express",
      "amex",
      "amex gcc",
      "american express india",
      "american express banking corp",
      "aexp",
    ],
    keywords: ["itil"],
    exclude: ["intern", "internship", "trainee", "apprentice"],
  },

  // Template for a second employer — identify their ATS, add a block.
  // {
  //   id: "barclays-servicenow",
  //   label: "Barclays · ServiceNow",
  //   enabled: false,
  //   company: ["barclays"],
  //   keywords: ["servicenow", "itsm", "cmdb", "now platform"],
  //   exclude: ["intern", "apprentice"],
  // },
];

/**
 * Oracle Recruiting Cloud location IDs, taken from the API's own locationsFacet
 * rather than typed by hand — Oracle filters by ID, not by city string.
 * "India" covers Gurugram, Bengaluru and Chennai in a single call.
 */
export const LOCATIONS = [{ id: "300000000228786", label: "India" }];

/** Where the Amex jobs come from. Other employers get their own source block. */
export const SOURCE = {
  type: "oracle",
  host: "egug.fa.us2.oraclecloud.com",
  site: "CX_1",
  companyName: "American Express",
  applyUrlBase: "https://careers.americanexpress.com/en/sites/CX_1/job/",
};

export const APP_NAME = "AMEX";
export const APP_SUFFIX = "WATCH";
export const STORAGE_KEY = "amexwatch:v1";
