import { diffRenderPhaseFixtureIds } from "./fixtures.mjs";

const allowedKeys = new Set([
  "artifactSizeEstimateKind",
  "avoidableCriticalPathUpperBound",
  "avoidableCriticalPathUpperBoundMs",
  "avoidableCriticalPathUpperBoundP50Ms",
  "avoidableOperationCount",
  "allDiffsForegroundReady",
  "allDiffsForegroundReadyMs",
  "artifactEstimatedBytes",
  "asciidoc",
  "benchmarkId",
  "browserSessionCount",
  "blockCount",
  "blockParse",
  "blockParseCount",
  "blockParseMs",
  "blockTextParse",
  "blockTextParseCount",
  "blockTextParseMs",
  "coreRender",
  "coreRenderCount",
  "coreRenderMs",
  "conservativeHeadroom",
  "conservativeHeadroomMs",
  "contractStatus",
  "contextCount",
  "count",
  "counts",
  "counterfactualStatus",
  "decision",
  "decisions",
  "dependency",
  "diffArtifactReady",
  "diffArtifactReadyMs",
  "driftPercent",
  "exactDuplicateCount",
  "executionMode",
  "firstUseful",
  "firstUsefulMs",
  "fixtureId",
  "fixtures",
  "format",
  "imp421",
  "imp422",
  "imp423",
  "identityComplete",
  "identityStatus",
  "itemCount",
  "iteration",
  "madMs",
  "markerContextReady",
  "markerContextReadyMs",
  "markerCount",
  "max",
  "maxMs",
  "measurementCount",
  "min",
  "minMs",
  "noiseFloorMs",
  "ownershipReason",
  "ownershipStatus",
  "pageCount",
  "p50Ms",
  "p95Ms",
  "phases",
  "potentialImprovementPercent",
  "prepare",
  "prepareCount",
  "prepareMs",
  "reason",
  "renderedCoreRenderCount",
  "requiredSavingMs",
  "samples",
  "schemaVersion",
  "status",
  "summaries",
  "tableCount",
  "tableCoreRenderCount",
  "tableSummaryReady",
  "tableSummaryReadyMs",
  "target",
  "targetKind",
  "targetMs",
  "targetP50Ms",
  "schedulability",
  "warmupCount",
  "work",
  "workflow",
  "workflowMs",
  "viability",
]);

const allowedStrings = new Set([
  ...diffRenderPhaseFixtureIds,
  "all-diffs",
  "asciidoc",
  "baseline-unstable",
  "blocked",
  "bounded-ownership-unresolved",
  "bounded-diff-shared",
  "diff-preview-lifecycle",
  "explicit-current-side-handoff",
  "failed",
  "go",
  "headroom-confirmed",
  "exact",
  "exact-core-input",
  "identity-not-reproducible",
  "identity-unresolved",
  "mismatch",
  "imp-420-diff-render-phase-baseline",
  "imp421-not-adopted",
  "imp420-measured",
  "insufficient-headroom",
  "markdown",
  "measured",
  "marker-context",
  "missing-samples",
  "needs-decision",
  "not-applicable",
  "not-scheduled",
  "no-go",
  "ok",
  "production-browser-worker",
  "production-loader-counterfactual-unmeasured",
  "ready",
  "rendered-summary",
  "rendered-table",
  "serialized-lower-bound",
  "satisfied",
  "passed",
  "resolved",
  "unmeasured",
  "unresolved",
  "viability-not-met",
  "workflow-ready",
]);

export function round(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(3))
    : null;
}

export function percentile(values, percentileValue) {
  const numeric = values
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (numeric.length === 0) return null;
  const index = Math.min(
    numeric.length - 1,
    Math.ceil((percentileValue / 100) * numeric.length) - 1,
  );
  return round(numeric[index]);
}

export function medianAbsoluteDeviation(values) {
  const median = percentile(values, 50);
  if (median === null) return null;
  return percentile(
    values
      .filter((value) => typeof value === "number" && Number.isFinite(value))
      .map((value) => Math.abs(value - median)),
    50,
  );
}

export function summarizeSamples(values) {
  const numeric = values.filter(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  return {
    count: numeric.length,
    madMs: medianAbsoluteDeviation(numeric),
    maxMs: numeric.length > 0 ? round(Math.max(...numeric)) : null,
    minMs: numeric.length > 0 ? round(Math.min(...numeric)) : null,
    p50Ms: percentile(numeric, 50),
    p95Ms: percentile(numeric, 95),
  };
}

function range(values) {
  const numeric = values.filter(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  return {
    max: numeric.length > 0 ? Math.max(...numeric) : null,
    min: numeric.length > 0 ? Math.min(...numeric) : null,
  };
}

export function criticalPathUnionMs(intervals) {
  const normalized = intervals
    .filter(
      (interval) =>
        interval &&
        Number.isFinite(interval.startMs) &&
        Number.isFinite(interval.endMs) &&
        interval.endMs >= interval.startMs,
    )
    .map((interval) => ({ startMs: interval.startMs, endMs: interval.endMs }))
    .sort(
      (left, right) => left.startMs - right.startMs || left.endMs - right.endMs,
    );
  if (normalized.length === 0) return 0;
  let total = 0;
  let start = normalized[0].startMs;
  let end = normalized[0].endMs;
  for (const interval of normalized.slice(1)) {
    if (interval.startMs <= end) {
      end = Math.max(end, interval.endMs);
      continue;
    }
    total += end - start;
    start = interval.startMs;
    end = interval.endMs;
  }
  return round(total + end - start) ?? 0;
}

export function criticalPathReductionMs(allIntervals, removableIntervals) {
  const removable = new Set(removableIntervals);
  const retainedIntervals = allIntervals.filter(
    (interval) => !removable.has(interval),
  );
  return (
    round(
      Math.max(
        0,
        criticalPathUnionMs(allIntervals) -
          criticalPathUnionMs(retainedIntervals),
      ),
    ) ?? 0
  );
}

export function splitHalfDriftPercent(values) {
  const numeric = values.filter(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  if (numeric.length < 2) return null;
  const middle = Math.floor(numeric.length / 2);
  const first = percentile(numeric.slice(0, middle), 50);
  const second = percentile(numeric.slice(middle), 50);
  if (first === null || second === null || first === 0) return null;
  return round((Math.abs(second - first) / Math.abs(first)) * 100);
}

export function evaluateHeadroom({
  avoidableCriticalPathUpperBoundValues,
  fixtureId,
  targetValues,
}) {
  const targetP50Ms = percentile(targetValues, 50);
  const avoidableCriticalPathUpperBoundP50Ms = percentile(
    avoidableCriticalPathUpperBoundValues,
    50,
  );
  if (
    targetP50Ms === null ||
    avoidableCriticalPathUpperBoundP50Ms === null ||
    targetP50Ms <= 0
  ) {
    return {
      decision: "no-go",
      fixtureId,
      reason: "missing-samples",
    };
  }
  const conservativeHeadroomMs = 0.5 * avoidableCriticalPathUpperBoundP50Ms;
  const noiseFloorMs = Math.max(
    2,
    2 * (medianAbsoluteDeviation(targetValues) ?? 0),
  );
  const requiredSavingMs = Math.max(targetP50Ms * 0.15, noiseFloorMs);
  const driftPercent = splitHalfDriftPercent(targetValues);
  const stable = driftPercent !== null && driftPercent <= 10;
  const enoughHeadroom = conservativeHeadroomMs >= requiredSavingMs;
  return {
    avoidableCriticalPathUpperBoundP50Ms,
    conservativeHeadroomMs: round(conservativeHeadroomMs),
    decision: stable && enoughHeadroom ? "go" : "no-go",
    driftPercent,
    fixtureId,
    noiseFloorMs: round(noiseFloorMs),
    potentialImprovementPercent: round(
      (conservativeHeadroomMs / targetP50Ms) * 100,
    ),
    reason: !stable
      ? "baseline-unstable"
      : enoughHeadroom
        ? "headroom-confirmed"
        : "insufficient-headroom",
    requiredSavingMs: round(requiredSavingMs),
    targetP50Ms,
  };
}

function fixtureSamples(samples, fixtureId) {
  return samples.filter((sample) => sample.fixtureId === fixtureId);
}

function decisionFor(samples, fixtureId) {
  const selected = fixtureSamples(samples, fixtureId);
  return evaluateHeadroom({
    avoidableCriticalPathUpperBoundValues: selected.map(
      (sample) => sample.avoidableCriticalPathUpperBoundMs,
    ),
    fixtureId,
    targetValues: selected.map((sample) => sample.targetMs),
  });
}

export function buildDiffRenderDecisions(samples) {
  const imp421Viability = decisionFor(samples, "markdown-simple-table");
  const imp422Viability = decisionFor(samples, "markdown-marker-first");
  const imp423Viability = {
    decision: "needs-decision",
    fixtureId: "markdown-all-diffs",
    reason: "production-loader-counterfactual-unmeasured",
  };
  const imp421Samples = fixtureSamples(samples, "markdown-simple-table");
  const imp421IdentityExact =
    imp421Samples.length > 0 &&
    imp421Samples.every(
      (sample) =>
        sample.identityStatus === "exact" && sample.exactDuplicateCount === 2,
    );
  const imp421Ready = imp421Viability.decision === "go" && imp421IdentityExact;
  const dependent = () => ({
    dependency: {
      decision: imp421Ready ? "satisfied" : "blocked",
      reason: imp421Ready ? "imp420-measured" : "imp421-not-adopted",
    },
    schedulability: {
      decision: imp421Ready ? "not-scheduled" : "blocked",
      reason: imp421Ready ? "identity-unresolved" : "imp421-not-adopted",
    },
  });
  return {
    imp421: {
      dependency: { decision: "satisfied", reason: "imp420-measured" },
      identityStatus: imp421IdentityExact ? "exact" : "needs-decision",
      ownershipReason: "exact-core-input",
      ownershipStatus: "resolved",
      schedulability: {
        decision: imp421Ready ? "ready" : "not-scheduled",
        reason: imp421Ready ? "headroom-confirmed" : "viability-not-met",
      },
      viability: imp421Viability,
    },
    imp422: {
      ...dependent(),
      identityStatus: "needs-decision",
      ownershipReason: "explicit-current-side-handoff",
      ownershipStatus: "resolved",
      schedulability: {
        decision: "blocked",
        reason: "identity-not-reproducible",
      },
      viability: imp422Viability,
    },
    imp423: {
      ...dependent(),
      identityStatus: "needs-decision",
      ownershipReason: "bounded-ownership-unresolved",
      ownershipStatus: "needs-decision",
      schedulability: {
        decision: "blocked",
        reason: "production-loader-counterfactual-unmeasured",
      },
      viability: imp423Viability,
    },
  };
}

export function summarizeFixtureSamples(samples) {
  if (samples.length === 0) {
    throw new Error("Cannot summarize an empty fixture sample set");
  }
  const duration = (key) =>
    summarizeSamples(samples.map((sample) => sample[key]));
  return {
    counts: {
      blockParseCount: range(samples.map((sample) => sample.blockParseCount)),
      blockTextParseCount: range(
        samples.map((sample) => sample.blockTextParseCount),
      ),
      avoidableOperationCount: range(
        samples.map((sample) => sample.avoidableOperationCount),
      ),
      coreRenderCount: range(samples.map((sample) => sample.coreRenderCount)),
      exactDuplicateCount: range(
        samples.map((sample) => sample.exactDuplicateCount),
      ),
      prepareCount: range(samples.map((sample) => sample.prepareCount)),
      renderedCoreRenderCount: range(
        samples.map((sample) => sample.renderedCoreRenderCount),
      ),
      tableCoreRenderCount: range(
        samples.map((sample) => sample.tableCoreRenderCount),
      ),
    },
    fixtureId: samples[0].fixtureId,
    measurementCount: samples.length,
    phases: {
      allDiffsForegroundReady: duration("allDiffsForegroundReadyMs"),
      blockParse: duration("blockParseMs"),
      blockTextParse: duration("blockTextParseMs"),
      coreRender: duration("coreRenderMs"),
      diffArtifactReady: duration("diffArtifactReadyMs"),
      firstUseful: duration("firstUsefulMs"),
      markerContextReady: duration("markerContextReadyMs"),
      prepare: duration("prepareMs"),
      avoidableCriticalPathUpperBound: duration(
        "avoidableCriticalPathUpperBoundMs",
      ),
      conservativeHeadroom: duration("conservativeHeadroomMs"),
      tableSummaryReady: duration("tableSummaryReadyMs"),
      target: duration("targetMs"),
      workflow: duration("workflowMs"),
    },
    work: {
      artifactEstimatedBytes: range(
        samples.map((sample) => sample.artifactEstimatedBytes),
      ),
      blockCount: range(samples.map((sample) => sample.blockCount)),
      itemCount: range(samples.map((sample) => sample.itemCount)),
      markerCount: range(samples.map((sample) => sample.markerCount)),
      tableCount: range(samples.map((sample) => sample.tableCount)),
    },
  };
}

export function assertDiffRenderArtifactSafe(value) {
  visit(value);
}

function visit(value) {
  if (Array.isArray(value)) {
    value.forEach(visit);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (!allowedKeys.has(key)) {
        throw new Error(
          `Unsupported diff render benchmark artifact key: ${key}`,
        );
      }
      visit(child);
    }
    return;
  }
  if (typeof value === "string" && !allowedStrings.has(value)) {
    throw new Error("Unsupported diff render benchmark artifact string");
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Unsupported diff render benchmark artifact number");
  }
  if (
    value !== null &&
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    throw new Error("Unsupported diff render benchmark artifact value");
  }
}
