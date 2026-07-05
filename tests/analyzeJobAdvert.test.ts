import { describe, expect, it } from "vitest";
import { analyzeJobAdvert } from "../src/lib/analyzeJobAdvert";

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
    expect(result.explanation).toContain("Recommendation forced to DO_NOT_APPLY");
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
});
