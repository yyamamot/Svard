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
    expect(artifact).toMatchObject({
      schema: "all-diffs-ui-performance-v2",
      runtime: "vite-production-bundle",
    });
    expect(() => assertAllDiffsUiArtifactSafe(artifact)).not.toThrow();
  });

  it("summarizes loader, render, and DOM commit phase metrics", () => {
    const artifact = summarizeAllDiffsUiRun({
      mode: "formal",
      samples: [
        ...samples("production", [40]).map((sample) => ({
          ...sample,
          loaderQueueWaitCount: 2,
          loaderQueueWaitDurationMs: 3,
          loaderQueueWaitItemCount: 2,
          gitPreviewWaitCount: 2,
          gitPreviewWaitDurationMs: 5,
          gitPreviewWaitItemCount: 2,
          renderSummaryCount: 2,
          renderSummaryDurationMs: 7,
          renderSummaryItemCount: 2,
          readyDomCommitCount: 2,
          readyDomCommitDurationMs: 1,
          readyDomCommitItemCount: 2,
        })),
        ...samples("without-margin-markers", [39]),
        ...samples("without-rendered-rulers", [38]),
      ],
    });

    expect(artifact.fixtures[0]).toMatchObject({
      variants: {
        production: {
          loaderQueueWaitDurationMs: { p50: 3, p95: 3 },
          gitPreviewWaitDurationMs: { p50: 5, p95: 5 },
          renderSummaryDurationMs: { p50: 7, p95: 7 },
          readyDomCommitDurationMs: { p50: 1, p95: 1 },
        },
      },
    });
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
      runtime: "vite-production-bundle",
      candidate: "margin-markers",
      fixtures: [fixture("markdown-14x12-mixed", "go", "not-go")],
    };
    const mismatched = {
      runtime: "vite-production-bundle",
      candidate: "margin-markers",
      fixtures: [fixture("markdown-14x12-mixed", "not-go", "go")],
      mode: "confirmation",
    };
    expect(combineAllDiffsUiRuns(formal, mismatched)).toMatchObject({
      confirmedCandidate: "no-go",
      confirmedEvidence: [],
    });

    const matched = {
      runtime: "vite-production-bundle",
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
    const formal = {
      runtime: "vite-production-bundle",
      candidate: "margin-markers",
      fixtures: [],
    };
    const confirmation = {
      runtime: "vite-production-bundle",
      candidate: "stream-ruler",
      fixtures: [],
      mode: "confirmation",
    };
    expect(combineAllDiffsUiRuns(formal, confirmation)).toMatchObject({
      confirmedCandidate: "no-go",
      confirmedEvidence: [],
    });
  });

  it("does not confirm results from a non-production runtime", () => {
    const formal = {
      runtime: "development-runtime",
      candidate: "margin-markers",
      fixtures: [],
    };
    const confirmation = {
      runtime: "vite-production-bundle",
      candidate: "margin-markers",
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
        schema: "all-diffs-ui-performance-v2",
        sourceText: "private content",
      }),
    ).toThrow(/forbidden key/i);
    expect(() =>
      assertAllDiffsUiArtifactSafe({
        schema: "all-diffs-ui-performance-v2",
        label: "private content",
      }),
    ).toThrow(/unsafe text/i);
  });
});
