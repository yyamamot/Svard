import { describe, expect, it } from "vitest";
import {
  assertGitPreviewReleaseArtifactSafe,
  assertGitPreviewReleaseDecisionSafe,
  buildGitPreviewReleaseDecision,
  parseGitPreviewReleaseBenchmarkArgs,
  type GitPreviewReleaseBenchmarkArtifact,
} from "../../scripts/git-preview-release-benchmark.mjs";

function artifact(
  runMode: "formal" | "confirmation" = "formal",
  pairedDeltaMs = 3,
): GitPreviewReleaseBenchmarkArtifact {
  const singlePreviewMs = 10;
  const batchPreviewMs = singlePreviewMs - pairedDeltaMs;
  const requiredDeltaMs = 2;
  const passed = pairedDeltaMs >= requiredDeltaMs;
  return {
    batchSize: 2,
    documentCount: 14,
    fixtureId: "working-tree-14x12-mixed",
    measurementCount: 15,
    runMode,
    samples: Array.from({ length: 15 }, (_, sampleIndex) => ({
      batchFirst: sampleIndex % 2 === 1,
      batchPreviewMs,
      documentCount: 14,
      pairedDeltaMs,
      sampleIndex,
      singlePreviewMs,
    })),
    schemaVersion: 2,
    summary: {
      batchPreviewMs: { p50: batchPreviewMs, p95: batchPreviewMs },
      improvementRatio: pairedDeltaMs / singlePreviewMs,
      pairedDeltaMs: { mad: 0, p50: pairedDeltaMs },
      passed,
      requiredDeltaMs,
      singlePreviewMs: { p50: singlePreviewMs, p95: singlePreviewMs },
    },
    variant: "single-vs-batch-two-preview-release",
    verdict: passed ? "go" : "no-go",
    warmupCount: 1,
  };
}

describe("Git preview release benchmark", () => {
  it("parses only the output directory option", () => {
    expect(parseGitPreviewReleaseBenchmarkArgs([])).toEqual({
      out: ".artifacts/perf/imp-445-git-preview-release",
    });
    expect(
      parseGitPreviewReleaseBenchmarkArgs(["--", "--out", "target/probe"]),
    ).toEqual({ out: "target/probe" });
    expect(() => parseGitPreviewReleaseBenchmarkArgs(["--unknown"])).toThrow(
      /Unknown argument/,
    );
  });

  it("accepts only the paired numeric and categorical artifact schema", () => {
    expect(() => assertGitPreviewReleaseArtifactSafe(artifact())).not.toThrow();

    const leaked = artifact();
    leaked.fixtureId = "/private/document.md";
    expect(() => assertGitPreviewReleaseArtifactSafe(leaked)).toThrow(
      /metadata mismatch|private string/,
    );

    const invalid = artifact();
    invalid.samples[0].pairedDeltaMs = Number.NaN;
    expect(() => assertGitPreviewReleaseArtifactSafe(invalid)).toThrow(
      /numeric mismatch|sample mismatch/,
    );
  });

  it("freezes the 15 percent, 2 ms, and two MAD adoption boundary", () => {
    const report = artifact();
    report.samples = report.samples.map((sample, index) => {
      const pairedDeltaMs = index < 7 ? 3 : index === 7 ? 8 : 13;
      return {
        ...sample,
        batchPreviewMs: 40 - pairedDeltaMs,
        pairedDeltaMs,
        singlePreviewMs: 40,
      };
    });
    report.summary.singlePreviewMs.p50 = 40;
    report.summary.singlePreviewMs.p95 = 40;
    report.summary.batchPreviewMs = { p50: 32, p95: 37 };
    report.summary.pairedDeltaMs = { p50: 8, mad: 5 };
    report.summary.requiredDeltaMs = 10;
    report.summary.improvementRatio = 0.2;
    report.summary.passed = false;
    report.verdict = "no-go";
    expect(() => assertGitPreviewReleaseArtifactSafe(report)).not.toThrow();

    report.summary.requiredDeltaMs = 6;
    expect(() => assertGitPreviewReleaseArtifactSafe(report)).toThrow(
      /adoption rule mismatch/,
    );
  });

  it("requires both formal and confirmation runs for the common verdict", () => {
    const go = buildGitPreviewReleaseDecision(
      artifact("formal", 3),
      artifact("confirmation", 3),
    );
    expect(go.verdict).toBe("go");
    expect(() => assertGitPreviewReleaseDecisionSafe(go)).not.toThrow();

    const noGo = buildGitPreviewReleaseDecision(
      artifact("formal", 3),
      artifact("confirmation", 1),
    );
    expect(noGo.verdict).toBe("no-go");
    expect(() => assertGitPreviewReleaseDecisionSafe(noGo)).not.toThrow();

    noGo.verdict = "go";
    expect(() => assertGitPreviewReleaseDecisionSafe(noGo)).toThrow(
      /common decision mismatch/,
    );
  });
});
