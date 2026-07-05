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
  ["postgresql", "postgres"],
  ["ci cd", "cicd"],
  ["api", "apis"],
  ["migration", "migrations"],
  ["remote first", "remotefirst"],
] as const;

const keywordVariationLookup = new Map<string, readonly string[]>();

for (const family of keywordVariationFamilies) {
  for (const variation of family) {
    keywordVariationLookup.set(variation, family);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function buildKeywordPattern(keyword: string): { matchKey: string; pattern: RegExp } | null {
  const variants = expandKeywordVariants(keyword);

  if (variants.length === 0) {
    return null;
  }

  const sortedVariants = [...variants].sort((left, right) => right.length - left.length);
  const pattern = sortedVariants
    .map((variant) => escapeRegExp(variant).replace(/\s+/g, "\\s+"))
    .join("|");

  return {
    matchKey: [...variants].sort().join("|"),
    pattern: new RegExp(`(?:^|\\s)(?:${pattern})(?=$|\\s)`, "u"),
  };
}

function findMatchedKeywords(text: string, keywords: string[]): string[] {
  const matchedKeywords: string[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    const matcher = buildKeywordPattern(keyword);

    if (!matcher) {
      continue;
    }

    if (seen.has(matcher.matchKey)) {
      continue;
    }

    if (matcher.pattern.test(text)) {
      seen.add(matcher.matchKey);
      matchedKeywords.push(keyword);
    }
  }

  return matchedKeywords;
}

function formatKeywordList(keywords: string[]): string {
  return keywords.join(", ");
}

function formatMatchedRules(rules: MatchedRule[]): string {
  return rules
    .map((rule) => {
      const matchedKeywords = formatKeywordList(rule.matchedKeywords);

      return matchedKeywords
        ? `${rule.label} [${matchedKeywords}]`
        : rule.label;
    })
    .join("; ");
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
  const normalizedText = normalizeForSearch(jobAdvert);
  const hardBlockers: MatchedRule[] = [];
  const concerns: MatchedRule[] = [];
  const strongPositives: MatchedRule[] = [];
  const bonuses: MatchedRule[] = [];

  let score = 0;

  for (const rule of checklistConfig.rules) {
    const matchedKeywords = findMatchedKeywords(normalizedText, rule.keywords);

    if (matchedKeywords.length === 0) {
      continue;
    }

    const matchedRule = createMatchedRule(rule, matchedKeywords);
    score += matchedRule.scoreDelta;

    if (rule.severity === "HARD_BLOCKER") {
      hardBlockers.push(matchedRule);
    } else if (rule.severity === "CONCERN") {
      concerns.push(matchedRule);
    } else if (rule.severity === "STRONG_POSITIVE") {
      strongPositives.push(matchedRule);
    } else {
      bonuses.push(matchedRule);
    }
  }

  const recommendation = determineRecommendation(score, hardBlockers);
  const summaryParts: string[] = [];

  if (hardBlockers.length > 0) {
    summaryParts.push(`Hard blockers: ${formatMatchedRules(hardBlockers)}.`);
  }

  if (concerns.length > 0) {
    summaryParts.push(`Concerns: ${formatMatchedRules(concerns)}.`);
  }

  if (strongPositives.length > 0) {
    summaryParts.push(`Strong positives: ${formatMatchedRules(strongPositives)}.`);
  }

  if (bonuses.length > 0) {
    summaryParts.push(`Bonuses: ${formatMatchedRules(bonuses)}.`);
  }

  if (summaryParts.length === 0) {
    summaryParts.push("No checklist items matched.");
  }

  summaryParts.push(`Score: ${score}.`);

  if (hardBlockers.length > 0) {
    summaryParts.push("Recommendation forced to DO_NOT_APPLY because a hard blocker matched.");
  } else {
    summaryParts.push(`Recommendation: ${recommendation}.`);
  }

  return {
    recommendation,
    score,
    hardBlockers,
    concerns,
    strongPositives,
    bonuses,
    explanation: summaryParts.join(" "),
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
