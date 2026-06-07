import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("markdown perf probe script", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "scripts/markdown-perf-probe.mjs"),
    "utf8",
  );

  it("separates DOM ready and settled timings", () => {
    expect(source).toContain("domReadyMs");
    expect(source).toContain("firstFrameAfterDomMs");
    expect(source).toContain("secondFrameAfterDomMs");
    expect(source).toContain("settledMs");
    expect(source).toContain("await page.waitForTimeout(50)");
    expect(source.indexOf("const domReadyMs")).toBeLessThan(
      source.indexOf("await page.waitForTimeout(50)"),
    );
    expect(source.indexOf("const settledMs")).toBeGreaterThan(
      source.indexOf("await page.waitForTimeout(50)"),
    );
    expect(source).not.toContain("wallMs:");
  });

  it("records readiness and derived phase timings without private payload fields", () => {
    expect(source).toContain("--diagnostic");
    expect(source).toContain("runReadinessProbe");
    expect(source).toContain("runDiagnosticSequence");
    expect(source).toContain("SVARD_PERF_DIAGNOSTIC");
    expect(source).toContain("SVARD_LONGTASK_STATUS");
    expect(source).toContain("readinessProbeMs");
    expect(source).toContain("workerResponseMs");
    expect(source).toContain("workerDeliveryMs");
    expect(source).toContain("workerCoreMs");
    expect(source).toContain("prepareDocumentHtmlMs");
    expect(source).toContain("sanitizeMs");
    expect(source).toContain("sanitizedDomParseMs");
    expect(source).toContain("sanitizedDomParseSkipped");
    expect(source).toContain("firstOpenPenaltyMs");
    expect(source).toContain("workerDeliveryPenaltyMs");
    expect(source).toContain("htmlSetToDomReadyMs");
    expect(source).toContain("domReadyToFirstFrameMs");
    expect(source).toContain("htmlSetMinusRenderMs");
    expect(source).toContain("domCommitMs");
    const summarizeBody = source.slice(
      source.indexOf("function summarizePerfEvents"),
      source.indexOf("function cloneDocumentForPhase"),
    );
    expect(summarizeBody).not.toContain("source");
    expect(summarizeBody).not.toContain("path");
    const returnSummaryBody = source.slice(
      source.indexOf("return {", source.indexOf("async function openDocument")),
      source.indexOf("async function waitForWarmupDone"),
    );
    expect(returnSummaryBody).not.toContain("absolutePath");
    expect(returnSummaryBody).not.toContain("source");
  });

  it("handles unsupported longtask observation without failing", () => {
    expect(source).toContain(
      'window.__SVARD_LONGTASK_STATUS__ = "unsupported"',
    );
    expect(source).toContain('status !== "ok"');
    expect(source).toContain("maxDurationMs");
    expect(source).toContain("totalDurationMs");
  });

  it("summarizes worker-side diagnostic metrics without private payload fields", () => {
    expect(source).toContain("render.workerPool.workerMetrics");
    expect(source).toContain("responsePostDeltaMs");
    expect(source).toContain("renderCoreMs");
    expect(source).toContain("workerReceivedAtMs");
    expect(source).toContain("workerMessage.sincePostMessageMs");
    expect(source).toContain("deriveStopGateSummary");
    expect(source).toContain("deliveryPrimed");
    expect(source).not.toContain("result:");
    expect(source).not.toContain("renderedHtml");
  });

  it("supports an opt-in budget gate without making the default probe fail", () => {
    expect(source).toContain("--budget");
    expect(source).toContain("defaultBudgets");
    expect(source).toContain("budgetPassed");
    expect(source).toContain("budgetResults");
    expect(source).toContain("repeatedWarm.plainSmall.prepareDocumentHtmlMs");
    expect(source).toContain(
      "repeatedWarm.plainSmall.sanitizedDomParseSkipped",
    );
    expect(source).toContain(
      "repeatedWarm.specification.prepareDocumentHtmlMs",
    );
    expect(source).toContain(
      "repeatedWarm.specification.sanitizedDomParseSkipped",
    );
    expect(source).toContain("process.exitCode = 1");
    expect(source).toContain("args.budget && !report.budgetPassed");

    const mainBody = source.slice(
      source.indexOf("async function main"),
      source.indexOf("await main();"),
    );
    expect(mainBody).not.toContain("process.exitCode = 1;\n    } else");
    expect(mainBody).toContain("args.budget");

    const budgetBody = source.slice(
      source.indexOf("function deriveBudgetSummary"),
      source.indexOf("async function pageNow"),
    );
    expect(budgetBody).not.toContain("source");
    expect(budgetBody).not.toContain("path");
    expect(budgetBody).not.toContain("absolute");
    expect(budgetBody).not.toContain("html");
  });
});
