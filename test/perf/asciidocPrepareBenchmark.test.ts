import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it, vi } from "vitest";

import { renderAsciiDocCore } from "../../src/core/renderAsciiDocCore";
import { asciiDocWorkerPhaseDurationKeys } from "../../src/core/renderWorkerMetrics";
import type { DocumentPayload } from "../../src/core/types";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import { asciidocPrepareFixtures } from "../../scripts/asciidoc-prepare-benchmark/fixtures.mjs";
import {
  assertAsciiDocPrepareArtifactSafe,
  estimateBoundedConcurrencyMs,
  evaluateHeadroom,
  round,
  summarizeSamples,
} from "../../scripts/asciidoc-prepare-benchmark/report.mjs";

const warmupCount = 1;
const measurementCount = 20;

const sourceAnalysisPhaseKeys = [
  "diagramPlaceholderMs",
  "headingsMs",
  "sourceBlocksMs",
  "sourceTextBlocksMs",
  "sourceSelectionBlocksMs",
  "diagramDiagnosticsMs",
  "diagramSlotsMs",
  "mermaidMs",
  "plantUmlMs",
  "graphvizMs",
  "krokiMs",
] as const;

const preparePhaseEvents = {
  domParseMs: "render.prepareDocumentHtml.domParse",
  includeDiagnosticsMs: "render.prepareDocumentHtml.includeDiagnostics",
  headingsAttachMs: "render.prepareDocumentHtml.headings",
  sourceBlocksAttachMs: "render.prepareDocumentHtml.sourceBlocks",
  sourceTextBlocksAttachMs: "render.prepareDocumentHtml.sourceTextBlocks",
  sourceSelectionBlocksAttachMs:
    "render.prepareDocumentHtml.sourceSelectionBlocks",
  tablesMs: "render.prepareDocumentHtml.tables",
  imagesMs: "render.prepareDocumentHtml.images",
  linksMs: "render.prepareDocumentHtml.links",
  sanitizeMs: "render.prepareDocumentHtml.sanitize",
  sanitizedDomParseMs: "render.prepareDocumentHtml.sanitizedDomParse",
  mathMs: "render.prepareDocumentHtml.math",
} as const;

interface ResolverMeasurement {
  active: number;
  callCount: number;
  duplicateDurationMs: number;
  durations: number[];
  maxConcurrency: number;
  seen: Set<string>;
}

interface BenchmarkCase {
  fixtureId: string;
  latencyMs: number;
  profile: "zero-latency" | "fixed-5ms";
  source: string;
  includeFiles: Array<{ path: string; source: string }>;
}

interface BenchmarkSample {
  concurrencyUpperBoundMs: number;
  duplicateUpperBoundMs: number;
  fixtureId: string;
  diagramCount: number;
  expandedBytes: number;
  expandedLines: number;
  imageElementCount: number;
  includeCount: number;
  iteration: number;
  linkElementCount: number;
  maxConcurrency: number;
  preparePhases: Record<keyof typeof preparePhaseEvents, number>;
  prepareMs: number;
  profile: BenchmarkCase["profile"];
  resolverCallCount: number;
  resolverResolvedCount: number;
  resolverTotalMs: number;
  resolverUniqueCount: number;
  sourceAnalysisMs: number;
  sourceAnalysisPasses: number;
  sourceAnalysisVisitedCodeUnitsEstimate: number;
  tableSourceScanMs: number;
  totalMs: number;
  workerCoreMs: number;
  workerPhases: Record<
    (typeof asciiDocWorkerPhaseDurationKeys)[number],
    number
  >;
}

function createCases(): BenchmarkCase[] {
  return asciidocPrepareFixtures.flatMap((fixture) => {
    const base = {
      fixtureId: fixture.fixtureId,
      source: fixture.source,
      includeFiles: fixture.includeFiles,
    };
    if (!fixture.fixtureId.startsWith("assets-")) {
      return [{ ...base, latencyMs: 0, profile: "zero-latency" as const }];
    }
    return [
      { ...base, latencyMs: 0, profile: "zero-latency" as const },
      { ...base, latencyMs: 5, profile: "fixed-5ms" as const },
    ];
  });
}

function newResolverMeasurement(): ResolverMeasurement {
  return {
    active: 0,
    callCount: 0,
    duplicateDurationMs: 0,
    durations: [],
    maxConcurrency: 0,
    seen: new Set(),
  };
}

async function delay(ms: number) {
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function measuredResolve<Value>(
  measurement: ResolverMeasurement,
  key: string,
  latencyMs: number,
  value: Value,
): Promise<Value> {
  const duplicate = measurement.seen.has(key);
  measurement.seen.add(key);
  measurement.callCount += 1;
  measurement.active += 1;
  measurement.maxConcurrency = Math.max(
    measurement.maxConcurrency,
    measurement.active,
  );
  const startedAt = performance.now();
  await delay(latencyMs);
  const elapsed = performance.now() - startedAt;
  measurement.active -= 1;
  measurement.durations.push(elapsed);
  if (duplicate) {
    measurement.duplicateDurationMs += elapsed;
  }
  return value;
}

function phaseDuration(
  events: Array<Record<string, unknown>>,
  eventName: string,
): number {
  const event = events.find((candidate) => candidate.event === eventName);
  return typeof event?.durationMs === "number" ? event.durationMs : 0;
}

function phaseCount(
  events: Array<Record<string, unknown>>,
  eventName: string,
): number {
  const event = events.find((candidate) => candidate.event === eventName);
  return typeof event?.count === "number" ? event.count : 0;
}

async function measureCase(
  benchmarkCase: BenchmarkCase,
  iteration: number,
  allEvents: Array<Record<string, unknown>>,
): Promise<BenchmarkSample> {
  const rootPath = `/perf/asciidoc/${benchmarkCase.fixtureId}.adoc`;
  const context = {
    attributes: {},
    baseDir: "/perf/asciidoc",
    documentDir: "/perf/asciidoc",
    resourceRoots: ["/perf/asciidoc"],
    workspaceRoot: "/perf/asciidoc",
  };
  const document: DocumentPayload = {
    asciidocContext: context,
    basePath: context.documentDir,
    format: "asciidoc",
    includeFiles: benchmarkCase.includeFiles,
    path: rootPath,
    source: benchmarkCase.source,
    updatedAt: new Date(0).toISOString(),
  };
  const eventStart = allEvents.length;
  const totalStartedAt = performance.now();
  const { result, phaseMetrics } = renderAsciiDocCore(
    {
      asciidocContext: context,
      includeFiles: benchmarkCase.includeFiles,
      path: rootPath,
      source: benchmarkCase.source,
    },
    { collectMetrics: true },
  );
  if (!phaseMetrics) {
    throw new Error("AsciiDoc phase metrics missing");
  }

  const resolver = newResolverMeasurement();
  const prepareStartedAt = performance.now();
  await prepareDocumentHtml(
    result.html,
    document,
    {
      security: {
        allowLocalImages: true,
        confirmExternalLinks: true,
        showExternalImages: false,
      },
    },
    result,
    {
      resolveDocumentLink: (href) =>
        measuredResolve(resolver, `link:${href}`, benchmarkCase.latencyMs, {
          status: "resolved" as const,
          path: "/perf/resolved.adoc",
        }),
      resolveLocalImage: (source) =>
        measuredResolve(resolver, `image:${source}`, benchmarkCase.latencyMs, {
          status: "resolved" as const,
          content: "iVBORw0KGgo=",
          mediaType: "image/png",
        }),
    },
  );
  const prepareMs = performance.now() - prepareStartedAt;
  const totalMs = performance.now() - totalStartedAt;
  const phaseEvents = allEvents.slice(eventStart);
  const tableSourceScanMs = phaseDuration(
    phaseEvents,
    "render.prepareDocumentHtml.tableSourceScan",
  );
  const sourceAnalysisMs =
    sourceAnalysisPhaseKeys.reduce(
      (total, key) => total + phaseMetrics[key],
      0,
    ) + tableSourceScanMs;
  const resolverTotalMs = resolver.durations.reduce(
    (total, durationMs) => total + durationMs,
    0,
  );
  const concurrencyEstimateMs =
    estimateBoundedConcurrencyMs(resolver.durations, 4) ?? 0;

  return {
    concurrencyUpperBoundMs: round(
      Math.max(0, resolverTotalMs - concurrencyEstimateMs),
    )!,
    duplicateUpperBoundMs: round(resolver.duplicateDurationMs)!,
    diagramCount: phaseMetrics.diagramCount,
    expandedBytes: phaseMetrics.expandedBytes,
    expandedLines: phaseMetrics.expandedLines,
    fixtureId: benchmarkCase.fixtureId,
    imageElementCount: phaseCount(
      phaseEvents,
      "render.prepareDocumentHtml.images",
    ),
    includeCount: phaseMetrics.includeCount,
    iteration,
    linkElementCount: phaseCount(
      phaseEvents,
      "render.prepareDocumentHtml.links",
    ),
    maxConcurrency: resolver.maxConcurrency,
    preparePhases: Object.fromEntries(
      Object.entries(preparePhaseEvents).map(([key, eventName]) => [
        key,
        round(phaseDuration(phaseEvents, eventName))!,
      ]),
    ) as BenchmarkSample["preparePhases"],
    prepareMs: round(prepareMs)!,
    profile: benchmarkCase.profile,
    resolverCallCount: resolver.callCount,
    resolverResolvedCount: resolver.callCount,
    resolverTotalMs: round(resolverTotalMs)!,
    resolverUniqueCount: resolver.seen.size,
    sourceAnalysisMs: round(sourceAnalysisMs)!,
    sourceAnalysisPasses: phaseMetrics.sourceAnalysisPasses,
    sourceAnalysisVisitedCodeUnitsEstimate:
      phaseMetrics.sourceAnalysisVisitedCodeUnitsEstimate,
    tableSourceScanMs: round(tableSourceScanMs)!,
    totalMs: round(totalMs)!,
    workerCoreMs: phaseMetrics.totalMs,
    workerPhases: Object.fromEntries(
      asciiDocWorkerPhaseDurationKeys.map((key) => [key, phaseMetrics[key]]),
    ) as BenchmarkSample["workerPhases"],
  };
}

function summarizeCase(samples: BenchmarkSample[]) {
  const durationFields = [
    "totalMs",
    "workerCoreMs",
    "prepareMs",
    "sourceAnalysisMs",
    "tableSourceScanMs",
    "resolverTotalMs",
    "duplicateUpperBoundMs",
    "concurrencyUpperBoundMs",
  ] as const;
  return {
    fixtureId: samples[0].fixtureId,
    profile: samples[0].profile,
    measurementCount: samples.length,
    durations: Object.fromEntries(
      durationFields.map((field) => [
        field,
        summarizeSamples(samples.map((sample) => sample[field])),
      ]),
    ),
    preparePhases: Object.fromEntries(
      Object.keys(preparePhaseEvents).map((key) => [
        key,
        summarizeSamples(
          samples.map(
            (sample) =>
              sample.preparePhases[
                key as keyof BenchmarkSample["preparePhases"]
              ],
          ),
        ),
      ]),
    ),
    workerPhases: Object.fromEntries(
      asciiDocWorkerPhaseDurationKeys.map((key) => [
        key,
        summarizeSamples(samples.map((sample) => sample.workerPhases[key])),
      ]),
    ),
    counts: {
      diagramCount: Math.max(...samples.map((sample) => sample.diagramCount)),
      expandedBytes: Math.max(...samples.map((sample) => sample.expandedBytes)),
      expandedLines: Math.max(...samples.map((sample) => sample.expandedLines)),
      imageElementCount: Math.max(
        ...samples.map((sample) => sample.imageElementCount),
      ),
      includeCount: Math.max(...samples.map((sample) => sample.includeCount)),
      linkElementCount: Math.max(
        ...samples.map((sample) => sample.linkElementCount),
      ),
      maxConcurrency: Math.max(
        ...samples.map((sample) => sample.maxConcurrency),
      ),
      resolverCallCount: Math.max(
        ...samples.map((sample) => sample.resolverCallCount),
      ),
      resolverUniqueCount: Math.max(
        ...samples.map((sample) => sample.resolverUniqueCount),
      ),
      resolverResolvedCount: Math.max(
        ...samples.map((sample) => sample.resolverResolvedCount),
      ),
      sourceAnalysisPasses: Math.max(
        ...samples.map((sample) => sample.sourceAnalysisPasses),
      ),
      sourceAnalysisVisitedCodeUnitsEstimate: Math.max(
        ...samples.map(
          (sample) => sample.sourceAnalysisVisitedCodeUnitsEstimate,
        ),
      ),
    },
  };
}

function caseSamples(
  samples: BenchmarkSample[],
  fixtureId: string,
  profile: BenchmarkCase["profile"],
) {
  return samples.filter(
    (sample) => sample.fixtureId === fixtureId && sample.profile === profile,
  );
}

function decisionFor(
  samples: BenchmarkSample[],
  fixtureId: string,
  profile: BenchmarkCase["profile"],
  target: keyof BenchmarkSample,
  upperBound: keyof BenchmarkSample,
) {
  const selected = caseSamples(samples, fixtureId, profile);
  return evaluateHeadroom({
    parentValues: selected.map((sample) => sample.totalMs),
    targetValues: selected.map((sample) => Number(sample[target])),
    upperBoundValues: selected.map((sample) => Number(sample[upperBound])),
  });
}

describe("AsciiDoc prepare phase benchmark", () => {
  it("writes a privacy-safe 20-sample phase baseline", async () => {
    const outPath =
      process.env.SVARD_ASCIIDOC_PREPARE_BENCHMARK_OUT ??
      path.resolve(
        process.cwd(),
        ".artifacts/perf/asciidoc-prepare-baseline/summary.json",
      );
    const originalLocalStorage = globalThis.localStorage;
    const events: Array<Record<string, unknown>> = [];
    const infoSpy = vi
      .spyOn(console, "info")
      .mockImplementation((label: unknown, payload: unknown) => {
        if (label === "[perf]" && payload && typeof payload === "object") {
          events.push(payload as Record<string, unknown>);
        }
      });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => (key === "SVARD_PERF_TRACE" ? "1" : null),
      },
    });

    try {
      const cases = createCases();
      for (const benchmarkCase of cases) {
        for (let warmup = 0; warmup < warmupCount; warmup += 1) {
          await measureCase(benchmarkCase, -1, events);
        }
      }

      const samples: BenchmarkSample[] = [];
      for (let iteration = 0; iteration < measurementCount; iteration += 1) {
        const offset = iteration % cases.length;
        const orderedCases = [
          ...cases.slice(offset),
          ...cases.slice(0, offset),
        ];
        for (const benchmarkCase of orderedCases) {
          samples.push(await measureCase(benchmarkCase, iteration + 1, events));
        }
      }

      const report = {
        decisions: {
          imp412SourceAnalysis: decisionFor(
            samples,
            "include-heavy",
            "zero-latency",
            "sourceAnalysisMs",
            "sourceAnalysisMs",
          ),
          imp413ResolverDeduplication: decisionFor(
            samples,
            "assets-duplicate",
            "fixed-5ms",
            "resolverTotalMs",
            "duplicateUpperBoundMs",
          ),
          imp414ResolverConcurrency: decisionFor(
            samples,
            "assets-unique",
            "fixed-5ms",
            "resolverTotalMs",
            "concurrencyUpperBoundMs",
          ),
        },
        fixtures: createCases().map((benchmarkCase) => ({
          fixtureId: benchmarkCase.fixtureId,
          profile: benchmarkCase.profile,
        })),
        measurementCount,
        productionWorker: null,
        schemaVersion: 1,
        status: "ok",
        summaries: createCases().map((benchmarkCase) =>
          summarizeCase(
            caseSamples(
              samples,
              benchmarkCase.fixtureId,
              benchmarkCase.profile,
            ),
          ),
        ),
        warmupCount,
      };
      const serialized = JSON.stringify(report, null, 2);
      expect(() => assertAsciiDocPrepareArtifactSafe(report)).not.toThrow();
      expect(serialized).not.toContain("/perf/asciidoc/");
      expect(serialized).not.toContain("Generated paragraph");
      expect(serialized).not.toContain("iVBORw0KGgo=");
      expect(serialized).not.toContain("/perf/resolved.adoc");
      expect(
        report.summaries.every((summary) => summary.measurementCount === 20),
      ).toBe(true);
      expect(
        report.summaries
          .filter((summary) => summary.fixtureId.startsWith("assets-"))
          .every((summary) => summary.counts.maxConcurrency <= 1),
      ).toBe(true);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, `${serialized}\n`);
    } finally {
      infoSpy.mockRestore();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  }, 120_000);
});
