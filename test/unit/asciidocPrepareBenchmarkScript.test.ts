import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { asciidocPrepareFixtureIds } from "../../scripts/asciidoc-prepare-benchmark/fixtures.mjs";
import {
  assertAsciiDocPrepareArtifactSafe,
  estimateBoundedConcurrencyMs,
  evaluateHeadroom,
  summarizeSamples,
} from "../../scripts/asciidoc-prepare-benchmark/report.mjs";

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
    expect(script).toContain('"phase-baseline-full-only"');
    expect(probe).toContain("measurementCount = 20");
    expect(probe).toContain("warmupCount = 1");
    expect(probe).toContain("preparePhases");
    expect(probe).toContain("asciiDocWorkerPhaseDurationKeys");
    expect(script).toContain("workerDeliveryMs");
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
