import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addDomBoundarySummary,
  derivePlaceholderMeasurements,
  derivedDocumentSummary,
  deriveStopGateSummary,
  diagnosticEventSummary,
  summarizePerfEvents,
  withoutPlaceholderMeasurementDocuments,
  // @ts-expect-error Node script module has no TypeScript declaration.
} from "../../scripts/markdown-perf/metrics.mjs";
import {
  budgetResult,
  budgetEqualsResult,
  defaultBudgets,
  deriveBudgetSummary,
  placeholderMeasurementsGrowLinearly,
  // @ts-expect-error Node script module has no TypeScript declaration.
} from "../../scripts/markdown-perf/budgets.mjs";
import {
  createPlaceholderChainSource,
  placeholderChainDepths,
  // @ts-expect-error Node script module has no TypeScript declaration.
} from "../../scripts/markdown-perf/documents.mjs";

const readModule = (name: string) =>
  fs.readFileSync(
    path.join(process.cwd(), `scripts/markdown-perf/${name}.mjs`),
    "utf8",
  );

function placeholderDocuments() {
  return placeholderChainDepths.map((depth: number) => ({
    placeholderDepth: depth,
    bytes: depth * 100,
    outputBytes: depth * 200,
    events: [
      {
        event: "render.markdown.replaceDetails",
        count: depth * 2,
        durationMs: depth / 10,
      },
    ],
  }));
}

describe("markdown perf probe script", () => {
  it("separates DOM ready and settled timings", () => {
    const source = readModule("browser");
    for (const field of [
      "domReadyMs",
      "firstFrameAfterDomMs",
      "secondFrameAfterDomMs",
      "settledMs",
    ])
      expect(source).toContain(field);
    expect(source.indexOf("const domReadyMs")).toBeLessThan(
      source.indexOf("await page.waitForTimeout(50)"),
    );
    expect(source.indexOf("const settledMs")).toBeGreaterThan(
      source.indexOf("await page.waitForTimeout(50)"),
    );
    expect(source).not.toContain("wallMs:");
    const summary = source.slice(
      source.indexOf("return {", source.indexOf("async function openDocument")),
      source.indexOf("async function waitForWarmupDone"),
    );
    expect(summary).not.toContain("absolutePath");
    expect(summary).not.toContain("source");
  });

  it("records readiness and derived phase timings without private payload fields", () => {
    const events = [
      { event: "render.renderDocument", durationMs: 20 },
      { event: "render.markdown.total", durationMs: 8 },
      { event: "render.firstDocumentHtmlSet", durationMs: 25 },
      { event: "render.articleInnerHtmlCommit", durationMs: 2 },
      { event: "render.workerPool.response", durationMs: 40 },
      { event: "render.workerPool.response", durationMs: 30 },
      {
        event: "render.workerPool.messageReceived",
        sincePostMessageMs: 18.555,
      },
      {
        event: "render.workerPool.workerMetrics",
        responsePostDeltaMs: 8,
        renderCoreMs: 7,
      },
      { event: "render.prepareDocumentHtml", durationMs: 4 },
      { event: "render.prepareDocumentHtml.sanitize", durationMs: 1 },
      {
        event: "render.prepareDocumentHtml.sanitizedDomParse",
        durationMs: 0,
        skipped: true,
      },
    ];
    expect(derivedDocumentSummary(events)).toEqual({
      domCommitMs: 2,
      htmlSetMinusRenderMs: 5,
      renderMinusMarkdownMs: 12,
      workerResponseMs: 30,
      workerCoreMs: 7,
      workerDeliveryMs: 10.55,
      htmlSetToDomReadyMs: null,
      domReadyToFirstFrameMs: null,
      prepareDocumentHtmlMs: 4,
      sanitizeMs: 1,
      sanitizedDomParseMs: 0,
      sanitizedDomParseSkipped: true,
    });
    expect(
      Object.values(derivedDocumentSummary([])).every(
        (value) => value === null,
      ),
    ).toBe(true);
    expect(
      addDomBoundarySummary(
        {},
        { domReadyMs: 30, firstFrameAfterDomMs: 35, firstHtmlSetDuration: 25 },
      ),
    ).toEqual({ domReadyToFirstFrameMs: 5, htmlSetToDomReadyMs: 5 });
    expect(addDomBoundarySummary({}, {})).toEqual({
      domReadyToFirstFrameMs: null,
      htmlSetToDomReadyMs: null,
    });
    expect(deriveStopGateSummary([])).toEqual({
      firstOpenPenaltyMs: null,
      workerDeliveryPenaltyMs: null,
    });
    expect(
      deriveStopGateSummary([
        {
          phase: "bootWarmBeforeOpen",
          documents: [
            {
              basename: "plain-small.md",
              domReadyMs: 100,
              workerDeliveryMs: 40,
            },
          ],
        },
        {
          phase: "repeatedWarm",
          documents: [
            {
              basename: "plain-small.md",
              domReadyMs: 55,
              workerDeliveryMs: 10,
            },
          ],
        },
      ]),
    ).toEqual({ firstOpenPenaltyMs: 45, workerDeliveryPenaltyMs: 30 });
  });

  it("handles unsupported longtask observation without failing", () => {
    const source = readModule("browser");
    expect(source).toContain(
      'window.__SVARD_LONGTASK_STATUS__ = "unsupported"',
    );
    expect(source).toContain('status !== "ok"');
    expect(source).toContain("maxDurationMs");
    expect(source).toContain("totalDurationMs");
  });

  it("summarizes worker-side diagnostic metrics without private payload fields", () => {
    const event = {
      event: "render.workerPool.workerMetrics",
      durationMs: 2,
      renderCoreMs: 1,
      source: "private",
      path: "/private",
      absolutePath: "/private",
      renderedHtml: "private",
      result: {},
    };
    const [summary] = summarizePerfEvents([null, {}, event]);
    expect(Object.keys(summary)).toEqual([
      "event",
      "deliveryPrimed",
      "durationMs",
      "bytes",
      "count",
      "skipped",
      "status",
      "reason",
      "trigger",
      "label",
      "passes",
      "queueDepth",
      "renderCoreMs",
      "renderStartDeltaMs",
      "responsePostDeltaMs",
      "reusedWorker",
      "sincePostMessageMs",
      "workerReceivedAtMs",
    ]);
    expect(Object.keys(diagnosticEventSummary([event])[0])).toEqual([
      "durationMs",
      "event",
      "label",
      "queueDepth",
      "renderCoreMs",
      "renderStartDeltaMs",
      "responsePostDeltaMs",
      "reusedWorker",
      "sincePostMessageMs",
      "status",
      "workerReceivedAtMs",
    ]);
    expect(JSON.stringify(summary)).not.toContain("private");
    expect(JSON.stringify(diagnosticEventSummary([event]))).not.toContain(
      "private",
    );
  });

  it("supports an opt-in budget gate without making the default probe fail", () => {
    expect(defaultBudgets).toEqual({
      bootWarmPlainWorkerCoreMs: 5,
      firstOpenPenaltyMs: 85,
      repeatedWarmPlainPrepareDocumentHtmlMs: 5,
      repeatedWarmPlainDomReadyMs: 55,
      repeatedWarmSpecPrepareDocumentHtmlMs: 20,
      workerDeliveryPenaltyMs: 35,
    });
    const phases = [
      {
        phase: "bootWarmBeforeOpen",
        documents: [{ basename: "plain-small.md", workerCoreMs: 5 }],
      },
      {
        phase: "repeatedWarm",
        documents: [
          {
            basename: "plain-small.md",
            domReadyMs: 55,
            prepareDocumentHtmlMs: 5,
            sanitizedDomParseSkipped: true,
          },
          {
            basename: "01-specification.md",
            prepareDocumentHtmlMs: 20,
            sanitizedDomParseSkipped: true,
          },
          ...placeholderDocuments(),
        ],
      },
    ];
    const summary = { firstOpenPenaltyMs: 85, workerDeliveryPenaltyMs: 35 };
    const passing = deriveBudgetSummary(phases, summary);
    expect(passing.budgetPassed).toBe(true);
    expect(passing.budgetResults).toHaveLength(9);
    expect(
      deriveBudgetSummary(phases, { ...summary, firstOpenPenaltyMs: 85.01 })
        .budgetPassed,
    ).toBe(false);
    expect(deriveBudgetSummary([], {}).budgetPassed).toBe(false);
    const source = readModule("budgets");
    const body = source.slice(
      source.indexOf("function deriveBudgetSummary"),
      source.indexOf("function placeholderMeasurementsGrowLinearly"),
    );
    for (const field of ["source", "path", "absolute", "html"])
      expect(body).not.toContain(field);
  });

  it.each([undefined, null, NaN, Infinity, -Infinity, "5"])(
    "treats nonfinite or missing budget value %s as missing",
    (actual) => {
      expect(
        budgetResult({ actual, label: "sample", limit: 5, metric: "sampleMs" }),
      ).toEqual({
        actualMs: null,
        label: "sample",
        limitMs: 5,
        metric: "sampleMs",
        passed: false,
        status: "missing",
      });
    },
  );

  it("keeps inclusive numeric budgets and strict equality budgets", () => {
    expect(budgetResult({ actual: 5, limit: 5 }).passed).toBe(true);
    expect(budgetResult({ actual: 5.01, limit: 5 }).passed).toBe(false);
    expect(budgetEqualsResult({ actual: false, expected: true })).toMatchObject(
      { actual: false, passed: false, status: "ok" },
    );
    expect(
      budgetEqualsResult({ actual: undefined, expected: true }),
    ).toMatchObject({ actual: null, passed: false, status: "missing" });
  });

  it("measures adversarial placeholder chains with a privacy-safe fixed schema", () => {
    const documents = placeholderDocuments();
    const phases = [{ phase: "repeatedWarm", documents }];
    const measurements = derivePlaceholderMeasurements(phases);
    expect(measurements).toEqual(
      [5, 10, 15].map((depth) => ({
        stage: "markdown.replaceDetails",
        count: depth * 2,
        inputBytes: depth * 100,
        outputBytes: depth * 200,
        durationMs: depth / 10,
      })),
    );
    expect(placeholderMeasurementsGrowLinearly(measurements)).toBe(true);
    const growthBoundary = measurements.map((item: object, index: number) => ({
      ...item,
      outputBytes: [10000, 11000, 14048][index],
    }));
    expect(placeholderMeasurementsGrowLinearly(growthBoundary)).toBe(true);
    expect(
      placeholderMeasurementsGrowLinearly(
        growthBoundary.map((item: object, index: number) =>
          index === 2 ? { ...item, outputBytes: 14049 } : item,
        ),
      ),
    ).toBe(false);
    expect(derivePlaceholderMeasurements([])).toEqual([]);
    expect(placeholderMeasurementsGrowLinearly([])).toBe(false);
    for (const field of ["inputBytes", "outputBytes", "durationMs", "count"]) {
      expect(
        placeholderMeasurementsGrowLinearly(
          measurements.map((item: object, index: number) =>
            index === 0 ? { ...item, [field]: NaN } : item,
          ),
        ),
      ).toBe(false);
    }
    expect(
      placeholderMeasurementsGrowLinearly(
        measurements.map((item: object, index: number) =>
          index === 2 ? { ...item, outputBytes: 4000 } : item,
        ),
      ),
    ).toBe(false);
    const retained = { basename: "plain-small.md" };
    expect(
      withoutPlaceholderMeasurementDocuments({
        phases: [
          { phase: "repeatedWarm", documents: [...documents, retained] },
        ],
        summary: {},
      }),
    ).toEqual({
      phases: [{ phase: "repeatedWarm", documents: [retained] }],
      summary: {},
    });
    expect(documents).toHaveLength(3);
    expect(createPlaceholderChainSource(5).match(/<details>/g)).toHaveLength(5);
    const source = readModule("metrics");
    const body = source.slice(
      source.indexOf("function derivePlaceholderMeasurements"),
      source.indexOf("function withoutPlaceholderMeasurementDocuments"),
    );
    for (const field of ["source", "path", "marker", "html"])
      expect(body).not.toContain(field);
  });
});
