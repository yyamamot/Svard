import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const defaultDocumentFiles = [
  "docs/04-implementation-plan.md",
  "docs/01-specification.md",
];

const syntheticDocuments = [
  {
    path: "/perf/plain-small.md",
    basename: "plain-small.md",
    source: `# Plain small

This is a small Markdown document used for render warmup attribution.

- one
- two
- three
`,
  },
  {
    path: "/perf/code-heavy.md",
    basename: "code-heavy.md",
    source: `# Code heavy

\`\`\`ts
export function render(value: string) {
  return value.trim().toUpperCase();
}
\`\`\`

\`\`\`rust
fn main() {
    println!("markup render");
}
\`\`\`

\`\`\`json
{ "name": "svard", "kind": "perf" }
\`\`\`

\`\`\`sql
select id, title from documents where format = 'markdown';
\`\`\`
`,
  },
];

const defaultBudgets = {
  bootWarmPlainWorkerCoreMs: 5,
  firstOpenPenaltyMs: 85,
  repeatedWarmPlainPrepareDocumentHtmlMs: 5,
  repeatedWarmPlainDomReadyMs: 55,
  repeatedWarmSpecPrepareDocumentHtmlMs: 20,
  workerDeliveryPenaltyMs: 35,
};

function parseArgs(argv) {
  const args = {
    budget: false,
    diagnostic: false,
    documents: [],
    out: null,
    port: 4292,
    url: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      args.out = argv[++index] ?? null;
    } else if (value === "--diagnostic") {
      args.diagnostic = true;
    } else if (value === "--budget") {
      args.budget = true;
    } else if (value === "--port") {
      args.port = Number(argv[++index] ?? args.port);
    } else if (value === "--url") {
      args.url = argv[++index] ?? null;
    } else if (value === "--") {
      continue;
    } else {
      args.documents.push(value);
    }
  }
  return args;
}

function basename(filePath) {
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
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

async function readDocuments(documentArgs) {
  const cwd = process.cwd();
  const documentPaths =
    documentArgs.length > 0 ? documentArgs : defaultDocumentFiles;
  const fileDocuments = await Promise.all(
    documentPaths.map(async (documentPath) => {
      const absolutePath = path.resolve(cwd, documentPath);
      const source = await fs.readFile(absolutePath, "utf8");
      return {
        path: `/perf/file/${basename(absolutePath)}`,
        basename: basename(absolutePath),
        bytes: Buffer.byteLength(source),
        source,
      };
    }),
  );
  if (documentArgs.length > 0) {
    return fileDocuments;
  }
  return [
    ...syntheticDocuments.map((document) => ({
      ...document,
      bytes: Buffer.byteLength(document.source),
    })),
    ...fileDocuments,
  ];
}

function summarizePerfEvents(events) {
  return events
    .filter((event) => typeof event?.event === "string")
    .map((event) => ({
      event: event.event,
      deliveryPrimed: event.deliveryPrimed,
      durationMs: event.durationMs,
      bytes: event.bytes,
      count: event.count,
      skipped: event.skipped,
      status: event.status,
      reason: event.reason,
      trigger: event.trigger,
      label: event.label,
      passes: event.passes,
      queueDepth: event.queueDepth,
      renderCoreMs: event.renderCoreMs,
      renderStartDeltaMs: event.renderStartDeltaMs,
      responsePostDeltaMs: event.responsePostDeltaMs,
      reusedWorker: event.reusedWorker,
      sincePostMessageMs: event.sincePostMessageMs,
      workerReceivedAtMs: event.workerReceivedAtMs,
    }));
}

function deriveStopGateSummary(phases) {
  const plainByPhase = Object.fromEntries(
    phases.map((phase) => [
      phase.phase,
      phase.documents.find(
        (document) => document.basename === "plain-small.md",
      ),
    ]),
  );
  const bootWarm = plainByPhase.bootWarmBeforeOpen;
  const repeatedWarm = plainByPhase.repeatedWarm;
  return {
    firstOpenPenaltyMs:
      typeof bootWarm?.domReadyMs === "number" &&
      typeof repeatedWarm?.domReadyMs === "number"
        ? Number((bootWarm.domReadyMs - repeatedWarm.domReadyMs).toFixed(2))
        : null,
    workerDeliveryPenaltyMs:
      typeof bootWarm?.workerDeliveryMs === "number" &&
      typeof repeatedWarm?.workerDeliveryMs === "number"
        ? Number(
            (bootWarm.workerDeliveryMs - repeatedWarm.workerDeliveryMs).toFixed(
              2,
            ),
          )
        : null,
  };
}

function cloneDocumentForPhase(document, phase, index) {
  const safeName = document.basename.replace(/[^A-Za-z0-9_.-]+/g, "-");
  return {
    ...document,
    path: `/perf/${phase}/${index}-${safeName}`,
  };
}

async function installPhaseHarness(page, documents, disableWarmup, diagnostic) {
  await page.addInitScript(
    ({
      diagnostic: nextDiagnostic,
      disableWarmup: nextDisableWarmup,
      docs,
    }) => {
      localStorage.setItem("SVARD_PERF_TRACE", "1");
      if (nextDiagnostic) {
        localStorage.setItem("SVARD_PERF_DIAGNOSTIC", "1");
      } else {
        localStorage.removeItem("SVARD_PERF_DIAGNOSTIC");
      }
      if (nextDisableWarmup) {
        localStorage.setItem("SVARD_DISABLE_MARKDOWN_WARMUP", "1");
      } else {
        localStorage.removeItem("SVARD_DISABLE_MARKDOWN_WARMUP");
      }
      window.__SVARD_PERF_EVENTS__ = [];
      window.__SVARD_LONGTASK_STATUS__ = "unsupported";
      window.__SVARD_LONGTASKS__ = [];
      try {
        const supported = PerformanceObserver.supportedEntryTypes ?? [];
        if (supported.includes("longtask")) {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              window.__SVARD_LONGTASKS__.push({
                duration: entry.duration,
                startTime: entry.startTime,
              });
            }
          });
          observer.observe({ entryTypes: ["longtask"] });
          window.__SVARD_LONGTASK_OBSERVER__ = observer;
          window.__SVARD_LONGTASK_STATUS__ = "ok";
        }
      } catch {
        window.__SVARD_LONGTASK_STATUS__ = "error";
      }
      const originalInfo = console.info.bind(console);
      console.info = (...args) => {
        if (args[0] === "[perf]" && typeof args[1] === "object") {
          window.__SVARD_PERF_EVENTS__.push(args[1]);
        }
        originalInfo(...args);
      };
      window.__SVARD_DOCUMENT_OVERRIDES__ = Object.fromEntries(
        docs.map((doc) => [
          doc.path,
          { source: doc.source, updatedAt: "2026-05-22T00:00:00.000Z" },
        ]),
      );
    },
    {
      diagnostic,
      disableWarmup,
      docs: documents.map((doc) => ({ path: doc.path, source: doc.source })),
    },
  );
}

function eventDuration(events, eventName) {
  const event = events.find((candidate) => candidate.event === eventName);
  return typeof event?.durationMs === "number" ? event.durationMs : null;
}

function eventSkipped(events, eventName) {
  const event = events.find((candidate) => candidate.event === eventName);
  return typeof event?.skipped === "boolean" ? event.skipped : null;
}

function lastEvent(events, eventName) {
  return events.filter((event) => event.event === eventName).at(-1) ?? null;
}

function derivedDocumentSummary(events) {
  const renderDuration = eventDuration(events, "render.renderDocument");
  const markdownDuration = eventDuration(events, "render.markdown.total");
  const firstHtmlSetDuration = eventDuration(
    events,
    "render.firstDocumentHtmlSet",
  );
  const workerResponse = lastEvent(events, "render.workerPool.response");
  const workerMessage = lastEvent(events, "render.workerPool.messageReceived");
  const workerMetrics = lastEvent(events, "render.workerPool.workerMetrics");
  const workerDeliveryMs =
    typeof workerMessage?.sincePostMessageMs === "number" &&
    typeof workerMetrics?.responsePostDeltaMs === "number"
      ? Number(
          (
            workerMessage.sincePostMessageMs - workerMetrics.responsePostDeltaMs
          ).toFixed(2),
        )
      : null;
  return {
    domCommitMs: eventDuration(events, "render.articleInnerHtmlCommit"),
    htmlSetMinusRenderMs:
      firstHtmlSetDuration !== null && renderDuration !== null
        ? Number((firstHtmlSetDuration - renderDuration).toFixed(2))
        : null,
    renderMinusMarkdownMs:
      renderDuration !== null && markdownDuration !== null
        ? Number((renderDuration - markdownDuration).toFixed(2))
        : null,
    workerResponseMs:
      typeof workerResponse?.durationMs === "number"
        ? workerResponse.durationMs
        : null,
    workerCoreMs:
      typeof workerMetrics?.renderCoreMs === "number"
        ? workerMetrics.renderCoreMs
        : null,
    workerDeliveryMs,
    htmlSetToDomReadyMs: null,
    domReadyToFirstFrameMs: null,
    prepareDocumentHtmlMs: eventDuration(events, "render.prepareDocumentHtml"),
    sanitizeMs: eventDuration(events, "render.prepareDocumentHtml.sanitize"),
    sanitizedDomParseMs: eventDuration(
      events,
      "render.prepareDocumentHtml.sanitizedDomParse",
    ),
    sanitizedDomParseSkipped: eventSkipped(
      events,
      "render.prepareDocumentHtml.sanitizedDomParse",
    ),
  };
}

function addDomBoundarySummary(summary, timings) {
  return {
    ...summary,
    domReadyToFirstFrameMs:
      typeof timings.firstFrameAfterDomMs === "number" &&
      typeof timings.domReadyMs === "number"
        ? Number((timings.firstFrameAfterDomMs - timings.domReadyMs).toFixed(2))
        : null,
    htmlSetToDomReadyMs:
      typeof timings.domReadyMs === "number" &&
      typeof timings.firstHtmlSetDuration === "number"
        ? Number((timings.domReadyMs - timings.firstHtmlSetDuration).toFixed(2))
        : null,
  };
}

function budgetResult({ actual, label, limit, metric }) {
  const hasValue = typeof actual === "number" && Number.isFinite(actual);
  return {
    actualMs: hasValue ? actual : null,
    label,
    limitMs: limit,
    metric,
    passed: hasValue ? actual <= limit : false,
    status: hasValue ? "ok" : "missing",
  };
}

function budgetEqualsResult({ actual, expected, label, metric }) {
  const hasValue = actual !== null && actual !== undefined;
  return {
    actual: hasValue ? actual : null,
    expected,
    label,
    metric,
    passed: hasValue ? actual === expected : false,
    status: hasValue ? "ok" : "missing",
  };
}

function deriveBudgetSummary(phases, summary, budgets = defaultBudgets) {
  const plainByPhase = Object.fromEntries(
    phases.map((phase) => [
      phase.phase,
      phase.documents.find(
        (document) => document.basename === "plain-small.md",
      ),
    ]),
  );
  const bootWarm = plainByPhase.bootWarmBeforeOpen;
  const repeatedWarm = plainByPhase.repeatedWarm;
  const repeatedWarmSpec = phases
    .find((phase) => phase.phase === "repeatedWarm")
    ?.documents.find((document) => document.basename === "01-specification.md");
  const budgetResults = [
    budgetResult({
      actual: summary.firstOpenPenaltyMs,
      label:
        "bootWarmBeforeOpen/plain-small.md minus repeatedWarm/plain-small.md",
      limit: budgets.firstOpenPenaltyMs,
      metric: "summary.firstOpenPenaltyMs",
    }),
    budgetResult({
      actual: summary.workerDeliveryPenaltyMs,
      label: "bootWarmBeforeOpen/plain-small.md worker delivery penalty",
      limit: budgets.workerDeliveryPenaltyMs,
      metric: "summary.workerDeliveryPenaltyMs",
    }),
    budgetResult({
      actual: repeatedWarm?.domReadyMs,
      label: "repeatedWarm/plain-small.md",
      limit: budgets.repeatedWarmPlainDomReadyMs,
      metric: "repeatedWarm.plainSmall.domReadyMs",
    }),
    budgetResult({
      actual: repeatedWarm?.prepareDocumentHtmlMs,
      label: "repeatedWarm/plain-small.md prepareDocumentHtml",
      limit: budgets.repeatedWarmPlainPrepareDocumentHtmlMs,
      metric: "repeatedWarm.plainSmall.prepareDocumentHtmlMs",
    }),
    budgetEqualsResult({
      actual: repeatedWarm?.sanitizedDomParseSkipped,
      expected: true,
      label: "repeatedWarm/plain-small.md sanitized DOM parse skipped",
      metric: "repeatedWarm.plainSmall.sanitizedDomParseSkipped",
    }),
    budgetResult({
      actual: repeatedWarmSpec?.prepareDocumentHtmlMs,
      label: "repeatedWarm/01-specification.md prepareDocumentHtml",
      limit: budgets.repeatedWarmSpecPrepareDocumentHtmlMs,
      metric: "repeatedWarm.specification.prepareDocumentHtmlMs",
    }),
    budgetEqualsResult({
      actual: repeatedWarmSpec?.sanitizedDomParseSkipped,
      expected: true,
      label: "repeatedWarm/01-specification.md sanitized DOM parse skipped",
      metric: "repeatedWarm.specification.sanitizedDomParseSkipped",
    }),
    budgetResult({
      actual: bootWarm?.workerCoreMs,
      label: "bootWarmBeforeOpen/plain-small.md",
      limit: budgets.bootWarmPlainWorkerCoreMs,
      metric: "bootWarmBeforeOpen.plainSmall.workerCoreMs",
    }),
  ];
  return {
    budgetPassed: budgetResults.every((result) => result.passed),
    budgetResults,
    budgets,
  };
}

async function pageNow(page) {
  return page.evaluate(() => performance.now());
}

async function collectFrameTimings(page, startedAt) {
  return page.evaluate(async (start) => {
    const first = await new Promise((resolve) => {
      requestAnimationFrame(() => resolve(performance.now()));
    });
    const second = await new Promise((resolve) => {
      requestAnimationFrame(() => resolve(performance.now()));
    });
    return {
      firstFrameAfterDomMs: Number((first - start).toFixed(2)),
      secondFrameAfterDomMs: Number((second - start).toFixed(2)),
    };
  }, startedAt);
}

async function summarizeLongTasks(page, startedAt, endedAt) {
  return page.evaluate(
    ({ end, start }) => {
      const status = window.__SVARD_LONGTASK_STATUS__ ?? "unsupported";
      if (status !== "ok") {
        return {
          count: 0,
          maxDurationMs: 0,
          status,
          totalDurationMs: 0,
        };
      }
      const entries = (window.__SVARD_LONGTASKS__ ?? []).filter(
        (entry) => entry.startTime >= start && entry.startTime <= end,
      );
      const durations = entries.map((entry) => entry.duration);
      return {
        count: entries.length,
        maxDurationMs:
          durations.length > 0 ? Number(Math.max(...durations).toFixed(2)) : 0,
        status: "ok",
        totalDurationMs: Number(
          durations.reduce((total, duration) => total + duration, 0).toFixed(2),
        ),
      };
    },
    { end: endedAt, start: startedAt },
  );
}

async function openDocument(page, document) {
  await page.evaluate(() => {
    window.__SVARD_PERF_EVENTS__ = [];
  });
  await page.evaluate(
    (documentPath) =>
      localStorage.setItem("svard.mockPickDocument", documentPath),
    document.path,
  );
  const nodeStartedAt = performance.now();
  const pageStartedAt = await pageNow(page);
  await page.evaluate(() => {
    window.__SVARD_PERF_EVENTS__?.push({
      event: "openDocument.dispatch.start",
      durationMs: 0,
      status: "started",
    });
  });
  await page.evaluate(() => window.__SVARD_COMMANDS__.dispatch("file.open"));
  await page.waitForFunction(
    (documentPath) =>
      document.querySelector('[data-review-id="document-body"]')?.dataset
        .renderedDocumentPath === documentPath,
    document.path,
  );
  const domReadyMs = Number((performance.now() - nodeStartedAt).toFixed(2));
  await page.evaluate((durationMs) => {
    window.__SVARD_PERF_EVENTS__?.push({
      event: "openDocument.dispatch.done",
      durationMs,
      status: "ok",
    });
  }, domReadyMs);
  const frameTimings = await collectFrameTimings(page, pageStartedAt);
  await page.waitForTimeout(50);
  const pageSettledAt = await pageNow(page);
  const settledMs = Number((performance.now() - nodeStartedAt).toFixed(2));
  const longTasks = await summarizeLongTasks(
    page,
    pageStartedAt,
    pageSettledAt,
  );
  const perfEvents = await page.evaluate(
    () => window.__SVARD_PERF_EVENTS__ ?? [],
  );
  const events = summarizePerfEvents(perfEvents);
  const summary = addDomBoundarySummary(derivedDocumentSummary(events), {
    domReadyMs,
    firstFrameAfterDomMs: frameTimings.firstFrameAfterDomMs,
    firstHtmlSetDuration: eventDuration(events, "render.firstDocumentHtmlSet"),
  });
  return {
    basename: document.basename,
    format: "markdown",
    bytes: document.bytes,
    domReadyMs,
    ...frameTimings,
    longTasks,
    settledMs,
    ...summary,
    events,
  };
}

async function waitForWarmupDone(page, timeoutMs = 5000) {
  await page.waitForFunction(
    () =>
      (window.__SVARD_PERF_EVENTS__ ?? []).some(
        (event) =>
          event?.event === "render.markdownWorkerWarmup.done" ||
          event?.event === "render.markdownWorkerWarmup.failed",
      ),
    undefined,
    { timeout: timeoutMs },
  );
}

async function runReadinessProbe(page) {
  await page.evaluate(() => {
    window.__SVARD_PERF_EVENTS__ = [];
  });
  const result = await page.evaluate(async () => {
    const probe = window.__SVARD_PERF_PROBES__?.probeMarkdownRenderWorkerReady;
    if (typeof probe !== "function") {
      return { durationMs: null, status: "unavailable" };
    }
    const probeResult = await probe();
    return { durationMs: probeResult.durationMs, status: "ok" };
  });
  const events = summarizePerfEvents(
    await page.evaluate(() => window.__SVARD_PERF_EVENTS__ ?? []),
  );
  const workerResponse = lastEvent(events, "render.workerPool.response");
  const summary = derivedDocumentSummary(events);
  return {
    events,
    readinessProbeMs: result.durationMs,
    reusedWorker:
      typeof workerResponse?.reusedWorker === "boolean"
        ? workerResponse.reusedWorker
        : null,
    status: result.status,
    workerResponseMs:
      typeof workerResponse?.durationMs === "number"
        ? workerResponse.durationMs
        : null,
    workerCoreMs: summary.workerCoreMs,
    workerDeliveryMs: summary.workerDeliveryMs,
  };
}

async function runPhase(page, url, phase, documents, options = {}) {
  const {
    readinessProbe = false,
    reload = true,
    waitForWarmup = false,
    waitMsAfterLoad = 0,
  } = options;
  if (reload) {
    await page.goto("about:blank");
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.__SVARD_COMMANDS__));
    await page
      .locator('[data-review-id="document-body"]')
      .waitFor({ state: "attached" });
  }

  if (waitForWarmup) {
    await waitForWarmupDone(page);
  }
  if (waitMsAfterLoad > 0) {
    await page.waitForTimeout(waitMsAfterLoad);
  }
  const warmupEvents = await page.evaluate(
    () => window.__SVARD_PERF_EVENTS__ ?? [],
  );
  const readiness = readinessProbe ? await runReadinessProbe(page) : null;

  const results = [];
  for (const document of documents) {
    results.push(await openDocument(page, document));
  }

  return {
    phase,
    waitForWarmup,
    waitMsAfterLoad,
    readinessProbe: readiness,
    warmupEvents: summarizePerfEvents(warmupEvents).filter((event) =>
      event.event.startsWith("render.markdownWorkerWarmup."),
    ),
    documents: results,
  };
}

function diagnosticEventSummary(events) {
  return events.map((event) => ({
    durationMs: event.durationMs,
    event: event.event,
    label: event.label,
    queueDepth: event.queueDepth,
    renderCoreMs: event.renderCoreMs,
    renderStartDeltaMs: event.renderStartDeltaMs,
    responsePostDeltaMs: event.responsePostDeltaMs,
    reusedWorker: event.reusedWorker,
    sincePostMessageMs: event.sincePostMessageMs,
    status: event.status,
    workerReceivedAtMs: event.workerReceivedAtMs,
  }));
}

async function runDiagnosticSequence(page, documents) {
  const plain = documents.find(
    (document) => document.basename === "plain-small.md",
  );
  if (!plain) {
    return [];
  }

  const sequence = [];
  const firstProbe = await runReadinessProbe(page);
  sequence.push({
    events: diagnosticEventSummary(firstProbe.events),
    iteration: "readinessProbe",
    phase: "bootWarmBeforeOpenDiagnostic",
    readinessProbeMs: firstProbe.readinessProbeMs,
    reusedWorker: firstProbe.reusedWorker,
    status: firstProbe.status,
    workerCoreMs: firstProbe.workerCoreMs,
    workerDeliveryMs: firstProbe.workerDeliveryMs,
    workerResponseMs: firstProbe.workerResponseMs,
  });

  const firstOpen = await openDocument(page, {
    ...plain,
    path: "/perf/diagnostic/first-plain.md",
  });
  sequence.push({
    ...firstOpen,
    events: diagnosticEventSummary(firstOpen.events),
    iteration: "firstPlainOpen",
    phase: "bootWarmBeforeOpenDiagnostic",
  });

  const immediateProbe = await runReadinessProbe(page);
  sequence.push({
    events: diagnosticEventSummary(immediateProbe.events),
    iteration: "immediateProbe",
    phase: "bootWarmBeforeOpenDiagnostic",
    readinessProbeMs: immediateProbe.readinessProbeMs,
    reusedWorker: immediateProbe.reusedWorker,
    status: immediateProbe.status,
    workerCoreMs: immediateProbe.workerCoreMs,
    workerDeliveryMs: immediateProbe.workerDeliveryMs,
    workerResponseMs: immediateProbe.workerResponseMs,
  });

  const secondOpen = await openDocument(page, {
    ...plain,
    path: "/perf/diagnostic/second-plain.md",
  });
  sequence.push({
    ...secondOpen,
    events: diagnosticEventSummary(secondOpen.events),
    iteration: "secondPlainOpen",
    phase: "bootWarmBeforeOpenDiagnostic",
  });

  const repeatedOpen = await openDocument(page, {
    ...plain,
    path: "/perf/diagnostic/repeated-plain.md",
  });
  sequence.push({
    ...repeatedOpen,
    events: diagnosticEventSummary(repeatedOpen.events),
    iteration: "repeatedPlainOpen",
    phase: "bootWarmBeforeOpenDiagnostic",
  });
  return sequence;
}

async function runProbe({ diagnostic, url, documents }) {
  const phaseDocuments = [
    ...documents.map((document, index) =>
      cloneDocumentForPhase(document, "cold-no-warm", index),
    ),
    ...documents.map((document, index) =>
      cloneDocumentForPhase(document, "boot-warm-before-open", index),
    ),
    ...documents.map((document, index) =>
      cloneDocumentForPhase(document, "repeated-warm", index),
    ),
    ...documents.flatMap((document) =>
      document.basename === "plain-small.md"
        ? [
            { ...document, path: "/perf/diagnostic/first-plain.md" },
            { ...document, path: "/perf/diagnostic/second-plain.md" },
            { ...document, path: "/perf/diagnostic/repeated-plain.md" },
          ]
        : [],
    ),
  ];
  const browser = await chromium.launch();
  try {
    const coldPage = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    await installPhaseHarness(coldPage, phaseDocuments, true, diagnostic);

    const warmPage = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    await installPhaseHarness(warmPage, phaseDocuments, false, diagnostic);

    const phases = [];
    phases.push(
      await runPhase(
        coldPage,
        url,
        "coldNoWarm",
        phaseDocuments.filter((document) =>
          document.path.startsWith("/perf/cold-no-warm/"),
        ),
      ),
    );
    phases.push(
      await runPhase(
        warmPage,
        url,
        "bootWarmBeforeOpen",
        phaseDocuments.filter((document) =>
          document.path.startsWith("/perf/boot-warm-before-open/"),
        ),
        { readinessProbe: true, waitForWarmup: true },
      ),
    );
    phases.push(
      await runPhase(
        warmPage,
        url,
        "repeatedWarm",
        phaseDocuments.filter((document) =>
          document.path.startsWith("/perf/repeated-warm/"),
        ),
        { reload: false },
      ),
    );
    const diagnosticSequence = diagnostic
      ? await runDiagnosticSequence(warmPage, phaseDocuments)
      : [];
    return {
      diagnosticSequence,
      phases,
      summary: deriveStopGateSummary(phases),
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const documents = await readDocuments(args.documents);
  let server = null;
  const url = args.url ?? (server = await startServer(args.port)).url;
  try {
    const reportData = await runProbe({
      diagnostic: args.diagnostic,
      documents,
      url,
    });
    const report = {
      ...(args.budget
        ? deriveBudgetSummary(
            reportData.phases,
            reportData.summary,
            defaultBudgets,
          )
        : {}),
      diagnostic: args.diagnostic,
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      ...reportData,
    };
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (args.out) {
      await fs.mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
      await fs.writeFile(args.out, output);
    }
    process.stdout.write(output);
    if (args.budget && !report.budgetPassed) {
      process.exitCode = 1;
    }
  } finally {
    server?.stop();
  }
}

await main();
