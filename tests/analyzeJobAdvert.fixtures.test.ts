import { describe, it } from "vitest";
import {
  analyzeJobAdvert,
  type AnalysisResult,
  type MatchedRule,
} from "../src/lib/analyzeJobAdvert";
import {
  jobAdvertFixtures,
  type ExpectedAnalysisFixture,
} from "./fixtures/jobAdvertFixtures";

type MatchGroupName = keyof ExpectedAnalysisFixture["expected"];

const matchGroupNames: MatchGroupName[] = [
  "hardBlockers",
  "concerns",
  "strongPositives",
  "bonuses",
];

function getActualMatchedRuleIds(
  result: AnalysisResult,
): ExpectedAnalysisFixture["expected"] {
  return {
    hardBlockers: result.hardBlockers.map((rule) => rule.id),
    concerns: result.concerns.map((rule) => rule.id),
    strongPositives: result.strongPositives.map((rule) => rule.id),
    bonuses: result.bonuses.map((rule) => rule.id),
  };
}

function valuesMatch(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatExpectedGroups(groups: ExpectedAnalysisFixture["expected"]): string {
  return matchGroupNames
    .map((groupName) => {
      const ruleIds = groups[groupName];

      return `${groupName}: ${ruleIds.length > 0 ? ruleIds.join(", ") : "None"}`;
    })
    .join("\n");
}

function formatMatchedRule(rule: MatchedRule): string {
  const matchedKeywords =
    rule.matchedKeywords.length > 0 ? rule.matchedKeywords.join(", ") : "None";

  return `${rule.id} (${rule.label}) [${matchedKeywords}]`;
}

function formatActualGroup(rules: MatchedRule[]): string {
  return rules.length > 0 ? rules.map(formatMatchedRule).join("\n") : "None";
}

function formatActualAnalysis(result: AnalysisResult): string {
  return [
    `recommendation: ${result.recommendation}`,
    `score: ${result.score}`,
    "hardBlockers:",
    formatActualGroup(result.hardBlockers),
    "concerns:",
    formatActualGroup(result.concerns),
    "strongPositives:",
    formatActualGroup(result.strongPositives),
    "bonuses:",
    formatActualGroup(result.bonuses),
    "explanation:",
    result.explanation,
  ].join("\n");
}

function assertFixtureAnalysis(
  fixture: ExpectedAnalysisFixture,
  result: AnalysisResult,
) {
  const actualGroups = getActualMatchedRuleIds(result);
  const failures: string[] = [];

  if (result.recommendation !== fixture.expectedRecommendation) {
    failures.push(
      `recommendation expected ${fixture.expectedRecommendation}, got ${result.recommendation}`,
    );
  }

  if (result.score !== fixture.expectedScore) {
    failures.push(`score expected ${fixture.expectedScore}, got ${result.score}`);
  }

  for (const groupName of matchGroupNames) {
    if (!valuesMatch(actualGroups[groupName], fixture.expected[groupName])) {
      failures.push(
        `${groupName} expected [${fixture.expected[groupName].join(", ")}], got [${actualGroups[groupName].join(", ")}]`,
      );
    }
  }

  if (failures.length === 0) {
    return;
  }

  throw new Error(
    [
      `Regression fixture failed: ${fixture.name}`,
      "",
      ...failures,
      "",
      "Expected matched rule IDs:",
      formatExpectedGroups(fixture.expected),
      "",
      "Actual analysis:",
      formatActualAnalysis(result),
    ].join("\n"),
  );
}

describe("analyzeJobAdvert regression fixtures", () => {
  it.each(jobAdvertFixtures)("$name", (fixture) => {
    const result = analyzeJobAdvert(fixture.advert);

    assertFixtureAnalysis(fixture, result);
  });
});
