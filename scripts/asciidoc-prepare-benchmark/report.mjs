const artifactAllowedKeys = new Set([
  "commitMs",
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
  "postMessageMs",
  "preparePhases",
  "prepareMs",
  "productionWorker",
  "profile",
  "queueWaitMs",
  "reason",
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
]);

const artifactAllowedStrings = new Set([
  "assets-duplicate",
  "assets-unique",
  "baseline-unstable",
  "diagram-heavy",
  "fixed-5ms",
  "full",
  "go",
  "headroom-confirmed",
  "include-heavy",
  "insufficient-parent-value",
  "insufficient-target-headroom",
  "missing-samples",
  "needs-decision",
  "no-go",
  "ok",
  "phase-baseline-full-only",
  "plain-large",
  "quick",
  "skipped",
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
