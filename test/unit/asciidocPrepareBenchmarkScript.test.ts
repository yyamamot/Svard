import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { asciidocPrepareFixtureIds } from "../../scripts/asciidoc-prepare-benchmark/fixtures.mjs";
import {
  assertAsciiDocPrepareArtifactSafe,
  buildAsciiDocPrepareComparison,
  estimateBoundedConcurrencyMs,
  evaluateHeadroom,
  summarizeSamples,
} from "../../scripts/asciidoc-prepare-benchmark/report.mjs";

function comparisonReport({
  duplicateCallCount,
  duplicateImageP50,
  duplicateLinkP50,
  duplicateResolverP50,
  p95,
  uniqueCallCount,
}: {
  duplicateCallCount: number;
  duplicateImageP50: number;
  duplicateLinkP50: number;
  duplicateResolverP50: number;
  p95: number;
  uniqueCallCount: number;
}) {
  const summary = (
    fixtureId: string,
    profile: "zero-latency" | "fixed-5ms",
    counts: Record<string, number> = {},
  ) => ({
    counts,
    durations: {
      prepareMs: { p95Ms: p95 },
      resolverTotalMs: { p50Ms: duplicateResolverP50 },
      totalMs: { p95Ms: p95 },
    },
    fixtureId,
    preparePhases: {
      imagesMs: { p50Ms: duplicateImageP50 },
      linksMs: { p50Ms: duplicateLinkP50 },
    },
    profile,
  });
  return {
    productionWorker: { durations: { domReadyMs: { p95Ms: p95 } } },
    summaries: [
      summary("plain-large", "zero-latency"),
      summary("include-heavy", "zero-latency"),
      summary("diagram-heavy", "zero-latency"),
      summary("assets-duplicate", "fixed-5ms", {
        imageElementCount: 60,
        linkElementCount: 60,
        maxConcurrency: 1,
        resolverCallCount: duplicateCallCount,
        resolverUniqueCount: duplicateCallCount,
      }),
      summary("assets-unique", "fixed-5ms", {
        maxConcurrency: 1,
        resolverCallCount: uniqueCallCount,
      }),
    ],
  };
}

describe("AsciiDoc prepare benchmark script", () => {
  const script = fs.readFileSync(
    path.join(process.cwd(), "scripts/asciidoc-prepare-benchmark.mjs"),
    "utf8",
  );
  const probe = fs.readFileSync(
    path.join(process.cwd(), "test/perf/asciidocPrepareBenchmark.test.ts"),
    "utf8",
  );

  it("keeps the fixture and profile contract fixed", () => {
    expect(asciidocPrepareFixtureIds).toEqual([
      "plain-large",
      "include-heavy",
      "diagram-heavy",
      "assets-duplicate",
      "assets-unique",
    ]);
    expect(script).toContain('profile: "full"');
    expect(script).toContain('value === "--baseline"');
    expect(script).toContain("buildAsciiDocPrepareComparison");
    expect(script).toContain('"phase-baseline-full-only"');
    expect(probe).toContain("measurementCount = 20");
    expect(probe).toContain("warmupCount = 1");
    expect(probe).toContain("preparePhases");
    expect(probe).toContain("asciiDocWorkerPhaseDurationKeys");
    expect(script).toContain("workerDeliveryMs");
  });

  it("returns go only when dedupe gains, call counts, and p95 gates pass", () => {
    const baseline = comparisonReport({
      duplicateCallCount: 120,
      duplicateImageP50: 50,
      duplicateLinkP50: 50,
      duplicateResolverP50: 100,
      p95: 100,
      uniqueCallCount: 120,
    });
    const current = comparisonReport({
      duplicateCallCount: 20,
      duplicateImageP50: 40,
      duplicateLinkP50: 40,
      duplicateResolverP50: 70,
      p95: 105,
      uniqueCallCount: 120,
    });

    const comparison = buildAsciiDocPrepareComparison(baseline, current);

    expect(comparison).toMatchObject({
      duplicateImagesP50ImprovementPercent: 20,
      duplicateLinksP50ImprovementPercent: 20,
      duplicateResolverCallCount: 20,
      duplicateResolverTotalP50ImprovementPercent: 30,
      duplicateResolverUniqueCount: 20,
      productionWorkerP95RegressionPercent: 5,
      reasons: [],
      status: "go",
      uniquePrepareP95RegressionPercent: 5,
      uniqueResolverCallCount: 120,
      uniqueTotalP95RegressionPercent: 5,
    });
    expect(() =>
      assertAsciiDocPrepareArtifactSafe({ comparison }),
    ).not.toThrow();
  });

  it("uses fixed reasons for regressions and needs-decision for missing data", () => {
    const baseline = comparisonReport({
      duplicateCallCount: 120,
      duplicateImageP50: 50,
      duplicateLinkP50: 50,
      duplicateResolverP50: 100,
      p95: 100,
      uniqueCallCount: 120,
    });
    const regressed = comparisonReport({
      duplicateCallCount: 21,
      duplicateImageP50: 50,
      duplicateLinkP50: 50,
      duplicateResolverP50: 90,
      p95: 111,
      uniqueCallCount: 119,
    });

    expect(buildAsciiDocPrepareComparison(baseline, regressed)).toMatchObject({
      reasons: expect.arrayContaining([
        "duplicate-resolver-total-p50-improvement-below-target",
        "duplicate-images-p50-improvement-below-target",
        "duplicate-links-p50-improvement-below-target",
        "duplicate-resolver-call-count-mismatch",
        "unique-resolver-call-count-mismatch",
        "unique-prepare-p95-regression",
        "unique-total-p95-regression",
        "production-worker-p95-regression",
      ]),
      status: "no-go",
    });
    expect(buildAsciiDocPrepareComparison({}, regressed)).toMatchObject({
      reasons: ["missing-comparison-metric"],
      status: "needs-decision",
    });
  });

  it("summarizes numeric samples and bounded concurrency deterministically", () => {
    expect(summarizeSamples([4, 1, 3, 2])).toEqual({
      count: 4,
      samplesMs: [4, 1, 3, 2],
      minMs: 1,
      maxMs: 4,
      p50Ms: 2,
      p95Ms: 4,
      madMs: 1,
    });
    expect(estimateBoundedConcurrencyMs([5, 5, 5, 5, 5], 4)).toBe(10);
  });

  it("requires stable target and parent headroom before returning go", () => {
    const stable = Array.from({ length: 20 }, (_, index) => 100 + (index % 2));
    expect(
      evaluateHeadroom({
        parentValues: stable.map(() => 400),
        targetValues: stable,
        upperBoundValues: stable,
      }),
    ).toMatchObject({ decision: "go", reason: "headroom-confirmed" });

    expect(
      evaluateHeadroom({
        parentValues: stable.map(() => 400),
        targetValues: [
          ...Array.from({ length: 10 }, () => 50),
          ...Array.from({ length: 10 }, () => 100),
        ],
        upperBoundValues: stable,
      }),
    ).toMatchObject({ decision: "no-go", reason: "baseline-unstable" });
  });

  it("rejects non-allowlisted artifact keys and strings", () => {
    expect(() =>
      assertAsciiDocPrepareArtifactSafe({
        schemaVersion: 1,
        status: "ok",
        source: "private source body",
      }),
    ).toThrow("artifact key");
    expect(() =>
      assertAsciiDocPrepareArtifactSafe({
        schemaVersion: 1,
        status: "/private/workspace/document.adoc",
      }),
    ).toThrow("artifact string");
  });
});
