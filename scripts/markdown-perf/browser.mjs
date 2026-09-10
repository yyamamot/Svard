import {
  summarizePerfEvents,
  addDomBoundarySummary,
  derivedDocumentSummary,
  eventDuration,
  lastEvent,
} from "./metrics.mjs";

export async function installPhaseHarness(
  page,
  documents,
  disableWarmup,
  diagnostic,
) {
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

export async function openDocument(page, document) {
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
  const isPlaceholderMeasurement = Number.isSafeInteger(
    document.placeholderDepth,
  );
  const outputBytes = isPlaceholderMeasurement
    ? await page
        .locator('[data-review-id="document-body"]')
        .evaluate(
          (element) => new TextEncoder().encode(element.innerHTML).byteLength,
        )
    : null;
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
    ...(isPlaceholderMeasurement
      ? { outputBytes, placeholderDepth: document.placeholderDepth }
      : {}),
    domReadyMs,
    ...frameTimings,
    longTasks,
    settledMs,
    ...summary,
    events,
  };
}

export async function waitForWarmupDone(page, timeoutMs = 5000) {
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

export async function runReadinessProbe(page) {
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
