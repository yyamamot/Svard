import { describe, expect, it } from "vitest";

import {
  buildLineDiffProbeComparison,
  lineDiffProbeFixtureIds,
  parseLineDiffProbeArgs,
  validateLineDiffProbeComparison,
  validateLineDiffProbeReport,
} from "../../scripts/line-diff-complexity-probe.mjs";

function validReport(
  mode: "full-lcs" | "common-edge-trim" = "full-lcs",
  durationMultiplier: (fixtureId: string) => number = () => 1,
) {
  const sample = (fixtureId: string, durationMs: number) => {
    const lineCount = Number(fixtureId.split("-").at(-1));
    const usesTrimmedMiddle =
      mode === "common-edge-trim" &&
      fixtureId.startsWith("single-edit-") &&
      lineCount > 200;
    return {
      durationMs,
      fixtureId,
      inputBytes: lineCount * 20,
      leftLineCount: lineCount,
      peakScratchEntries: usesTrimmedMiddle
        ? 4
        : (lineCount + 1) * (lineCount + 1),
      rightLineCount: lineCount,
      workUnits: usesTrimmedMiddle ? 1 : lineCount * lineCount,
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

describe("line diff complexity probe wrapper", () => {
  it("fixes the formal probe to one warmup and twenty measurements", () => {
    expect(parseLineDiffProbeArgs([])).toEqual({
      baseline: null,
      out: ".artifacts/perf/imp-415-before",
    });
    expect(
      parseLineDiffProbeArgs([
        "--",
        "--baseline",
        "before.json",
        "--out",
        "artifact",
      ]),
    ).toEqual({ baseline: "before.json", out: "artifact" });
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
  });

  it("compares deterministic reductions and small-case p95 without private data", () => {
    const baseline = validReport();
    const candidate = validReport("common-edge-trim", () => 0.5);
    const comparison = buildLineDiffProbeComparison(baseline, candidate);

    expect(comparison.status).toBe("go");
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
});
