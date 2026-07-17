export const allDiffsUiVariants = [
  "production",
  "without-margin-markers",
  "without-rendered-rulers",
];

const metricKeys = [
  "firstUsefulMs",
  "workflowSettledMs",
  "scrollFrameP50Ms",
  "scrollFrameP95Ms",
  "longTaskCount",
  "longTaskTotalMs",
  "longTaskMaxMs",
  "presentationDurationMs",
  "marginMeasureDurationMs",
  "streamRulerMeasureDurationMs",
  "activeFileScrollSyncDurationMs",
  "marginMeasureCount",
  "marginTargetCount",
  "marginRectCount",
  "marginResizeCallbackCount",
  "marginResizeEntryCount",
  "marginMutationCallbackCount",
  "marginMutationCount",
  "streamRulerMeasureCount",
  "streamRulerTargetCount",
  "streamRulerRectCount",
  "streamRulerMarkerCount",
  "streamRulerResizeCallbackCount",
  "streamRulerResizeEntryCount",
  "presentationRebuildCount",
  "presentationItemCount",
  "presentationReadyItemCount",
  "presentationTargetCount",
  "activeFileScrollSyncCount",
  "activeFileScrollSyncSectionCount",
  "activeFileScrollSyncRectCount",
];

const allowedStrings = new Set([
  "formal",
  "confirmation",
  "production",
  "without-margin-markers",
  "without-rendered-rulers",
  "markdown-14x12-mixed",
  "asciidoc-14x12-mixed",
  "markdown-dense-list-200",
  "markdown-dense-table-200",
  "margin-markers",
  "stream-ruler",
  "no-go",
  "go",
  "not-go",
  "all-diffs-ui-performance-v1",
  "firstUsefulMs",
  "workflowSettledMs",
  "scrollFrameP95Ms",
]);

const decisionMetricKeys = [
  "firstUsefulMs",
  "workflowSettledMs",
  "scrollFrameP95Ms",
];

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function round(value) {
  return Number(finite(value).toFixed(3));
}

export function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = values.map(finite).sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index];
}

export function median(values) {
  if (values.length === 0) return 0;
  const sorted = values.map(finite).sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function medianAbsoluteDeviation(values) {
  const center = median(values);
  return median(values.map((value) => Math.abs(finite(value) - center)));
}

function summarizeVariant(samples) {
  const summary = { sampleCount: samples.length };
  for (const key of metricKeys) {
    const values = samples.map((sample) => finite(sample[key]));
    summary[key] = {
      p50: round(percentile(values, 0.5)),
      p95: round(percentile(values, 0.95)),
    };
  }
  return summary;
}

export function comparePairedSamples(
  baselineSamples,
  counterfactualSamples,
  metric = "workflowSettledMs",
) {
  const counterfactualByIndex = new Map(
    counterfactualSamples.map((sample) => [sample.sampleIndex, sample]),
  );
  const pairs = baselineSamples
    .map((sample) => {
      const counterfactual = counterfactualByIndex.get(sample.sampleIndex);
      return counterfactual
        ? finite(sample[metric]) - finite(counterfactual[metric])
        : null;
    })
    .filter((value) => value !== null);
  const baselineP50 = percentile(
    baselineSamples.map((sample) => finite(sample[metric])),
    0.5,
  );
  const pairedMad = medianAbsoluteDeviation(pairs);
  const requiredSavingMs = Math.max(baselineP50 * 0.15, 2, pairedMad * 2);
  const observedSavingMs = median(pairs);
  const go = observedSavingMs >= requiredSavingMs;
  return {
    metric,
    pairCount: pairs.length,
    baselineP50Ms: round(baselineP50),
    observedSavingMs: round(observedSavingMs),
    pairedMadMs: round(pairedMad),
    requiredSavingMs: round(requiredSavingMs),
    status: go ? "go" : "not-go",
  };
}

export function compareCounterfactual(baselineSamples, counterfactualSamples) {
  const metrics = Object.fromEntries(
    decisionMetricKeys.map((metric) => [
      metric,
      comparePairedSamples(baselineSamples, counterfactualSamples, metric),
    ]),
  );
  return {
    metrics,
    status: Object.values(metrics).some((metric) => metric.status === "go")
      ? "go"
      : "not-go",
  };
}

export function summarizeAllDiffsUiRun({ mode, samples }) {
  const fixtures = [];
  const fixtureIds = [...new Set(samples.map((sample) => sample.fixtureId))];
  for (const fixtureId of fixtureIds) {
    const fixtureSamples = samples.filter(
      (sample) => sample.fixtureId === fixtureId,
    );
    const byVariant = Object.fromEntries(
      allDiffsUiVariants.map((variant) => {
        const variantSamples = fixtureSamples.filter(
          (sample) => sample.variant === variant,
        );
        return [variant, summarizeVariant(variantSamples)];
      }),
    );
    const production = fixtureSamples.filter(
      (sample) => sample.variant === "production",
    );
    const withoutMargins = fixtureSamples.filter(
      (sample) => sample.variant === "without-margin-markers",
    );
    const withoutRulers = fixtureSamples.filter(
      (sample) => sample.variant === "without-rendered-rulers",
    );
    fixtures.push({
      fixtureId,
      variants: byVariant,
      marginMarkers: compareCounterfactual(production, withoutMargins),
      streamRuler: compareCounterfactual(withoutMargins, withoutRulers),
    });
  }
  const marginMarkersGo = fixtures.some(
    (fixture) => fixture.marginMarkers.status === "go",
  );
  const streamRulerGo = fixtures.some(
    (fixture) => fixture.streamRuler.status === "go",
  );
  return {
    schema: "all-diffs-ui-performance-v1",
    mode,
    sampleCount: samples.length,
    fixtures,
    candidate: marginMarkersGo
      ? "margin-markers"
      : streamRulerGo
        ? "stream-ruler"
        : "no-go",
  };
}

export function combineAllDiffsUiRuns(formal, confirmation) {
  const candidate =
    formal.candidate !== "no-go" && formal.candidate === confirmation.candidate
      ? formal.candidate
      : "no-go";
  const comparisonKey =
    candidate === "margin-markers"
      ? "marginMarkers"
      : candidate === "stream-ruler"
        ? "streamRuler"
        : null;
  const confirmationByFixture = new Map(
    confirmation.fixtures.map((fixture) => [fixture.fixtureId, fixture]),
  );
  const confirmedEvidence = comparisonKey
    ? formal.fixtures.flatMap((formalFixture) => {
        const confirmationFixture = confirmationByFixture.get(
          formalFixture.fixtureId,
        );
        if (!confirmationFixture) return [];
        return decisionMetricKeys.flatMap((metric) =>
          formalFixture[comparisonKey].metrics[metric]?.status === "go" &&
          confirmationFixture[comparisonKey].metrics[metric]?.status === "go"
            ? [{ fixtureId: formalFixture.fixtureId, metric }]
            : [],
        );
      })
    : [];
  return {
    ...confirmation,
    confirmedCandidate: confirmedEvidence.length > 0 ? candidate : "no-go",
    confirmedEvidence,
  };
}

export function assertAllDiffsUiArtifactSafe(value) {
  const forbiddenKey = /(?:path|url|html|source|text|revision|query|hunk)/i;
  const visit = (candidate) => {
    if (candidate === null || typeof candidate === "boolean") return;
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) {
        throw new Error("All Diffs UI artifact contains a non-finite number");
      }
      return;
    }
    if (typeof candidate === "string") {
      if (!allowedStrings.has(candidate)) {
        throw new Error(
          `All Diffs UI artifact contains unsafe text: ${candidate}`,
        );
      }
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!candidate || typeof candidate !== "object") {
      throw new Error("All Diffs UI artifact contains an unsupported value");
    }
    for (const [key, nested] of Object.entries(candidate)) {
      if (forbiddenKey.test(key)) {
        throw new Error(`All Diffs UI artifact contains forbidden key: ${key}`);
      }
      visit(nested);
    }
  };
  visit(value);
  return value;
}
