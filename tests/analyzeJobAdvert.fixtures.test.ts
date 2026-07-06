import { describe, it } from "vitest";
import { analyzeJobAdvert } from "../src/lib/analyzeJobAdvert";
import { jobAdvertFixtures } from "./fixtures/jobAdvertFixtures";
import { assertFixtureAnalysis } from "./helpers/analysisTestDebug";

describe("analyzeJobAdvert regression fixtures", () => {
  it.each(jobAdvertFixtures)("$name", (fixture) => {
    const result = analyzeJobAdvert(fixture.advert);

    assertFixtureAnalysis(fixture, result);
  });
});
