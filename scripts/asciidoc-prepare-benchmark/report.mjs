const artifactAllowedKeys = new Set([
  "commitMs",
  "comparison",
  "concurrencyUpperBoundMs",
  "conservativeHeadroomMs",
  "convertMs",
  "count",
  "counts",
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
  "imp412SourceAnalysis",
  "imp413ResolverDeduplication",
  "imp414ResolverConcurrency",
  "includeCount",
  "includeDiagnosticsMs",
  "includeHeavyP95RegressionPercent",
  "krokiMs",
  "linkElementCount",
  "linksMs",
  "madMs",
  "maxConcurrency",
  "maxMs",
  "maxQueueDepth",
  "measurementCount",
  "mermaidMs",
  "mathMs",
  "minMs",
  "noiseFloorMs",
  "p50Ms",
  "p95Ms",
  "parentP50Ms",
  "parentValueThresholdMs",
  "plantUmlMs",
  "plainLargeP95RegressionPercent",
  "postMessageMs",
  "preparePhases",
  "prepareMs",
  "productionWorker",
  "productionWorkerP95RegressionPercent",
  "profile",
  "queueWaitMs",
  "reason",
  "reasons",
  "renderDocumentMs",
  "requiredSavingMs",
  "resolverCallCount",
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
  "summaries",
  "sanitizeMs",
  "sanitizedDomParseMs",
  "tablesMs",
  "tableSourceScanMs",
  "targetP50Ms",
  "totalMs",
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
  "baseline-unstable",
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
  "plain-large",
  "plain-large-p95-regression",
  "production-worker-p95-regression",
  "quick",
  "skipped",
  "serial-concurrency-violation",
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
  return round((Math.abs(second - first) / first) * 100);
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
