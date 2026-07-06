import { describe, expect, it } from "vitest";
import {
  analyzeJobAdvert,
  analyzeJobAdvertWithChecklist,
  type ChecklistConfig,
} from "../src/lib/analyzeJobAdvert";

describe("analyzeJobAdvert", () => {
  it("returns DO_NOT_APPLY when a hard blocker is present", () => {
    const result = analyzeJobAdvert(
      "This is a remote role with salary range, but it is unpaid.",
    );

    expect(result.recommendation).toBe("DO_NOT_APPLY");
    expect(result.score).toBe(-50);
    expect(result.hardBlockers).toHaveLength(1);
    expect(result.hardBlockers[0].id).toBe("hard-blocker-unpaid-work");
    expect(result.concerns).toHaveLength(0);
    expect(result.strongPositives).toHaveLength(2);
    expect(result.bonuses).toHaveLength(0);
    expect(result.explanation).toContain("Recommendation: DO_NOT_APPLY");
  });

  it("returns APPLY for a strong positive advert", () => {
    const result = analyzeJobAdvert(
      [
        "Remote role with salary range and flexible hours.",
        "The package includes a learning budget and health insurance.",
      ].join(" "),
    );

    expect(result.recommendation).toBe("APPLY");
    expect(result.score).toBe(95);
    expect(result.hardBlockers).toHaveLength(0);
    expect(result.concerns).toHaveLength(0);
    expect(result.strongPositives).toHaveLength(3);
    expect(result.bonuses).toHaveLength(2);
  });

  it("returns MAYBE_INVESTIGATE for a mixed advert", () => {
    const result = analyzeJobAdvert(
      "Remote role with salary range and travel required.",
    );

    expect(result.recommendation).toBe("MAYBE_INVESTIGATE");
    expect(result.score).toBe(35);
    expect(result.hardBlockers).toHaveLength(0);
    expect(result.concerns).toHaveLength(1);
    expect(result.strongPositives).toHaveLength(2);
    expect(result.bonuses).toHaveLength(0);
  });

  it("avoids duplicate matches for repeated keywords", () => {
    const result = analyzeJobAdvert(
      "Remote remote remote position with salary range salary range salary range.",
    );

    expect(result.recommendation).toBe("MAYBE_INVESTIGATE");
    expect(result.score).toBe(50);
    expect(result.strongPositives).toHaveLength(2);
    expect(result.strongPositives[0].matchedKeywords).toEqual(["remote"]);
    expect(result.strongPositives[1].matchedKeywords).toEqual(["salary range"]);
  });

  it("matches normalized keyword variations in a sample advert", () => {
    const checklist: ChecklistConfig = {
      version: 1,
      rules: [
        {
          id: "positive-node",
          severity: "STRONG_POSITIVE",
          label: "Node.js",
          keywords: ["node.js"],
        },
        {
          id: "positive-fullstack",
          severity: "STRONG_POSITIVE",
          label: "Full stack",
          keywords: ["full stack"],
        },
        {
          id: "positive-postgres",
          severity: "STRONG_POSITIVE",
          label: "PostgreSQL",
          keywords: ["postgresql"],
        },
        {
          id: "positive-cicd",
          severity: "STRONG_POSITIVE",
          label: "CI/CD",
          keywords: ["ci/cd"],
        },
        {
          id: "positive-api",
          severity: "STRONG_POSITIVE",
          label: "API",
          keywords: ["api"],
        },
        {
          id: "positive-migration",
          severity: "STRONG_POSITIVE",
          label: "Migration",
          keywords: ["migration"],
        },
        {
          id: "positive-remote-first",
          severity: "STRONG_POSITIVE",
          label: "Remote-first",
          keywords: ["remote-first"],
        },
      ],
    };

    const result = analyzeJobAdvertWithChecklist(
      [
        "  REMOTE   FIRST team building fullstack NodeJS services and APIs.  ",
        "You will own migrations, improve CICD, and work on Postgres-backed systems.",
      ].join(" "),
      checklist,
    );

    expect(result.recommendation).toBe("APPLY");
    expect(result.score).toBe(175);
    expect(result.strongPositives.map((rule) => rule.id)).toEqual([
      "positive-node",
      "positive-fullstack",
      "positive-postgres",
      "positive-cicd",
      "positive-api",
      "positive-migration",
      "positive-remote-first",
    ]);
  });

  it("matches the reverse form of supported variations", () => {
    const checklist: ChecklistConfig = {
      version: 1,
      rules: [
        {
          id: "positive-node",
          severity: "STRONG_POSITIVE",
          label: "Node.js",
          keywords: ["nodejs"],
        },
        {
          id: "positive-fullstack",
          severity: "STRONG_POSITIVE",
          label: "Full stack",
          keywords: ["fullstack"],
        },
        {
          id: "positive-postgres",
          severity: "STRONG_POSITIVE",
          label: "Postgres",
          keywords: ["postgres"],
        },
        {
          id: "positive-cicd",
          severity: "STRONG_POSITIVE",
          label: "CI/CD",
          keywords: ["cicd"],
        },
        {
          id: "positive-api",
          severity: "STRONG_POSITIVE",
          label: "APIs",
          keywords: ["apis"],
        },
        {
          id: "positive-migration",
          severity: "STRONG_POSITIVE",
          label: "Migrations",
          keywords: ["migrations"],
        },
        {
          id: "positive-remote-first",
          severity: "STRONG_POSITIVE",
          label: "Remote first",
          keywords: ["remote first"],
        },
      ],
    };

    const result = analyzeJobAdvertWithChecklist(
      "Node.js platform for a full-stack team with PostgreSQL, CI/CD, API design, migration work, and a remote-first culture.",
      checklist,
    );

    expect(result.strongPositives).toHaveLength(7);
    expect(result.score).toBe(175);
  });

  it("matches whole words for short keywords", () => {
    const checklist: ChecklistConfig = {
      version: 1,
      rules: [
        {
          id: "positive-api",
          severity: "STRONG_POSITIVE",
          label: "API",
          keywords: ["api"],
        },
      ],
    };

    const result = analyzeJobAdvertWithChecklist(
      "We care about rapid delivery and durable integrations.",
      checklist,
    );

    expect(result.strongPositives).toHaveLength(0);
    expect(result.score).toBe(0);
  });

  it("deduplicates equivalent keyword variations for one checklist item", () => {
    const checklist: ChecklistConfig = {
      version: 1,
      rules: [
        {
          id: "positive-node",
          severity: "STRONG_POSITIVE",
          label: "Node.js",
          keywords: ["node.js", "nodejs"],
        },
      ],
    };

    const result = analyzeJobAdvertWithChecklist(
      "Node.js experience is required. NodeJS services power the platform.",
      checklist,
    );

    expect(result.strongPositives).toHaveLength(1);
    expect(result.strongPositives[0].matchedKeywords).toEqual(["node.js"]);
    expect(result.score).toBe(25);
  });

  it("does not treat negated negative phrases as blockers or concerns", () => {
    const result = analyzeJobAdvert(
      [
        "No LeetCode.",
        "No whiteboard interview or whiteboard algorithms.",
        "No take-home assignment and no take-home.",
        "No overtime, no mandatory overtime, and no work on weekends.",
      ].join(" "),
    );

    expect(result.hardBlockers).toHaveLength(0);
    expect(result.concerns).toHaveLength(0);
    expect(result.score).toBe(0);
  });

  it("still detects unnegated negative interview and overtime signals", () => {
    const result = analyzeJobAdvert(
      [
        "The process includes LeetCode, a whiteboard interview, and a take-home assignment.",
        "The role requires mandatory overtime and work on weekends.",
      ].join(" "),
    );

    expect(result.recommendation).toBe("DO_NOT_APPLY");
    expect(result.hardBlockers.map((rule) => rule.id)).toEqual([
      "hard-blocker-leetcode-interview",
      "hard-blocker-whiteboard-interview",
      "hard-blocker-take-home-assignment",
      "hard-blocker-mandatory-overtime",
    ]);
  });

  it("does not include removed ambiguous concern rules", () => {
    const result = analyzeJobAdvert(
      "We offer a competitive salary and no overtime expectations.",
    );

    expect(result.hardBlockers).toHaveLength(0);
    expect(result.concerns).toHaveLength(0);
    expect(result.score).toBe(0);
  });

  it("returns APPLY for the Senior Product Engineer TypeScript advert", () => {
    const result = analyzeJobAdvert(
      [
        "Senior Product Engineer (TypeScript)",
        "We are looking for a product-minded engineer to own features end-to-end with autonomy and feature ownership.",
        "You will build REST APIs and backend API integrations on Node.js and TypeScript.",
        "Our PostgreSQL schema, database schema, data model, and migrations matter a lot.",
        "The team uses Playwright, automated testing, integration tests, unit tests, and code review.",
        "You will improve internal tooling, developer productivity, and engineering productivity.",
        "We ship with GitHub Actions, CI/CD, continuous integration, and continuous deployment.",
        "We are a remote-first hybrid small engineering team inside a product team.",
        "The product is financial software for a finance platform with analytics, planning, and forecasting.",
        "The team uses GitHub Copilot, Claude Code, and AI-assisted development.",
        "Salary range, flexible hours, a learning budget, and health insurance are included.",
      ].join(" "),
    );

    expect(result.recommendation).toBe("APPLY");
    expect(result.hardBlockers).toHaveLength(0);
    expect(result.concerns).toHaveLength(0);
    expect(result.strongPositives.length).toBeGreaterThanOrEqual(10);
    expect(result.strongPositives.map((rule) => rule.label)).toEqual(
      expect.arrayContaining(["Product Engineer", "PostgreSQL", "API Design"]),
    );
    expect(result.explanation).toContain(
      [
        "Recommendation: APPLY",
        "",
        "Reasoning:",
        "",
        "Strong positives",
      ].join("\n"),
    );
    expect(result.explanation).toContain("Concerns\n- None");
    expect(result.explanation).toContain("Hard blockers\n- None");
  });

  it("returns DO_NOT_APPLY for the enterprise Java consulting advert", () => {
    const result = analyzeJobAdvert(
      [
        "Enterprise Java consulting role for a customer site delivery team.",
        "This is a fixed term contract and an onsite office only position.",
        "Travel required with frequent travel and regular travel to client sites.",
        "The rota includes on-call duty and 24/7 support.",
        "Candidates must relocate before starting.",
        "The interview process includes LeetCode, a whiteboard interview, and a take-home assignment.",
        "The role requires mandatory overtime and work on weekends.",
        "The stack includes Java EE, J2EE, SOAP, WebSphere, and legacy systems.",
      ].join(" "),
    );

    expect(result.recommendation).toBe("DO_NOT_APPLY");
    expect(result.hardBlockers.length).toBeGreaterThanOrEqual(3);
    expect(result.concerns.length).toBeGreaterThanOrEqual(2);
  });
});
