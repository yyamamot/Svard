import { describe, expect, it } from "vitest";

import {
  lineDiffProbeFixtureIds,
  parseLineDiffProbeArgs,
  validateLineDiffProbeReport,
} from "../../scripts/line-diff-complexity-probe.mjs";

function validReport() {
  const sample = (fixtureId: string, durationMs: number) => {
    const lineCount = Number(fixtureId.split("-").at(-1));
    return {
      durationMs,
      fixtureId,
      inputBytes: lineCount * 20,
      leftLineCount: lineCount,
      peakScratchEntries: (lineCount + 1) * (lineCount + 1),
      rightLineCount: lineCount,
      workUnits: lineCount * lineCount,
    };
  };
  return {
    measurementCount: 20,
    samples: lineDiffProbeFixtureIds.flatMap((fixtureId) =>
      Array.from({ length: 20 }, (_, index) => sample(fixtureId, index + 1)),
    ),
    schemaVersion: 1,
    summaries: lineDiffProbeFixtureIds.map((fixtureId) => ({
      ...sample(fixtureId, 0),
      durationMs: { p50: 10, p95: 19 },
    })),
    warmupCount: 1,
  };
}

describe("line diff complexity probe wrapper", () => {
  it("fixes the formal probe to one warmup and twenty measurements", () => {
    expect(parseLineDiffProbeArgs([])).toEqual({
      out: ".artifacts/perf/imp-415-before",
    });
    expect(parseLineDiffProbeArgs(["--", "--out", "artifact"])).toEqual({
      out: "artifact",
    });
    expect(() => parseLineDiffProbeArgs(["--profile", "quick"])).toThrow(
      "Unknown argument",
    );
    expect(lineDiffProbeFixtureIds).toHaveLength(8);
  });

  it("accepts only the fixed privacy-safe report schema", () => {
    const report = validReport();
    expect(() => validateLineDiffProbeReport(report)).not.toThrow();

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
});
