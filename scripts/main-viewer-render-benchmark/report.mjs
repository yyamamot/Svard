import { mainViewerRenderFixtureIds } from "./fixtures.mjs";

export const mainViewerRenderSchema = "imp-560-main-viewer-render-v1";
export const mainViewerRenderBenchmarkId = "imp-560-main-viewer-render";
export const mainViewerRenderRuntime = "chromium-vite-production";

export const mainViewerRenderTimingKeys = Object.freeze([
  "viewerReadyMs",
  "workerCoreMs",
  "workerDeliveryMs",
  "prepareMs",
  "sanitizeMs",
  "resolverMs",
  "commitMs",
  "decodeMs",
  "frame1Ms",
  "frame2Ms",
  "layoutStabilityMs",
  "searchCleanupMs",
  "activeHeadingMs",
  "linkInspectorCollectMs",
  "linkInspectorBuildMs",
  "postCommitMs",
]);

export const mainViewerRenderCountKeys = Object.freeze([
  "htmlCommitCount",
  "staleDecodeCount",
  "layoutTimeoutCount",
  "resolverCallCount",
  "resolverResolvedCount",
  "resolverBlockedCount",
  "resolverErrorCount",
  "mediaElementCount",
  "decodedCount",
  "decodeErrorCount",
  "layoutFrameCount",
  "searchMarkCount",
  "headingCount",
  "headingMeasurementCount",
  "linkCount",
  "linkInspectorCollectCount",
  "linkInspectorBuildCount",
  "outgoingCount",
  "backlinkCount",
]);

const candidateDefinitions = Object.freeze([
  Object.freeze({
    candidatePhase: "image-resolver",
    fixtureIds: Object.freeze([
      "svg-one",
      "raster-duplicate",
      "raster-unique",
      "raster-near-5-mib",
    ]),
    timingKey: "resolverMs",
  }),
  Object.freeze({
    candidatePhase: "image-decode",
    fixtureIds: Object.freeze([
      "svg-one",
      "raster-duplicate",
      "raster-unique",
      "raster-near-5-mib",
    ]),
    timingKey: "decodeMs",
  }),
  Object.freeze({
    candidatePhase: "post-commit",
    fixtureIds: Object.freeze(["dom-dense"]),
    timingKey: "postCommitMs",
  }),
]);

const allowedArtifactKeys = new Set([
  "activeHeadingMs",
  "adoption",
  "backlinkCount",
  "baselineP50Ms",
  "baselineP95Ms",
  "benchmarkId",
  "cacheStatus",
  "candidatePhase",
  "commitMs",
  "confirmationDecision",
  "conservativeHeadroomMs",
  "contractStatus",
  "controlBaselineP95Ms",
  "controlCurrentP95Ms",
  "controlNoiseFloorMs",
  "controlP95RegressionMs",
  "controlP95RegressionPercent",
  "count",
  "counts",
  "currentP50Ms",
  "currentP95Ms",
  "decodeErrorCount",
  "decodeMs",
  "decodedCount",
  "decision",
  "driftPercent",
  "encodeMs",
  "evaluations",
  "fileReadMs",
  "fixtureId",
  "fixtureOrder",
  "fixtures",
  "frame1Ms",
  "frame2Ms",
  "headingCount",
  "headingMeasurementCount",
  "headroom",
  "headroomConfirmation",
  "htmlCommitCount",
  "layoutFrameCount",
  "layoutTimeoutCount",
  "layoutStabilityMs",
  "linkCount",
  "linkInspectorBuildCount",
  "linkInspectorBuildMs",
  "linkInspectorCollectCount",
  "linkInspectorCollectMs",
  "madMs",
  "max",
  "maxMs",
  "measurementCount",
  "mediaElementCount",
  "mediaKind",
  "metadataMs",
  "min",
  "minMs",
  "nativePhases",
  "noiseFloorMs",
  "outgoingCount",
  "p50ImprovementPercent",
  "p50Ms",
  "p50SavingMs",
  "p95Ms",
  "p95SavingMs",
  "parentP50Ms",
  "pathPolicyContextMs",
  "phaseP50Ms",
  "phases",
  "postCommitMs",
  "potentialImprovementPercent",
  "prepareMs",
  "reason",
  "reasons",
  "requiredSavingMs",
  "resolverBlockedCount",
  "resolverCallCount",
  "resolverErrorCount",
  "resolverMs",
  "resolverResolvedCount",
  "runMode",
  "runtime",
  "sampleCount",
  "sampleIndex",
  "samples",
  "samplesMs",
  "sanitizeMs",
  "schemaVersion",
  "searchCleanupMs",
  "searchMarkCount",
  "selectedCandidate",
  "selectedFixtureId",
  "sizeBucket",
  "status",
  "staleDecodeCount",
  "targetFixtureId",
  "targetNoiseFloorMs",
  "timings",
  "totalMs",
  "viewerReadyMs",
  "warmupCount",
  "workerCoreMs",
  "workerDeliveryMs",
]);

const allowedArtifactStrings = new Set([
  ...mainViewerRenderFixtureIds,
  mainViewerRenderSchema,
  mainViewerRenderBenchmarkId,
  mainViewerRenderRuntime,
  "chromium-external-url",
  "formal",
  "confirmation",
  "none",
  "svg",
  "raster",
  "under-64-kib",
  "64-kib-to-1-mib",
  "1-mib-to-5-mib",
  "not-applicable",
  "unavailable",
  "ok",
  "incomplete",
  "go",
  "no-go",
  "needs-baseline",
  "needs-decision",
  "image-resolver",
  "image-decode",
  "post-commit",
  "no-candidate",
  "headroom-confirmed",
  "baseline-unstable",
  "insufficient-headroom",
  "missing-samples",
  "missing-baseline",
  "missing-baseline-target",
  "incomplete-samples",
  "count-drift",
  "target-p50-improvement-below-15-percent",
  "target-p95-saving-below-noise-floor",
  "control-p95-regression-above-noise-floor",
  "control-p95-regression-above-10-percent",
  "matched",
  "mismatch",
  "confirmed",
  "confirmed-no-candidate",
  "formal-not-go",
  "confirmation-not-go",
  "candidate-mismatch",
  "baseline-headroom-mismatch",
  "runtime-mismatch",
  "run-mode-mismatch",
  "missing-comparison",
]);

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function round(value) {
  const numeric = finite(value);
  return numeric === null ? null : Number(numeric.toFixed(3));
}

export function percentile(values, percentileValue) {
  const numeric = values
    .map(finite)
    .filter((value) => value !== null)
    .sort((left, right) => left - right);
  if (numeric.length === 0) return null;
  const index = Math.min(
    numeric.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * numeric.length) - 1),
  );
  return round(numeric[index]);
}

export function medianAbsoluteDeviation(values) {
  const median = percentile(values, 50);
  if (median === null) return null;
  return percentile(
    values
      .map(finite)
      .filter((value) => value !== null)
      .map((value) => Math.abs(value - median)),
    50,
  );
}

export function summarizeDurationSamples(values) {
  const samplesMs = values
    .map(finite)
    .filter((value) => value !== null)
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

function summarizeCountSamples(values) {
  const numeric = values.map(finite).filter((value) => value !== null);
  return {
    min: numeric.length > 0 ? Math.min(...numeric) : null,
    max: numeric.length > 0 ? Math.max(...numeric) : null,
  };
}

export function splitHalfDriftPercent(values) {
  const numeric = values.map(finite).filter((value) => value !== null);
  if (numeric.length < 2) return null;
  const middle = Math.floor(numeric.length / 2);
  const first = percentile(numeric.slice(0, middle), 50);
  const second = percentile(numeric.slice(middle), 50);
  if (first === null || second === null || first === 0) return null;
  return round((Math.abs(second - first) / Math.abs(first)) * 100);
}

export function evaluateMainViewerHeadroom({
  candidatePhase,
  fixtureId,
  parentValues,
  phaseValues,
}) {
  const parentP50Ms = percentile(parentValues, 50);
  const phaseP50Ms = percentile(phaseValues, 50);
  if (
    parentValues.length !== 20 ||
    phaseValues.length !== 20 ||
    parentP50Ms === null ||
    phaseP50Ms === null ||
    parentP50Ms <= 0
  ) {
    return {
      candidatePhase,
      decision: "needs-decision",
      fixtureId,
      reason: "missing-samples",
    };
  }
  const noiseFloorMs = Math.max(
    2,
    2 * (medianAbsoluteDeviation(parentValues) ?? 0),
  );
  const requiredSavingMs = Math.max(parentP50Ms * 0.15, noiseFloorMs);
  const conservativeHeadroomMs = phaseP50Ms * 0.5;
  const driftPercent = splitHalfDriftPercent(parentValues);
  const stable = driftPercent !== null && driftPercent <= 10;
  const enoughHeadroom = conservativeHeadroomMs >= requiredSavingMs;
  return {
    candidatePhase,
    conservativeHeadroomMs: round(conservativeHeadroomMs),
    decision: stable && enoughHeadroom ? "go" : "no-go",
    driftPercent,
    fixtureId,
    noiseFloorMs: round(noiseFloorMs),
    parentP50Ms,
    phaseP50Ms,
    potentialImprovementPercent: round(
      (conservativeHeadroomMs / parentP50Ms) * 100,
    ),
    reason: !stable
      ? "baseline-unstable"
      : enoughHeadroom
        ? "headroom-confirmed"
        : "insufficient-headroom",
    requiredSavingMs: round(requiredSavingMs),
  };
}

function fixtureSamples(samples, fixtureId) {
  return samples.filter((sample) => sample.fixtureId === fixtureId);
}

export function buildMainViewerHeadroom(samples) {
  const evaluations = candidateDefinitions.flatMap((candidate) =>
    candidate.fixtureIds.map((fixtureId) => {
      const selected = fixtureSamples(samples, fixtureId).filter(
        (sample) => sample.status === "ok",
      );
      return evaluateMainViewerHeadroom({
        candidatePhase: candidate.candidatePhase,
        fixtureId,
        parentValues: selected.map((sample) => sample.timings.viewerReadyMs),
        phaseValues: selected.map(
          (sample) => sample.timings[candidate.timingKey],
        ),
      });
    }),
  );
  const eligible = evaluations
    .filter((evaluation) => evaluation.decision === "go")
    .sort(
      (left, right) =>
        (right.conservativeHeadroomMs ?? 0) -
          (left.conservativeHeadroomMs ?? 0) ||
        mainViewerRenderFixtureIds.indexOf(left.fixtureId) -
          mainViewerRenderFixtureIds.indexOf(right.fixtureId),
    );
  const selected = eligible[0];
  return {
    evaluations,
    selectedCandidate: selected?.candidatePhase ?? "no-candidate",
    selectedFixtureId: selected?.fixtureId ?? "none",
    status: selected ? "go" : "no-go",
  };
}

function sanitizeSample(sample) {
  return {
    counts: Object.fromEntries(
      mainViewerRenderCountKeys.map((key) => [key, finite(sample.counts[key])]),
    ),
    fixtureId: sample.fixtureId,
    sampleIndex: sample.sampleIndex,
    status: sample.status,
    timings: Object.fromEntries(
      mainViewerRenderTimingKeys.map((key) => [
        key,
        round(sample.timings[key]),
      ]),
    ),
  };
}

function summarizeFixture(fixture, samples) {
  const selected = fixtureSamples(samples, fixture.fixtureId).map(
    sanitizeSample,
  );
  return {
    cacheStatus: fixture.cacheStatus,
    counts: Object.fromEntries(
      mainViewerRenderCountKeys.map((key) => [
        key,
        summarizeCountSamples(selected.map((sample) => sample.counts[key])),
      ]),
    ),
    fixtureId: fixture.fixtureId,
    measurementCount: selected.length,
    mediaKind: fixture.mediaKind,
    phases: Object.fromEntries(
      mainViewerRenderTimingKeys.map((key) => [
        key,
        summarizeDurationSamples(selected.map((sample) => sample.timings[key])),
      ]),
    ),
    samples: selected,
    sizeBucket: fixture.sizeBucket,
    status:
      selected.length === 20 &&
      selected.every((sample) => sample.status === "ok")
        ? "ok"
        : "incomplete",
  };
}

export function buildMainViewerRenderArtifact({
  fixtures,
  measurementCount = 20,
  mode,
  runtime,
  samples,
}) {
  const summaries = fixtures.map((fixture) =>
    summarizeFixture(fixture, samples),
  );
  const artifact = {
    benchmarkId: mainViewerRenderBenchmarkId,
    fixtureOrder: fixtures.map((fixture) => fixture.fixtureId),
    fixtures: summaries,
    headroom: buildMainViewerHeadroom(samples),
    measurementCount,
    nativePhases: {
      encodeMs: null,
      fileReadMs: null,
      metadataMs: null,
      pathPolicyContextMs: null,
      status: "unavailable",
      totalMs: null,
    },
    runMode: mode,
    runtime,
    schemaVersion: mainViewerRenderSchema,
    warmupCount: 1,
  };
  assertMainViewerRenderArtifactSafe(artifact);
  return artifact;
}

function fixtureSummary(artifact, fixtureId) {
  return artifact.fixtures?.find((fixture) => fixture.fixtureId === fixtureId);
}

function durationSummary(fixture, key) {
  return fixture?.phases?.[key] ?? null;
}

function sameCountContract(baselineFixture, currentFixture) {
  const keys = [
    "htmlCommitCount",
    "staleDecodeCount",
    "layoutTimeoutCount",
    "resolverCallCount",
    "mediaElementCount",
    "decodedCount",
    "headingCount",
    "linkCount",
    "linkInspectorCollectCount",
    "linkInspectorBuildCount",
  ];
  return keys.every(
    (key) =>
      baselineFixture?.counts?.[key]?.min ===
        baselineFixture?.counts?.[key]?.max &&
      currentFixture?.counts?.[key]?.min ===
        currentFixture?.counts?.[key]?.max &&
      baselineFixture?.counts?.[key]?.min ===
        currentFixture?.counts?.[key]?.min,
  );
}

function regressionPercent(baseline, current) {
  if (baseline === null || current === null || baseline <= 0) return null;
  return round((Math.max(0, current - baseline) / baseline) * 100);
}

export function buildMainViewerAdoptionComparison(baseline, current) {
  if (
    baseline?.schemaVersion !== mainViewerRenderSchema ||
    current?.schemaVersion !== mainViewerRenderSchema ||
    baseline?.benchmarkId !== mainViewerRenderBenchmarkId ||
    current?.benchmarkId !== mainViewerRenderBenchmarkId
  ) {
    throw new Error("Main Viewer render benchmark schema mismatch");
  }
  assertMainViewerRenderArtifactSafe(baseline);
  assertMainViewerRenderArtifactSafe(current);
  const candidatePhase = baseline.headroom?.selectedCandidate;
  const targetFixtureId = baseline.headroom?.selectedFixtureId;
  if (
    baseline.runtime !== mainViewerRenderRuntime ||
    current.runtime !== mainViewerRenderRuntime ||
    baseline.runtime !== current.runtime
  ) {
    return {
      candidatePhase: candidatePhase ?? "no-candidate",
      contractStatus: "mismatch",
      reasons: ["runtime-mismatch"],
      status: "needs-decision",
      targetFixtureId: targetFixtureId ?? "none",
    };
  }
  if (baseline.runMode !== current.runMode) {
    return {
      candidatePhase: candidatePhase ?? "no-candidate",
      contractStatus: "mismatch",
      reasons: ["run-mode-mismatch"],
      status: "needs-decision",
      targetFixtureId: targetFixtureId ?? "none",
    };
  }
  if (
    !candidatePhase ||
    candidatePhase === "no-candidate" ||
    !targetFixtureId
  ) {
    return {
      candidatePhase: "no-candidate",
      contractStatus: "mismatch",
      reasons: ["missing-baseline-target"],
      status: "needs-decision",
      targetFixtureId: "none",
    };
  }
  const baselineTargetFixture = fixtureSummary(baseline, targetFixtureId);
  const currentTargetFixture = fixtureSummary(current, targetFixtureId);
  const baselineControlFixture = fixtureSummary(baseline, "plain-control");
  const currentControlFixture = fixtureSummary(current, "plain-control");
  if (
    !baselineTargetFixture ||
    !currentTargetFixture ||
    !baselineControlFixture ||
    !currentControlFixture
  ) {
    return {
      candidatePhase,
      contractStatus: "mismatch",
      reasons: ["missing-baseline-target"],
      status: "needs-decision",
      targetFixtureId,
    };
  }
  const baselineTarget = durationSummary(
    baselineTargetFixture,
    "viewerReadyMs",
  );
  const currentTarget = durationSummary(currentTargetFixture, "viewerReadyMs");
  const baselineControl = durationSummary(
    baselineControlFixture,
    "viewerReadyMs",
  );
  const currentControl = durationSummary(
    currentControlFixture,
    "viewerReadyMs",
  );
  const required = [
    baselineTarget?.p50Ms,
    currentTarget?.p50Ms,
    baselineTarget?.p95Ms,
    currentTarget?.p95Ms,
    baselineControl?.p95Ms,
    currentControl?.p95Ms,
  ];
  if (required.some((value) => finite(value) === null)) {
    return {
      candidatePhase,
      contractStatus: "mismatch",
      reasons: ["missing-samples"],
      status: "needs-decision",
      targetFixtureId,
    };
  }
  const baselineP50Ms = baselineTarget.p50Ms;
  const currentP50Ms = currentTarget.p50Ms;
  const baselineP95Ms = baselineTarget.p95Ms;
  const currentP95Ms = currentTarget.p95Ms;
  const p50SavingMs = baselineP50Ms - currentP50Ms;
  const p50ImprovementPercent = (p50SavingMs / baselineP50Ms) * 100;
  const p95SavingMs = baselineP95Ms - currentP95Ms;
  const targetNoiseFloorMs = Math.max(2, 2 * (baselineTarget.madMs ?? 0));
  const controlP95RegressionMs = Math.max(
    0,
    currentControl.p95Ms - baselineControl.p95Ms,
  );
  const controlNoiseFloorMs = Math.max(2, 2 * (baselineControl.madMs ?? 0));
  const controlP95RegressionPercent = regressionPercent(
    baselineControl.p95Ms,
    currentControl.p95Ms,
  );
  const samplesComplete = [
    baselineTargetFixture,
    currentTargetFixture,
    baselineControlFixture,
    currentControlFixture,
  ].every(
    (fixture) => fixture.status === "ok" && fixture.measurementCount === 20,
  );
  const contractStatus =
    sameCountContract(baselineTargetFixture, currentTargetFixture) &&
    sameCountContract(baselineControlFixture, currentControlFixture)
      ? "matched"
      : "mismatch";
  const reasons = [];
  if (!samplesComplete) reasons.push("incomplete-samples");
  if (contractStatus !== "matched") reasons.push("count-drift");
  if (p50ImprovementPercent < 15) {
    reasons.push("target-p50-improvement-below-15-percent");
  }
  if (p95SavingMs < targetNoiseFloorMs) {
    reasons.push("target-p95-saving-below-noise-floor");
  }
  if (controlP95RegressionMs > controlNoiseFloorMs) {
    reasons.push("control-p95-regression-above-noise-floor");
  }
  if (
    controlP95RegressionPercent === null ||
    controlP95RegressionPercent > 10
  ) {
    reasons.push("control-p95-regression-above-10-percent");
  }
  return {
    baselineP50Ms,
    baselineP95Ms,
    candidatePhase,
    contractStatus,
    controlBaselineP95Ms: baselineControl.p95Ms,
    controlCurrentP95Ms: currentControl.p95Ms,
    controlNoiseFloorMs: round(controlNoiseFloorMs),
    controlP95RegressionMs: round(controlP95RegressionMs),
    controlP95RegressionPercent,
    currentP50Ms,
    currentP95Ms,
    p50ImprovementPercent: round(p50ImprovementPercent),
    p50SavingMs: round(p50SavingMs),
    p95SavingMs: round(p95SavingMs),
    reasons: [...new Set(reasons)],
    status: reasons.length === 0 ? "go" : "no-go",
    targetFixtureId,
    targetNoiseFloorMs: round(targetNoiseFloorMs),
  };
}

export function compareMainViewerBaselineHeadroom(formal, confirmation) {
  if (
    formal?.schemaVersion !== mainViewerRenderSchema ||
    confirmation?.schemaVersion !== mainViewerRenderSchema ||
    formal?.benchmarkId !== mainViewerRenderBenchmarkId ||
    confirmation?.benchmarkId !== mainViewerRenderBenchmarkId
  ) {
    throw new Error("Main Viewer render benchmark schema mismatch");
  }
  assertMainViewerRenderArtifactSafe(formal);
  assertMainViewerRenderArtifactSafe(confirmation);
  const formalCandidate = formal.headroom?.selectedCandidate ?? "no-candidate";
  const formalFixture = formal.headroom?.selectedFixtureId ?? "none";
  const confirmationCandidate =
    confirmation.headroom?.selectedCandidate ?? "no-candidate";
  const confirmationFixture =
    confirmation.headroom?.selectedFixtureId ?? "none";
  const samplesComplete = [formal, confirmation].every(
    (artifact) =>
      artifact.measurementCount === 20 &&
      artifact.fixtures?.every(
        (fixture) => fixture.measurementCount === 20 && fixture.status === "ok",
      ),
  );
  let status = "needs-decision";
  let reason;
  let contractStatus = "mismatch";
  if (formal.runMode !== "formal" || confirmation.runMode !== "confirmation") {
    reason = "run-mode-mismatch";
  } else if (
    formal.runtime !== mainViewerRenderRuntime ||
    confirmation.runtime !== mainViewerRenderRuntime ||
    formal.runtime !== confirmation.runtime
  ) {
    reason = "runtime-mismatch";
  } else if (!samplesComplete) {
    reason = "incomplete-samples";
  } else if (
    formalCandidate !== confirmationCandidate ||
    formalFixture !== confirmationFixture
  ) {
    status = "no-go";
    reason = "baseline-headroom-mismatch";
  } else {
    contractStatus = "matched";
    if (formalCandidate === "no-candidate") {
      status = "no-go";
      reason = "confirmed-no-candidate";
    } else {
      status = "go";
      reason = "headroom-confirmed";
    }
  }
  return {
    candidatePhase: formalCandidate,
    contractStatus,
    reason,
    status,
    targetFixtureId: formalFixture,
  };
}

export function combineMainViewerFormalConfirmation(formal, confirmation) {
  assertMainViewerRenderArtifactSafe(formal);
  assertMainViewerRenderArtifactSafe(confirmation);
  const formalAdoption = formal.adoption;
  const confirmationAdoption = confirmation.adoption;
  let status = "no-go";
  let reason = "missing-comparison";
  if (formal.runMode !== "formal" || confirmation.runMode !== "confirmation") {
    status = "needs-decision";
    reason = "run-mode-mismatch";
  } else if (formal.runtime !== confirmation.runtime) {
    reason = "runtime-mismatch";
  } else if (!formalAdoption || !confirmationAdoption) {
    status = "needs-decision";
  } else if (
    formalAdoption.candidatePhase !== confirmationAdoption.candidatePhase ||
    formalAdoption.targetFixtureId !== confirmationAdoption.targetFixtureId
  ) {
    reason = "candidate-mismatch";
  } else if (formalAdoption.status !== "go") {
    reason = "formal-not-go";
  } else if (confirmationAdoption.status !== "go") {
    reason = "confirmation-not-go";
  } else {
    status = "go";
    reason = "confirmed";
  }
  const combined = {
    ...confirmation,
    confirmationDecision: {
      candidatePhase: confirmationAdoption?.candidatePhase ?? "no-candidate",
      reason,
      status,
      targetFixtureId: confirmationAdoption?.targetFixtureId ?? "none",
    },
  };
  assertMainViewerRenderArtifactSafe(combined);
  return combined;
}

export function assertMainViewerRenderArtifactSafe(value) {
  const visit = (candidate) => {
    if (candidate === null || typeof candidate === "boolean") return;
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) {
        throw new Error("Main Viewer render artifact contains non-finite data");
      }
      return;
    }
    if (typeof candidate === "string") {
      if (!allowedArtifactStrings.has(candidate)) {
        throw new Error(
          "Main Viewer render artifact contains uncontrolled text",
        );
      }
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!candidate || typeof candidate !== "object") {
      throw new Error("Main Viewer render artifact contains unsupported data");
    }
    for (const [key, child] of Object.entries(candidate)) {
      if (!allowedArtifactKeys.has(key)) {
        throw new Error(
          `Main Viewer render artifact contains unsafe key: ${key}`,
        );
      }
      visit(child);
    }
  };
  visit(value);
  return value;
}
