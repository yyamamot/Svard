import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { diffRenderPhaseFixtures } from "./diff-render-phase-benchmark/fixtures.mjs";
import {
  assertDiffRenderArtifactSafe,
  buildDiffRenderDecisions,
  criticalPathUnionMs,
  round,
  summarizeFixtureSamples,
} from "./diff-render-phase-benchmark/report.mjs";

const warmupCount = 1;
const formalMeasurementCount = 20;
const targetPerfEvents = new Set([
  "diff-artifact-ready",
  "marker-context-ready",
  "table-summary-ready",
]);

export function parseDiffRenderBenchmarkArgs(argv) {
  const args = {
    out: ".artifacts/perf/imp-420-before",
    port: 4295,
    smoke: false,
    url: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") continue;
    if (value === "--out") {
      args.out = argv[++index] ?? args.out;
    } else if (value === "--port") {
      args.port = Number(argv[++index] ?? args.port);
    } else if (value === "--smoke") {
      args.smoke = true;
    } else if (value === "--url") {
      args.url = argv[++index] ?? null;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (!Number.isInteger(args.port) || args.port <= 0 || args.port > 65_535) {
    throw new Error(`Invalid port: ${args.port}`);
  }
  return args;
}

function waitForServer(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    async function poll() {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Retry until the bounded startup deadline.
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(poll, 200);
    }
    void poll();
  });
}

async function startServer(port) {
  const child = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => process.stderr.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  const url = `http://127.0.0.1:${port}/`;
  await waitForServer(url);
  return {
    stop() {
      child.kill();
    },
    url,
  };
}

export function installDiffRenderPerfCollector() {
  localStorage.setItem("SVARD_PERF_TRACE", "1");
  const targetEvents = new Set([
    "diff-artifact-ready",
    "marker-context-ready",
    "table-summary-ready",
  ]);
  const numericKeys = new Set([
    "blockCount",
    "leftBlockCount",
    "leftBlockParseCount",
    "leftBlockParseDurationMs",
    "leftBlockParseEndOffsetMs",
    "leftBlockParseStartOffsetMs",
    "leftPrepareCount",
    "leftPrepareDurationMs",
    "leftPrepareEndOffsetMs",
    "leftPrepareStartOffsetMs",
    "leftRenderCount",
    "leftRenderDurationMs",
    "leftRenderEndOffsetMs",
    "leftRenderStartOffsetMs",
    "leftSourceScanCount",
    "leftSourceScanDurationMs",
    "markerCount",
    "outputBlockCount",
    "perfEntryIndex",
    "presentationEntryCount",
    "renderedMarkerCount",
    "renderedTableCount",
    "rightBlockCount",
    "rightBlockParseCount",
    "rightBlockParseDurationMs",
    "rightBlockParseEndOffsetMs",
    "rightBlockParseStartOffsetMs",
    "rightPrepareCount",
    "rightPrepareDurationMs",
    "rightPrepareEndOffsetMs",
    "rightPrepareStartOffsetMs",
    "rightRenderCount",
    "rightRenderDurationMs",
    "rightRenderEndOffsetMs",
    "rightRenderStartOffsetMs",
    "rightSourceScanCount",
    "rightSourceScanDurationMs",
    "tableMarkerCount",
    "totalDurationMs",
  ]);
  const fixedStringKeys = new Set([
    "event",
    "format",
    "mode",
    "outcome",
    "owner",
  ]);
  const fixedStringValues = new Set([
    "all-diffs",
    "asciidoc",
    "diff-artifact-ready",
    "empty",
    "fallback",
    "handoff",
    "initial",
    "markdown",
    "marker-context-ready",
    "normal-viewer-marker",
    "not-applicable",
    "ready",
    "single-preview",
    "table-summary-ready",
  ]);
  let sampleStartedAt = performance.now();
  let events = [];
  window.__SVARD_DIFF_PERF_BEGIN_SAMPLE__ = () => {
    events = [];
    sampleStartedAt = performance.now();
    return sampleStartedAt;
  };
  window.__SVARD_DIFF_PERF_DRAIN__ = () => events.splice(0);
  const originalInfo = console.info.bind(console);
  console.info = (...args) => {
    if (args[0] === "[perf]") {
      const raw = args[1];
      if (raw && typeof raw === "object" && targetEvents.has(raw.event)) {
        const sanitized = {
          capturedOffsetMs: Number(
            (performance.now() - sampleStartedAt).toFixed(3),
          ),
        };
        for (const [key, value] of Object.entries(raw)) {
          if (numericKeys.has(key) && Number.isFinite(value)) {
            sanitized[key] = value;
          } else if (fixedStringKeys.has(key) && fixedStringValues.has(value)) {
            sanitized[key] = value;
          }
        }
        events.push(sanitized);
      }
      return;
    }
    originalInfo(...args);
  };
}

function numeric(event, key) {
  return typeof event?.[key] === "number" && Number.isFinite(event[key])
    ? event[key]
    : 0;
}

function eventsNamed(events, eventName) {
  return events.filter((event) => event.event === eventName);
}

function singleEvent(events, eventName) {
  const matches = eventsNamed(events, eventName);
  if (matches.length !== 1) {
    throw new Error(
      `Expected one ${eventName} event, received ${matches.length}`,
    );
  }
  return matches[0];
}

function phaseIntervals(event) {
  const workflowStartedAt =
    numeric(event, "capturedOffsetMs") - numeric(event, "totalDurationMs");
  const specs =
    event.event === "diff-artifact-ready"
      ? ["Render", "Prepare", "BlockParse"]
      : event.event === "table-summary-ready"
        ? ["Render", "BlockParse"]
        : ["BlockParse"];
  const intervals = [];
  for (const side of ["left", "right"]) {
    for (const phase of specs) {
      const prefix = `${side}${phase}`;
      const startOffsetMs = event[`${prefix}StartOffsetMs`];
      const endOffsetMs = event[`${prefix}EndOffsetMs`];
      if (
        typeof startOffsetMs !== "number" ||
        typeof endOffsetMs !== "number" ||
        endOffsetMs < startOffsetMs
      ) {
        continue;
      }
      intervals.push({
        endMs: workflowStartedAt + endOffsetMs,
        event,
        phase,
        side,
        startMs: workflowStartedAt + startOffsetMs,
      });
    }
  }
  return intervals;
}

function avoidableUpperBound(allIntervals, avoidableIntervals) {
  const avoidable = new Set(avoidableIntervals);
  const retained = allIntervals.filter((interval) => !avoidable.has(interval));
  return (
    round(
      Math.max(
        0,
        criticalPathUnionMs(allIntervals) - criticalPathUnionMs(retained),
      ),
    ) ?? 0
  );
}

function fixtureContext(document) {
  const documentDir = path.posix.dirname(document.path);
  return {
    attributes: {},
    baseDir: documentDir,
    documentDir,
    resourceRoots: [documentDir],
    workspaceRoot: "/perf/diff",
  };
}

function renderedCoreTuple(document) {
  if (document.format === "markdown") {
    return { format: document.format, source: document.source };
  }
  return {
    asciidocContext: fixtureContext(document),
    format: document.format,
    includeFiles: [],
    path: document.path,
    source: document.source,
  };
}

function tableCoreTuple(document) {
  if (document.format === "markdown") {
    return { format: document.format, source: document.source };
  }
  return {
    asciidocContext: null,
    format: document.format,
    includeFiles: [],
    path: null,
    source: document.source,
  };
}

export function exactInputTupleEqual(left, right) {
  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, canonical(value[key])]),
      );
    }
    return value;
  };
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export function renderedTableExactDuplicateCount(fixture) {
  return fixture.pairs[0]
    ? [fixture.pairs[0].left, fixture.pairs[0].right].filter((document) =>
        exactInputTupleEqual(
          renderedCoreTuple(document),
          tableCoreTuple(document),
        ),
      ).length
    : 0;
}

function normalizedOutcomes(values) {
  return [...values].sort().join(",");
}

export function assertDiffRenderSampleContract(fixture, sample, eventOutcomes) {
  for (const field of [
    "blockParseCount",
    "blockTextParseCount",
    "coreRenderCount",
    "prepareCount",
  ]) {
    if (sample[field] !== fixture.expected[field]) {
      throw new Error(
        `${fixture.fixtureId} ${field} drift: expected ${fixture.expected[field]}, received ${sample[field]}`,
      );
    }
  }
  for (const [eventName, expectedField] of [
    ["diff-artifact-ready", "diffOutcomes"],
    ["marker-context-ready", "markerOutcomes"],
    ["table-summary-ready", "tableOutcomes"],
  ]) {
    const actual = eventOutcomes[eventName] ?? [];
    const expected = fixture.expected[expectedField];
    if (normalizedOutcomes(actual) !== normalizedOutcomes(expected)) {
      throw new Error(
        `${fixture.fixtureId} ${eventName} outcome drift: expected ${normalizedOutcomes(expected) || "none"}, received ${normalizedOutcomes(actual) || "none"}`,
      );
    }
  }
  return "passed";
}

function phaseInvocation(events, suffix) {
  return events.reduce(
    (total, event) =>
      total +
      numeric(event, `left${suffix}`) +
      numeric(event, `right${suffix}`),
    0,
  );
}

function buildSample(fixture, iteration, result) {
  const events = result.events.filter((event) =>
    targetPerfEvents.has(event.event),
  );
  const diffEvents = eventsNamed(events, "diff-artifact-ready");
  const tableEvents = eventsNamed(events, "table-summary-ready");
  const markerEvents = eventsNamed(events, "marker-context-ready");
  let exactDuplicateCount = 0;
  let identityComplete = true;
  let identityStatus = "not-applicable";
  let avoidable = [];
  const counterfactualMeasured = fixture.workflow !== "all-diffs";

  if (fixture.workflow === "rendered-summary") {
    singleEvent(events, "diff-artifact-ready");
  } else if (fixture.workflow === "rendered-table") {
    const diffEvent = singleEvent(events, "diff-artifact-ready");
    const tableEvent = singleEvent(events, "table-summary-ready");
    exactDuplicateCount = renderedTableExactDuplicateCount(fixture);
    identityStatus = exactDuplicateCount === 2 ? "exact" : "mismatch";
    const duplicateSides = ["left", "right"].filter((side) =>
      exactInputTupleEqual(
        renderedCoreTuple(fixture.pairs[0][side]),
        tableCoreTuple(fixture.pairs[0][side]),
      ),
    );
    avoidable = phaseIntervals(tableEvent).filter(
      (interval) =>
        interval.phase === "Render" && duplicateSides.includes(interval.side),
    );
    if (phaseIntervals(diffEvent).length === 0) {
      throw new Error("Rendered summary phase offsets missing");
    }
  } else if (fixture.workflow === "marker-context") {
    const diffEvent = singleEvent(events, "diff-artifact-ready");
    singleEvent(events, "marker-context-ready");
    identityComplete = false;
    identityStatus = "needs-decision";
    avoidable = phaseIntervals(diffEvent).filter(
      (interval) => interval.phase === "Render" && interval.side === "right",
    );
  } else {
    if (diffEvents.length !== fixture.pairs.length) {
      throw new Error(
        `Expected ${fixture.pairs.length} All diffs events, received ${diffEvents.length}`,
      );
    }
    const indexes = diffEvents
      .map((event) => numeric(event, "perfEntryIndex"))
      .sort((left, right) => left - right);
    if (indexes.join(",") !== "0,1") {
      throw new Error(`Unexpected All diffs perfEntryIndex values: ${indexes}`);
    }
    identityComplete = false;
    identityStatus = "needs-decision";
    const firstEvent = diffEvents.find(
      (event) => numeric(event, "perfEntryIndex") === 0,
    );
    if (!firstEvent) {
      throw new Error("All diffs item 0 event missing");
    }
  }

  const allIntervals = events.flatMap(phaseIntervals);
  const avoidableCriticalPathUpperBoundMs = counterfactualMeasured
    ? avoidableUpperBound(allIntervals, avoidable)
    : null;
  const coreEvents = [...diffEvents, ...tableEvents];
  const sample = {
    allDiffsForegroundReadyMs: round(result.allDiffsForegroundReadyMs),
    artifactEstimatedBytes: result.artifactEstimatedBytes,
    avoidableCriticalPathUpperBoundMs,
    avoidableOperationCount: avoidable.length,
    blockCount: result.blockCount,
    blockParseCount: phaseInvocation(coreEvents, "BlockParseCount"),
    blockParseMs:
      round(phaseInvocation(coreEvents, "BlockParseDurationMs")) ?? 0,
    blockTextParseCount: phaseInvocation(markerEvents, "BlockParseCount"),
    blockTextParseMs:
      round(phaseInvocation(markerEvents, "BlockParseDurationMs")) ?? 0,
    conservativeHeadroomMs:
      avoidableCriticalPathUpperBoundMs === null
        ? null
        : (round(0.5 * avoidableCriticalPathUpperBoundMs) ?? 0),
    contractStatus: "passed",
    counterfactualStatus: counterfactualMeasured ? "measured" : "unmeasured",
    coreRenderCount: phaseInvocation(coreEvents, "RenderCount"),
    coreRenderMs: round(phaseInvocation(coreEvents, "RenderDurationMs")) ?? 0,
    diffArtifactReadyMs: round(result.diffArtifactReadyMs),
    exactDuplicateCount,
    firstUsefulMs: round(result.firstUsefulMs) ?? 0,
    fixtureId: fixture.fixtureId,
    format: fixture.format,
    identityComplete,
    identityStatus,
    itemCount: fixture.pairs.length,
    iteration,
    markerContextReadyMs: round(result.markerContextReadyMs),
    markerCount: result.markerCount,
    prepareCount: phaseInvocation(diffEvents, "PrepareCount"),
    prepareMs: round(phaseInvocation(diffEvents, "PrepareDurationMs")) ?? 0,
    renderedCoreRenderCount: phaseInvocation(diffEvents, "RenderCount"),
    tableCoreRenderCount: phaseInvocation(tableEvents, "RenderCount"),
    tableCount: result.tableCount,
    tableSummaryReadyMs: round(result.tableSummaryReadyMs),
    targetKind: counterfactualMeasured ? "workflow-ready" : "unresolved",
    targetMs: counterfactualMeasured ? (round(result.workflowMs) ?? 0) : null,
    workflow: fixture.workflow,
    workflowMs: round(result.workflowMs) ?? 0,
  };
  sample.contractStatus = assertDiffRenderSampleContract(fixture, sample, {
    "diff-artifact-ready": diffEvents.map((event) => event.outcome),
    "marker-context-ready": markerEvents.map((event) => event.outcome),
    "table-summary-ready": tableEvents.map((event) => event.outcome),
  });
  return sample;
}

async function measureFixture(page, fixture, iteration) {
  const result = await page.evaluate(
    async (pageFixture) =>
      window.__SVARD_DIFF_RENDER_BENCHMARK__.runFixture(pageFixture),
    fixture,
  );
  return buildSample(fixture, iteration, result);
}

async function createReport(page, smoke) {
  const fixtures = diffRenderPhaseFixtures;
  const measurementCount = smoke ? 1 : formalMeasurementCount;
  for (const fixture of fixtures) {
    await measureFixture(page, fixture, 0);
  }
  const samples = [];
  for (let iteration = 0; iteration < measurementCount; iteration += 1) {
    const offset = iteration % fixtures.length;
    const ordered = [...fixtures.slice(offset), ...fixtures.slice(0, offset)];
    for (const fixture of ordered) {
      samples.push(await measureFixture(page, fixture, iteration + 1));
    }
  }
  const expectedSampleCount = fixtures.length * measurementCount;
  const status =
    samples.length === expectedSampleCount &&
    samples.every((sample) => sample.contractStatus === "passed")
      ? "ok"
      : "failed";
  return {
    artifactSizeEstimateKind: "serialized-lower-bound",
    benchmarkId: "imp-420-diff-render-phase-baseline",
    browserSessionCount: 1,
    contextCount: 1,
    decisions: buildDiffRenderDecisions(samples),
    executionMode: "production-browser-worker",
    fixtures: fixtures.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      format: fixture.format,
      itemCount: fixture.pairs.length,
      workflow: fixture.workflow,
    })),
    measurementCount,
    pageCount: 1,
    samples,
    schemaVersion: 3,
    status,
    summaries: fixtures.map((fixture) =>
      summarizeFixtureSamples(
        samples.filter((sample) => sample.fixtureId === fixture.fixtureId),
      ),
    ),
    warmupCount,
  };
}

export async function runDiffRenderBenchmark(argv = process.argv.slice(2)) {
  const args = parseDiffRenderBenchmarkArgs(argv);
  const server = args.url ? null : await startServer(args.port);
  const rootUrl = args.url ?? server.url;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(installDiffRenderPerfCollector);
    const page = await context.newPage();
    await page.goto(
      new URL("/scripts/diff-render-phase-benchmark.html", rootUrl).href,
    );
    await page.waitForFunction(
      () => window.__SVARD_DIFF_RENDER_BENCHMARK_READY__ === true,
    );
    const report = await createReport(page, args.smoke);
    assertDiffRenderArtifactSafe(report);
    const outputFile = path.resolve(args.out, "summary.json");
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(
      `Diff render production browser benchmark passed: ${report.samples.length} samples across ${report.fixtures.length} fixtures.\n`,
    );
    await context.close();
    return report;
  } finally {
    await browser.close();
    server?.stop();
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await runDiffRenderBenchmark();
}
