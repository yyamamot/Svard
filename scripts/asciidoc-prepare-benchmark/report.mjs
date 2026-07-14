const artifactAllowedKeys = new Set([
  "commitMs",
  "comparison",
  "concurrencySummaries",
  "concurrencyUpperBoundMs",
  "conservativeHeadroomMs",
  "convertMs",
  "count",
  "counts",
  "bounded",
  "boundedMaxConcurrency",
  "boundedPendingCount",
  "boundedResolverCallCount",
  "boundedResolverResolvedCount",
  "boundedResolverUniqueCount",
  "decision",
  "decisions",
  "diagramCount",
  "diagramDiagnosticsMs",
  "diagramPlaceholderMs",
  "diagramSlotsMs",
  "diagramHeavyP95RegressionPercent",
  "duplicateImagesP50ImprovementPercent",
  "duplicateLinksP50ImprovementPercent",
  "duplicateMaxConcurrency",
  "duplicateResolverCallCount",
  "duplicateResolverTotalP50ImprovementPercent",
  "duplicateResolverUniqueCount",
  "domReadyMs",
  "domParseMs",
  "duplicateUpperBoundMs",
  "durations",
  "documentAttributesMs",
  "driftPercent",
  "expandedBytes",
  "expandedLines",
  "expandIncludesMs",
  "fixtureId",
  "fixtures",
  "graphvizMs",
  "headingCount",
  "headingsMs",
  "headingsAttachMs",
  "imageElementCount",
  "imagesMs",
  "imagesP50ImprovementPercent",
  "imagesSplitHalfDriftPercent",
  "imp412SourceAnalysis",
  "imp413ResolverDeduplication",
  "imp414ResolverConcurrency",
  "includeCount",
  "includeDiagnosticsMs",
  "includeHeavyP95RegressionPercent",
  "krokiMs",
  "linkElementCount",
  "linksMs",
  "linksP50ImprovementPercent",
  "linksSplitHalfDriftPercent",
  "madMs",
  "maxConcurrency",
  "maxMs",
  "maxQueueDepth",
  "measurementCount",
  "mermaidMs",
  "mathMs",
  "minMs",
  "noiseFloorMs",
  "orderingViolationCount",
  "pairedDeltaMs",
  "pairedImprovementPercent",
  "pendingCount",
  "p50Ms",
  "p95Ms",
  "parentP50Ms",
  "parentValueThresholdMs",
  "plantUmlMs",
  "plainLargeP95RegressionPercent",
  "postMessageMs",
  "preparePhases",
  "prepareMs",
  "prepareP50ImprovementPercent",
  "prepareSplitHalfDriftPercent",
  "productionWorker",
  "productionWorkerP95RegressionPercent",
  "profile",
  "queueWaitMs",
  "reason",
  "reasons",
  "renderDocumentMs",
  "requiredSavingMs",
  "resolverCallCount",
  "resolverCountViolationCount",
  "resolverResolvedCount",
  "resolverTotalMs",
  "resolverUniqueCount",
  "reusedWorkerCount",
  "samplesMs",
  "schemaVersion",
  "sourceAnalysisMs",
  "sourceAnalysisPasses",
  "sourceAnalysisVisitedCodeUnitsEstimate",
  "sourceBlockCount",
  "sourceBlocksMs",
  "sourceBlocksAttachMs",
  "sourceSelectionBlockCount",
  "sourceSelectionBlocksMs",
  "sourceSelectionBlocksAttachMs",
  "sourceTextBlockCount",
  "sourceTextBlocksMs",
  "sourceTextBlocksAttachMs",
  "status",
  "serial",
  "serialMaxConcurrency",
  "serialPendingCount",
  "serialResolverCallCount",
  "serialResolverResolvedCount",
  "serialResolverUniqueCount",
  "splitHalfDriftPercent",
  "summaries",
  "sanitizeMs",
  "sanitizedDomParseMs",
  "tablesMs",
  "tableSourceScanMs",
  "targetP50Ms",
  "totalMs",
  "totalNoiseFloorMs",
  "totalP95DeltaMs",
  "totalP95RegressionPercent",
  "upperBoundP50Ms",
  "warmupCount",
  "work",
  "workerCoreMs",
  "workerDeliveryMs",
  "workerPhases",
  "workerRoundTripMs",
  "uniqueMaxConcurrency",
  "uniquePrepareP95RegressionPercent",
  "uniqueResolverCallCount",
  "uniqueTotalP95RegressionPercent",
]);

const artifactAllowedStrings = new Set([
  "assets-duplicate",
  "assets-unique",
  "assets-unique-1",
  "assets-unique-10",
  "assets-unique-100",
  "baseline-unstable",
  "bounded-concurrency-violation",
  "call-count-violation",
  "cold-paired-regression",
  "diagram-heavy",
  "diagram-heavy-p95-regression",
  "duplicate-image-element-count-mismatch",
  "duplicate-images-p50-improvement-below-target",
  "duplicate-link-element-count-mismatch",
  "duplicate-links-p50-improvement-below-target",
  "duplicate-resolver-call-count-mismatch",
  "duplicate-resolver-total-p50-improvement-below-target",
  "duplicate-resolver-unique-count-mismatch",
  "fixed-5ms",
  "full",
  "go",
  "headroom-confirmed",
  "include-heavy",
  "include-heavy-p95-regression",
  "insufficient-parent-value",
  "insufficient-target-headroom",
  "missing-samples",
  "missing-comparison-metric",
  "needs-decision",
  "no-go",
  "ok",
  "phase-baseline-full-only",
  "paired-measurement-unstable",
  "plain-large",
  "plain-large-p95-regression",
  "production-worker-p95-regression",
  "quick",
  "skipped",
  "serial-concurrency-violation",
  "ordering-violation",
  "pending-count-violation",
  "resolver-count-violation",
  "unique-10-images-p50-improvement-below-target",
  "unique-10-links-p50-improvement-below-target",
  "unique-100-images-p50-improvement-below-target",
  "unique-100-links-p50-improvement-below-target",
  "unique-100-prepare-p50-improvement-below-target",
  "unique-prepare-p95-regression",
  "unique-resolver-call-count-mismatch",
  "unique-total-p95-regression",
  "zero-latency",
]);

export function assertAsciiDocPrepareArtifactSafe(value) {
  visitArtifact(value);
}

function visitArtifact(value) {
  if (Array.isArray(value)) {
    value.forEach(visitArtifact);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (!artifactAllowedKeys.has(key)) {
        throw new Error(`Unsupported AsciiDoc benchmark artifact key: ${key}`);
      }
      visitArtifact(child);
    }
    return;
  }
  if (typeof value === "string" && !artifactAllowedStrings.has(value)) {
    throw new Error("Unsupported AsciiDoc benchmark artifact string");
  }
  if (
    value !== null &&
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    throw new Error("Unsupported AsciiDoc benchmark artifact value");
  }
}

export function round(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(2))
    : null;
}

export function percentile(values, percentileValue) {
  const sorted = values
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileValue / 100) * sorted.length) - 1,
  );
  return round(sorted[index]);
}

export function medianAbsoluteDeviation(values) {
  const median = percentile(values, 50);
  if (median === null) return null;
  return percentile(
    values.map((value) => Math.abs(value - median)),
    50,
  );
}

export function summarizeSamples(values) {
  const samplesMs = values
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .map(round);
  return {
    count: samplesMs.length,
    samplesMs,
    minMs: samplesMs.length > 0 ? round(Math.min(...samplesMs)) : null,
    maxMs: samplesMs.length > 0 ? round(Math.max(...samplesMs)) : null,
    p50Ms: percentile(samplesMs, 50),
    p95Ms: percentile(samplesMs, 95),
    madMs: medianAbsoluteDeviation(samplesMs),
  };
}

function benchmarkSummary(report, fixtureId, profile) {
  return Array.isArray(report?.summaries)
    ? report.summaries.find(
        (summary) =>
          summary?.fixtureId === fixtureId && summary?.profile === profile,
      )
    : null;
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function percentChange(before, after, direction) {
  const beforeValue = finiteNumber(before);
  const afterValue = finiteNumber(after);
  if (beforeValue === null || afterValue === null || beforeValue <= 0) {
    return null;
  }
  const delta =
    direction === "improvement"
      ? beforeValue - afterValue
      : afterValue - beforeValue;
  return round((delta / beforeValue) * 100);
}

export function buildAsciiDocPrepareComparison(baseline, current) {
  const beforeDuplicate = benchmarkSummary(
    baseline,
    "assets-duplicate",
    "fixed-5ms",
  );
  const afterDuplicate = benchmarkSummary(
    current,
    "assets-duplicate",
    "fixed-5ms",
  );
  const beforeUnique = benchmarkSummary(baseline, "assets-unique", "fixed-5ms");
  const afterUnique = benchmarkSummary(current, "assets-unique", "fixed-5ms");
  const coldFixtures = ["plain-large", "include-heavy", "diagram-heavy"];
  const coldRegressions = Object.fromEntries(
    coldFixtures.map((fixtureId) => {
      const before = benchmarkSummary(baseline, fixtureId, "zero-latency");
      const after = benchmarkSummary(current, fixtureId, "zero-latency");
      return [
        fixtureId,
        percentChange(
          before?.durations?.totalMs?.p95Ms,
          after?.durations?.totalMs?.p95Ms,
          "regression",
        ),
      ];
    }),
  );
  const comparison = {
    duplicateImagesP50ImprovementPercent: percentChange(
      beforeDuplicate?.preparePhases?.imagesMs?.p50Ms,
      afterDuplicate?.preparePhases?.imagesMs?.p50Ms,
      "improvement",
    ),
    duplicateLinksP50ImprovementPercent: percentChange(
      beforeDuplicate?.preparePhases?.linksMs?.p50Ms,
      afterDuplicate?.preparePhases?.linksMs?.p50Ms,
      "improvement",
    ),
    duplicateMaxConcurrency: finiteNumber(
      afterDuplicate?.counts?.maxConcurrency,
    ),
    duplicateResolverCallCount: finiteNumber(
      afterDuplicate?.counts?.resolverCallCount,
    ),
    duplicateResolverTotalP50ImprovementPercent: percentChange(
      beforeDuplicate?.durations?.resolverTotalMs?.p50Ms,
      afterDuplicate?.durations?.resolverTotalMs?.p50Ms,
      "improvement",
    ),
    duplicateResolverUniqueCount: finiteNumber(
      afterDuplicate?.counts?.resolverUniqueCount,
    ),
    plainLargeP95RegressionPercent: coldRegressions["plain-large"],
    includeHeavyP95RegressionPercent: coldRegressions["include-heavy"],
    diagramHeavyP95RegressionPercent: coldRegressions["diagram-heavy"],
    productionWorkerP95RegressionPercent: percentChange(
      baseline?.productionWorker?.durations?.domReadyMs?.p95Ms,
      current?.productionWorker?.durations?.domReadyMs?.p95Ms,
      "regression",
    ),
    reasons: [],
    status: "go",
    uniqueMaxConcurrency: finiteNumber(afterUnique?.counts?.maxConcurrency),
    uniquePrepareP95RegressionPercent: percentChange(
      beforeUnique?.durations?.prepareMs?.p95Ms,
      afterUnique?.durations?.prepareMs?.p95Ms,
      "regression",
    ),
    uniqueResolverCallCount: finiteNumber(
      afterUnique?.counts?.resolverCallCount,
    ),
    uniqueTotalP95RegressionPercent: percentChange(
      beforeUnique?.durations?.totalMs?.p95Ms,
      afterUnique?.durations?.totalMs?.p95Ms,
      "regression",
    ),
  };
  const numericValues = Object.entries(comparison)
    .filter(([key]) => !new Set(["reasons", "status"]).has(key))
    .map(([, value]) => value);
  const requiredCounts = [
    afterDuplicate?.counts?.imageElementCount,
    afterDuplicate?.counts?.linkElementCount,
  ];
  if (
    numericValues.some((value) => value === null) ||
    requiredCounts.some((value) => finiteNumber(value) === null)
  ) {
    comparison.reasons = ["missing-comparison-metric"];
    comparison.status = "needs-decision";
    return comparison;
  }

  const violations = [];
  if (comparison.duplicateResolverTotalP50ImprovementPercent < 15) {
    violations.push("duplicate-resolver-total-p50-improvement-below-target");
  }
  if (comparison.duplicateImagesP50ImprovementPercent < 15) {
    violations.push("duplicate-images-p50-improvement-below-target");
  }
  if (comparison.duplicateLinksP50ImprovementPercent < 15) {
    violations.push("duplicate-links-p50-improvement-below-target");
  }
  if (comparison.duplicateResolverCallCount !== 20) {
    violations.push("duplicate-resolver-call-count-mismatch");
  }
  if (comparison.duplicateResolverUniqueCount !== 20) {
    violations.push("duplicate-resolver-unique-count-mismatch");
  }
  if (afterDuplicate.counts.imageElementCount !== 60) {
    violations.push("duplicate-image-element-count-mismatch");
  }
  if (afterDuplicate.counts.linkElementCount !== 60) {
    violations.push("duplicate-link-element-count-mismatch");
  }
  if (
    comparison.duplicateMaxConcurrency > 1 ||
    comparison.uniqueMaxConcurrency > 1
  ) {
    violations.push("serial-concurrency-violation");
  }
  if (comparison.uniqueResolverCallCount !== 120) {
    violations.push("unique-resolver-call-count-mismatch");
  }
  if (comparison.uniquePrepareP95RegressionPercent > 10) {
    violations.push("unique-prepare-p95-regression");
  }
  if (comparison.uniqueTotalP95RegressionPercent > 10) {
    violations.push("unique-total-p95-regression");
  }
  if (comparison.plainLargeP95RegressionPercent > 10) {
    violations.push("plain-large-p95-regression");
  }
  if (comparison.includeHeavyP95RegressionPercent > 10) {
    violations.push("include-heavy-p95-regression");
  }
  if (comparison.diagramHeavyP95RegressionPercent > 10) {
    violations.push("diagram-heavy-p95-regression");
  }
  if (comparison.productionWorkerP95RegressionPercent > 10) {
    violations.push("production-worker-p95-regression");
  }
  comparison.reasons = violations;
  comparison.status = violations.length === 0 ? "go" : "no-go";
  return comparison;
}

function concurrencySummary(report, fixtureId, profile) {
  return Array.isArray(report?.concurrencySummaries)
    ? report.concurrencySummaries.find(
        (summary) =>
          summary?.fixtureId === fixtureId && summary?.profile === profile,
      )
    : null;
}

function concurrencyFixtureResult(current, fixtureId, profile) {
  const summary = concurrencySummary(current, fixtureId, profile);
  const total = summary?.durations?.totalMs;
  const serialTotalP95 = finiteNumber(total?.serial?.p95Ms);
  const boundedTotalP95 = finiteNumber(total?.bounded?.p95Ms);
  const pairedDeltaP95 = finiteNumber(total?.pairedDeltaMs?.p95Ms);
  const pairedDeltaMad = finiteNumber(total?.pairedDeltaMs?.madMs);
  const serialTotalP50 = finiteNumber(total?.serial?.p50Ms);
  return {
    boundedMaxConcurrency: finiteNumber(
      summary?.counts?.bounded?.maxConcurrency,
    ),
    boundedPendingCount: finiteNumber(summary?.counts?.bounded?.pendingCount),
    boundedResolverCallCount: finiteNumber(
      summary?.counts?.bounded?.resolverCallCount,
    ),
    boundedResolverResolvedCount: finiteNumber(
      summary?.counts?.bounded?.resolverResolvedCount,
    ),
    boundedResolverUniqueCount: finiteNumber(
      summary?.counts?.bounded?.resolverUniqueCount,
    ),
    fixtureId,
    imagesP50ImprovementPercent: finiteNumber(
      summary?.durations?.imagesMs?.pairedImprovementPercent?.p50Ms,
    ),
    imagesSplitHalfDriftPercent: finiteNumber(
      summary?.durations?.imagesMs?.splitHalfDriftPercent,
    ),
    linksP50ImprovementPercent: finiteNumber(
      summary?.durations?.linksMs?.pairedImprovementPercent?.p50Ms,
    ),
    linksSplitHalfDriftPercent: finiteNumber(
      summary?.durations?.linksMs?.splitHalfDriftPercent,
    ),
    orderingViolationCount: finiteNumber(
      summary?.counts?.orderingViolationCount,
    ),
    prepareP50ImprovementPercent: finiteNumber(
      summary?.durations?.prepareMs?.pairedImprovementPercent?.p50Ms,
    ),
    prepareSplitHalfDriftPercent: finiteNumber(
      summary?.durations?.prepareMs?.splitHalfDriftPercent,
    ),
    profile,
    serialMaxConcurrency: finiteNumber(summary?.counts?.serial?.maxConcurrency),
    serialPendingCount: finiteNumber(summary?.counts?.serial?.pendingCount),
    serialResolverCallCount: finiteNumber(
      summary?.counts?.serial?.resolverCallCount,
    ),
    serialResolverResolvedCount: finiteNumber(
      summary?.counts?.serial?.resolverResolvedCount,
    ),
    serialResolverUniqueCount: finiteNumber(
      summary?.counts?.serial?.resolverUniqueCount,
    ),
    resolverCountViolationCount: finiteNumber(
      summary?.counts?.resolverCountViolationCount,
    ),
    splitHalfDriftPercent: finiteNumber(total?.splitHalfDriftPercent),
    totalNoiseFloorMs:
      pairedDeltaMad === null || serialTotalP50 === null
        ? null
        : round(Math.max(2, 2 * pairedDeltaMad, serialTotalP50 * 0.1)),
    totalP95DeltaMs: pairedDeltaP95,
    totalP95RegressionPercent: percentChange(
      serialTotalP95,
      boundedTotalP95,
      "regression",
    ),
  };
}

export function buildAsciiDocResolverConcurrencyComparison(baseline, current) {
  const fixtureContracts = [
    ["assets-unique-1", "fixed-5ms"],
    ["assets-unique-10", "fixed-5ms"],
    ["assets-unique-100", "fixed-5ms"],
    ["assets-duplicate", "fixed-5ms"],
    ["plain-large", "zero-latency"],
    ["include-heavy", "zero-latency"],
    ["diagram-heavy", "zero-latency"],
  ];
  const fixtures = fixtureContracts.map(([fixtureId, profile]) =>
    concurrencyFixtureResult(current, fixtureId, profile),
  );
  const comparison = {
    fixtures,
    productionWorkerP95RegressionPercent: percentChange(
      baseline?.productionWorker?.durations?.domReadyMs?.p95Ms,
      current?.productionWorker?.durations?.domReadyMs?.p95Ms,
      "regression",
    ),
    reasons: [],
    status: "go",
  };
  const requiredMetricKeys = [
    "boundedMaxConcurrency",
    "boundedPendingCount",
    "boundedResolverCallCount",
    "boundedResolverResolvedCount",
    "boundedResolverUniqueCount",
    "orderingViolationCount",
    "resolverCountViolationCount",
    "serialMaxConcurrency",
    "serialPendingCount",
    "serialResolverCallCount",
    "serialResolverResolvedCount",
    "serialResolverUniqueCount",
    "splitHalfDriftPercent",
    "totalNoiseFloorMs",
    "totalP95DeltaMs",
    "totalP95RegressionPercent",
  ];
  if (
    finiteNumber(comparison.productionWorkerP95RegressionPercent) === null ||
    fixtures.some((fixture) =>
      requiredMetricKeys.some((key) => finiteNumber(fixture[key]) === null),
    ) ||
    fixtures
      .filter((fixture) => fixture.fixtureId.startsWith("assets-"))
      .some((fixture) =>
        [
          fixture.imagesP50ImprovementPercent,
          fixture.imagesSplitHalfDriftPercent,
          fixture.linksP50ImprovementPercent,
          fixture.linksSplitHalfDriftPercent,
          fixture.prepareP50ImprovementPercent,
          fixture.prepareSplitHalfDriftPercent,
        ].some((value) => finiteNumber(value) === null),
      )
  ) {
    comparison.reasons = ["missing-comparison-metric"];
    comparison.status = "needs-decision";
    return comparison;
  }

  const byId = Object.fromEntries(
    fixtures.map((fixture) => [fixture.fixtureId, fixture]),
  );
  const violations = [];
  if (byId["assets-unique-10"].imagesP50ImprovementPercent < 15) {
    violations.push("unique-10-images-p50-improvement-below-target");
  }
  if (byId["assets-unique-10"].linksP50ImprovementPercent < 15) {
    violations.push("unique-10-links-p50-improvement-below-target");
  }
  if (byId["assets-unique-100"].imagesP50ImprovementPercent < 15) {
    violations.push("unique-100-images-p50-improvement-below-target");
  }
  if (byId["assets-unique-100"].linksP50ImprovementPercent < 15) {
    violations.push("unique-100-links-p50-improvement-below-target");
  }
  if (byId["assets-unique-100"].prepareP50ImprovementPercent < 15) {
    violations.push("unique-100-prepare-p50-improvement-below-target");
  }

  const countContracts = {
    "assets-duplicate": { calls: 120, unique: 20 },
    "assets-unique-1": { calls: 2, unique: 2 },
    "assets-unique-10": { calls: 20, unique: 20 },
    "assets-unique-100": { calls: 200, unique: 200 },
  };
  const countViolation = Object.entries(countContracts).some(
    ([fixtureId, expected]) => {
      const fixture = byId[fixtureId];
      return (
        fixture.serialResolverCallCount !== expected.calls ||
        fixture.boundedResolverCallCount !== expected.calls ||
        fixture.serialResolverResolvedCount !== expected.calls ||
        fixture.boundedResolverResolvedCount !== expected.calls ||
        fixture.serialResolverUniqueCount !== expected.unique ||
        fixture.boundedResolverUniqueCount !== expected.unique
      );
    },
  );
  if (
    countViolation ||
    fixtures.some((fixture) => fixture.resolverCountViolationCount !== 0)
  ) {
    violations.push("resolver-count-violation");
  }
  if (
    Object.keys(countContracts).some(
      (fixtureId) => byId[fixtureId].serialMaxConcurrency > 1,
    )
  ) {
    violations.push("serial-concurrency-violation");
  }
  if (
    byId["assets-unique-1"].boundedMaxConcurrency !== 1 ||
    ["assets-unique-10", "assets-unique-100", "assets-duplicate"].some(
      (fixtureId) => byId[fixtureId].boundedMaxConcurrency !== 4,
    )
  ) {
    violations.push("bounded-concurrency-violation");
  }
  if (
    fixtures.some(
      (fixture) =>
        fixture.serialPendingCount !== 0 || fixture.boundedPendingCount !== 0,
    )
  ) {
    violations.push("pending-count-violation");
  }
  if (fixtures.some((fixture) => fixture.orderingViolationCount !== 0)) {
    violations.push("ordering-violation");
  }
  const coldFixtureIds = [
    "assets-unique-1",
    "plain-large",
    "include-heavy",
    "diagram-heavy",
  ];
  if (
    coldFixtureIds.some((fixtureId) => {
      const fixture = byId[fixtureId];
      return (
        fixture.totalP95RegressionPercent > 10 &&
        fixture.totalP95DeltaMs > fixture.totalNoiseFloorMs
      );
    })
  ) {
    violations.push("cold-paired-regression");
  }
  if (
    ["assets-unique-10", "assets-unique-100"].some((fixtureId) => {
      const fixture = byId[fixtureId];
      return (
        fixture.imagesSplitHalfDriftPercent > 10 ||
        fixture.linksSplitHalfDriftPercent > 10 ||
        fixture.prepareSplitHalfDriftPercent > 10
      );
    })
  ) {
    comparison.reasons = ["paired-measurement-unstable"];
    comparison.status = "needs-decision";
    return comparison;
  }
  comparison.reasons = [...new Set(violations)];
  comparison.status = violations.length === 0 ? "go" : "no-go";
  return comparison;
}

export function estimateBoundedConcurrencyMs(durations, concurrency) {
  const lanes = Array.from({ length: Math.max(1, concurrency) }, () => 0);
  for (const duration of durations) {
    const lane = lanes.indexOf(Math.min(...lanes));
    lanes[lane] += duration;
  }
  return round(Math.max(...lanes));
}

export function splitHalfDriftPercent(values) {
  if (values.length < 2) return null;
  const middle = Math.floor(values.length / 2);
  const first = percentile(values.slice(0, middle), 50);
  const second = percentile(values.slice(middle), 50);
  if (first === null || second === null || first === 0) return null;
  return round((Math.abs(second - first) / Math.abs(first)) * 100);
}

export function evaluateHeadroom({
  parentValues,
  targetValues,
  upperBoundValues,
}) {
  const parentP50Ms = percentile(parentValues, 50);
  const targetP50Ms = percentile(targetValues, 50);
  const upperBoundP50Ms = percentile(upperBoundValues, 50);
  const madMs = medianAbsoluteDeviation(targetValues) ?? 0;
  if (
    parentP50Ms === null ||
    targetP50Ms === null ||
    upperBoundP50Ms === null
  ) {
    return {
      decision: "needs-decision",
      reason: "missing-samples",
    };
  }
  const noiseFloorMs = Math.max(2, 2 * madMs);
  const requiredSavingMs = Math.max(targetP50Ms * 0.15, noiseFloorMs);
  const conservativeHeadroomMs = upperBoundP50Ms * 0.5;
  const parentValueThresholdMs = Math.max(5, parentP50Ms * 0.03);
  const driftPercent = splitHalfDriftPercent(targetValues);
  const stable = driftPercent !== null && driftPercent <= 10;
  const enoughTargetHeadroom = conservativeHeadroomMs >= requiredSavingMs;
  const enoughParentValue = conservativeHeadroomMs >= parentValueThresholdMs;
  const decision =
    stable && enoughTargetHeadroom && enoughParentValue ? "go" : "no-go";
  const reason = !stable
    ? "baseline-unstable"
    : !enoughTargetHeadroom
      ? "insufficient-target-headroom"
      : !enoughParentValue
        ? "insufficient-parent-value"
        : "headroom-confirmed";
  return {
    conservativeHeadroomMs: round(conservativeHeadroomMs),
    decision,
    driftPercent,
    noiseFloorMs: round(noiseFloorMs),
    parentP50Ms,
    parentValueThresholdMs: round(parentValueThresholdMs),
    reason,
    requiredSavingMs: round(requiredSavingMs),
    targetP50Ms,
    upperBoundP50Ms,
  };
}
