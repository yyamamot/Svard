import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES,
  DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO,
  buildDocumentRenderCacheBenchmarkUrl,
  installDocumentRenderCacheBenchmarkCollector,
} from "../../scripts/ui-review/core/captureBenchmarks.mjs";
// @ts-expect-error UI assertion handlers are runtime JavaScript modules.
import { buildOpenFilesAssertions } from "../../scripts/ui-review/assertions/handlers/filesBookmarks/openFiles.mjs";

interface RenderCachePhase {
  durationMs: number;
  coreProducerCount: number;
  prepareProducerCount: number;
  articleCommitCount: number;
  cacheEventCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  inFlightCount: number;
  inFlightActiveCountFinal: number;
  inFlightSnapshotCount: number;
  coreHitCount: number;
  preparedHitCount: number;
  admissionEstimatedBytesMax: number;
  residentBytesMax: number;
  entryCountMax: number;
  evictionCount: number;
}

interface RenderCacheBenchmark {
  schemaVersion: number;
  scenarioId: string;
  status: "pending" | "ok" | "failed";
  phases: Record<string, RenderCachePhase>;
  reason?: string;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("document render cache UI review harness", () => {
  it("builds a fixed scenario URL without adding private identifiers", () => {
    const url = new URL(
      buildDocumentRenderCacheBenchmarkUrl("http://127.0.0.1:4173/?existing=1"),
    );

    expect(url.searchParams.get("scenario")).toBe(
      DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO,
    );
    expect(url.searchParams.get("existing")).toBe("1");
    expect(url.searchParams.has("path")).toBe(false);
    expect(url.searchParams.has("key")).toBe(false);
  });

  it("collects only fixed numeric phase metrics and suppresses raw perf payloads", async () => {
    vi.useFakeTimers();
    let initScript:
      | ((input: { allowedPhases: string[]; scenarioId: string }) => void)
      | null = null;
    let initInput: { allowedPhases: string[]; scenarioId: string } | null =
      null;
    const page = {
      addInitScript: vi.fn(
        async (
          script: typeof initScript,
          input: typeof initInput,
        ): Promise<void> => {
          initScript = script;
          initInput = input;
        },
      ),
    };

    await installDocumentRenderCacheBenchmarkCollector(page);
    expect(page.addInitScript).toHaveBeenCalledOnce();
    expect(initInput).toMatchObject({
      allowedPhases: DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES,
      scenarioId: DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO,
    });

    let now = 10;
    vi.spyOn(performance, "now").mockImplementation(() => now++);
    const originalInfo = console.info;
    const consoleSink = vi.fn();
    console.info = consoleSink;
    try {
      (
        initScript as unknown as (input: {
          allowedPhases: string[];
          scenarioId: string;
        }) => void
      )(initInput!);
      const target = window as unknown as {
        __SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK__: RenderCacheBenchmark;
        __SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK_BEGIN__: (
          phase: string,
        ) => boolean;
        __SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK_END__: (
          phase: string,
        ) => boolean;
      };

      for (const phase of DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES) {
        expect(
          target.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK_BEGIN__(phase),
        ).toBe(true);
        console.info("[perf]", {
          event: "render.renderDocument",
          path: "/Users/example/private.md",
          source: "private source",
        });
        console.info("[perf]", {
          event: "render.prepareDocumentHtml",
          cacheKey: "private-key",
        });
        console.info("[perf]", { event: "render.articleInnerHtmlCommit" });
        console.info("[perf]", {
          event: "render.artifactCache.lookup",
          stage: "core",
          status: "hit",
          count: 0,
          totalBytes: 4096,
          entryCount: 2,
        });
        console.info("[perf]", {
          event: "render.artifactCache.lookup",
          stage: "prepared",
          status: "hit",
          count: 0,
          totalBytes: 8192,
          entryCount: 2,
        });
        console.info("[perf]", {
          event: "render.artifactCache.admission",
          count: 0,
          estimatedBytes: 2048,
          totalBytes: 8192,
          entryCount: 2,
        });
        expect(
          target.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK_END__(phase),
        ).toBe(true);
      }

      const result = target.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK__;
      expect(result).toMatchObject({
        schemaVersion: 2,
        scenarioId: DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO,
        status: "ok",
      });
      expect(Object.keys(result.phases)).toEqual(
        DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES,
      );
      expect(result.phases["revisit-a"]).toMatchObject({
        coreProducerCount: 1,
        prepareProducerCount: 1,
        articleCommitCount: 1,
        cacheEventCount: 3,
        cacheHitCount: 2,
        coreHitCount: 1,
        preparedHitCount: 1,
        inFlightActiveCountFinal: 0,
        inFlightSnapshotCount: 3,
        admissionEstimatedBytesMax: 2048,
        residentBytesMax: 8192,
        entryCountMax: 2,
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("/Users/");
      expect(serialized).not.toContain("private source");
      expect(serialized).not.toContain("private-key");
      expect(consoleSink).not.toHaveBeenCalled();
      expect(localStorage.getItem("SVARD_PERF_TRACE")).toBe("1");
    } finally {
      console.info = originalInfo;
    }
  });

  it("requires cache instrumentation for the formal IMP-410 UI gate", async () => {
    const phases = Object.fromEntries(
      DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES.map((phase) => [
        phase,
        {
          durationMs: 1,
          coreProducerCount: 1,
          prepareProducerCount: 1,
          articleCommitCount: 1,
          cacheEventCount: 0,
          cacheHitCount: 0,
          cacheMissCount: 0,
          inFlightCount: 0,
          inFlightActiveCountFinal: 0,
          inFlightSnapshotCount: 0,
          coreHitCount: 0,
          preparedHitCount: 0,
          admissionEstimatedBytesMax: 0,
          residentBytesMax: 0,
          entryCountMax: 0,
          evictionCount: 0,
        },
      ]),
    );
    const context = {
      bodyText: "",
      commandAutomation: { availableCommands: [] },
      consoleMessages: [],
      contextMenuText: "",
      documentRenderCacheBenchmark: {
        schemaVersion: 2,
        scenarioId: DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO,
        status: "ok",
        phases,
      },
      editorOpenRequests: [],
      geometryReviewIds: [],
      page: { evaluate: vi.fn(async () => true) },
      scenario: DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO,
    };

    const baseline = await buildOpenFilesAssertions({
      ...context,
      renderCacheExpectation: "optional",
    });
    expect(baseline.hasRenderCacheInstrumentation).toBe(true);
    expect(baseline.hasRenderCacheProducerElision).toBe(true);

    const candidate = await buildOpenFilesAssertions({
      ...context,
      renderCacheExpectation: "required",
    });
    expect(candidate.hasRenderCacheInstrumentation).toBe(false);
    expect(candidate.hasRenderCacheProducerElision).toBe(false);

    const instrumentedPhases = Object.fromEntries(
      Object.entries(phases).map(([phase, metrics]) => {
        const isHit = phase === "revisit-a" || phase === "theme-a";
        return [
          phase,
          {
            ...metrics,
            coreProducerCount: isHit ? 0 : 1,
            prepareProducerCount: isHit ? 0 : 1,
            cacheEventCount: 2,
            cacheHitCount: isHit ? 2 : 0,
            cacheMissCount: isHit ? 0 : 2,
            coreHitCount: isHit ? 1 : 0,
            preparedHitCount: isHit ? 1 : 0,
            inFlightActiveCountFinal: 0,
            inFlightSnapshotCount: 1,
            residentBytesMax: 8192,
          },
        ];
      }),
    );
    const instrumented = await buildOpenFilesAssertions({
      ...context,
      documentRenderCacheBenchmark: {
        ...context.documentRenderCacheBenchmark,
        phases: instrumentedPhases,
      },
      renderCacheExpectation: "required",
    });
    expect(instrumented.hasRenderCacheInstrumentation).toBe(true);
    expect(instrumented.hasRenderCacheProducerElision).toBe(true);
    expect(instrumented.hasRenderCacheBoundedAccounting).toBe(true);
  });
});
