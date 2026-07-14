import { describe, expect, it } from "vitest";

import {
  buildLineDiffProbeComparison,
  lineDiffProbeFixtureIds,
  parseLineDiffProbeArgs,
  validateLineDiffProbeComparison,
  validateLineDiffProbeReport,
} from "../../scripts/line-diff-complexity-probe.mjs";

function validReport(
  mode: "full-lcs" | "common-edge-trim" | "linear-memory" = "full-lcs",
  durationMultiplier: (fixtureId: string) => number = () => 1,
) {
  const sample = (fixtureId: string, durationMs: number) => {
    const lineCount = Number(fixtureId.split("-").at(-1));
    const usesLinearMemory = mode === "linear-memory";
    const usesTrimmedMiddle =
      mode === "common-edge-trim" &&
      fixtureId.startsWith("single-edit-") &&
      lineCount > 200;
    return {
      durationMs,
      fixtureId,
      inputBytes: lineCount * 20,
      leftLineCount: lineCount,
      peakScratchEntries: usesLinearMemory
        ? 0
        : usesTrimmedMiddle
          ? 4
          : (lineCount + 1) * (lineCount + 1),
      rightLineCount: lineCount,
      workUnits:
        (usesLinearMemory && fixtureId.startsWith("single-edit-")) ||
        usesTrimmedMiddle
          ? 1
          : lineCount * lineCount,
    };
  };
  return {
    measurementCount: 20,
    samples: lineDiffProbeFixtureIds.flatMap((fixtureId) =>
      Array.from({ length: 20 }, (_, index) =>
        sample(fixtureId, (index + 1) * durationMultiplier(fixtureId)),
      ),
    ),
    schemaVersion: 1,
    summaries: lineDiffProbeFixtureIds.map((fixtureId) => ({
      ...sample(fixtureId, 0),
      durationMs: {
        p50: 10 * durationMultiplier(fixtureId),
        p95: 19 * durationMultiplier(fixtureId),
      },
    })),
    warmupCount: 1,
  };
}

function withFixtureMetrics(
  report: ReturnType<typeof validReport>,
  fixtureId: string,
  workUnits: number,
  peakScratchEntries: number,
) {
  return {
    ...report,
    samples: report.samples.map((sample) =>
      sample.fixtureId === fixtureId
        ? { ...sample, peakScratchEntries, workUnits }
        : sample,
    ),
    summaries: report.summaries.map((summary) =>
      summary.fixtureId === fixtureId
        ? { ...summary, peakScratchEntries, workUnits }
        : summary,
    ),
  };
}

function withWorkBudget(
  report: ReturnType<typeof validReport>,
  overrides: Partial<{
    adversarialAvailability: "available" | "too-complex";
    adversarialReason: "work-budget-exceeded" | null;
    adversarialWorkUnits: number;
    budget: number;
    disjoint5000Availability: "available" | "too-complex";
  }> = {},
) {
  return {
    ...report,
    schemaVersion: 2,
    workBudget: {
      adversarialAvailability: "too-complex" as const,
      adversarialReason: "work-budget-exceeded" as const,
      adversarialWorkUnits: 25_000_000,
      budget: 25_000_000,
      disjoint5000Availability: "available" as const,
      ...overrides,
    },
  };
}

describe("line diff complexity probe wrapper", () => {
  it("fixes the formal probe to one warmup and twenty measurements", () => {
    expect(parseLineDiffProbeArgs([])).toEqual({
      baseline: null,
      comparison: null,
      out: ".artifacts/perf/imp-415-before",
    });
    expect(
      parseLineDiffProbeArgs([
        "--",
        "--baseline",
        "before.json",
        "--comparison",
        "imp419-work-budget",
        "--out",
        "artifact",
      ]),
    ).toEqual({
      baseline: "before.json",
      comparison: "imp419-work-budget",
      out: "artifact",
    });
    expect(() => parseLineDiffProbeArgs(["--comparison", "unknown"])).toThrow(
      "Unsupported comparison",
    );
    expect(() => parseLineDiffProbeArgs(["--profile", "quick"])).toThrow(
      "Unknown argument",
    );
    expect(lineDiffProbeFixtureIds).toHaveLength(8);
  });

  it("accepts only the fixed privacy-safe report schema", () => {
    const report = validReport();
    expect(validateLineDiffProbeReport(report)).toBe("full-lcs");
    expect(validateLineDiffProbeReport(validReport("common-edge-trim"))).toBe(
      "common-edge-trim",
    );
    expect(validateLineDiffProbeReport(validReport("linear-memory"))).toBe(
      "linear-memory",
    );
    expect(
      validReport("common-edge-trim").summaries.find(
        (summary) => summary.fixtureId === "single-edit-200",
      ),
    ).toMatchObject({
      peakScratchEntries: 40_401,
      workUnits: 40_000,
    });

    expect(() =>
      validateLineDiffProbeReport({ ...report, source: "private" }),
    ).toThrow("report schema mismatch");
    expect(() =>
      validateLineDiffProbeReport({
        ...report,
        samples: report.samples.slice(1),
      }),
    ).toThrow("sample count mismatch");
    expect(() =>
      validateLineDiffProbeReport({ ...report, measurementCount: 3 }),
    ).toThrow("metadata mismatch");
    expect(() =>
      validateLineDiffProbeReport({
        ...report,
        summaries: report.summaries.map((summary, index) =>
          index === 0
            ? { ...summary, durationMs: { p50: 11, p95: 19 } }
            : summary,
        ),
      }),
    ).toThrow("percentile mismatch");
    expect(() =>
      validateLineDiffProbeReport(
        withFixtureMetrics(
          validReport("linear-memory"),
          "disjoint-3000",
          8_999_999,
          0,
        ),
      ),
    ).toThrow("mode mismatch");
  });

  it("compares deterministic reductions and small-case p95 without private data", () => {
    const baseline = validReport();
    const candidate = validReport("common-edge-trim", () => 0.5);
    const comparison = buildLineDiffProbeComparison(baseline, candidate);

    expect(comparison.status).toBe("go");
    expect(comparison).toMatchObject({
      baselineMode: "full-lcs",
      candidateMode: "common-edge-trim",
      comparisonId: "imp416-common-edge-trim",
      schemaVersion: 2,
    });
    expect(comparison.violations).toEqual([]);
    expect(
      comparison.fixtures.find(
        (fixture) => fixture.fixtureId === "single-edit-5000",
      ),
    ).toMatchObject({
      baselinePeakScratchEntries: 25_010_001,
      baselineWorkUnits: 25_000_000,
      candidatePeakScratchEntries: 4,
      candidateWorkUnits: 1,
    });
    expect(() => validateLineDiffProbeComparison(comparison)).not.toThrow();
    expect(JSON.stringify(comparison)).not.toMatch(
      /source|path|basename|hunk|repository|timestamp|platform/i,
    );

    const regression = buildLineDiffProbeComparison(
      baseline,
      validReport("common-edge-trim", (fixtureId) =>
        fixtureId === "disjoint-200" ? 1.2 : 0.5,
      ),
    );
    expect(regression).toMatchObject({
      status: "no-go",
      violations: ["small-case-p95-regression"],
    });
  });

  it("compares IMP-417 linear memory metrics across every fixture", () => {
    const baseline = validReport("common-edge-trim");
    const candidate = validReport("linear-memory", () => 0.5);
    const comparison = buildLineDiffProbeComparison(
      baseline,
      candidate,
      "imp417-linear-memory",
    );

    expect(comparison).toMatchObject({
      baselineMode: "common-edge-trim",
      candidateMode: "linear-memory",
      comparisonId: "imp417-linear-memory",
      schemaVersion: 2,
      status: "go",
      violations: [],
    });
    expect(comparison.fixtures).toHaveLength(8);
    expect(
      comparison.fixtures.find(
        (fixture) => fixture.fixtureId === "single-edit-200",
      ),
    ).toMatchObject({
      baselinePeakScratchEntries: 40_401,
      baselineWorkUnits: 40_000,
      candidatePeakScratchEntries: 0,
      candidateWorkUnits: 1,
    });
    expect(
      comparison.fixtures.find(
        (fixture) => fixture.fixtureId === "disjoint-5000",
      ),
    ).toMatchObject({
      candidatePeakScratchEntries: 0,
      candidateWorkUnits: 25_000_000,
    });
    expect(() => validateLineDiffProbeComparison(comparison)).not.toThrow();
    expect(JSON.stringify(comparison)).not.toMatch(
      /source|path|basename|hunk|repository|timestamp|platform/i,
    );
  });

  it("writes fixed IMP-417 violations for structurally valid non-modes", () => {
    const baseline = validReport("common-edge-trim");
    const unknownCandidate = withFixtureMetrics(
      validReport("linear-memory", () => 0.5),
      "disjoint-5000",
      24_999_999,
      0,
    );
    const unknownComparison = buildLineDiffProbeComparison(
      baseline,
      unknownCandidate,
      "imp417-linear-memory",
    );
    expect(unknownComparison).toMatchObject({
      candidateMode: "unknown",
      status: "no-go",
      violations: ["candidate-mode-mismatch"],
    });
    expect(() =>
      validateLineDiffProbeComparison(unknownComparison),
    ).not.toThrow();

    const fullMatrixComparison = buildLineDiffProbeComparison(
      baseline,
      validReport("common-edge-trim", () => 0.5),
      "imp417-linear-memory",
    );
    expect(fullMatrixComparison).toMatchObject({
      status: "no-go",
      violations: [
        "candidate-mode-mismatch",
        "linear-scratch-bound-exceeded",
        "full-matrix-allocation-retained",
      ],
    });
  });

  it("checks the small-case p95 threshold before percentage rounding", () => {
    const comparison = buildLineDiffProbeComparison(
      validReport("common-edge-trim"),
      validReport("linear-memory", (fixtureId) =>
        fixtureId === "single-edit-200" ? 1.100000001 : 0.5,
      ),
      "imp417-linear-memory",
    );
    expect(
      comparison.fixtures.find(
        (fixture) => fixture.fixtureId === "single-edit-200",
      )?.p95RegressionPercent,
    ).toBe(10);
    expect(comparison).toMatchObject({
      status: "no-go",
      violations: ["small-case-p95-regression"],
    });
  });

  it("compares IMP-419 linear-memory reports with a fixed work budget", () => {
    const baseline = validReport("linear-memory");
    const candidate = withWorkBudget(validReport("linear-memory"));
    const comparison = buildLineDiffProbeComparison(
      baseline,
      candidate,
      "imp419-work-budget",
    );

    expect(validateLineDiffProbeReport(candidate)).toBe("linear-memory");
    expect(comparison).toMatchObject({
      baselineMode: "linear-memory",
      candidateMode: "linear-memory",
      comparisonId: "imp419-work-budget",
      schemaVersion: 2,
      status: "go",
      violations: [],
      workBudget: {
        adversarialAvailability: "too-complex",
        adversarialReason: "work-budget-exceeded",
        adversarialWorkUnits: 25_000_000,
        budget: 25_000_000,
        disjoint5000Availability: "available",
      },
    });
    expect(() => validateLineDiffProbeComparison(comparison)).not.toThrow();
    expect(JSON.stringify(comparison)).not.toMatch(
      /source|path|basename|hunk|repository|revision|message|timestamp|platform/i,
    );
  });

  it("uses fixed IMP-419 violations for budget and deterministic regressions", () => {
    const baseline = validReport("linear-memory");
    const candidate = withWorkBudget(
      withFixtureMetrics(
        validReport("linear-memory", (fixtureId) =>
          fixtureId === "disjoint-200" ? 1.2 : 1,
        ),
        "disjoint-1000",
        999_999,
        2,
      ),
      {
        adversarialAvailability: "available",
        adversarialReason: null,
        adversarialWorkUnits: 24_999_999,
        budget: 24_999_999,
        disjoint5000Availability: "too-complex",
      },
    );
    const comparison = buildLineDiffProbeComparison(
      baseline,
      candidate,
      "imp419-work-budget",
    );

    expect(comparison).toMatchObject({
      status: "no-go",
      violations: [
        "candidate-mode-mismatch",
        "work-units-changed",
        "peak-scratch-entries-changed",
        "work-budget-mismatch",
        "disjoint-5000-availability-mismatch",
        "adversarial-availability-mismatch",
        "adversarial-reason-mismatch",
        "adversarial-work-units-mismatch",
        "small-case-p95-regression",
      ],
    });
    expect(() => validateLineDiffProbeComparison(comparison)).not.toThrow();
  });

  it("records fixed IMP-419 violations when the candidate lacks budget metadata", () => {
    const comparison = buildLineDiffProbeComparison(
      validReport("linear-memory"),
      validReport("linear-memory"),
      "imp419-work-budget",
    );

    expect(comparison).toMatchObject({
      status: "no-go",
      violations: [
        "work-budget-mismatch",
        "disjoint-5000-availability-mismatch",
        "adversarial-availability-mismatch",
        "adversarial-reason-mismatch",
        "adversarial-work-units-mismatch",
      ],
      workBudget: null,
    });
  });
});
