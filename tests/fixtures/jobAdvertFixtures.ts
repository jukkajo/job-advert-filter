export type ExpectedAnalysisFixture = {
  name: string;
  advert: string;
  expectedRecommendation: "APPLY" | "MAYBE_INVESTIGATE" | "DO_NOT_APPLY";
  expectedScore: number;
  expected: {
    hardBlockers: string[];
    concerns: string[];
    strongPositives: string[];
    bonuses: string[];
  };
};

export const jobAdvertFixtures: ExpectedAnalysisFixture[] = [
  {
    name: "Senior Product Engineer TypeScript",
    advert: [
      "Senior Product Engineer (TypeScript)",
      "We are looking for a product-minded engineer to own features end-to-end with autonomy and feature ownership.",
      "This is full-stack product work building REST APIs and backend API integrations on Node.js and TypeScript.",
      "Our PostgreSQL schema, database schema, data model, and migrations matter a lot.",
      "The team uses Playwright, automated testing, integration tests, unit tests, and code review.",
      "You will improve internal tooling, developer productivity, and engineering productivity.",
      "We ship with GitHub Actions, CI/CD, continuous integration, and continuous deployment.",
      "We are a remote-first hybrid small engineering team inside a product team.",
      "The product is financial software for a finance platform with analytics, planning, and forecasting.",
      "The team uses GitHub Copilot, Claude Code, and AI-assisted development.",
      "Salary range, flexible hours, and growth opportunities are included.",
      "Benefits include a learning budget, equity, health insurance, pension, and a home office stipend.",
    ].join(" "),
    expectedRecommendation: "APPLY",
    expectedScore: 475,
    expected: {
      hardBlockers: [],
      concerns: [],
      strongPositives: [
        "strong-positive-product-engineer",
        "strong-positive-ownership",
        "strong-positive-api-design",
        "strong-positive-postgresql",
        "strong-positive-testing",
        "strong-positive-developer-productivity",
        "strong-positive-ci-cd",
        "strong-positive-small-engineering-team",
        "strong-positive-financial-domain",
        "strong-positive-ai-assisted-development",
        "strong-positive-typescript",
        "strong-positive-node-js",
        "strong-positive-full-stack",
        "strong-positive-remote-friendly",
        "strong-positive-salary-disclosed",
        "strong-positive-flexible-hours",
        "strong-positive-growth-opportunities",
      ],
      bonuses: [
        "bonus-learning-budget",
        "bonus-equity",
        "bonus-health-benefits",
        "bonus-pension",
        "bonus-equipment-provided",
      ],
    },
  },
  {
    name: "enterprise Java consulting",
    advert: [
      "Enterprise Java consulting role for a customer site delivery team.",
      "This is a fixed term contract and an onsite office only position.",
      "Travel required with frequent travel and regular travel to client sites.",
      "The rota includes on-call duty and 24/7 support.",
      "Candidates must relocate before starting.",
      "The interview process includes LeetCode, a whiteboard interview, and a take-home assignment.",
      "The role requires mandatory overtime and work on weekends.",
      "The stack includes Java EE, J2EE, SOAP, WebSphere, and legacy systems.",
    ].join(" "),
    expectedRecommendation: "DO_NOT_APPLY",
    expectedScore: -590,
    expected: {
      hardBlockers: [
        "hard-blocker-relocation-required",
        "hard-blocker-leetcode-interview",
        "hard-blocker-whiteboard-interview",
        "hard-blocker-take-home-assignment",
        "hard-blocker-mandatory-overtime",
      ],
      concerns: [
        "concern-onsite-only",
        "concern-contract-only",
        "concern-travel-required",
        "concern-on-call",
        "concern-client-consulting",
        "concern-legacy-enterprise-stack",
      ],
      strongPositives: [],
      bonuses: [],
    },
  },
  {
    name: "negated interview and overtime concerns",
    advert: [
      "Remote-first role with salary range, flexible hours, automated testing, and a learning budget.",
      "No LeetCode.",
      "No whiteboard interview or whiteboard algorithms.",
      "No take-home assignment and no take-home.",
      "No overtime, no mandatory overtime, and no work on weekends.",
    ].join(" "),
    expectedRecommendation: "APPLY",
    expectedScore: 110,
    expected: {
      hardBlockers: [],
      concerns: [],
      strongPositives: [
        "strong-positive-testing",
        "strong-positive-remote-friendly",
        "strong-positive-salary-disclosed",
        "strong-positive-flexible-hours",
      ],
      bonuses: ["bonus-learning-budget"],
    },
  },
  {
    name: "mixed remote role with travel",
    advert: "Remote role with salary range and travel required.",
    expectedRecommendation: "MAYBE_INVESTIGATE",
    expectedScore: 35,
    expected: {
      hardBlockers: [],
      concerns: ["concern-travel-required"],
      strongPositives: [
        "strong-positive-remote-friendly",
        "strong-positive-salary-disclosed",
      ],
      bonuses: [],
    },
  },
  {
    name: "removed ambiguous salary and overtime concerns",
    advert: "We offer a competitive salary and no overtime expectations.",
    expectedRecommendation: "DO_NOT_APPLY",
    expectedScore: 0,
    expected: {
      hardBlockers: [],
      concerns: [],
      strongPositives: [],
      bonuses: [],
    },
  },
  {
    name: "unpaid role overrides positive signals",
    advert: "This is a remote role with salary range, but it is unpaid.",
    expectedRecommendation: "DO_NOT_APPLY",
    expectedScore: -50,
    expected: {
      hardBlockers: ["hard-blocker-unpaid-work"],
      concerns: [],
      strongPositives: [
        "strong-positive-remote-friendly",
        "strong-positive-salary-disclosed",
      ],
      bonuses: [],
    },
  },
];
