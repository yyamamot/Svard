import { chromium } from "@playwright/test";
import { cloneDocumentForPhase } from "./documents.mjs";
import {
  installPhaseHarness,
  openDocument,
  runReadinessProbe,
  waitForWarmupDone,
} from "./browser.mjs";
import {
  summarizePerfEvents,
  diagnosticEventSummary,
  deriveStopGateSummary,
} from "./metrics.mjs";

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

export async function runProbe({ diagnostic, url, documents }) {
  const standardDocuments = documents.filter(
    (document) => !Number.isSafeInteger(document.placeholderDepth),
  );
  const phaseDocuments = [
    ...standardDocuments.map((document, index) =>
      cloneDocumentForPhase(document, "cold-no-warm", index),
    ),
    ...standardDocuments.map((document, index) =>
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
