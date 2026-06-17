// @ts-expect-error The benchmark runner is a Node ESM script tested directly.
import * as benchmark from "../../scripts/workspace-performance-benchmark.mjs";
import { describe, expect, it } from "vitest";

const {
  buildSummary,
  deriveUiReviewResults,
  fillMissingWorkflows,
  parseArgs,
  percentile,
  reportMarkdown,
  summarizeEvents,
  validatePrivacy,
} = benchmark;

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
    expect(summary.workflows).toHaveLength(13);
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

    expect(workflows).toHaveLength(13);
    expect(
      workflows.find((item: { id: string }) => item.id === "workspace-search"),
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
          captureMetrics: { scenarioMs: 300 },
          outcome: "passed",
          plantUmlMetrics: {
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
            p50Ms: 121,
            p95Ms: 141,
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
        concurrency: 1,
        diagramCount: 2,
        errorCount: 0,
        p50Ms: 121,
        p95Ms: 141,
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
      durationMs: 220,
      id: "diagram-render-after-open",
      metric: "uiScenario.phase.all-diagrams-visible",
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
            {
              details: {
                articleCommitCount: 1,
                articleHtmlCommitAtMs: 910,
                eventCount: 8,
                openDispatchEventCount: 2,
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
        eventCount: 8,
        openDispatchEventCount: 2,
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
      details: { status: "not-seen" },
      durationMs: 910,
      name: "render-worker-response-seen",
      status: "skipped",
    });
    expect(validatePrivacy(result)).toEqual([]);
    expect(
      reportMarkdown({
        bottleneckCandidates: [],
        profile: "full",
        workflows: [result],
      }),
    ).toContain("document-heading-visible: ok, 900ms");
  });

  it("uses the search interaction phase duration for current file search", () => {
    const [result] = deriveUiReviewResults([
      {
        durationMs: 1400,
        report: {
          assertionFailures: [],
          assertions: { searchVisible: true },
          benchmarkPhases: [
            { durationMs: 900, name: "document-ready-for-search", status: "ok" },
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
            { durationMs: 900, name: "document-ready-for-search", status: "ok" },
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
