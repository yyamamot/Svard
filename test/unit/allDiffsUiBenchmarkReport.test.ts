import { describe, expect, it } from "vitest";
import {
  assertAllDiffsUiArtifactSafe,
  combineAllDiffsUiRuns,
  compareCounterfactual,
  comparePairedSamples,
  medianAbsoluteDeviation,
  summarizeAllDiffsUiRun,
} from "../../scripts/all-diffs-ui-benchmark/report.mjs";

function samples(variant: string, values: number[]) {
  return values.map((workflowSettledMs, sampleIndex) => ({
    fixtureId: "markdown-14x12-mixed",
    variant,
    sampleIndex,
    workflowSettledMs,
  }));
}

describe("All Diffs UI benchmark report", () => {
  it("uses the maximum of 15 percent, two milliseconds, and twice MAD", () => {
    const comparison = comparePairedSamples(
      samples("production", [20, 22, 24]),
      samples("without-margin-markers", [15, 16, 17]),
    );

    expect(comparison).toEqual({
      metric: "workflowSettledMs",
      pairCount: 3,
      baselineP50Ms: 22,
      observedSavingMs: 6,
      pairedMadMs: 1,
      requiredSavingMs: 3.3,
      status: "go",
    });
  });

  it("does not adopt savings below the fixed two millisecond floor", () => {
    const comparison = comparePairedSamples(
      samples("production", [8, 9, 10]),
      samples("without-margin-markers", [7, 7.5, 8]),
    );

    expect(comparison.requiredSavingMs).toBe(2);
    expect(comparison.status).toBe("not-go");
  });

  it("computes median absolute deviation from paired deltas", () => {
    expect(medianAbsoluteDeviation([2, 4, 5, 8, 20])).toBe(3);
  });

  it("evaluates startup, settled workflow, and scroll p95 separately", () => {
    const baseline = samples("production", [40, 42, 44]).map((sample) => ({
      ...sample,
      firstUsefulMs: 20,
      scrollFrameP95Ms: 18,
    }));
    const counterfactual = samples("without-margin-markers", [39, 41, 43]).map(
      (sample) => ({
        ...sample,
        firstUsefulMs: 10,
        scrollFrameP95Ms: 17,
      }),
    );
    const comparison = compareCounterfactual(baseline, counterfactual);

    expect(Object.keys(comparison.metrics)).toEqual([
      "firstUsefulMs",
      "workflowSettledMs",
      "scrollFrameP95Ms",
    ]);
    expect(comparison.metrics.firstUsefulMs.status).toBe("go");
    expect(comparison.metrics.workflowSettledMs.status).toBe("not-go");
    expect(comparison.status).toBe("go");
  });

  it("prioritizes a measured margin-marker candidate", () => {
    const artifact = summarizeAllDiffsUiRun({
      mode: "formal",
      samples: [
        ...samples("production", [40, 42, 44]),
        ...samples("without-margin-markers", [25, 27, 29]),
        ...samples("without-rendered-rulers", [24, 26, 28]),
      ],
    });

    expect(artifact.candidate).toBe("margin-markers");
    expect(() => assertAllDiffsUiArtifactSafe(artifact)).not.toThrow();
  });

  it("requires the same candidate, fixture, and metric in both runs", () => {
    const metric = (status: "go" | "not-go") => ({ status });
    const fixture = (
      fixtureId: string,
      firstUsefulStatus: "go" | "not-go",
      workflowStatus: "go" | "not-go",
    ) => ({
      fixtureId,
      marginMarkers: {
        metrics: {
          firstUsefulMs: metric(firstUsefulStatus),
          workflowSettledMs: metric(workflowStatus),
          scrollFrameP95Ms: metric("not-go"),
        },
      },
      streamRuler: {
        metrics: {
          firstUsefulMs: metric("not-go"),
          workflowSettledMs: metric("not-go"),
          scrollFrameP95Ms: metric("not-go"),
        },
      },
    });
    const formal = {
      candidate: "margin-markers",
      fixtures: [fixture("markdown-14x12-mixed", "go", "not-go")],
    };
    const mismatched = {
      candidate: "margin-markers",
      fixtures: [fixture("markdown-14x12-mixed", "not-go", "go")],
      mode: "confirmation",
    };
    expect(combineAllDiffsUiRuns(formal, mismatched)).toMatchObject({
      confirmedCandidate: "no-go",
      confirmedEvidence: [],
    });

    const matched = {
      candidate: "margin-markers",
      fixtures: [fixture("markdown-14x12-mixed", "go", "not-go")],
      mode: "confirmation",
    };
    expect(combineAllDiffsUiRuns(formal, matched)).toMatchObject({
      confirmedCandidate: "margin-markers",
      confirmedEvidence: [
        { fixtureId: "markdown-14x12-mixed", metric: "firstUsefulMs" },
      ],
    });
  });

  it("does not confirm matching categories when the candidates differ", () => {
    const formal = { candidate: "margin-markers", fixtures: [] };
    const confirmation = {
      candidate: "stream-ruler",
      fixtures: [],
      mode: "confirmation",
    };
    expect(combineAllDiffsUiRuns(formal, confirmation)).toMatchObject({
      confirmedCandidate: "no-go",
      confirmedEvidence: [],
    });
  });

  it("rejects source-like fields and uncontrolled strings", () => {
    expect(() =>
      assertAllDiffsUiArtifactSafe({
        schema: "all-diffs-ui-performance-v1",
        sourceText: "private content",
      }),
    ).toThrow(/forbidden key/i);
    expect(() =>
      assertAllDiffsUiArtifactSafe({
        schema: "all-diffs-ui-performance-v1",
        label: "private content",
      }),
    ).toThrow(/unsafe text/i);
  });
});
