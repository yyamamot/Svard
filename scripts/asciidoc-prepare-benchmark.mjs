import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

import { asciidocPrepareFixtures } from "./asciidoc-prepare-benchmark/fixtures.mjs";
import {
  assertAsciiDocPrepareArtifactSafe,
  round,
  summarizeSamples,
} from "./asciidoc-prepare-benchmark/report.mjs";

const workerPhaseKeys = [
  "expandIncludesMs",
  "documentAttributesMs",
  "diagramPlaceholderMs",
  "convertMs",
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
  "totalMs",
];
const workerCountKeys = [
  "expandedBytes",
  "expandedLines",
  "includeCount",
  "headingCount",
  "sourceBlockCount",
  "sourceTextBlockCount",
  "sourceSelectionBlockCount",
  "diagramCount",
  "sourceAnalysisPasses",
  "sourceAnalysisVisitedCodeUnitsEstimate",
];

function parseArgs(argv) {
  const args = {
    out: ".artifacts/perf/imp-411-baseline",
    port: 4293,
    profile: "full",
    url: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") continue;
    if (value === "--out") {
      args.out = argv[++index] ?? args.out;
    } else if (value === "--port") {
      args.port = Number(argv[++index] ?? args.port);
    } else if (value === "--profile") {
      args.profile = argv[++index] ?? args.profile;
    } else if (value === "--url") {
      args.url = argv[++index] ?? null;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (!new Set(["full", "quick"]).has(args.profile)) {
    throw new Error(`Unsupported profile: ${args.profile}`);
  }
  return args;
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`${command} exited with ${code}`));
      } else {
        resolve();
      }
    });
  });
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
        // Retry until timeout.
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(poll, 250);
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
    url,
    stop() {
      child.kill();
    },
  };
}

function lastEvent(events, eventName) {
  return events.filter((event) => event?.event === eventName).at(-1) ?? null;
}

function eventDuration(events, eventName) {
  const event = lastEvent(events, eventName);
  return typeof event?.durationMs === "number" ? round(event.durationMs) : null;
}

function safeWorkerPhases(events) {
  const event = lastEvent(events, "render.asciidoc.workerPhases");
  return Object.fromEntries(
    workerPhaseKeys.map((key) => [
      key,
      typeof event?.[key] === "number" ? round(event[key]) : null,
    ]),
  );
}

function safeWorkerCounts(events) {
  const event = lastEvent(events, "render.asciidoc.workerPhases");
  return Object.fromEntries(
    workerCountKeys.map((key) => [
      key,
      Number.isSafeInteger(event?.[key]) && event[key] >= 0 ? event[key] : null,
    ]),
  );
}

async function installHarness(page, documents) {
  await page.addInitScript((docs) => {
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    localStorage.setItem("SVARD_PERF_DIAGNOSTIC", "1");
    window.__SVARD_PERF_EVENTS__ = [];
    const originalInfo = console.info.bind(console);
    console.info = (...args) => {
      if (args[0] === "[perf]" && args[1] && typeof args[1] === "object") {
        window.__SVARD_PERF_EVENTS__.push(args[1]);
      }
      originalInfo(...args);
    };
    window.__SVARD_DOCUMENT_OVERRIDES__ = Object.fromEntries(
      docs.map((document) => [
        document.path,
        {
          source: document.source,
          updatedAt: "2026-07-14T00:00:00.000Z",
        },
      ]),
    );
  }, documents);
}

async function openDocument(page, document, iteration) {
  await page.evaluate(() => {
    window.__SVARD_PERF_EVENTS__ = [];
  });
  await page.evaluate(
    (documentPath) =>
      localStorage.setItem("svard.mockPickDocument", documentPath),
    document.path,
  );
  const startedAt = performance.now();
  await page.evaluate(() => window.__SVARD_COMMANDS__.dispatch("file.open"));
  await page.waitForFunction(
    (documentPath) =>
      document.querySelector('[data-review-id="document-body"]')?.dataset
        .renderedDocumentPath === documentPath,
    document.path,
  );
  const domReadyMs = round(performance.now() - startedAt);
  const events = await page.evaluate(() => window.__SVARD_PERF_EVENTS__ ?? []);
  const workerMetrics = lastEvent(events, "render.workerPool.workerMetrics");
  const workerMessage = lastEvent(events, "render.workerPool.messageReceived");
  const workerResponse = lastEvent(events, "render.workerPool.response");
  const queueWait = lastEvent(events, "render.workerPool.queueWait");
  return {
    commitMs: eventDuration(events, "render.articleInnerHtmlCommit"),
    domReadyMs,
    iteration,
    prepareMs: eventDuration(events, "render.prepareDocumentHtml"),
    postMessageMs: eventDuration(events, "render.workerPool.postMessageQueued"),
    queueWaitMs: eventDuration(events, "render.workerPool.queueWait"),
    queueDepth:
      Number.isSafeInteger(queueWait?.queueDepth) && queueWait.queueDepth >= 0
        ? queueWait.queueDepth
        : null,
    renderDocumentMs: eventDuration(events, "render.renderDocument"),
    workerCoreMs:
      typeof workerMetrics?.renderCoreMs === "number"
        ? round(workerMetrics.renderCoreMs)
        : null,
    workerDeliveryMs:
      typeof workerMessage?.sincePostMessageMs === "number" &&
      typeof workerMetrics?.responsePostDeltaMs === "number"
        ? round(
            Math.max(
              0,
              workerMessage.sincePostMessageMs -
                workerMetrics.responsePostDeltaMs,
            ),
          )
        : null,
    workerCounts: safeWorkerCounts(events),
    workerPhases: safeWorkerPhases(events),
    workerReused: workerResponse?.reusedWorker === true,
    workerRoundTripMs: eventDuration(events, "render.workerPool.response"),
  };
}

function summarizeProductionWorker(samples) {
  const fields = [
    "domReadyMs",
    "queueWaitMs",
    "postMessageMs",
    "workerRoundTripMs",
    "workerCoreMs",
    "workerDeliveryMs",
    "renderDocumentMs",
    "prepareMs",
    "commitMs",
  ];
  return {
    fixtureId: "plain-large",
    measurementCount: samples.length,
    durations: Object.fromEntries(
      fields.map((field) => [
        field,
        summarizeSamples(samples.map((sample) => sample[field])),
      ]),
    ),
    workerPhases: Object.fromEntries(
      workerPhaseKeys.map((key) => [
        key,
        summarizeSamples(samples.map((sample) => sample.workerPhases[key])),
      ]),
    ),
    work: {
      maxQueueDepth: Math.max(
        ...samples.map((sample) => sample.queueDepth ?? 0),
      ),
      reusedWorkerCount: samples.filter((sample) => sample.workerReused).length,
      ...Object.fromEntries(
        workerCountKeys.map((key) => [
          key,
          Math.max(...samples.map((sample) => sample.workerCounts[key] ?? 0)),
        ]),
      ),
    },
  };
}

async function runProductionWorkerProbe(url) {
  const fixture = asciidocPrepareFixtures.find(
    (candidate) => candidate.fixtureId === "plain-large",
  );
  if (!fixture) throw new Error("plain-large fixture missing");
  const documents = Array.from({ length: 21 }, (_, index) => ({
    path: `/perf/asciidoc/production-${index}.adoc`,
    source: fixture.source,
  }));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    await installHarness(page, documents);
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.__SVARD_COMMANDS__));
    await page.locator('[data-review-id="document-body"]').waitFor({
      state: "attached",
    });
    await openDocument(page, documents[0], -1);
    const samples = [];
    for (let index = 1; index < documents.length; index += 1) {
      samples.push(await openDocument(page, documents[index], index));
    }
    const report = summarizeProductionWorker(samples);
    if (
      report.measurementCount !== 20 ||
      report.durations.workerCoreMs.count !== 20 ||
      report.workerPhases.totalMs.count !== 20
    ) {
      throw new Error("production worker metrics incomplete");
    }
    return report;
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDirectory = path.resolve(args.out);
  const summaryPath = path.join(outputDirectory, "summary.json");
  if (args.profile === "quick") {
    const report = {
      profile: "quick",
      reason: "phase-baseline-full-only",
      schemaVersion: 1,
      status: "skipped",
    };
    assertAsciiDocPrepareArtifactSafe(report);
    await writeJson(summaryPath, report);
    return;
  }

  await runCommand(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "test/perf/asciidocPrepareBenchmark.test.ts",
      "--reporter",
      "dot",
    ],
    { SVARD_ASCIIDOC_PREPARE_BENCHMARK_OUT: summaryPath },
  );
  const server = args.url ? null : await startServer(args.port);
  try {
    const productionWorker = await runProductionWorkerProbe(
      args.url ?? server.url,
    );
    const report = JSON.parse(await fs.readFile(summaryPath, "utf8"));
    const merged = {
      ...report,
      productionWorker,
    };
    assertAsciiDocPrepareArtifactSafe(merged);
    const serialized = JSON.stringify(merged);
    if (
      serialized.includes("/perf/asciidoc/") ||
      serialized.includes("Generated paragraph")
    ) {
      throw new Error("private benchmark data reached summary artifact");
    }
    await writeJson(summaryPath, merged);
  } finally {
    server?.stop();
  }
}

await main();
