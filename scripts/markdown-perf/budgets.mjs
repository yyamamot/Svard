import { placeholderChainDepths } from "./documents.mjs";
import { derivePlaceholderMeasurements } from "./metrics.mjs";

export const defaultBudgets = {
  bootWarmPlainWorkerCoreMs: 5,
  firstOpenPenaltyMs: 85,
  repeatedWarmPlainPrepareDocumentHtmlMs: 5,
  repeatedWarmPlainDomReadyMs: 55,
  repeatedWarmSpecPrepareDocumentHtmlMs: 20,
  workerDeliveryPenaltyMs: 35,
};

export function budgetResult({ actual, label, limit, metric }) {
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

export function budgetEqualsResult({ actual, expected, label, metric }) {
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

export function deriveBudgetSummary(phases, summary, budgets = defaultBudgets) {
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
  const placeholderMeasurements = derivePlaceholderMeasurements(phases);
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
    budgetEqualsResult({
      actual: placeholderMeasurementsGrowLinearly(placeholderMeasurements),
      expected: true,
      label: "repeatedWarm placeholder chain output growth",
      metric: "placeholderMeasurements.outputBytes",
    }),
  ];
  return {
    budgetPassed: budgetResults.every((result) => result.passed),
    budgetResults,
    budgets,
  };
}

export function placeholderMeasurementsGrowLinearly(measurements) {
  if (
    measurements.length !== placeholderChainDepths.length ||
    measurements.some(
      (measurement) =>
        !Number.isFinite(measurement.inputBytes) ||
        !Number.isFinite(measurement.outputBytes) ||
        !Number.isFinite(measurement.durationMs) ||
        !Number.isSafeInteger(measurement.count),
    )
  ) {
    return false;
  }
  const [depth5, depth10, depth15] = measurements;
  const firstGrowth = depth10.outputBytes - depth5.outputBytes;
  const secondGrowth = depth15.outputBytes - depth10.outputBytes;
  return (
    depth5.count === 10 &&
    depth10.count === 20 &&
    depth15.count === 30 &&
    secondGrowth <= firstGrowth + 2048 &&
    depth15.outputBytes < depth5.outputBytes * 4
  );
}
