import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { asciidocPrepareFixtureIds } from "../../scripts/asciidoc-prepare-benchmark/fixtures.mjs";
import {
  assertAsciiDocPrepareArtifactSafe,
  buildAsciiDocPrepareComparison,
  buildAsciiDocResolverConcurrencyComparison,
  estimateBoundedConcurrencyMs,
  evaluateHeadroom,
  splitHalfDriftPercent,
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

function concurrencyReport({
  boundedConcurrency = 4,
  boundedCalls = 20,
  driftPercent = 5,
  improvementPercent = 20,
  orderingViolationCount = 0,
  pendingCount = 0,
  resolverCountViolationCount = 0,
}: {
  boundedConcurrency?: number;
  boundedCalls?: number;
  driftPercent?: number | null;
  improvementPercent?: number;
  orderingViolationCount?: number;
  pendingCount?: number;
  resolverCountViolationCount?: number;
} = {}) {
  const fixture = (
    fixtureId: string,
    profile: "fixed-5ms" | "zero-latency",
    calls: number,
    unique: number,
    maxConcurrency: number,
  ) => ({
    counts: {
      bounded: {
        maxConcurrency,
        pendingCount,
        resolverCallCount:
          fixtureId === "assets-unique-10" ? boundedCalls : calls,
        resolverResolvedCount:
          fixtureId === "assets-unique-10" ? boundedCalls : calls,
        resolverUniqueCount: unique,
      },
      orderingViolationCount,
      resolverCountViolationCount,
      serial: {
        maxConcurrency: calls > 0 ? 1 : 0,
        pendingCount,
        resolverCallCount: calls,
        resolverResolvedCount: calls,
        resolverUniqueCount: unique,
      },
    },
    durations: Object.fromEntries(
      ["imagesMs", "linksMs", "prepareMs", "totalMs"].map((key) => [
        key,
        {
          bounded: { p50Ms: 80, p95Ms: 105 },
          pairedDeltaMs: { madMs: 1, p95Ms: 5 },
          pairedImprovementPercent: { p50Ms: improvementPercent },
          serial: { p50Ms: 100, p95Ms: 100 },
          splitHalfDriftPercent: driftPercent,
        },
      ]),
    ),
    fixtureId,
    measurementCount: 20,
    profile,
  });
  return {
    concurrencySummaries: [
      fixture("assets-unique-1", "fixed-5ms", 2, 2, 1),
      fixture("assets-unique-10", "fixed-5ms", 20, 20, boundedConcurrency),
      fixture("assets-unique-100", "fixed-5ms", 200, 200, 4),
      fixture("assets-duplicate", "fixed-5ms", 120, 20, 4),
      fixture("plain-large", "zero-latency", 0, 0, 0),
      fixture("include-heavy", "zero-latency", 0, 0, 0),
      fixture("diagram-heavy", "zero-latency", 0, 0, 0),
    ],
    productionWorker: { durations: { domReadyMs: { p95Ms: 105 } } },
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
      "assets-unique-1",
      "assets-unique-10",
      "assets-unique-100",
    ]);
    expect(script).toContain('profile: "full"');
    expect(script).toContain('value === "--baseline"');
    expect(script).toContain("buildAsciiDocPrepareComparison");
    expect(script).toContain('value === "--comparison"');
    expect(script).toContain('"imp414-concurrency"');
    expect(script).toContain("buildAsciiDocResolverConcurrencyComparison");
    expect(script).toContain('"phase-baseline-full-only"');
    expect(probe).toContain("measurementCount = 20");
    expect(probe).toContain("warmupCount = 1");
    expect(probe).toContain("preparePhases");
    expect(probe).toContain("asciiDocWorkerPhaseDurationKeys");
    expect(script).toContain("workerDeliveryMs");
    expect(probe).toContain("concurrencyOrder");
    expect(probe).toContain("summarizeConcurrencyPairs");
  });

  it("uses paired serial and bounded samples for the IMP-414 decision", () => {
    const baseline = {
      productionWorker: { durations: { domReadyMs: { p95Ms: 100 } } },
    };
    const comparison = buildAsciiDocResolverConcurrencyComparison(
      baseline,
      concurrencyReport(),
    );

    expect(comparison).toMatchObject({
      productionWorkerP95RegressionPercent: 5,
      reasons: [],
      status: "go",
    });
    expect(
      comparison.fixtures.find(
        (fixture) => fixture.fixtureId === "assets-unique-100",
      ),
    ).toMatchObject({
      boundedMaxConcurrency: 4,
      boundedResolverCallCount: 200,
      imagesP50ImprovementPercent: 20,
      linksP50ImprovementPercent: 20,
      prepareP50ImprovementPercent: 20,
      resolverCountViolationCount: 0,
      serialMaxConcurrency: 1,
      serialResolverCallCount: 200,
      totalNoiseFloorMs: 10,
      totalP95DeltaMs: 5,
      totalP95RegressionPercent: 5,
    });
    expect(() =>
      assertAsciiDocPrepareArtifactSafe({ comparison }),
    ).not.toThrow();
  });

  it("reports fixed concurrency, count, ordering, and drift violations", () => {
    const baseline = {
      productionWorker: { durations: { domReadyMs: { p95Ms: 100 } } },
    };
    expect(
      buildAsciiDocResolverConcurrencyComparison(
        baseline,
        concurrencyReport({
          boundedConcurrency: 3,
          boundedCalls: 19,
          improvementPercent: 10,
          orderingViolationCount: 1,
          pendingCount: 1,
          resolverCountViolationCount: 1,
        }),
      ),
    ).toMatchObject({
      reasons: expect.arrayContaining([
        "unique-10-images-p50-improvement-below-target",
        "unique-10-links-p50-improvement-below-target",
        "unique-100-images-p50-improvement-below-target",
        "unique-100-links-p50-improvement-below-target",
        "unique-100-prepare-p50-improvement-below-target",
        "resolver-count-violation",
        "bounded-concurrency-violation",
        "pending-count-violation",
        "ordering-violation",
      ]),
      status: "no-go",
    });
    expect(
      buildAsciiDocResolverConcurrencyComparison(
        baseline,
        concurrencyReport({ driftPercent: 11 }),
      ),
    ).toMatchObject({
      reasons: ["paired-measurement-unstable"],
      status: "needs-decision",
    });
    expect(
      buildAsciiDocResolverConcurrencyComparison(
        baseline,
        concurrencyReport({ resolverCountViolationCount: 1 }),
      ),
    ).toMatchObject({
      reasons: ["resolver-count-violation"],
      status: "no-go",
    });
    expect(
      buildAsciiDocResolverConcurrencyComparison(
        baseline,
        concurrencyReport({ driftPercent: null }),
      ),
    ).toMatchObject({
      reasons: ["missing-comparison-metric"],
      status: "needs-decision",
    });
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
    expect(splitHalfDriftPercent([-10, -10, -20, -20])).toBe(100);
    expect(splitHalfDriftPercent([0, 0, 10, 10])).toBeNull();
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
