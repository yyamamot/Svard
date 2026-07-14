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
        "imp417-linear-memory",
        "--out",
        "artifact",
      ]),
    ).toEqual({
      baseline: "before.json",
      comparison: "imp417-linear-memory",
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
});
