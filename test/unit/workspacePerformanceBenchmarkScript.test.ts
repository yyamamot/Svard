// @ts-expect-error The benchmark runner is a Node ESM script tested directly.
import * as benchmark from "../../scripts/workspace-performance-benchmark.mjs";
import { describe, expect, it, vi } from "vitest";

const {
  buildSummary,
  deriveDocumentRenderCacheResult,
  deriveUiReviewResults,
  deriveWorkspaceBootResult,
  fillMissingWorkflows,
  normalizeWorkspaceBootSample,
  normalizeDocumentRenderCacheSample,
  parseArgs,
  percentile,
  reportMarkdown,
  runWorkspaceBootBenchmark,
  runDocumentRenderCacheBenchmark,
  summarizeDocumentRenderCacheBenchmark,
  summarizeWorkspaceBootBenchmark,
  summarizeEvents,
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

  it("summarizes known perf trace categories without private payload fields", () => {
    const summary = summarizeEvents([
      { event: "render.prepareDocumentHtml", durationMs: 4.2 },
      { event: "sourceControl.getGitChanges", durationMs: 9.1 },
      { event: "postDiffGitMarkers.initialContext", durationMs: 3 },
      { event: "workspaceBoot.listRootDirectory", durationMs: 12 },
      { event: "viewer.render", durationMs: 1 },
    ]);

    expect(summary.count).toBe(5);
    expect(summary.byCategory.render.count).toBe(2);
    expect(summary.byCategory["git/source-control"].count).toBe(1);
    expect(summary.byCategory["change-review"].count).toBe(1);
    expect(summary.byCategory.filesystem.count).toBe(1);
    expect(JSON.stringify(summary)).not.toContain("/Users/");
    expect(JSON.stringify(summary)).not.toContain("sourceText");
  });

  it("builds a workspace benchmark summary from existing probe reports", () => {
    const summary = buildSummary({
      profile: "diagnostic",
      markdownReport: {
        diagnosticSequence: [
          {
            events: [
              { event: "render.renderDocument", durationMs: 5 },
              { event: "sourceControl.getGitChanges", durationMs: 8 },
            ],
          },
        ],
        phases: [
          {
            documents: [
              {
                basename: "plain-small.md",
                domReadyMs: 20,
                events: [{ event: "render.renderDocument", durationMs: 3 }],
              },
            ],
            phase: "bootWarmBeforeOpen",
          },
          {
            documents: [
              { basename: "plain-small.md", domReadyMs: 10, events: [] },
              { basename: "01-specification.md", domReadyMs: 40, events: [] },
            ],
            phase: "repeatedWarm",
          },
        ],
        summary: { firstOpenPenaltyMs: 10 },
      },
      asciidocReport: {
        summary: {
          averages: { totalRenderPrepareMs: 75 },
          document: { basename: "large-generated.adoc" },
        },
      },
      sourceReport: {
        phases: [
          {
            itemCount: 7,
            metrics: { durationMs: 18 },
            phase: "initialLimit",
          },
          {
            itemCount: 7,
            metrics: { durationMs: 2 },
            phase: "sameHeadCacheHit",
          },
        ],
      },
      uiReports: [
        {
          durationMs: 1234,
          report: {
            assertionFailures: [],
            benchmarkPhases: [
              { durationMs: 12, name: "document-open", status: "ok" },
            ],
            assertions: { renderedDiffVisible: true },
            captureMetrics: { scenarioMs: 320 },
            outcome: "passed",
          },
          scenario: "viewer-rendered-diff-quality",
          status: "ok",
          workflowId: "diff-preview-open",
        },
      ],
    });

    expect(summary.schemaVersion).toBe(1);
    expect(summary.workflows).toHaveLength(15);
    expect(
      summary.workflows.find(
        (item: { id: string }) => item.id === "asciidoc-render",
      )?.durationMs,
    ).toBe(75);
    expect(
      summary.workflows.find(
        (item: { id: string }) => item.id === "file-history",
      )?.durationMs,
    ).toBe(2);
    expect(
      summary.workflows.find(
        (item: { id: string }) => item.id === "diff-preview-open",
      )?.durationMs,
    ).toBe(320);
    expect(
      summary.workflows.find(
        (item: { id: string }) => item.id === "diff-preview-open",
      )?.phaseBreakdown,
    ).toEqual([{ durationMs: 12, name: "document-open", status: "ok" }]);
    expect(summary.bottleneckCandidates[0]).toMatchObject({
      id: "diff-preview-open",
      category: "diff-preview",
    });
  });

  it("derives UI review workflow results without exposing artifact paths", () => {
    const results = deriveUiReviewResults([
      {
        durationMs: 420,
        report: {
          assertionFailures: [],
          assertions: { markerVisible: true },
          benchmarkPhases: [
            { durationMs: 4, name: "highlight-complete", status: "ok" },
            { durationMs: 8, name: "result-list-rendered", status: "ok" },
            { durationMs: 1, name: "active-hit-update", status: "ok" },
            { durationMs: 12, name: "hit-scroll", status: "ok" },
          ],
          captureMetrics: { scenarioMs: 210 },
          outcome: "passed",
          postDiffMarkerSummary: {
            markerCount: 2,
            tableSummary: { tableCellMarkerCount: 3 },
          },
        },
        scenario: "viewer-normal-git-markers-table-cell-markdown-diagnosis",
        status: "ok",
        workflowId: "change-review-marker-generation",
      },
      {
        durationMs: 99,
        report: {
          assertionFailures: ["searchVisible"],
          assertions: { searchVisible: false },
          outcome: "failed",
        },
        scenario: "viewer-search",
        status: "failed",
        workflowId: "current-file-search",
      },
    ]);

    expect(results[0]).toMatchObject({
      durationMs: 210,
      eventCount: 5,
      id: "change-review-marker-generation",
      metric: "uiScenario.scenarioMs",
      source:
        "ui-review:viewer-normal-git-markers-table-cell-markdown-diagnosis",
      status: "ok",
    });
    expect(results[0].phaseBreakdown).toEqual([
      { durationMs: 4, name: "highlight-complete", status: "ok" },
      { durationMs: 8, name: "result-list-rendered", status: "ok" },
      { durationMs: 1, name: "active-hit-update", status: "ok" },
      { durationMs: 12, name: "hit-scroll", status: "ok" },
    ]);
    expect(results[1]).toMatchObject({
      id: "current-file-search",
      reason: "ui-scenario-assertion-failure",
      status: "failed",
    });
    expect(validatePrivacy(results)).toEqual([]);
  });

  it("fills missing workflow measurements with explicit skipped reasons", () => {
    const workflows = fillMissingWorkflows(
      [
        {
          category: "render",
          durationMs: 10,
          eventCount: 1,
          fixtureId: "fixture",
          id: "markdown-render",
          metric: "durationMs",
          reason: null,
          source: "test",
          status: "ok",
        },
      ],
      "quick",
    );

    expect(workflows).toHaveLength(15);
    expect(
      workflows.find((item: { id: string }) => item.id === "workspace-search"),
    ).toMatchObject({
      reason: "not-measured-in-quick-profile",
      status: "skipped",
    });
  });

  it("skips the startup workflow explicitly in the quick profile", () => {
    const summary = buildSummary({
      profile: "quick",
      markdownReport: null,
      asciidocReport: null,
      sourceReport: null,
    });
    expect(summary.workspaceBootFirstContent).toMatchObject({
      profiles: {},
      reason: "not-measured-in-quick-profile",
      status: "skipped",
    });
    expect(summary.documentRenderCacheTabRevisit).toMatchObject({
      phases: {},
      reason: "not-measured-in-quick-profile",
      status: "skipped",
    });
    expect(
      summary.workflows.find(
        (workflow: { id: string }) =>
          workflow.id === "workspace-boot-first-content",
      ),
    ).toMatchObject({
      reason: "not-measured-in-quick-profile",
      status: "skipped",
    });
    expect(
      summary.workflows.find(
        (workflow: { id: string }) =>
          workflow.id === "document-render-cache-tab-revisit",
      ),
    ).toMatchObject({
      reason: "not-measured-in-quick-profile",
      status: "skipped",
    });
  });

  it("rejects private values in benchmark summaries and reports safe markdown", () => {
    expect(
      validatePrivacy({
        fixtureId: "plain-small.md",
        source: "perf:markdown",
      }),
    ).toEqual([]);
    expect(validatePrivacy({ path: "/Users/example/private.md" })).toContain(
      "absolute-private-path",
    );
    expect(
      validatePrivacy({ endpoint: "https://example.com/kroki" }),
    ).toContain("endpoint-url");
    expect(validatePrivacy({ hunk: "@@ -1 +1 @@" })).toContain("diff-hunk");

    const report = reportMarkdown(
      buildSummary({
        profile: "quick",
        markdownReport: null,
        asciidocReport: null,
        sourceReport: null,
      }),
    );
    expect(report).toContain("# Workspace Performance Benchmark");
    expect(report).toContain("not-measured-in-quick-profile");
    expect(report).not.toContain("/Users/");
  });

  it("prints phase breakdown lines in benchmark markdown", () => {
    const report = reportMarkdown({
      bottleneckCandidates: [],
      profile: "full",
      workflows: [
        {
          category: "search",
          durationMs: 50,
          id: "workspace-search",
          metric: "uiScenario.scenarioMs",
          phaseBreakdown: [
            { durationMs: 10, name: "query-dispatch", status: "ok" },
          ],
          status: "ok",
        },
      ],
    });

    expect(report).toContain("workspace-search: ok, search, 50ms");
    expect(report).toContain("query-dispatch: ok, 10ms");
  });

  it("adds privacy-safe PlantUML component metrics to diagram phase breakdown", () => {
    const [result] = deriveUiReviewResults([
      {
        durationMs: 300,
        report: {
          assertionFailures: [],
          assertions: { diagramVisible: true },
          benchmarkPhases: [
            {
              durationMs: 180,
              name: "all-diagrams-visible-after-heading",
              status: "ok",
            },
          ],
          captureMetrics: { scenarioMs: 300 },
          outcome: "passed",
          plantUmlMetrics: {
            cacheHitCount: 1,
            cacheMissCount: 1,
            componentP50Ms: {
              queueWaitMs: 1.23,
              renderCoreMs: 90.12,
              workerReadyWaitMs: 0.5,
              workerTotalMs: 120.34,
            },
            componentP95Ms: {
              queueWaitMs: 2.34,
              renderCoreMs: 110.23,
              workerReadyWaitMs: 1.5,
              workerTotalMs: 140.45,
            },
            concurrency: 1,
            diagramCount: 2,
            errorCount: 0,
            memoryHitCount: 1,
            p50Ms: 121,
            p95Ms: 141,
            persistentHitCount: 0,
            renderedCount: 2,
            timeoutCount: 0,
            totalMs: 250.4,
            workerCount: 1,
          },
        },
        scenario: "viewer-diagram-samples",
        status: "ok",
        workflowId: "diagram-render-after-open",
      },
    ]);

    expect(result.phaseBreakdown).toContainEqual({
      details: {
        cacheHitCount: 1,
        cacheMissCount: 1,
        concurrency: 1,
        diagramCount: 2,
        errorCount: 0,
        memoryHitCount: 1,
        p50Ms: 121,
        p95Ms: 141,
        persistentHitCount: 0,
        queueWaitP50Ms: 1.23,
        queueWaitP95Ms: 2.34,
        renderCoreP50Ms: 90.12,
        renderCoreP95Ms: 110.23,
        renderedCount: 2,
        timeoutCount: 0,
        workerCount: 1,
        workerReadyWaitP50Ms: 0.5,
        workerReadyWaitP95Ms: 1.5,
        workerTotalP50Ms: 120.34,
        workerTotalP95Ms: 140.45,
      },
      durationMs: 250.4,
      name: "plantuml-render-batch",
      status: "ok",
    });
    expect(validatePrivacy(result)).toEqual([]);
    expect(
      reportMarkdown({
        bottleneckCandidates: [],
        profile: "full",
        workflows: [result],
      }),
    ).toContain("queueWaitP95Ms: 2.34");
  });

  it("uses the after-open phase duration for diagram render workflow", () => {
    const [result] = deriveUiReviewResults([
      {
        durationMs: 900,
        report: {
          assertionFailures: [],
          assertions: { diagramVisible: true },
          benchmarkPhases: [
            { durationMs: 20, name: "heading-visible", status: "ok" },
            {
              details: { status: "seen" },
              durationMs: 120,
              name: "render-diagrams-async-done-seen",
              status: "ok",
            },
            {
              details: { status: "seen" },
              durationMs: 125,
              name: "diagram-html-apply-done-seen",
              status: "ok",
            },
            {
              details: { status: "seen" },
              durationMs: 130,
              name: "diagram-dom-commit-seen",
              status: "ok",
            },
            {
              details: { status: "seen" },
              durationMs: 145,
              name: "diagram-post-commit-frame-seen",
              status: "ok",
            },
            {
              details: {
                articleCommitCount: 1,
                diagramDomCommitAtMs: 130,
                diagramHtmlApplyDoneAtMs: 125,
                diagramPostCommitFrameAtMs: 145,
                diagramsAsyncDoneAtMs: 120,
                eventCount: 18,
                htmlApplyCount: 1,
                postCommitFrameCount: 1,
                renderDiagramsAsyncDoneCount: 1,
                renderEventCount: 18,
                slowestDurationMs: 80.5,
                status: "seen",
              },
              durationMs: 80.5,
              name: "diagram-render-after-open-events",
              status: "ok",
            },
            {
              durationMs: 180,
              name: "all-diagrams-visible-after-heading",
              status: "ok",
            },
            { durationMs: 220, name: "all-diagrams-visible", status: "ok" },
          ],
          captureMetrics: { scenarioMs: 900 },
          outcome: "passed",
        },
        scenario: "viewer-diagram-samples-after-open",
        status: "ok",
        workflowId: "diagram-render-after-open",
      },
    ]);

    expect(result).toMatchObject({
      durationMs: 180,
      id: "diagram-render-after-open",
      metric: "uiScenario.phase.all-diagrams-visible-after-heading",
      status: "ok",
    });
    expect(result.phaseBreakdown).toContainEqual({
      details: {
        articleCommitCount: 1,
        diagramDomCommitAtMs: 130,
        diagramHtmlApplyDoneAtMs: 125,
        diagramPostCommitFrameAtMs: 145,
        diagramsAsyncDoneAtMs: 120,
        eventCount: 18,
        htmlApplyCount: 1,
        postCommitFrameCount: 1,
        renderDiagramsAsyncDoneCount: 1,
        renderEventCount: 18,
        slowestDurationMs: 80.5,
        status: "seen",
      },
      durationMs: 80.5,
      name: "diagram-render-after-open-events",
      status: "ok",
    });
    expect(result.phaseBreakdown).toContainEqual({
      durationMs: 220,
      name: "all-diagrams-visible",
      status: "ok",
    });
    expect(validatePrivacy(result)).toEqual([]);
  });

  it("keeps diagram open path document-ready phase details privacy-safe", () => {
    const [result] = deriveUiReviewResults([
      {
        durationMs: 1800,
        report: {
          assertionFailures: [],
          assertions: { diagramVisible: true },
          benchmarkPhases: [
            { durationMs: 120, name: "file-click-dispatched", status: "ok" },
            { durationMs: 700, name: "active-title-visible", status: "ok" },
            { durationMs: 780, name: "document-body-visible", status: "ok" },
            { durationMs: 900, name: "document-heading-visible", status: "ok" },
            {
              durationMs: 150,
              name: "open-document-host-done-seen",
              status: "ok",
            },
            {
              durationMs: 155,
              name: "open-document-state-before-set-payload-seen",
              status: "ok",
            },
            {
              durationMs: 165,
              name: "open-document-state-after-set-payload-queued-seen",
              status: "ok",
            },
            {
              durationMs: 166,
              name: "open-document-total-seen",
              status: "ok",
            },
            { durationMs: 210, name: "render-effect-start-seen", status: "ok" },
            {
              details: { status: "not-seen" },
              durationMs: 910,
              name: "render-worker-response-seen",
              status: "skipped",
            },
            {
              durationMs: 360,
              name: "render-prepare-html-done-seen",
              status: "ok",
            },
            {
              durationMs: 720,
              name: "render-html-state-queued-seen",
              status: "ok",
            },
            { durationMs: 905, name: "article-ref-ready-seen", status: "ok" },
            { durationMs: 906, name: "layout-effect-start-seen", status: "ok" },
            { durationMs: 912, name: "layout-effect-done-seen", status: "ok" },
            {
              durationMs: 930,
              name: "post-commit-animation-frame-seen",
              status: "ok",
            },
            {
              details: {
                documentHeadingVisibleAtMs: 960,
                postCommitAnimationFrameAtMs: 930,
                status: "seen",
              },
              durationMs: 30,
              name: "heading-visible-after-post-commit-frame",
              status: "ok",
            },
            {
              details: {
                articleCommitCount: 1,
                articleHtmlCommitAtMs: 910,
                articleRefReadyAtMs: 905,
                articleRefReadyCount: 1,
                eventCount: 16,
                layoutEffectDoneAtMs: 912,
                layoutEffectDoneCount: 1,
                layoutEffectStartAtMs: 906,
                layoutEffectStartCount: 1,
                openDispatchEventCount: 2,
                openDocumentEventCount: 4,
                openDocumentHostDoneAtMs: 150,
                openDocumentHostDoneCount: 1,
                openDocumentStateAfterSetPayloadQueuedAtMs: 165,
                openDocumentStateAfterSetPayloadQueuedCount: 1,
                openDocumentStateBeforeSetPayloadAtMs: 155,
                openDocumentStateBeforeSetPayloadCount: 1,
                openDocumentTotalAtMs: 166,
                openDocumentTotalCount: 1,
                postCommitAnimationFrameAtMs: 930,
                postCommitAnimationFrameCount: 1,
                renderEventCount: 5,
                renderEffectStartAtMs: 210,
                renderHtmlStateQueuedAtMs: 720,
                renderPrepareHtmlDoneAtMs: 360,
                slowestDurationMs: 12.34,
                status: "seen",
                viewerRenderCount: 1,
              },
              durationMs: 910,
              name: "article-html-commit-seen",
              status: "ok",
            },
          ],
          captureMetrics: { scenarioMs: 1800 },
          outcome: "passed",
        },
        scenario: "viewer-diagram-samples",
        status: "ok",
        workflowId: "diagram-open-via-tree",
      },
    ]);

    expect(result.phaseBreakdown).toContainEqual({
      details: {
        articleCommitCount: 1,
        articleHtmlCommitAtMs: 910,
        articleRefReadyAtMs: 905,
        articleRefReadyCount: 1,
        eventCount: 16,
        layoutEffectDoneAtMs: 912,
        layoutEffectDoneCount: 1,
        layoutEffectStartAtMs: 906,
        layoutEffectStartCount: 1,
        openDispatchEventCount: 2,
        openDocumentEventCount: 4,
        openDocumentHostDoneAtMs: 150,
        openDocumentHostDoneCount: 1,
        openDocumentStateAfterSetPayloadQueuedAtMs: 165,
        openDocumentStateAfterSetPayloadQueuedCount: 1,
        openDocumentStateBeforeSetPayloadAtMs: 155,
        openDocumentStateBeforeSetPayloadCount: 1,
        openDocumentTotalAtMs: 166,
        openDocumentTotalCount: 1,
        postCommitAnimationFrameAtMs: 930,
        postCommitAnimationFrameCount: 1,
        renderEventCount: 5,
        renderEffectStartAtMs: 210,
        renderHtmlStateQueuedAtMs: 720,
        renderPrepareHtmlDoneAtMs: 360,
        slowestDurationMs: 12.34,
        status: "seen",
        viewerRenderCount: 1,
      },
      durationMs: 910,
      name: "article-html-commit-seen",
      status: "ok",
    });
    expect(result.phaseBreakdown).toContainEqual({
      durationMs: 150,
      name: "open-document-host-done-seen",
      status: "ok",
    });
    expect(result.phaseBreakdown).toContainEqual({
      durationMs: 155,
      name: "open-document-state-before-set-payload-seen",
      status: "ok",
    });
    expect(result.phaseBreakdown).toContainEqual({
      durationMs: 165,
      name: "open-document-state-after-set-payload-queued-seen",
      status: "ok",
    });
    expect(result.phaseBreakdown).toContainEqual({
      durationMs: 166,
      name: "open-document-total-seen",
      status: "ok",
    });
    expect(result.phaseBreakdown).toContainEqual({
      details: {
        documentHeadingVisibleAtMs: 960,
        postCommitAnimationFrameAtMs: 930,
        status: "seen",
      },
      durationMs: 30,
      name: "heading-visible-after-post-commit-frame",
      status: "ok",
    });
    expect(result.phaseBreakdown).toContainEqual({
      details: { status: "not-seen" },
      durationMs: 910,
      name: "render-worker-response-seen",
      status: "skipped",
    });
    expect(result.durationMs).toBe(900);
    expect(result.metric).toBe("uiScenario.phase.document-heading-visible");
    expect(result.phaseBreakdown).toContainEqual({
      durationMs: 930,
      name: "post-commit-animation-frame-seen",
      status: "ok",
    });
    expect(validatePrivacy(result)).toEqual([]);
    expect(
      reportMarkdown({
        bottleneckCandidates: [],
        profile: "full",
        workflows: [result],
      }),
    ).toContain("document-heading-visible: ok, 900ms");
    expect(
      reportMarkdown({
        bottleneckCandidates: [],
        profile: "full",
        workflows: [result],
      }),
    ).toContain("diagram-open-via-tree: ok, filesystem, 900ms");
  });

  it("uses the search interaction phase duration for current file search", () => {
    const [result] = deriveUiReviewResults([
      {
        durationMs: 1400,
        report: {
          assertionFailures: [],
          assertions: { searchVisible: true },
          benchmarkPhases: [
            {
              durationMs: 900,
              name: "document-ready-for-search",
              status: "ok",
            },
            { durationMs: 40, name: "search-results-visible", status: "ok" },
            {
              durationMs: 180,
              name: "search-interaction-complete",
              status: "ok",
            },
          ],
          captureMetrics: { scenarioMs: 1400 },
          outcome: "passed",
        },
        scenario: "viewer-search",
        status: "ok",
        workflowId: "current-file-search",
      },
    ]);

    expect(result).toMatchObject({
      durationMs: 180,
      id: "current-file-search",
      metric: "uiScenario.phase.search-interaction-complete",
      reason: null,
      status: "ok",
    });
    expect(validatePrivacy(result)).toEqual([]);
  });

  it("falls back to scenario duration when the search interaction phase is missing", () => {
    const [result] = deriveUiReviewResults([
      {
        durationMs: 1400,
        report: {
          assertionFailures: [],
          assertions: { searchVisible: true },
          benchmarkPhases: [
            {
              durationMs: 900,
              name: "document-ready-for-search",
              status: "ok",
            },
          ],
          captureMetrics: { scenarioMs: 1400 },
          outcome: "passed",
        },
        scenario: "viewer-search",
        status: "ok",
        workflowId: "current-file-search",
      },
    ]);

    expect(result).toMatchObject({
      durationMs: 1400,
      id: "current-file-search",
      metric: "uiScenario.scenarioMs",
      reason: "missing-phase:search-interaction-complete",
      status: "ok",
    });
    expect(
      reportMarkdown({
        bottleneckCandidates: [],
        profile: "full",
        workflows: [result],
      }),
    ).toContain("reason: missing-phase:search-interaction-complete");
    expect(validatePrivacy(result)).toEqual([]);
  });
});
