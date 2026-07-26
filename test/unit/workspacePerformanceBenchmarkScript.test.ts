// @ts-expect-error The benchmark runner is a Node ESM script tested directly.
import * as benchmark from "../../scripts/workspace-performance-benchmark.mjs";
import { describe, expect, it, vi } from "vitest";

const {
  deriveDocumentRenderCacheResult,
  deriveWorkspaceBootResult,
  normalizeWorkspaceBootSample,
  normalizeDocumentRenderCacheSample,
  parseArgs,
  percentile,
  runWorkspaceBootBenchmark,
  runDocumentRenderCacheBenchmark,
  summarizeDocumentRenderCacheBenchmark,
  summarizeWorkspaceBootBenchmark,
  validatePrivacy,
  documentRenderCacheBenchmarkPlan,
  workspaceBootBenchmarkPlan,
  workspaceBootScenarioUrl,
} = benchmark;

const renderCachePhaseNames = [
  "cold-a",
  "cold-b",
  "revisit-a",
  "theme-a",
  "reload-a",
];

function documentRenderCacheSample(offset = 0) {
  return {
    schemaVersion: 2,
    scenarioId: "viewer-render-cache-tab-revisit",
    status: "ok",
    phases: Object.fromEntries(
      renderCachePhaseNames.map((phase, index) => [
        phase,
        {
          durationMs: offset + index + 1,
          coreProducerCount:
            phase === "revisit-a" || phase === "theme-a" ? 0 : 1,
          prepareProducerCount:
            phase === "revisit-a" || phase === "theme-a" ? 0 : 1,
          articleCommitCount: 1,
          cacheEventCount: 2,
          cacheHitCount: phase === "revisit-a" || phase === "theme-a" ? 2 : 0,
          cacheMissCount: phase === "revisit-a" || phase === "theme-a" ? 0 : 2,
          inFlightCount: 0,
          inFlightActiveCountFinal: 0,
          inFlightSnapshotCount: 2,
          coreHitCount: phase === "revisit-a" || phase === "theme-a" ? 1 : 0,
          preparedHitCount:
            phase === "revisit-a" || phase === "theme-a" ? 1 : 0,
          admissionEstimatedBytesMax: 2048,
          residentBytesMax: 8192,
          entryCountMax: 2,
          evictionCount: 0,
        },
      ]),
    ),
  };
}

function workspaceBootSample(
  profile: "fast" | "normal",
  offset: number,
  orderViolationCount = 0,
) {
  return {
    schemaVersion: 1,
    scenarioId: "viewer-workspace-boot-first-content",
    status: "ok",
    profile,
    phases: {
      initialDocumentOpenedMs: offset + 1,
      documentRenderStartedMs: offset + 2,
      firstDocumentFrameMs: offset + 3,
      rootDirectoryReadyMs: offset + 4,
      expandedDirectoriesReadyMs: offset + 5,
      treeSettledMs: offset + 6,
    },
    entryCount: 12,
    orderViolationCount,
  };
}

describe("workspace performance benchmark script", () => {
  it("parses benchmark profiles and output path", () => {
    expect(parseArgs(["--profile", "diagnostic", "--out", "tmp/out"])).toEqual({
      out: "tmp/out",
      profile: "diagnostic",
    });
    expect(parseArgs([])).toEqual({ out: null, profile: "quick" });
    expect(() => parseArgs(["--profile", "wsl"])).toThrow(
      "Unsupported profile",
    );
  });

  it("calculates percentiles with finite numeric values only", () => {
    expect(percentile([10, 2, 30, Number.NaN, 20], 50)).toBe(10);
    expect(percentile([10, 2, 30, 20], 95)).toBe(30);
    expect(percentile([], 95)).toBeNull();
  });

  it("plans one warmup and seven interleaved measurements per startup profile", () => {
    const plan = workspaceBootBenchmarkPlan();
    expect(plan).toHaveLength(16);
    expect(plan.slice(0, 2)).toEqual([
      { kind: "warmup", profile: "fast" },
      { kind: "warmup", profile: "normal" },
    ]);
    for (const profile of ["fast", "normal"]) {
      expect(
        plan.filter(
          (run: { kind: string; profile: string }) =>
            run.kind === "warmup" && run.profile === profile,
        ),
      ).toHaveLength(1);
      expect(
        plan.filter(
          (run: { kind: string; profile: string }) =>
            run.kind === "measurement" && run.profile === profile,
        ),
      ).toHaveLength(7);
    }
    const scenarioUrl = new URL(
      workspaceBootScenarioUrl("http://127.0.0.1:4173", "normal"),
    );
    expect(scenarioUrl.searchParams.get("scenario")).toBe(
      "viewer-workspace-boot-first-content",
    );
    expect(scenarioUrl.searchParams.get("bootTreeProfile")).toBe("normal");
    expect(scenarioUrl.searchParams.has("workspaceTreeDelayMs")).toBe(false);
    expect(scenarioUrl.searchParams.has("workspaceBootBenchmarkRunId")).toBe(
      false,
    );
  });

  it("normalizes the startup collector through a fixed privacy-safe allowlist", () => {
    const normalized = normalizeWorkspaceBootSample(
      {
        ...workspaceBootSample("normal", 10),
        privatePath: "/Users/example/private.md",
        sourceText: "private source",
      },
      "normal",
    );
    expect(normalized).toMatchObject({
      entryCount: 12,
      orderViolationCount: 0,
      phases: workspaceBootSample("normal", 10).phases,
      profile: "normal",
      status: "ok",
    });
    expect(JSON.stringify(normalized)).not.toContain("privatePath");
    expect(JSON.stringify(normalized)).not.toContain("sourceText");
    expect(() =>
      normalizeWorkspaceBootSample(workspaceBootSample("fast", 0), "normal"),
    ).toThrow("contract mismatch");
  });

  it("aggregates startup phases and uses normal first-frame p50 as duration", () => {
    const report = {
      status: "ok",
      profiles: {
        fast: Array.from({ length: 7 }, (_, index) =>
          workspaceBootSample("fast", index + 1),
        ),
        normal: Array.from({ length: 7 }, (_, index) =>
          workspaceBootSample("normal", index + 21),
        ),
      },
    };
    const summary = summarizeWorkspaceBootBenchmark(report, "full");
    const result = deriveWorkspaceBootResult(summary);

    expect(summary).toMatchObject({
      measurementCountPerProfile: 7,
      reason: null,
      status: "ok",
      warmupCountPerProfile: 1,
    });
    expect(summary.profiles.normal.phases.firstDocumentFrameMs).toMatchObject({
      count: 7,
      p50Ms: 27,
      p95Ms: 30,
    });
    expect(summary.profiles.normal.phases.treeSettledMs).toMatchObject({
      p50Ms: 30,
      p95Ms: 33,
    });
    expect(result).toMatchObject({
      durationMs: 27,
      eventCount: 84,
      id: "workspace-boot-first-content",
      metric: "normal.firstDocumentFrameMs.p50",
      status: "ok",
    });
    expect(result.phaseBreakdown).toContainEqual({
      details: {
        entryCountMax: 12,
        entryCountMin: 12,
        orderViolationCount: 0,
        p50Ms: 30,
        p95Ms: 33,
        sampleCount: 7,
      },
      durationMs: 30,
      name: "normal-tree-settled",
      status: "ok",
    });
    expect(validatePrivacy({ result, summary })).toEqual([]);
  });

  it("records fast and normal phase order without treating it as the stress gate", () => {
    const summary = summarizeWorkspaceBootBenchmark(
      {
        status: "ok",
        profiles: {
          fast: Array.from({ length: 7 }, (_, index) =>
            workspaceBootSample("fast", index, index === 0 ? 1 : 0),
          ),
          normal: Array.from({ length: 7 }, (_, index) =>
            workspaceBootSample("normal", index + 10),
          ),
        },
      },
      "diagnostic",
    );
    expect(summary).toMatchObject({
      reason: null,
      status: "ok",
    });
    expect(summary.profiles.fast.orderViolationCount).toBe(1);
    expect(deriveWorkspaceBootResult(summary)).toMatchObject({
      reason: null,
      status: "ok",
    });
  });

  it("reports a collector failure without requiring partial phase samples", () => {
    const summary = summarizeWorkspaceBootBenchmark(
      {
        reason: "missing-phase",
        status: "failed",
      },
      "full",
    );
    expect(deriveWorkspaceBootResult(summary)).toMatchObject({
      durationMs: null,
      id: "workspace-boot-first-content",
      reason: "missing-phase",
      status: "failed",
    });
  });

  it("reuses one browser context for all startup warmups and measurements", async () => {
    let currentProfile: "fast" | "normal" = "fast";
    let sampleOffset = 0;
    const page = {
      goto: vi.fn(async (url: string) => {
        currentProfile = new URL(url).searchParams.get("bootTreeProfile") as
          | "fast"
          | "normal";
      }),
      waitForFunction: vi.fn(async () => {}),
      evaluate: vi.fn(async () =>
        workspaceBootSample(currentProfile, sampleOffset++),
      ),
    };
    const context = {
      close: vi.fn(async () => {}),
      grantPermissions: vi.fn(async () => {}),
      newPage: vi.fn(async () => page),
    };
    const browser = {
      close: vi.fn(async () => {}),
      newContext: vi.fn(async () => context),
    };
    const installCollector = vi.fn(async () => {});
    const launchBrowser = vi.fn(async () => browser);

    const report = await runWorkspaceBootBenchmark({
      baseURL: "http://127.0.0.1:4173",
      installCollector,
      launchBrowser,
    });

    expect(report.status).toBe("ok");
    expect(report.profiles.fast).toHaveLength(7);
    expect(report.profiles.normal).toHaveLength(7);
    expect(launchBrowser).toHaveBeenCalledTimes(1);
    expect(browser.newContext).toHaveBeenCalledTimes(1);
    expect(context.newPage).toHaveBeenCalledTimes(1);
    expect(installCollector).toHaveBeenCalledTimes(1);
    expect(page.goto).toHaveBeenCalledTimes(16);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("marks an unavailable startup collector as skipped and closes the context", async () => {
    const timeout = new Error("Timed out waiting for collector");
    timeout.name = "TimeoutError";
    const page = {
      goto: vi.fn(async () => {}),
      waitForFunction: vi.fn(async () => {
        throw timeout;
      }),
    };
    const context = {
      close: vi.fn(async () => {}),
      grantPermissions: vi.fn(async () => {}),
      newPage: vi.fn(async () => page),
    };
    const browser = {
      close: vi.fn(async () => {}),
      newContext: vi.fn(async () => context),
    };

    const report = await runWorkspaceBootBenchmark({
      baseURL: "http://127.0.0.1:4173",
      installCollector: vi.fn(async () => {}),
      launchBrowser: vi.fn(async () => browser),
    });

    expect(report).toMatchObject({
      reason: "workspace-boot-collector-unavailable",
      status: "skipped",
    });
    expect(page.goto).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(validatePrivacy(report)).toEqual([]);
  });

  it("normalizes and aggregates the document render cache collector allowlist", () => {
    const normalized = normalizeDocumentRenderCacheSample({
      ...documentRenderCacheSample(10),
      cacheKey: "private-key",
      sourceText: "private source",
      path: "/Users/example/private.md",
    });
    expect(normalized).toMatchObject({ status: "ok" });
    expect(normalized.phases["revisit-a"]).toMatchObject({
      coreProducerCount: 0,
      prepareProducerCount: 0,
      coreHitCount: 1,
      preparedHitCount: 1,
      inFlightActiveCountFinal: 0,
      inFlightSnapshotCount: 2,
    });
    expect(JSON.stringify(normalized)).not.toContain("private-key");
    expect(JSON.stringify(normalized)).not.toContain("private source");
    expect(JSON.stringify(normalized)).not.toContain("/Users/");

    const report = {
      status: "ok",
      samples: Array.from({ length: 7 }, (_, index) =>
        normalizeDocumentRenderCacheSample(documentRenderCacheSample(index)),
      ),
    };
    const summary = summarizeDocumentRenderCacheBenchmark(report, "full");
    const result = deriveDocumentRenderCacheResult(summary);
    expect(summary).toMatchObject({
      measurementCount: 7,
      reason: null,
      status: "ok",
      warmupCount: 1,
    });
    expect(summary.phases["revisit-a"].duration).toMatchObject({
      count: 7,
      p50Ms: 6,
      p95Ms: 9,
    });
    expect(result).toMatchObject({
      durationMs: 6,
      eventCount: 35,
      id: "document-render-cache-tab-revisit",
      metric: "revisit-a.durationMs.p50",
      status: "ok",
    });
    expect(validatePrivacy({ result, summary })).toEqual([]);
  });

  it("reuses one browser context for one cache warmup and seven measurements", async () => {
    const plan = documentRenderCacheBenchmarkPlan();
    expect(plan).toHaveLength(8);
    expect(
      plan.filter((run: { kind: string }) => run.kind === "warmup"),
    ).toHaveLength(1);
    expect(
      plan.filter((run: { kind: string }) => run.kind === "measurement"),
    ).toHaveLength(7);
    let offset = 0;
    const page = {};
    const context = {
      close: vi.fn(async () => {}),
      grantPermissions: vi.fn(async () => {}),
      newPage: vi.fn(async () => page),
    };
    const browser = {
      close: vi.fn(async () => {}),
      newContext: vi.fn(async () => context),
    };
    const installCollector = vi.fn(async () => {});
    const runScenario = vi.fn(async () => documentRenderCacheSample(offset++));

    const report = await runDocumentRenderCacheBenchmark({
      baseURL: "http://127.0.0.1:4173",
      installCollector,
      launchBrowser: vi.fn(async () => browser),
      runScenario,
    });

    expect(report.status).toBe("ok");
    expect(report.samples).toHaveLength(7);
    expect(installCollector).toHaveBeenCalledTimes(1);
    expect(runScenario).toHaveBeenCalledTimes(8);
    expect(context.newPage).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });
});
