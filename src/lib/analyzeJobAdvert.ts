import checklistData from "../data/checklist.json";

export type Severity =
  | "HARD_BLOCKER"
  | "CONCERN"
  | "STRONG_POSITIVE"
  | "BONUS";

export type Recommendation = "DO_NOT_APPLY" | "MAYBE_INVESTIGATE" | "APPLY";

export const severityScores: Record<Severity, number> = {
  HARD_BLOCKER: -100,
  CONCERN: -15,
  STRONG_POSITIVE: 25,
  BONUS: 10,
};

export interface ChecklistRule {
  id: string;
  severity: Severity;
  label: string;
  description?: string;
  keywords: string[];
}

export interface ChecklistConfig {
  version: number;
  name?: string;
  rules: ChecklistRule[];
}

export interface MatchedRule extends ChecklistRule {
  scoreDelta: number;
  matchedKeywords: string[];
}

export interface AnalysisResult {
  recommendation: Recommendation;
  score: number;
  hardBlockers: MatchedRule[];
  concerns: MatchedRule[];
  strongPositives: MatchedRule[];
  bonuses: MatchedRule[];
  explanation: string;
}

export const recommendationThresholds = {
  maybeInvestigate: 25,
  apply: 60,
} as const;

const checklist = checklistData as ChecklistConfig;

export const defaultChecklist = checklist;

const keywordVariationFamilies = [
  ["node js", "nodejs"],
  ["full stack", "fullstack"],
  ["end to end", "endtoend"],
  ["postgresql", "postgres"],
  ["ci cd", "cicd"],
  ["api", "apis"],
  ["migration", "migrations"],
  ["remote first", "remotefirst"],
  ["take home", "takehome"],
] as const;

const keywordVariationLookup = new Map<string, readonly string[]>();

for (const family of keywordVariationFamilies) {
  for (const variation of family) {
    keywordVariationLookup.set(variation, family);
  }
}

interface NormalizedAdvert {
  tokens: string[];
}

interface KeywordMatcher {
  keyword: string;
  matchKey: string;
  variants: string[][];
}

interface KeywordMatch {
  keyword: string;
  matchKey: string;
  startIndex: number;
  endIndex: number;
  variantTokens: string[];
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAdvert(value: string): NormalizedAdvert {
  const text = normalizeForSearch(value);

  return {
    tokens: text ? text.split(" ") : [],
  };
}

function expandKeywordVariants(keyword: string): string[] {
  const normalizedKeyword = normalizeForSearch(keyword);

  if (!normalizedKeyword) {
    return [];
  }

  const variants = new Set<string>([normalizedKeyword]);

  if (normalizedKeyword.includes(" ")) {
    variants.add(normalizedKeyword.replace(/\s+/g, ""));
  }

  const family = keywordVariationLookup.get(normalizedKeyword);

  if (family) {
    for (const variation of family) {
      variants.add(variation);
    }
  }

  return [...variants];
}

function buildKeywordMatcher(keyword: string): KeywordMatcher | null {
  const variants = expandKeywordVariants(keyword);

  if (variants.length === 0) {
    return null;
  }

  const variantMap = new Map<string, string[]>();

  for (const variant of variants) {
    const variantTokens = normalizeAdvert(variant).tokens;

    if (variantTokens.length === 0) {
      continue;
    }

    variantMap.set(variantTokens.join(" "), variantTokens);
  }

  return {
    keyword,
    matchKey: [...variants].sort().join("|"),
    variants: [...variantMap.values()].sort((left, right) => right.length - left.length),
  };
}

function findVariantMatches(tokens: string[], matcher: KeywordMatcher): KeywordMatch[] {
  const matches: KeywordMatch[] = [];

  for (const variantTokens of matcher.variants) {
    if (variantTokens.length > tokens.length) {
      continue;
    }

    for (let index = 0; index <= tokens.length - variantTokens.length; index += 1) {
      const isMatch = variantTokens.every(
        (token, offset) => tokens[index + offset] === token,
      );

      if (isMatch) {
        matches.push({
          keyword: matcher.keyword,
          matchKey: matcher.matchKey,
          startIndex: index,
          endIndex: index + variantTokens.length,
          variantTokens,
        });
      }
    }
  }

  return matches.sort((left, right) => {
    if (left.startIndex !== right.startIndex) {
      return left.startIndex - right.startIndex;
    }

    return right.endIndex - left.endIndex;
  });
}

const negationTokens = new Set(["no", "not", "never", "without"]);
const negationLookbehindTokenCount = 4;

function isNegativeRule(rule: ChecklistRule): boolean {
  return rule.severity === "HARD_BLOCKER" || rule.severity === "CONCERN";
}

function matchStartsWithNegation(match: KeywordMatch): boolean {
  const [firstToken] = match.variantTokens;

  return firstToken ? negationTokens.has(firstToken) : false;
}

function hasNearbyNegation(tokens: string[], match: KeywordMatch): boolean {
  const searchStart = Math.max(0, match.startIndex - negationLookbehindTokenCount);
  const precedingTokens = tokens.slice(searchStart, match.startIndex);

  return precedingTokens.some((token) => negationTokens.has(token));
}

function isNegatedMatch(rule: ChecklistRule, tokens: string[], match: KeywordMatch): boolean {
  if (!isNegativeRule(rule) || matchStartsWithNegation(match)) {
    return false;
  }

  return hasNearbyNegation(tokens, match);
}

function findMatchedKeywords(tokens: string[], rule: ChecklistRule): string[] {
  const matchedKeywords: string[] = [];
  const seenMatchKeys = new Set<string>();

  for (const keyword of rule.keywords) {
    const matcher = buildKeywordMatcher(keyword);

    if (!matcher || seenMatchKeys.has(matcher.matchKey)) {
      continue;
    }

    const hasUnnegatedMatch = findVariantMatches(tokens, matcher).some(
      (match) => !isNegatedMatch(rule, tokens, match),
    );

    if (!hasUnnegatedMatch) {
      continue;
    }

    seenMatchKeys.add(matcher.matchKey);
    matchedKeywords.push(keyword);
  }

  return matchedKeywords;
}

function formatRuleList(rules: MatchedRule[]): string[] {
  if (rules.length === 0) {
    return ["- None"];
  }

  return rules.map((rule) => `- ${rule.label}`);
}

function buildExplanation({
  recommendation,
  hardBlockers,
  concerns,
  strongPositives,
}: Pick<
  AnalysisResult,
  "recommendation" | "hardBlockers" | "concerns" | "strongPositives"
>): string {
  return [
    `Recommendation: ${recommendation}`,
    "",
    "Reasoning:",
    "",
    "Strong positives",
    ...formatRuleList(strongPositives),
    "",
    "Concerns",
    ...formatRuleList(concerns),
    "",
    "Hard blockers",
    ...formatRuleList(hardBlockers),
  ].join("\n");
}

function groupMatchedRule(
  groupedRules: Pick<
    AnalysisResult,
    "hardBlockers" | "concerns" | "strongPositives" | "bonuses"
  >,
  matchedRule: MatchedRule,
) {
  if (matchedRule.severity === "HARD_BLOCKER") {
    groupedRules.hardBlockers.push(matchedRule);
  } else if (matchedRule.severity === "CONCERN") {
    groupedRules.concerns.push(matchedRule);
  } else if (matchedRule.severity === "STRONG_POSITIVE") {
    groupedRules.strongPositives.push(matchedRule);
  } else {
    groupedRules.bonuses.push(matchedRule);
  }
}

function calculateScore(matchedRules: MatchedRule[]): number {
  return matchedRules.reduce((score, rule) => score + rule.scoreDelta, 0);
}

function determineRecommendation(
  score: number,
  hardBlockers: MatchedRule[],
): Recommendation {
  if (hardBlockers.length > 0) {
    return "DO_NOT_APPLY";
  }

  if (score >= recommendationThresholds.apply) {
    return "APPLY";
  }

  if (score >= recommendationThresholds.maybeInvestigate) {
    return "MAYBE_INVESTIGATE";
  }

  return "DO_NOT_APPLY";
}

function createMatchedRule(rule: ChecklistRule, matchedKeywords: string[]): MatchedRule {
  return {
    ...rule,
    scoreDelta: severityScores[rule.severity],
    matchedKeywords,
  };
}

function analyzeChecklist(
  jobAdvert: string,
  checklistConfig: ChecklistConfig,
): AnalysisResult {
  const normalizedAdvert = normalizeAdvert(jobAdvert);
  const matchedRules: MatchedRule[] = [];
  const hardBlockers: MatchedRule[] = [];
  const concerns: MatchedRule[] = [];
  const strongPositives: MatchedRule[] = [];
  const bonuses: MatchedRule[] = [];
  const groupedRules = {
    hardBlockers,
    concerns,
    strongPositives,
    bonuses,
  };

  for (const rule of checklistConfig.rules) {
    const matchedKeywords = findMatchedKeywords(normalizedAdvert.tokens, rule);

    if (matchedKeywords.length === 0) {
      continue;
    }

    const matchedRule = createMatchedRule(rule, matchedKeywords);
    matchedRules.push(matchedRule);
    groupMatchedRule(groupedRules, matchedRule);
  }

  const score = calculateScore(matchedRules);
  const recommendation = determineRecommendation(score, hardBlockers);

  return {
    recommendation,
    score,
    hardBlockers,
    concerns,
    strongPositives,
    bonuses,
    explanation: buildExplanation({
      recommendation,
      hardBlockers,
      concerns,
      strongPositives,
    }),
  };
}

export function analyzeJobAdvert(jobAdvert: string): AnalysisResult {
  return analyzeChecklist(jobAdvert, checklist);
}

export function analyzeJobAdvertWithChecklist(
  jobAdvert: string,
  checklistConfig: ChecklistConfig,
): AnalysisResult {
  return analyzeChecklist(jobAdvert, checklistConfig);
}

export default analyzeJobAdvert;
