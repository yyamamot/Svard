import { describe, expect, it } from "vitest";

import {
  assertDiffRenderSampleContract,
  exactInputTupleEqual,
  parseDiffRenderBenchmarkArgs,
  renderedTableExactDuplicateCount,
} from "../../scripts/diff-render-phase-benchmark.mjs";
import {
  diffRenderPhaseFixtureIds,
  diffRenderPhaseFixtures,
} from "../../scripts/diff-render-phase-benchmark/fixtures.mjs";
import {
  assertDiffRenderArtifactSafe,
  buildDiffRenderDecisions,
  criticalPathReductionMs,
  criticalPathUnionMs,
  evaluateHeadroom,
  summarizeSamples,
} from "../../scripts/diff-render-phase-benchmark/report.mjs";

describe("diff render phase benchmark script", () => {
  it("parses a fixed output directory and rejects unknown flags", () => {
    expect(parseDiffRenderBenchmarkArgs([])).toEqual({
      out: ".artifacts/perf/imp-420-before",
      port: 4295,
      smoke: false,
      url: null,
    });
    expect(
      parseDiffRenderBenchmarkArgs(["--", "--out", "/tmp/report"]),
    ).toEqual({
      out: "/tmp/report",
      port: 4295,
      smoke: false,
      url: null,
    });
    expect(() => parseDiffRenderBenchmarkArgs(["--samples", "2"])).toThrow(
      "Unknown argument",
    );
  });

  it("matches only exact production core input tuples", () => {
    const markdown = diffRenderPhaseFixtures.find(
      (fixture) => fixture.fixtureId === "markdown-simple-table",
    )!;
    const asciidoc = diffRenderPhaseFixtures.find(
      (fixture) => fixture.fixtureId === "asciidoc-simple-table",
    )!;
    expect(renderedTableExactDuplicateCount(markdown)).toBe(2);
    expect(renderedTableExactDuplicateCount(asciidoc)).toBe(0);

    const input = {
      asciidocContext: { attributes: {}, baseDir: "/workspace" },
      format: "asciidoc",
      path: "/workspace/doc.adoc",
      resourceSource: { kind: "commit", revision: "base" },
      source: "= Title",
    };
    expect(exactInputTupleEqual(input, structuredClone(input))).toBe(true);
    for (const mismatch of [
      { ...input, source: "= Changed" },
      { ...input, path: "/workspace/other.adoc" },
      {
        ...input,
        resourceSource: { kind: "commit", revision: "other" },
      },
      {
        ...input,
        asciidocContext: { attributes: { env: "prod" }, baseDir: "/workspace" },
      },
    ]) {
      expect(exactInputTupleEqual(input, mismatch)).toBe(false);
    }
  });

  it("uses interval union rather than summing overlapping critical-path work", () => {
    const first = { startMs: 0, endMs: 10 };
    const overlap = { startMs: 5, endMs: 15 };
    const tail = { startMs: 20, endMs: 25 };
    expect(criticalPathUnionMs([first, overlap, tail])).toBe(20);
    expect(criticalPathReductionMs([first, overlap, tail], [overlap])).toBe(5);
  });

  it("halves the avoidable upper bound before applying 15% and noise gates", () => {
    const targetValues = Array.from({ length: 20 }, () => 100);
    expect(
      evaluateHeadroom({
        avoidableCriticalPathUpperBoundValues: Array.from(
          { length: 20 },
          () => 40,
        ),
        fixtureId: "markdown-simple-table",
        targetValues,
      }),
    ).toMatchObject({
      avoidableCriticalPathUpperBoundP50Ms: 40,
      conservativeHeadroomMs: 20,
      decision: "go",
      requiredSavingMs: 15,
    });
    expect(
      evaluateHeadroom({
        avoidableCriticalPathUpperBoundValues: Array.from(
          { length: 20 },
          () => 20,
        ),
        fixtureId: "markdown-simple-table",
        targetValues,
      }),
    ).toMatchObject({ decision: "no-go", reason: "insufficient-headroom" });
  });

  it("records raw samples, p50, p95, and MAD", () => {
    expect(summarizeSamples([1, 2, 3, 4, 100])).toEqual({
      count: 5,
      madMs: 1,
      maxMs: 100,
      minMs: 1,
      p50Ms: 3,
      p95Ms: 100,
    });
  });

  it("keeps timing viability separate from dependency and schedulability", () => {
    const decisionFixtures: Array<[string, string, number]> = [
      ["markdown-simple-table", "exact", 2],
      ["markdown-marker-first", "needs-decision", 0],
      ["markdown-all-diffs", "needs-decision", 0],
    ];
    const samples = decisionFixtures.flatMap(
      ([fixtureId, identityStatus, exactDuplicateCount]) =>
        Array.from({ length: 20 }, () => ({
          avoidableCriticalPathUpperBoundMs: 40,
          exactDuplicateCount,
          fixtureId,
          identityStatus,
          targetMs: 100,
        })),
    );
    expect(buildDiffRenderDecisions(samples)).toMatchObject({
      imp421: {
        identityStatus: "exact",
        ownershipStatus: "resolved",
        schedulability: { decision: "ready" },
        viability: { decision: "go" },
      },
      imp422: {
        dependency: { decision: "satisfied" },
        identityStatus: "needs-decision",
        ownershipStatus: "resolved",
        schedulability: {
          decision: "blocked",
          reason: "identity-not-reproducible",
        },
        viability: { decision: "go" },
      },
      imp423: {
        dependency: { decision: "satisfied" },
        identityStatus: "needs-decision",
        ownershipStatus: "needs-decision",
        schedulability: {
          decision: "blocked",
          reason: "production-loader-counterfactual-unmeasured",
        },
        viability: {
          decision: "needs-decision",
          reason: "production-loader-counterfactual-unmeasured",
        },
      },
    });
  });

  it("fails on per-fixture phase-count or outcome drift", () => {
    const fixture = diffRenderPhaseFixtures.find(
      (candidate) => candidate.fixtureId === "markdown-simple-table",
    )!;
    const sample = {
      blockParseCount: 4,
      blockTextParseCount: 0,
      coreRenderCount: 4,
      prepareCount: 2,
    };
    const outcomes = {
      "diff-artifact-ready": ["ready"],
      "marker-context-ready": [],
      "table-summary-ready": ["ready"],
    };
    expect(assertDiffRenderSampleContract(fixture, sample, outcomes)).toBe(
      "passed",
    );
    expect(() =>
      assertDiffRenderSampleContract(
        fixture,
        { ...sample, coreRenderCount: 3 },
        outcomes,
      ),
    ).toThrow("coreRenderCount drift");
    expect(() =>
      assertDiffRenderSampleContract(fixture, sample, {
        ...outcomes,
        "table-summary-ready": ["fallback"],
      }),
    ).toThrow("outcome drift");
  });

  it("keeps the fixture matrix explicit and deterministic", () => {
    expect(diffRenderPhaseFixtureIds).toEqual([
      "markdown-rendered-single",
      "asciidoc-rendered-single",
      "markdown-simple-table",
      "asciidoc-simple-table",
      "asciidoc-complex-table",
      "markdown-marker-first",
      "asciidoc-marker-first",
      "markdown-all-diffs",
      "asciidoc-all-diffs",
    ]);
    expect(
      diffRenderPhaseFixtures.filter(
        (fixture) => fixture.workflow === "rendered-table",
      ),
    ).toHaveLength(3);
    expect(
      diffRenderPhaseFixtures.filter(
        (fixture) => fixture.workflow === "all-diffs",
      ),
    ).toHaveLength(2);
    expect(
      diffRenderPhaseFixtures.find(
        (fixture) => fixture.fixtureId === "asciidoc-complex-table",
      )?.expected.tableOutcomes,
    ).toEqual(["fallback"]);
  });

  it("rejects artifact strings, paths, source fields, and non-finite numbers", () => {
    expect(() =>
      assertDiffRenderArtifactSafe({
        fixtureId: "markdown-simple-table",
        measurementCount: 20,
        status: "ok",
      }),
    ).not.toThrow();
    expect(() => assertDiffRenderArtifactSafe({ source: "secret" })).toThrow(
      "artifact key",
    );
    expect(() =>
      assertDiffRenderArtifactSafe({ fixtureId: "/private/path.adoc" }),
    ).toThrow("artifact string");
    expect(() =>
      assertDiffRenderArtifactSafe({ measurementCount: Number.NaN }),
    ).toThrow("artifact number");
  });
});
