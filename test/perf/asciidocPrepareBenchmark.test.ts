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
  splitHalfDriftPercent,
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
  startOrder: string[];
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
  mode: "bounded" | "serial";
  pendingCount: number;
  preparePhases: Record<keyof typeof preparePhaseEvents, number>;
  prepareMs: number;
  profile: BenchmarkCase["profile"];
  resolverCallCount: number;
  resolverResolvedCount: number;
  resolverTotalMs: number;
  resolverUniqueCount: number;
  resolverStartOrder: string[];
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
    startOrder: [],
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
  measurement.startOrder.push(key);
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
  concurrency: 1 | 4 = 1,
): Promise<BenchmarkSample> {
  // The candidate arm is intentionally unwired after rollback. A future
  // candidate must explicitly pass this mode into its benchmark-only hook;
  // until then the comparator records bounded-concurrency-violation.
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
    mode: concurrency === 1 ? "serial" : "bounded",
    pendingCount: resolver.active,
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
    resolverStartOrder: resolver.startOrder,
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
      pendingCount: Math.max(...samples.map((sample) => sample.pendingCount)),
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

interface BenchmarkPair {
  bounded: BenchmarkSample;
  orderingViolationCount: number;
  serial: BenchmarkSample;
}

function summarizePairedDuration(
  pairs: BenchmarkPair[],
  read: (sample: BenchmarkSample) => number,
) {
  const serial = pairs.map((pair) => read(pair.serial));
  const bounded = pairs.map((pair) => read(pair.bounded));
  const pairedDeltaMs = pairs.map(
    (pair) => read(pair.bounded) - read(pair.serial),
  );
  const pairedImprovementPercent = pairs
    .map((pair) => {
      const serialValue = read(pair.serial);
      return serialValue > 0
        ? ((serialValue - read(pair.bounded)) / serialValue) * 100
        : null;
    })
    .filter((value): value is number => value !== null);
  return {
    bounded: summarizeSamples(bounded),
    pairedDeltaMs: summarizeSamples(pairedDeltaMs),
    pairedImprovementPercent: summarizeSamples(pairedImprovementPercent),
    serial: summarizeSamples(serial),
    splitHalfDriftPercent: splitHalfDriftPercent(pairedImprovementPercent),
  };
}

function summarizeModeCounts(samples: BenchmarkSample[]) {
  return {
    maxConcurrency: Math.max(...samples.map((sample) => sample.maxConcurrency)),
    pendingCount: Math.max(...samples.map((sample) => sample.pendingCount)),
    resolverCallCount: Math.max(
      ...samples.map((sample) => sample.resolverCallCount),
    ),
    resolverResolvedCount: Math.max(
      ...samples.map((sample) => sample.resolverResolvedCount),
    ),
    resolverUniqueCount: Math.max(
      ...samples.map((sample) => sample.resolverUniqueCount),
    ),
  };
}

const resolverCountContracts: Record<
  string,
  { calls: number; unique: number }
> = {
  "assets-duplicate": { calls: 120, unique: 20 },
  "assets-unique": { calls: 120, unique: 120 },
  "assets-unique-1": { calls: 2, unique: 2 },
  "assets-unique-10": { calls: 20, unique: 20 },
  "assets-unique-100": { calls: 200, unique: 200 },
  "diagram-heavy": { calls: 0, unique: 0 },
  "include-heavy": { calls: 0, unique: 0 },
  "plain-large": { calls: 0, unique: 0 },
};

function resolverCountViolationCount(pairs: BenchmarkPair[]): number {
  const expected = resolverCountContracts[pairs[0].serial.fixtureId];
  return pairs.reduce(
    (count, pair) =>
      count +
      [pair.serial, pair.bounded].filter(
        (sample) =>
          sample.resolverCallCount !== expected.calls ||
          sample.resolverResolvedCount !== expected.calls ||
          sample.resolverUniqueCount !== expected.unique,
      ).length,
    0,
  );
}

function summarizeConcurrencyPairs(pairs: BenchmarkPair[]) {
  const durationReaders = {
    imagesMs: (sample: BenchmarkSample) => sample.preparePhases.imagesMs,
    linksMs: (sample: BenchmarkSample) => sample.preparePhases.linksMs,
    prepareMs: (sample: BenchmarkSample) => sample.prepareMs,
    totalMs: (sample: BenchmarkSample) => sample.totalMs,
  };
  return {
    counts: {
      bounded: summarizeModeCounts(pairs.map((pair) => pair.bounded)),
      orderingViolationCount: pairs.reduce(
        (count, pair) => count + pair.orderingViolationCount,
        0,
      ),
      resolverCountViolationCount: resolverCountViolationCount(pairs),
      serial: summarizeModeCounts(pairs.map((pair) => pair.serial)),
    },
    durations: Object.fromEntries(
      Object.entries(durationReaders).map(([key, read]) => [
        key,
        summarizePairedDuration(pairs, read),
      ]),
    ),
    fixtureId: pairs[0].serial.fixtureId,
    measurementCount: pairs.length,
    profile: pairs[0].serial.profile,
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

function casePairs(
  pairs: BenchmarkPair[],
  fixtureId: string,
  profile: BenchmarkCase["profile"],
) {
  return pairs.filter(
    (pair) =>
      pair.serial.fixtureId === fixtureId && pair.serial.profile === profile,
  );
}

function startOrderViolationCount(
  serial: BenchmarkSample,
  bounded: BenchmarkSample,
) {
  if (serial.resolverStartOrder.length !== bounded.resolverStartOrder.length) {
    return 1;
  }
  return serial.resolverStartOrder.some(
    (key, index) => bounded.resolverStartOrder[index] !== key,
  )
    ? 1
    : 0;
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
      const comparisonMode =
        process.env.SVARD_ASCIIDOC_PREPARE_COMPARISON === "imp414-concurrency";
      for (const benchmarkCase of cases) {
        for (let warmup = 0; warmup < warmupCount; warmup += 1) {
          await measureCase(benchmarkCase, -1, events, 1);
          if (comparisonMode) {
            await measureCase(benchmarkCase, -1, events, 4);
          }
        }
      }

      const samples: BenchmarkSample[] = [];
      const pairs: BenchmarkPair[] = [];
      for (let iteration = 0; iteration < measurementCount; iteration += 1) {
        const offset = iteration % cases.length;
        const orderedCases = [
          ...cases.slice(offset),
          ...cases.slice(0, offset),
        ];
        for (const benchmarkCase of orderedCases) {
          if (!comparisonMode) {
            samples.push(
              await measureCase(benchmarkCase, iteration + 1, events, 1),
            );
            continue;
          }
          const concurrencyOrder: Array<1 | 4> =
            iteration % 2 === 0 ? [1, 4] : [4, 1];
          let serial: BenchmarkSample | null = null;
          let bounded: BenchmarkSample | null = null;
          for (const concurrency of concurrencyOrder) {
            const sample = await measureCase(
              benchmarkCase,
              iteration + 1,
              events,
              concurrency,
            );
            if (concurrency === 1) serial = sample;
            else bounded = sample;
          }
          if (!serial || !bounded) {
            throw new Error("AsciiDoc concurrency pair incomplete");
          }
          samples.push(serial);
          pairs.push({
            bounded,
            orderingViolationCount: startOrderViolationCount(serial, bounded),
            serial,
          });
        }
      }

      const report = {
        ...(comparisonMode
          ? {
              concurrencySummaries: createCases().map((benchmarkCase) =>
                summarizeConcurrencyPairs(
                  casePairs(
                    pairs,
                    benchmarkCase.fixtureId,
                    benchmarkCase.profile,
                  ),
                ),
              ),
            }
          : {}),
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
      if (comparisonMode) {
        expect(
          report.concurrencySummaries?.every(
            (summary) => summary.measurementCount === 20,
          ),
        ).toBe(true);
      }
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, `${serialized}\n`);
    } finally {
      infoSpy.mockRestore();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  }, 240_000);
});
