import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildMainViewerRenderSample,
  parseMainViewerRenderBenchmarkArgs,
} from "../../scripts/main-viewer-render-benchmark.mjs";
import {
  mainViewerRenderFixtureIds,
  mainViewerRenderFixtures,
} from "../../scripts/main-viewer-render-benchmark/fixtures.mjs";
import {
  assertMainViewerRenderArtifactSafe,
  buildMainViewerAdoptionComparison,
  buildMainViewerRenderArtifact,
  combineMainViewerFormalConfirmation,
  compareMainViewerBaselineHeadroom,
  evaluateMainViewerHeadroom,
  medianAbsoluteDeviation,
  summarizeDurationSamples,
} from "../../scripts/main-viewer-render-benchmark/report.mjs";
import { resolveLocalImage } from "../../src/adapters/mockHost/files";

function fixedEvents(mediaCount: number): Array<Record<string, unknown>> {
  return [
    {
      event: "render.workerPool.messageReceived",
      sincePostMessageMs: 5,
    },
    {
      event: "render.workerPool.workerMetrics",
      renderCoreMs: 2,
      responsePostDeltaMs: 1,
    },
    {
      event: "render.prepareDocumentHtml.imageResolver",
      durationMs: mediaCount > 0 ? 12 : 0,
      callCount: mediaCount,
      resolvedCount: mediaCount,
      blockedCount: 0,
      errorCount: 0,
      status: mediaCount > 0 ? "used" : "unused",
    },
    {
      event: "render.imageDecode.complete",
      durationMs: mediaCount > 0 ? 8 : 0,
      imageCount: mediaCount,
      decodedCount: mediaCount,
      errorCount: 0,
      status: mediaCount > 0 ? "ready" : "empty",
    },
    { event: "render.commitFrame", durationMs: 4, frame: 1 },
    { event: "render.commitFrame", durationMs: 6, frame: 2 },
    {
      event: "render.layoutStability",
      durationMs: 7,
      frameCount: 2,
      status: "ready",
    },
    {
      event: "render.search.cleanup",
      durationMs: 1,
      markCount: 0,
      status: "complete",
    },
    {
      event: "render.activeHeading.measure",
      durationMs: 1,
      headingCount: 1,
      measurementCount: 1,
      trigger: "initial",
    },
    {
      event: "render.linkInspector.collect",
      durationMs: 1,
      linkCount: 0,
      status: "ready",
    },
    {
      event: "render.linkInspector.build",
      durationMs: 1,
      outgoingCount: 0,
      backlinkCount: 0,
      status: "ready",
    },
    { event: "render.prepareDocumentHtml", durationMs: 20 },
    { event: "render.prepareDocumentHtml.sanitize", durationMs: 2 },
    { event: "render.articleInnerHtmlCommit", durationMs: 1 },
  ].map((event, index) => ({
    ...event,
    captureAtMs: 101 + index,
  }));
}

function benchmarkSample(
  fixture: (typeof mainViewerRenderFixtures)[number],
  sampleIndex: number,
  viewerReadyMs: number,
  resolverMs = 1,
) {
  const built = buildMainViewerRenderSample({
    events: fixedEvents(fixture.expectedMediaCount).map((event) => ({
      ...event,
      captureAtMs: viewerReadyMs - 14 + (event.captureAtMs as number),
    })),
    expectedMediaCount: fixture.expectedMediaCount,
    fixtureId: fixture.fixtureId,
    sampleIndex,
    sampleStartedAt: 100,
    waitCompleted: true,
  });
  return {
    ...built,
    timings: {
      ...built.timings,
      resolverMs,
    },
  };
}

function artifact({
  controlMs = 100,
  mode = "formal",
  targetMs = 100,
}: {
  controlMs?: number;
  mode?: "formal" | "confirmation";
  targetMs?: number;
} = {}) {
  const samples = mainViewerRenderFixtures.flatMap((fixture) =>
    Array.from({ length: 20 }, (_, sampleIndex) =>
      benchmarkSample(
        fixture,
        sampleIndex,
        fixture.fixtureId === "plain-control"
          ? controlMs
          : fixture.fixtureId === "raster-duplicate"
            ? targetMs
            : 100,
        fixture.fixtureId === "raster-duplicate" ? 40 : 1,
      ),
    ),
  );
  return buildMainViewerRenderArtifact({
    fixtures: mainViewerRenderFixtures,
    mode,
    runtime: "chromium-vite-production",
    samples,
  });
}

describe("Main Viewer render benchmark", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("keeps one warmup, twenty round-robin measurements, and a fixed CLI", () => {
    const script = fs.readFileSync(
      path.join(process.cwd(), "scripts/main-viewer-render-benchmark.mjs"),
      "utf8",
    );
    expect(script).toContain("const warmupCount = 1");
    expect(script).toContain("const formalMeasurementCount = 20");
    expect(script).toContain("rotatedFixtures(sampleIndex)");
    expect(script).toContain("imp-560-${fixture.fixtureId}.md");
    expect(script).not.toContain("${iterationLabel}");
    expect(script).toContain("nextUpdatedAt: updatedAt");
    expect(parseMainViewerRenderBenchmarkArgs([])).toEqual({
      baseline: null,
      confirmation: null,
      headroomFormal: null,
      out: ".artifacts/perf/imp-560-main-viewer-render-formal.json",
      port: 4297,
      runMode: "formal",
      smoke: false,
      url: null,
    });
    expect(
      parseMainViewerRenderBenchmarkArgs([
        "--baseline",
        "baseline.json",
        "--confirmation",
        "formal.json",
        "--run-mode",
        "confirmation",
        "--out",
        "confirmation.json",
      ]),
    ).toMatchObject({
      baseline: "baseline.json",
      confirmation: "formal.json",
      out: "confirmation.json",
      runMode: "confirmation",
    });
    expect(() =>
      parseMainViewerRenderBenchmarkArgs([
        "--confirmation",
        "formal.json",
        "--run-mode",
        "confirmation",
      ]),
    ).toThrow("requires --baseline");
    expect(() =>
      parseMainViewerRenderBenchmarkArgs(["--samples", "2"]),
    ).toThrow("Unknown argument");
  });

  it("locks the six privacy-safe fixture categories", () => {
    expect(mainViewerRenderFixtureIds).toEqual([
      "plain-control",
      "dom-dense",
      "svg-one",
      "raster-duplicate",
      "raster-unique",
      "raster-near-5-mib",
    ]);
    expect(
      mainViewerRenderFixtures.map((fixture) => fixture.expectedMediaCount),
    ).toEqual([0, 0, 1, 8, 6, 1]);
    expect(
      mainViewerRenderFixtures.map((fixture) => fixture.sizeBucket),
    ).toEqual([
      "none",
      "none",
      "under-64-kib",
      "64-kib-to-1-mib",
      "64-kib-to-1-mib",
      "1-mib-to-5-mib",
    ]);
  });

  it("extracts only aggregate event timings and counts", () => {
    const sample = buildMainViewerRenderSample({
      events: fixedEvents(1),
      expectedMediaCount: 1,
      fixtureId: "svg-one",
      sampleIndex: 0,
      sampleStartedAt: 100,
      waitCompleted: true,
    });
    expect(sample).toMatchObject({
      counts: {
        decodedCount: 1,
        htmlCommitCount: 1,
        layoutTimeoutCount: 0,
        linkInspectorBuildCount: 1,
        linkInspectorCollectCount: 1,
        mediaElementCount: 1,
        resolverCallCount: 1,
        resolverResolvedCount: 1,
        staleDecodeCount: 0,
      },
      status: "ok",
      timings: {
        activeHeadingMs: 1,
        decodeMs: 8,
        postCommitMs: 4,
        resolverMs: 12,
        viewerReadyMs: 14,
        workerCoreMs: 2,
        workerDeliveryMs: 4,
      },
    });
    expect(
      buildMainViewerRenderSample({
        events: fixedEvents(1).filter(
          (event) => event.event !== "render.layoutStability",
        ),
        expectedMediaCount: 1,
        fixtureId: "svg-one",
        sampleIndex: 0,
        sampleStartedAt: 100,
        waitCompleted: false,
      }).status,
    ).toBe("incomplete");
  });

  it("sums repeated link inspector work within one document generation", () => {
    const events = fixedEvents(0);
    const build = events.find(
      (event) => event.event === "render.linkInspector.build",
    );
    const collect = events.find(
      (event) => event.event === "render.linkInspector.collect",
    );
    if (!build || !collect) throw new Error("Missing inspector fixtures");
    const sample = buildMainViewerRenderSample({
      events: [
        ...events,
        { ...collect, durationMs: 2, captureAtMs: 116 },
        { ...build, durationMs: 3, captureAtMs: 117 },
      ],
      expectedMediaCount: 0,
      fixtureId: "dom-dense",
      sampleIndex: 0,
      sampleStartedAt: 100,
      waitCompleted: true,
    });
    expect(sample).toMatchObject({
      counts: {
        linkInspectorBuildCount: 2,
        linkInspectorCollectCount: 2,
      },
      timings: {
        linkInspectorBuildMs: 4,
        linkInspectorCollectMs: 3,
        postCommitMs: 9,
      },
    });
  });

  it("fails closed on double commit, stale decode, and layout timeout", () => {
    const sample = (events: Array<Record<string, unknown>>) =>
      buildMainViewerRenderSample({
        events,
        expectedMediaCount: 1,
        fixtureId: "svg-one",
        sampleIndex: 0,
        sampleStartedAt: 100,
        waitCompleted: true,
      });
    expect(
      sample([
        ...fixedEvents(1),
        {
          captureAtMs: 120,
          durationMs: 1,
          event: "render.articleInnerHtmlCommit",
        },
      ]),
    ).toMatchObject({
      counts: { htmlCommitCount: 2 },
      status: "incomplete",
    });
    expect(
      sample([
        ...fixedEvents(1),
        {
          captureAtMs: 120,
          decodedCount: 0,
          durationMs: 2,
          errorCount: 0,
          event: "render.imageDecode.complete",
          imageCount: 1,
          status: "stale",
        },
      ]),
    ).toMatchObject({
      counts: { staleDecodeCount: 1 },
      status: "incomplete",
    });
    expect(
      sample(
        fixedEvents(1).map((event) =>
          event.event === "render.layoutStability"
            ? { ...event, status: "timeout" }
            : event,
        ),
      ),
    ).toMatchObject({
      counts: { layoutTimeoutCount: 1 },
      status: "incomplete",
    });
  });

  it("uses parent p50, two milliseconds, twice MAD, and conservative headroom", () => {
    const parent = Array.from({ length: 20 }, (_, index) => 100 + (index % 2));
    expect(
      evaluateMainViewerHeadroom({
        candidatePhase: "image-resolver",
        fixtureId: "raster-duplicate",
        parentValues: parent,
        phaseValues: Array.from({ length: 20 }, () => 40),
      }),
    ).toMatchObject({
      conservativeHeadroomMs: 20,
      decision: "go",
      noiseFloorMs: 2,
      reason: "headroom-confirmed",
      requiredSavingMs: 15,
    });
    expect(
      evaluateMainViewerHeadroom({
        candidatePhase: "image-resolver",
        fixtureId: "raster-duplicate",
        parentValues: parent,
        phaseValues: Array.from({ length: 20 }, () => 20),
      }),
    ).toMatchObject({ decision: "no-go", reason: "insufficient-headroom" });
    expect(medianAbsoluteDeviation([2, 4, 5, 8, 20])).toBe(3);
  });

  it("records raw samples plus p50, p95, and MAD", () => {
    expect(summarizeDurationSamples([1, 2, 3, 4, 100])).toEqual({
      count: 5,
      samplesMs: [1, 2, 3, 4, 100],
      minMs: 1,
      maxMs: 100,
      p50Ms: 3,
      p95Ms: 100,
      madMs: 1,
    });
  });

  it("adopts only with 15 percent p50, p95 noise saving, and control non-regression", () => {
    const baseline = artifact();
    const current = artifact({ controlMs: 101, targetMs: 80 });
    expect(buildMainViewerAdoptionComparison(baseline, current)).toMatchObject({
      candidatePhase: "image-resolver",
      contractStatus: "matched",
      controlP95RegressionMs: 1,
      p50ImprovementPercent: 20,
      p95SavingMs: 20,
      reasons: [],
      status: "go",
      targetFixtureId: "raster-duplicate",
    });

    expect(
      buildMainViewerAdoptionComparison(
        baseline,
        artifact({ controlMs: 111, targetMs: 90 }),
      ),
    ).toMatchObject({
      reasons: expect.arrayContaining([
        "target-p50-improvement-below-15-percent",
        "control-p95-regression-above-noise-floor",
        "control-p95-regression-above-10-percent",
      ]),
      status: "no-go",
    });

    expect(
      buildMainViewerAdoptionComparison(baseline, {
        ...current,
        runtime: "chromium-external-url",
      }),
    ).toMatchObject({
      reasons: ["runtime-mismatch"],
      status: "needs-decision",
    });
    expect(() =>
      buildMainViewerAdoptionComparison(
        { ...baseline, schemaVersion: "wrong-schema" },
        current,
      ),
    ).toThrow("schema mismatch");
  });

  it("requires matching formal and confirmation decisions", () => {
    const baseline = artifact();
    const formalRun = artifact({ controlMs: 101, targetMs: 80 });
    const confirmationRun = artifact({
      controlMs: 101,
      mode: "confirmation",
      targetMs: 80,
    });
    const formal = {
      ...formalRun,
      adoption: buildMainViewerAdoptionComparison(baseline, formalRun),
    };
    const confirmation = {
      ...confirmationRun,
      adoption: buildMainViewerAdoptionComparison(
        artifact({ mode: "confirmation" }),
        confirmationRun,
      ),
    };
    expect(
      combineMainViewerFormalConfirmation(formal, confirmation),
    ).toMatchObject({
      confirmationDecision: {
        candidatePhase: "image-resolver",
        reason: "confirmed",
        status: "go",
        targetFixtureId: "raster-duplicate",
      },
    });
  });

  it("confirms baseline headroom in a separate Chromium process", () => {
    const baselineFormal = artifact();
    const baselineConfirmation = artifact({ mode: "confirmation" });
    expect(
      compareMainViewerBaselineHeadroom(baselineFormal, baselineConfirmation),
    ).toMatchObject({
      candidatePhase: "image-resolver",
      contractStatus: "matched",
      reason: "headroom-confirmed",
      status: "go",
      targetFixtureId: "raster-duplicate",
    });
  });

  it("rejects payload-like fields, paths, and uncontrolled strings", () => {
    const safe = artifact();
    expect(() => assertMainViewerRenderArtifactSafe(safe)).not.toThrow();
    const serialized = JSON.stringify(safe).toLowerCase();
    for (const forbidden of [
      "captureatms",
      "documentpath",
      "resolvedpath",
      "source",
      "renderedhtml",
      "htmlbody",
      "htmlpayload",
      "base64",
      "content",
      "/private/",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(() =>
      assertMainViewerRenderArtifactSafe({
        schemaVersion: "imp-560-main-viewer-render-v1",
        documentPath: "/private/workspace/secret.md",
      }),
    ).toThrow("unsafe key");
    expect(() =>
      assertMainViewerRenderArtifactSafe({
        schemaVersion: "imp-560-main-viewer-render-v1",
        htmlBody: "<p>private source body</p>",
      }),
    ).toThrow("unsafe key");
    expect(() =>
      assertMainViewerRenderArtifactSafe({
        schemaVersion: "imp-560-main-viewer-render-v1",
        status: "private source body",
      }),
    ).toThrow("uncontrolled text");
  });

  it("isolates deterministic raster payloads to the benchmark scenario", async () => {
    const documentPath = "/workspace/docs/benchmark.md";
    const context = {
      documentDir: "/workspace/docs",
      resourceRoots: ["/workspace"],
      workspaceRoot: "/workspace",
    };
    expect(
      await resolveLocalImage(
        "assets/imp-560-raster-1.png",
        documentPath,
        context,
      ),
    ).toMatchObject({ status: "blocked" });

    window.history.replaceState(
      {},
      "",
      "/?scenario=imp-560-main-viewer-render",
    );
    const first = await resolveLocalImage(
      "assets/imp-560-raster-1.png",
      documentPath,
      context,
    );
    const second = await resolveLocalImage(
      "assets/imp-560-raster-2.png",
      documentPath,
      context,
    );
    const large = await resolveLocalImage(
      "assets/imp-560-raster-near-5-mib.png",
      documentPath,
      context,
    );
    expect(first).toMatchObject({
      encoding: "base64",
      mediaType: "image/png",
      status: "resolved",
    });
    expect(second).toMatchObject({ status: "resolved" });
    expect(large).toMatchObject({ status: "resolved" });
    if (
      first.status !== "resolved" ||
      second.status !== "resolved" ||
      large.status !== "resolved"
    ) {
      throw new Error("Expected resolved IMP-560 benchmark rasters");
    }
    if (typeof large.content !== "string") {
      throw new Error("Expected encoded IMP-560 benchmark raster content");
    }
    expect(first.content).not.toBe(second.content);
    const decoded = Buffer.from(large.content, "base64");
    expect([...decoded.subarray(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(decoded.byteLength).toBeGreaterThan(4.5 * 1024 * 1024);
    expect(decoded.byteLength).toBeLessThan(5 * 1024 * 1024);
  });
});
