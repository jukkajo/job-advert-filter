import type { AnalysisResult, MatchedRule, Recommendation } from "../../src/lib/analyzeJobAdvert";
import type { ExpectedAnalysisFixture } from "../fixtures/jobAdvertFixtures";

type MatchGroupName = keyof ExpectedAnalysisFixture["expected"];

const matchGroupNames: MatchGroupName[] = [
  "hardBlockers",
  "concerns",
  "strongPositives",
  "bonuses",
];

const scoreDeltaByGroup: Record<MatchGroupName, number> = {
  hardBlockers: -100,
  concerns: -15,
  strongPositives: 25,
  bonuses: 10,
};

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

function getActualMatchedRulesByGroup(
  result: AnalysisResult,
): Record<MatchGroupName, MatchedRule[]> {
  return {
    hardBlockers: result.hardBlockers,
    concerns: result.concerns,
    strongPositives: result.strongPositives,
    bonuses: result.bonuses,
  };
}

function findMissingMatches(expectedIds: string[], actualIds: string[]): string[] {
  const actualIdSet = new Set(actualIds);

  return expectedIds.filter((id) => !actualIdSet.has(id));
}

function findUnexpectedMatches(expectedIds: string[], actualIds: string[]): string[] {
  const expectedIdSet = new Set(expectedIds);

  return actualIds.filter((id) => !expectedIdSet.has(id));
}

function calculateExpectedScore(groups: ExpectedAnalysisFixture["expected"]): number {
  return matchGroupNames.reduce(
    (score, groupName) => score + groups[groupName].length * scoreDeltaByGroup[groupName],
    0,
  );
}

function determineExpectedRecommendation(
  score: number,
  expectedHardBlockers: string[],
): Recommendation {
  if (expectedHardBlockers.length > 0) {
    return "DO_NOT_APPLY";
  }

  if (score >= 60) {
    return "APPLY";
  }

  if (score >= 25) {
    return "MAYBE_INVESTIGATE";
  }

  return "DO_NOT_APPLY";
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

function formatMatchDiffs(
  title: string,
  matchesByGroup: Record<MatchGroupName, string[]>,
): string {
  const lines = matchGroupNames
    .filter((groupName) => matchesByGroup[groupName].length > 0)
    .map((groupName) => `${groupName}: ${matchesByGroup[groupName].join(", ")}`);

  return lines.length > 0 ? [title, ...lines].join("\n") : `${title}\nNone`;
}

function hasAnyMatches(matchesByGroup: Record<MatchGroupName, string[]>): boolean {
  return matchGroupNames.some((groupName) => matchesByGroup[groupName].length > 0);
}

function containsNegationLanguage(advert: string): boolean {
  return /\b(no|not|never|without)\b/i.test(advert);
}

function collectLikelyFailureReasons({
  fixture,
  result,
  actualGroups,
  missingMatchesByGroup,
  unexpectedMatchesByGroup,
}: {
  fixture: ExpectedAnalysisFixture;
  result: AnalysisResult;
  actualGroups: ExpectedAnalysisFixture["expected"];
  missingMatchesByGroup: Record<MatchGroupName, string[]>;
  unexpectedMatchesByGroup: Record<MatchGroupName, string[]>;
}): string[] {
  const reasons = new Set<string>();
  const calculatedFixtureScore = calculateExpectedScore(fixture.expected);
  const calculatedFixtureRecommendation = determineExpectedRecommendation(
    calculatedFixtureScore,
    fixture.expected.hardBlockers,
  );
  const missingMatches = hasAnyMatches(missingMatchesByGroup);
  const unexpectedMatches = hasAnyMatches(unexpectedMatchesByGroup);

  if (fixture.expectedScore !== calculatedFixtureScore) {
    reasons.add("fixture expectedScore is not derived from the expected match list");
  }

  if (fixture.expectedRecommendation !== calculatedFixtureRecommendation) {
    reasons.add("fixture expectedRecommendation does not follow the recommendation rules");
  }

  if (missingMatches) {
    reasons.add("missing keyword coverage or checklist changed");
  }

  if (unexpectedMatches) {
    reasons.add("false positive match or checklist changed");
  }

  if (
    containsNegationLanguage(fixture.advert) &&
    (unexpectedMatchesByGroup.hardBlockers.length > 0 ||
      unexpectedMatchesByGroup.concerns.length > 0)
  ) {
    reasons.add("possible negation failure for a negative rule");
  }

  if (result.score !== fixture.expectedScore && !missingMatches && !unexpectedMatches) {
    reasons.add("scoring mismatch");
  }

  if (
    result.recommendation !== fixture.expectedRecommendation &&
    result.score === fixture.expectedScore &&
    actualGroups.hardBlockers.length === fixture.expected.hardBlockers.length
  ) {
    reasons.add("recommendation rule changed");
  }

  return reasons.size > 0 ? [...reasons] : ["unexpected analyzer drift"];
}

export function assertFixtureAnalysis(
  fixture: ExpectedAnalysisFixture,
  result: AnalysisResult,
) {
  const actualGroups = getActualMatchedRuleIds(result);
  const actualRulesByGroup = getActualMatchedRulesByGroup(result);
  const missingMatchesByGroup: Record<MatchGroupName, string[]> = {
    hardBlockers: [],
    concerns: [],
    strongPositives: [],
    bonuses: [],
  };
  const unexpectedMatchesByGroup: Record<MatchGroupName, string[]> = {
    hardBlockers: [],
    concerns: [],
    strongPositives: [],
    bonuses: [],
  };
  const failures: string[] = [];
  const calculatedFixtureScore = calculateExpectedScore(fixture.expected);
  const calculatedFixtureRecommendation = determineExpectedRecommendation(
    calculatedFixtureScore,
    fixture.expected.hardBlockers,
  );

  if (fixture.expectedScore !== calculatedFixtureScore) {
    failures.push(
      `fixture score expected ${calculatedFixtureScore} from its match list, got ${fixture.expectedScore}`,
    );
  }

  if (fixture.expectedRecommendation !== calculatedFixtureRecommendation) {
    failures.push(
      `fixture recommendation expected ${calculatedFixtureRecommendation} from score and blockers, got ${fixture.expectedRecommendation}`,
    );
  }

  if (result.recommendation !== fixture.expectedRecommendation) {
    failures.push(
      `recommendation expected ${fixture.expectedRecommendation}, got ${result.recommendation}`,
    );
  }

  if (result.score !== fixture.expectedScore) {
    failures.push(`score expected ${fixture.expectedScore}, got ${result.score}`);
  }

  for (const groupName of matchGroupNames) {
    missingMatchesByGroup[groupName] = findMissingMatches(
      fixture.expected[groupName],
      actualGroups[groupName],
    );
    unexpectedMatchesByGroup[groupName] = findUnexpectedMatches(
      fixture.expected[groupName],
      actualGroups[groupName],
    );

    if (missingMatchesByGroup[groupName].length > 0) {
      failures.push(
        `${groupName} missing [${missingMatchesByGroup[groupName].join(", ")}]`,
      );
    }

    if (unexpectedMatchesByGroup[groupName].length > 0) {
      failures.push(
        `${groupName} unexpected [${unexpectedMatchesByGroup[groupName].join(", ")}]`,
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
      "Likely failure reason:",
      ...collectLikelyFailureReasons({
        fixture,
        result,
        actualGroups,
        missingMatchesByGroup,
        unexpectedMatchesByGroup,
      }).map((reason) => `- ${reason}`),
      "",
      "Expected matched rule IDs:",
      formatExpectedGroups(fixture.expected),
      "",
      "Missing matches:",
      formatMatchDiffs("Missing", missingMatchesByGroup),
      "",
      "Unexpected matches:",
      formatMatchDiffs("Unexpected", unexpectedMatchesByGroup),
      "",
      "Actual matches with keywords:",
      matchGroupNames
        .map(
          (groupName) =>
            `${groupName}:\n${formatActualGroup(actualRulesByGroup[groupName])}`,
        )
        .join("\n"),
      "",
      "Actual analysis:",
      formatActualAnalysis(result),
    ].join("\n"),
  );
}
