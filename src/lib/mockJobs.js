/**
 * Fake listings for local development.
 *
 * Includes deliberate non-matches (wrong company, wrong skill, an intern role)
 * so you can see the filter actually rejecting things rather than just
 * passing everything through.
 */
export const MOCK_JOBS = [
  {
    id: "mock-001",
    title: "ServiceNow Developer - ITSM",
    company: "American Express",
    location: "Gurugram, Haryana",
    salary: "₹18,00,000 - ₹28,00,000 a year",
    posted: "2 days ago",
    url: "https://in.indeed.com/",
    description:
      "Design and build on the Now Platform. Scoped application development, CMDB integrations, REST and OAuth.",
  },
  {
    id: "mock-002",
    title: "Senior Engineer - ServiceNow Platform",
    company: "American Express",
    location: "Bengaluru, Karnataka",
    salary: null,
    posted: "5 days ago",
    url: "https://in.indeed.com/",
    description:
      "Own ITSM and ITOM modules, MID server configuration, discovery and CMDB health.",
  },
  {
    id: "mock-003",
    title: "Platform Engineer - CMDB",
    company: "Amex GCC India",
    location: "Noida, Uttar Pradesh",
    salary: "₹22,00,000 a year",
    posted: "1 day ago",
    url: "https://in.indeed.com/",
    description:
      "CMDB data governance, IRE reconciliation, service graph connectors.",
  },
  // --- should NOT match: right skill, wrong employer ---
  {
    id: "mock-004",
    title: "ServiceNow Architect",
    company: "Infosys",
    location: "Pune, Maharashtra",
    salary: null,
    posted: "3 days ago",
    url: "https://in.indeed.com/",
    description: "ServiceNow ITSM architecture for banking clients.",
  },
  // --- should NOT match: right employer, wrong skill ---
  {
    id: "mock-005",
    title: "Java Backend Developer",
    company: "American Express",
    location: "Gurugram, Haryana",
    salary: null,
    posted: "1 week ago",
    url: "https://in.indeed.com/",
    description: "Spring Boot microservices for payments infrastructure.",
  },
  // --- should NOT match: excluded by keyword ---
  {
    id: "mock-006",
    title: "ServiceNow Intern",
    company: "American Express",
    location: "Bengaluru, Karnataka",
    salary: null,
    posted: "4 days ago",
    url: "https://in.indeed.com/",
    description: "Six month ServiceNow ITSM internship.",
  },
];