import { describe, expect, it } from "vitest";
import {
  assertGitStreamPreviewArtifactSafe,
  parseGitStreamPreviewBenchmarkArgs,
} from "../../scripts/git-stream-preview-release-benchmark.mjs";

function route(route: "branch" | "commit") {
  const sample = {
    sampleIndex: 0,
    batchFirst: false,
    singlePreviewMs: 10,
    batchPreviewMs: 6,
    pairedDeltaMs: 4,
    repositorySetupMs: 1,
    revisionSetupMs: 1,
    previewBuildMs: 4,
  };
  return {
    route,
    fixtureId: `${route}-14x12-mixed`,
    variant: "single-vs-batch-two-release",
    samples: Array.from({ length: 15 }, (_, sampleIndex) => ({
      ...sample,
      sampleIndex,
      batchFirst: sampleIndex % 2 === 1,
    })),
    summary: {
      singlePreviewMs: { p50: 10, p95: 11 },
      batchPreviewMs: { p50: 6, p95: 7 },
      pairedDeltaMs: { p50: 4, mad: 0.2 },
      repositorySetupMs: { p50: 1, p95: 1.2 },
      revisionSetupMs: { p50: 1, p95: 1.2 },
      previewBuildMs: { p50: 4, p95: 4.5 },
      requiredDeltaMs: 2,
      improvementRatio: 0.4,
      passed: true,
    },
    verdict: "go",
  };
}

describe("Git stream preview release benchmark", () => {
  it("parses formal and confirmation arguments", () => {
    expect(
      parseGitStreamPreviewBenchmarkArgs(["--out", ".artifacts/formal.json"]),
    ).toEqual({ confirmation: null, out: ".artifacts/formal.json" });
    expect(
      parseGitStreamPreviewBenchmarkArgs([
        "--confirmation",
        ".artifacts/formal.json",
      ]),
    ).toMatchObject({ confirmation: ".artifacts/formal.json" });
  });

  it("accepts numeric allowlisted reports and rejects private strings", () => {
    const report = {
      schemaVersion: 1,
      runMode: "formal",
      warmupCount: 1,
      measurementCount: 15,
      documentCount: 14,
      batchSize: 2,
      routes: [route("branch"), route("commit")],
    };
    expect(assertGitStreamPreviewArtifactSafe(report)).toBe(report);
    expect(() =>
      assertGitStreamPreviewArtifactSafe({
        ...report,
        privateValue: "/private/repository",
      }),
    ).toThrow(/private text/);
  });
});
