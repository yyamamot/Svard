import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { mainViewerRenderFixtures } from "./main-viewer-render-benchmark/fixtures.mjs";
import {
  assertMainViewerRenderArtifactSafe,
  buildMainViewerAdoptionComparison,
  buildMainViewerRenderArtifact,
  combineMainViewerFormalConfirmation,
  compareMainViewerBaselineHeadroom,
  mainViewerRenderRuntime,
  round,
} from "./main-viewer-render-benchmark/report.mjs";

const warmupCount = 1;
const formalMeasurementCount = 20;
const sampleTimeoutMs = 10_000;

export function parseMainViewerRenderBenchmarkArgs(argv) {
  const args = {
    baseline: null,
    confirmation: null,
    headroomFormal: null,
    out: ".artifacts/perf/imp-560-main-viewer-render-formal.json",
    port: 4297,
    runMode: "formal",
    smoke: false,
    url: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") continue;
    if (value === "--baseline") {
      args.baseline = argv[++index] ?? null;
    } else if (value === "--confirmation") {
      args.confirmation = argv[++index] ?? null;
    } else if (value === "--out") {
      args.out = argv[++index] ?? args.out;
    } else if (value === "--headroom-formal") {
      args.headroomFormal = argv[++index] ?? null;
    } else if (value === "--port") {
      args.port = Number(argv[++index] ?? args.port);
    } else if (value === "--run-mode") {
      args.runMode = argv[++index] ?? args.runMode;
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
  if (args.runMode !== "formal" && args.runMode !== "confirmation") {
    throw new Error(`Invalid run mode: ${args.runMode}`);
  }
  if (args.confirmation && !args.baseline) {
    throw new Error("--confirmation requires --baseline");
  }
  if (args.confirmation && args.runMode !== "confirmation") {
    throw new Error("--confirmation requires --run-mode confirmation");
  }
  if (args.headroomFormal && args.runMode !== "confirmation") {
    throw new Error("--headroom-formal requires --run-mode confirmation");
  }
  return args;
}

function runCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => process.stderr.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Main Viewer production build failed (${signal ?? `exit ${code}`})`,
        ),
      );
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
        // Retry until the bounded startup deadline.
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("Timed out waiting for the Main Viewer benchmark"));
        return;
      }
      setTimeout(poll, 200);
    }
    void poll();
  });
}

async function startServer(port) {
  await runCommand(["exec", "vite", "build"]);
  const child = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "preview",
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
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return {
    runtime: mainViewerRenderRuntime,
    stop() {
      child.kill();
    },
    url,
  };
}

function rotatedFixtures(roundIndex) {
  const offset = roundIndex % mainViewerRenderFixtures.length;
  return [
    ...mainViewerRenderFixtures.slice(offset),
    ...mainViewerRenderFixtures.slice(0, offset),
  ];
}

function latestEvent(events, name, predicate = () => true) {
  return events
    .filter((event) => event?.event === name && predicate(event))
    .at(-1);
}

function matchingEvents(events, name, predicate = () => true) {
  return events.filter((event) => event?.event === name && predicate(event));
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function eventDuration(event) {
  return round(numeric(event?.durationMs));
}

function eventCount(event, key) {
  return numeric(event?.[key]);
}

function sumDurations(values) {
  if (values.some((value) => value === null)) return null;
  return round(values.reduce((total, value) => total + value, 0));
}

export function buildMainViewerRenderSample({
  events,
  expectedMediaCount,
  fixtureId,
  sampleIndex,
  sampleStartedAt,
  waitCompleted,
}) {
  const workerMessage = latestEvent(
    events,
    "render.workerPool.messageReceived",
  );
  const workerMetrics = latestEvent(events, "render.workerPool.workerMetrics");
  const resolver = latestEvent(
    events,
    "render.prepareDocumentHtml.imageResolver",
  );
  const decode = latestEvent(
    events,
    "render.imageDecode.complete",
    (event) => event.status !== "stale",
  );
  const frame1 = latestEvent(
    events,
    "render.commitFrame",
    (event) => event.frame === 1,
  );
  const frame2 = latestEvent(
    events,
    "render.commitFrame",
    (event) => event.frame === 2,
  );
  const layout = latestEvent(events, "render.layoutStability");
  const searchCleanup = latestEvent(
    events,
    "render.search.cleanup",
    (event) => event.status === "complete",
  );
  const activeHeading = latestEvent(
    events,
    "render.activeHeading.measure",
    (event) => event.trigger === "initial",
  );
  const linkCollectEvents = matchingEvents(
    events,
    "render.linkInspector.collect",
    (event) => event.status === "ready",
  );
  const linkBuildEvents = matchingEvents(
    events,
    "render.linkInspector.build",
    (event) => event.status === "ready",
  );
  const linkCollect = linkCollectEvents.at(-1);
  const linkBuild = linkBuildEvents.at(-1);
  const prepare = latestEvent(events, "render.prepareDocumentHtml");
  const sanitize = latestEvent(events, "render.prepareDocumentHtml.sanitize");
  const commit = latestEvent(events, "render.articleInnerHtmlCommit");
  const workerCoreMs = round(numeric(workerMetrics?.renderCoreMs));
  const workerDeliveryMs =
    numeric(workerMessage?.sincePostMessageMs) !== null &&
    numeric(workerMetrics?.responsePostDeltaMs) !== null
      ? round(
          workerMessage.sincePostMessageMs - workerMetrics.responsePostDeltaMs,
        )
      : null;
  const postCommitMs = sumDurations([
    eventDuration(searchCleanup),
    eventDuration(activeHeading),
    sumDurations(linkCollectEvents.map(eventDuration)),
    sumDurations(linkBuildEvents.map(eventDuration)),
  ]);
  const counts = {
    htmlCommitCount: events.filter(
      (event) => event?.event === "render.articleInnerHtmlCommit",
    ).length,
    staleDecodeCount: events.filter(
      (event) =>
        event?.event === "render.imageDecode.complete" &&
        event.status === "stale",
    ).length,
    layoutTimeoutCount: events.filter(
      (event) =>
        event?.event === "render.layoutStability" && event.status === "timeout",
    ).length,
    resolverCallCount: eventCount(resolver, "callCount"),
    resolverResolvedCount: eventCount(resolver, "resolvedCount"),
    resolverBlockedCount: eventCount(resolver, "blockedCount"),
    resolverErrorCount: eventCount(resolver, "errorCount"),
    mediaElementCount: eventCount(decode, "imageCount"),
    decodedCount: eventCount(decode, "decodedCount"),
    decodeErrorCount: eventCount(decode, "errorCount"),
    layoutFrameCount: eventCount(layout, "frameCount"),
    searchMarkCount: eventCount(searchCleanup, "markCount"),
    headingCount: eventCount(activeHeading, "headingCount"),
    headingMeasurementCount: eventCount(activeHeading, "measurementCount"),
    linkCount: eventCount(linkCollect, "linkCount"),
    linkInspectorCollectCount: linkCollectEvents.length,
    linkInspectorBuildCount: linkBuildEvents.length,
    outgoingCount: eventCount(linkBuild, "outgoingCount"),
    backlinkCount: eventCount(linkBuild, "backlinkCount"),
  };
  const timings = {
    viewerReadyMs: null,
    workerCoreMs,
    workerDeliveryMs,
    prepareMs: eventDuration(prepare),
    sanitizeMs: eventDuration(sanitize),
    resolverMs: eventDuration(resolver),
    commitMs: eventDuration(commit),
    decodeMs: eventDuration(decode),
    frame1Ms: eventDuration(frame1),
    frame2Ms: eventDuration(frame2),
    layoutStabilityMs: eventDuration(layout),
    searchCleanupMs: eventDuration(searchCleanup),
    activeHeadingMs: eventDuration(activeHeading),
    linkInspectorCollectMs: sumDurations(linkCollectEvents.map(eventDuration)),
    linkInspectorBuildMs: sumDurations(linkBuildEvents.map(eventDuration)),
    postCommitMs,
  };
  const requiredEvents = [
    workerMessage,
    workerMetrics,
    resolver,
    decode,
    frame1,
    frame2,
    layout,
    searchCleanup,
    activeHeading,
    linkCollect,
    linkBuild,
    prepare,
    sanitize,
    commit,
  ];
  const readyCapturedAt = requiredEvents
    .map((event) => numeric(event?.captureAtMs))
    .filter((value) => value !== null)
    .reduce((latest, value) => Math.max(latest, value), -Infinity);
  timings.viewerReadyMs =
    numeric(sampleStartedAt) !== null && Number.isFinite(readyCapturedAt)
      ? round(readyCapturedAt - sampleStartedAt)
      : null;
  const expectedDecodeStatus = expectedMediaCount === 0 ? "empty" : "ready";
  const contractMatches =
    counts.htmlCommitCount === 1 &&
    counts.staleDecodeCount === 0 &&
    counts.layoutTimeoutCount === 0 &&
    counts.resolverCallCount === expectedMediaCount &&
    counts.resolverResolvedCount === expectedMediaCount &&
    counts.resolverBlockedCount === 0 &&
    counts.resolverErrorCount === 0 &&
    counts.mediaElementCount === expectedMediaCount &&
    counts.decodedCount === expectedMediaCount &&
    counts.decodeErrorCount === 0 &&
    decode?.status === expectedDecodeStatus &&
    layout?.status === "ready";
  return {
    counts,
    fixtureId,
    sampleIndex,
    status:
      waitCompleted &&
      requiredEvents.every(Boolean) &&
      Object.values(timings).every((value) => value !== null) &&
      contractMatches
        ? "ok"
        : "incomplete",
    timings,
  };
}

async function installPerfHarness(page) {
  await page.addInitScript(() => {
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    localStorage.setItem("SVARD_PERF_DIAGNOSTIC", "1");
    window.__SVARD_MAIN_VIEWER_PERF_EVENTS__ = [];
    window.__SVARD_DOCUMENT_OVERRIDES__ = {};
    const originalInfo = console.info.bind(console);
    console.info = (...args) => {
      if (args[0] === "[perf]" && args[1] && typeof args[1] === "object") {
        window.__SVARD_MAIN_VIEWER_PERF_EVENTS__.push({
          ...args[1],
          captureAtMs: performance.now(),
        });
      }
      originalInfo(...args);
    };
  });
}

async function flushBrowserEffects(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
}

async function runBrowserSample(page, fixture, sampleIndex) {
  const documentPath = `/workspace/docs/imp-560-${fixture.fixtureId}.md`;
  const updatedAt = `2026-08-30T00:00:${String(sampleIndex + 2).padStart(2, "0")}.000Z`;
  await flushBrowserEffects(page);
  await page.evaluate(
    ({ nextDocumentPath, nextUpdatedAt, source }) => {
      window.__SVARD_DOCUMENT_OVERRIDES__[nextDocumentPath] = {
        source,
        updatedAt: nextUpdatedAt,
      };
      window.__SVARD_MAIN_VIEWER_PERF_EVENTS__ = [];
      window.__SVARD_MAIN_VIEWER_SAMPLE_STARTED_AT__ = performance.now();
      localStorage.setItem("svard.mockPickDocument", nextDocumentPath);
    },
    {
      nextDocumentPath: documentPath,
      nextUpdatedAt: updatedAt,
      source: fixture.source,
    },
  );
  await page.evaluate(() => window.__SVARD_COMMANDS__.dispatch("file.open"));
  await page.waitForFunction(
    (nextDocumentPath) =>
      document.querySelector('[data-review-id="document-body"]')?.dataset
        .renderedDocumentPath === nextDocumentPath,
    documentPath,
    { timeout: sampleTimeoutMs },
  );
  let waitCompleted = true;
  try {
    await page.waitForFunction(
      () => {
        const events = window.__SVARD_MAIN_VIEWER_PERF_EVENTS__ ?? [];
        const has = (name, predicate = () => true) =>
          events.some((event) => event?.event === name && predicate(event));
        return (
          has(
            "render.imageDecode.complete",
            (event) => event.status !== "stale",
          ) &&
          has("render.commitFrame", (event) => event.frame === 2) &&
          has("render.layoutStability") &&
          has(
            "render.search.cleanup",
            (event) => event.status === "complete",
          ) &&
          has(
            "render.activeHeading.measure",
            (event) => event.trigger === "initial",
          ) &&
          has(
            "render.linkInspector.collect",
            (event) => event.status === "ready",
          ) &&
          has("render.linkInspector.build", (event) => event.status === "ready")
        );
      },
      undefined,
      { timeout: sampleTimeoutMs },
    );
  } catch {
    waitCompleted = false;
  }
  await flushBrowserEffects(page);
  const collected = await page.evaluate((nextDocumentPath) => {
    const startedAt = window.__SVARD_MAIN_VIEWER_SAMPLE_STARTED_AT__;
    const result = {
      events: window.__SVARD_MAIN_VIEWER_PERF_EVENTS__ ?? [],
      sampleStartedAt: typeof startedAt === "number" ? startedAt : null,
    };
    delete window.__SVARD_DOCUMENT_OVERRIDES__[nextDocumentPath];
    return result;
  }, documentPath);
  return buildMainViewerRenderSample({
    ...collected,
    expectedMediaCount: fixture.expectedMediaCount,
    fixtureId: fixture.fixtureId,
    sampleIndex,
    waitCompleted,
  });
}

async function runBrowserMeasurements({ baseUrl, measurementCount }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  await installPerfHarness(page);
  try {
    await page.goto(`${baseUrl}/?scenario=imp-560-main-viewer-render`, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() => Boolean(window.__SVARD_COMMANDS__), {
      timeout: 30_000,
    });
    await page
      .locator('[data-review-id="document-body"]')
      .waitFor({ state: "attached" });
    await page
      .waitForFunction(
        () =>
          (window.__SVARD_MAIN_VIEWER_PERF_EVENTS__ ?? []).some(
            (event) =>
              event?.event === "render.markdownWorkerWarmup.done" ||
              event?.event === "render.markdownWorkerWarmup.failed",
          ),
        undefined,
        { timeout: 5_000 },
      )
      .catch(() => undefined);
    for (let warmupIndex = 0; warmupIndex < warmupCount; warmupIndex += 1) {
      for (const fixture of rotatedFixtures(warmupIndex)) {
        await runBrowserSample(page, fixture, -1);
      }
    }
    const samples = [];
    for (
      let sampleIndex = 0;
      sampleIndex < measurementCount;
      sampleIndex += 1
    ) {
      for (const fixture of rotatedFixtures(sampleIndex)) {
        samples.push(await runBrowserSample(page, fixture, sampleIndex));
      }
    }
    return samples;
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function runMainViewerRenderBenchmark(
  argv = process.argv.slice(2),
) {
  const args = parseMainViewerRenderBenchmarkArgs(argv);
  const server = args.url ? null : await startServer(args.port);
  const baseUrl = args.url ?? server?.url;
  const runtime = server?.runtime ?? "chromium-external-url";
  if (!baseUrl) throw new Error("Main Viewer benchmark URL is unavailable");
  try {
    const measurementCount = args.smoke ? 1 : formalMeasurementCount;
    const samples = await runBrowserMeasurements({
      baseUrl,
      measurementCount,
    });
    const mode = args.runMode;
    let artifact = buildMainViewerRenderArtifact({
      fixtures: mainViewerRenderFixtures,
      measurementCount,
      mode,
      runtime,
      samples,
    });
    if (args.baseline) {
      const baseline = JSON.parse(await fs.readFile(args.baseline, "utf8"));
      assertMainViewerRenderArtifactSafe(baseline);
      artifact = {
        ...artifact,
        adoption: buildMainViewerAdoptionComparison(baseline, artifact),
      };
    } else {
      artifact = {
        ...artifact,
        adoption: {
          candidatePhase: artifact.headroom.selectedCandidate,
          contractStatus: "mismatch",
          reasons: ["missing-baseline"],
          status: "needs-baseline",
          targetFixtureId: artifact.headroom.selectedFixtureId,
        },
      };
    }
    if (args.confirmation) {
      const formal = JSON.parse(await fs.readFile(args.confirmation, "utf8"));
      assertMainViewerRenderArtifactSafe(formal);
      artifact = combineMainViewerFormalConfirmation(formal, artifact);
    }
    if (args.headroomFormal) {
      const formal = JSON.parse(await fs.readFile(args.headroomFormal, "utf8"));
      assertMainViewerRenderArtifactSafe(formal);
      artifact = {
        ...artifact,
        headroomConfirmation: compareMainViewerBaselineHeadroom(
          formal,
          artifact,
        ),
      };
    }
    assertMainViewerRenderArtifactSafe(artifact);
    await fs.mkdir(path.dirname(args.out), { recursive: true });
    await fs.writeFile(args.out, `${JSON.stringify(artifact, null, 2)}\n`);
    process.stdout.write(
      `${artifact.runMode}: ${artifact.confirmationDecision?.status ?? artifact.adoption.status}\n`,
    );
    return artifact;
  } finally {
    server?.stop();
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  await runMainViewerRenderBenchmark();
}
