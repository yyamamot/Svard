import { round, workflowResult } from "./benchmarkCore.mjs";

/**
 * Browser collector contract installed before each startup navigation:
 * window[collectorGlobal] = {
 *   schemaVersion, scenarioId, status, profile,
 *   phases: { initialDocumentOpenedMs, documentRenderStartedMs,
 *     firstDocumentFrameMs, rootDirectoryReadyMs,
 *     expandedDirectoriesReadyMs, treeSettledMs },
 *   entryCount, orderViolationCount, reason?
 * }.
 * The benchmark copies only this fixed allowlist into its summary.
 */
const workspaceBootBenchmarkInterface = Object.freeze({
  collectorGlobal: "__SVARD_WORKSPACE_BOOT_BENCHMARK__",
  measurementCountPerProfile: 7,
  profiles: ["fast", "normal"],
  scenarioId: "viewer-workspace-boot-first-content",
  schemaVersion: 1,
  warmupCountPerProfile: 1,
});

const workspaceBootPhaseDefinitions = [
  ["initialDocumentOpenedMs", "initial-document-opened"],
  ["documentRenderStartedMs", "document-render-started"],
  ["firstDocumentFrameMs", "first-document-frame"],
  ["rootDirectoryReadyMs", "root-directory-ready"],
  ["expandedDirectoriesReadyMs", "expanded-directories-ready"],
  ["treeSettledMs", "tree-settled"],
];

const documentRenderCacheBenchmarkInterface = Object.freeze({
  collectorGlobal: "__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK__",
  measurementCount: 7,
  phases: ["cold-a", "cold-b", "revisit-a", "theme-a", "reload-a"],
  scenarioId: "viewer-render-cache-tab-revisit",
  schemaVersion: 2,
  warmupCount: 1,
});

const documentRenderCacheCountFields = [
  "coreProducerCount",
  "prepareProducerCount",
  "articleCommitCount",
  "cacheEventCount",
  "cacheHitCount",
  "cacheMissCount",
  "inFlightCount",
  "inFlightActiveCountFinal",
  "inFlightSnapshotCount",
  "coreHitCount",
  "preparedHitCount",
  "admissionEstimatedBytesMax",
  "residentBytesMax",
  "entryCountMax",
  "evictionCount",
];

function percentile(values, percentileValue) {
  const sorted = values
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (sorted.length === 0) {
    return null;
  }
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileValue / 100) * sorted.length) - 1,
  );
  return round(sorted[index]);
}

function summarizeDurations(durations) {
  const numeric = durations.filter(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  return {
    count: numeric.length,
    maxMs: numeric.length > 0 ? round(Math.max(...numeric)) : null,
    p50Ms: percentile(numeric, 50),
    p95Ms: percentile(numeric, 95),
  };
}

function workspaceBootBenchmarkPlan() {
  const warmups = workspaceBootBenchmarkInterface.profiles.flatMap((profile) =>
    Array.from(
      { length: workspaceBootBenchmarkInterface.warmupCountPerProfile },
      () => ({ kind: "warmup", profile }),
    ),
  );
  const measurements = Array.from(
    { length: workspaceBootBenchmarkInterface.measurementCountPerProfile },
    (_, index) =>
      workspaceBootBenchmarkInterface.profiles.map((profile) => ({
        index: index + 1,
        kind: "measurement",
        profile,
      })),
  ).flat();
  return [...warmups, ...measurements];
}

function workspaceBootScenarioUrl(baseURL, profile) {
  if (!workspaceBootBenchmarkInterface.profiles.includes(profile)) {
    throw new Error(`Unsupported workspace boot profile: ${profile}`);
  }
  const url = new URL(baseURL);
  url.searchParams.set("scenario", workspaceBootBenchmarkInterface.scenarioId);
  url.searchParams.set("bootTreeProfile", profile);
  return url.toString();
}

function safeCollectorReason(reason, fallback) {
  return typeof reason === "string" && /^[a-z0-9_.:-]+$/iu.test(reason)
    ? reason
    : fallback;
}

function normalizeWorkspaceBootSample(sample, expectedProfile) {
  if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
    throw new Error("Workspace boot collector returned an invalid sample");
  }
  const status = sample.status === "ok" ? "ok" : "failed";
  const profile = sample.profile;
  if (
    sample.schemaVersion !== workspaceBootBenchmarkInterface.schemaVersion ||
    sample.scenarioId !== workspaceBootBenchmarkInterface.scenarioId ||
    profile !== expectedProfile
  ) {
    throw new Error("Workspace boot collector contract mismatch");
  }
  if (status !== "ok") {
    return {
      profile,
      reason: safeCollectorReason(sample.reason, "collector-failed"),
      status,
    };
  }
  const phases = {};
  for (const [phaseKey] of workspaceBootPhaseDefinitions) {
    const value = sample.phases?.[phaseKey];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(`Workspace boot collector missing phase: ${phaseKey}`);
    }
    phases[phaseKey] = round(value);
  }
  const entryCount = sample.entryCount;
  const orderViolationCount = sample.orderViolationCount;
  if (!Number.isInteger(entryCount) || entryCount < 0) {
    throw new Error("Workspace boot collector returned an invalid entry count");
  }
  if (!Number.isInteger(orderViolationCount) || orderViolationCount < 0) {
    throw new Error(
      "Workspace boot collector returned an invalid order violation count",
    );
  }
  return {
    entryCount,
    orderViolationCount,
    phases,
    profile,
    status,
  };
}

function summarizeWorkspaceBootProfile(samples) {
  const phases = Object.fromEntries(
    workspaceBootPhaseDefinitions.map(([phaseKey]) => [
      phaseKey,
      summarizeDurations(samples.map((sample) => sample.phases[phaseKey])),
    ]),
  );
  const entryCounts = samples.map((sample) => sample.entryCount);
  return {
    entryCount: {
      max: entryCounts.length > 0 ? Math.max(...entryCounts) : null,
      min: entryCounts.length > 0 ? Math.min(...entryCounts) : null,
    },
    measurementCount: samples.length,
    orderViolationCount: samples.reduce(
      (total, sample) => total + sample.orderViolationCount,
      0,
    ),
    phases,
  };
}

function summarizeWorkspaceBootBenchmark(report, profile) {
  if (!report) {
    return {
      measurementCountPerProfile:
        workspaceBootBenchmarkInterface.measurementCountPerProfile,
      profiles: {},
      reason:
        profile === "quick"
          ? "not-measured-in-quick-profile"
          : "workspace-boot-collector-unavailable",
      scenarioId: workspaceBootBenchmarkInterface.scenarioId,
      schemaVersion: workspaceBootBenchmarkInterface.schemaVersion,
      status: "skipped",
      warmupCountPerProfile:
        workspaceBootBenchmarkInterface.warmupCountPerProfile,
    };
  }
  if (report.status !== "ok") {
    return {
      measurementCountPerProfile:
        workspaceBootBenchmarkInterface.measurementCountPerProfile,
      profiles: {},
      reason: safeCollectorReason(
        report.reason,
        report.status === "skipped"
          ? "workspace-boot-collector-unavailable"
          : "workspace-boot-collector-failed",
      ),
      scenarioId: workspaceBootBenchmarkInterface.scenarioId,
      schemaVersion: workspaceBootBenchmarkInterface.schemaVersion,
      status: report.status === "skipped" ? "skipped" : "failed",
      warmupCountPerProfile:
        workspaceBootBenchmarkInterface.warmupCountPerProfile,
    };
  }

  const profileSummaries = {};
  let reason = null;
  for (const profileId of workspaceBootBenchmarkInterface.profiles) {
    const samples = report.profiles?.[profileId] ?? [];
    if (
      samples.length !==
      workspaceBootBenchmarkInterface.measurementCountPerProfile
    ) {
      reason ??= "incomplete-workspace-boot-measurements";
    }
    profileSummaries[profileId] = summarizeWorkspaceBootProfile(samples);
  }
  return {
    measurementCountPerProfile:
      workspaceBootBenchmarkInterface.measurementCountPerProfile,
    profiles: profileSummaries,
    reason,
    scenarioId: workspaceBootBenchmarkInterface.scenarioId,
    schemaVersion: workspaceBootBenchmarkInterface.schemaVersion,
    status: reason === null ? "ok" : "failed",
    warmupCountPerProfile:
      workspaceBootBenchmarkInterface.warmupCountPerProfile,
  };
}

function deriveWorkspaceBootResult(summary) {
  const hasProfileSummaries = workspaceBootBenchmarkInterface.profiles.every(
    (profileId) => summary.profiles?.[profileId]?.phases,
  );
  if (
    (summary.status !== "ok" && summary.status !== "failed") ||
    !hasProfileSummaries
  ) {
    return workflowResult({
      category: "filesystem",
      fixtureId: summary.scenarioId,
      id: "workspace-boot-first-content",
      metric: "normal.firstDocumentFrameMs.p50",
      reason: summary.reason,
      source: `ui-startup-benchmark:${summary.scenarioId}`,
      status: summary.status === "failed" ? "failed" : "skipped",
    });
  }
  const phaseBreakdown = workspaceBootBenchmarkInterface.profiles.flatMap(
    (profileId) =>
      workspaceBootPhaseDefinitions.map(([phaseKey, phaseName]) => {
        const stats = summary.profiles[profileId].phases[phaseKey];
        const details = {
          p50Ms: stats.p50Ms,
          p95Ms: stats.p95Ms,
          sampleCount: stats.count,
        };
        if (phaseKey === "treeSettledMs") {
          details.entryCountMax = summary.profiles[profileId].entryCount.max;
          details.entryCountMin = summary.profiles[profileId].entryCount.min;
          details.orderViolationCount =
            summary.profiles[profileId].orderViolationCount;
        }
        return {
          details,
          durationMs: stats.p50Ms,
          name: `${profileId}-${phaseName}`,
          status: "ok",
        };
      }),
  );
  const measurementCount = workspaceBootBenchmarkInterface.profiles.reduce(
    (total, profileId) => total + summary.profiles[profileId].measurementCount,
    0,
  );
  return workflowResult({
    category: "filesystem",
    durationMs:
      summary.profiles.normal?.phases.firstDocumentFrameMs.p50Ms ?? null,
    eventCount: measurementCount * workspaceBootPhaseDefinitions.length,
    fixtureId: summary.scenarioId,
    id: "workspace-boot-first-content",
    metric: "normal.firstDocumentFrameMs.p50",
    phaseBreakdown,
    reason: summary.reason,
    source: `ui-startup-benchmark:${summary.scenarioId}`,
    status: summary.status,
  });
}

function documentRenderCacheBenchmarkPlan() {
  return [
    ...Array.from(
      { length: documentRenderCacheBenchmarkInterface.warmupCount },
      () => ({ kind: "warmup" }),
    ),
    ...Array.from(
      { length: documentRenderCacheBenchmarkInterface.measurementCount },
      (_, index) => ({ index: index + 1, kind: "measurement" }),
    ),
  ];
}

function normalizeDocumentRenderCacheSample(sample) {
  if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
    throw new Error(
      "Document render cache collector returned an invalid sample",
    );
  }
  if (
    sample.schemaVersion !==
      documentRenderCacheBenchmarkInterface.schemaVersion ||
    sample.scenarioId !== documentRenderCacheBenchmarkInterface.scenarioId
  ) {
    throw new Error("Document render cache collector contract mismatch");
  }
  if (sample.status !== "ok") {
    return {
      reason: safeCollectorReason(sample.reason, "collector-failed"),
      status: "failed",
    };
  }
  const phases = {};
  for (const phaseName of documentRenderCacheBenchmarkInterface.phases) {
    const source = sample.phases?.[phaseName];
    if (
      !source ||
      typeof source.durationMs !== "number" ||
      !Number.isFinite(source.durationMs) ||
      source.durationMs < 0
    ) {
      throw new Error(
        `Document render cache collector missing phase: ${phaseName}`,
      );
    }
    const phase = { durationMs: round(source.durationMs) };
    for (const field of documentRenderCacheCountFields) {
      const value = source[field];
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(
          `Document render cache collector returned an invalid ${field}`,
        );
      }
      phase[field] = value;
    }
    phases[phaseName] = phase;
  }
  return { phases, status: "ok" };
}

function summarizeDocumentRenderCacheBenchmark(report, profile) {
  if (!report) {
    return {
      measurementCount: documentRenderCacheBenchmarkInterface.measurementCount,
      phases: {},
      reason:
        profile === "quick"
          ? "not-measured-in-quick-profile"
          : "document-render-cache-collector-unavailable",
      scenarioId: documentRenderCacheBenchmarkInterface.scenarioId,
      schemaVersion: documentRenderCacheBenchmarkInterface.schemaVersion,
      status: "skipped",
      warmupCount: documentRenderCacheBenchmarkInterface.warmupCount,
    };
  }
  if (report.status !== "ok") {
    return {
      measurementCount: documentRenderCacheBenchmarkInterface.measurementCount,
      phases: {},
      reason: safeCollectorReason(
        report.reason,
        report.status === "skipped"
          ? "document-render-cache-collector-unavailable"
          : "document-render-cache-collector-failed",
      ),
      scenarioId: documentRenderCacheBenchmarkInterface.scenarioId,
      schemaVersion: documentRenderCacheBenchmarkInterface.schemaVersion,
      status: report.status === "skipped" ? "skipped" : "failed",
      warmupCount: documentRenderCacheBenchmarkInterface.warmupCount,
    };
  }
  const samples = report.samples ?? [];
  const phases = Object.fromEntries(
    documentRenderCacheBenchmarkInterface.phases.map((phaseName) => {
      const phaseSamples = samples.map((sample) => sample.phases[phaseName]);
      const counts = Object.fromEntries(
        documentRenderCacheCountFields.map((field) => {
          const values = phaseSamples.map((phase) => phase[field]);
          return [
            field,
            {
              max: values.length > 0 ? Math.max(...values) : null,
              min: values.length > 0 ? Math.min(...values) : null,
              total: values.reduce((sum, value) => sum + value, 0),
            },
          ];
        }),
      );
      return [
        phaseName,
        {
          duration: summarizeDurations(
            phaseSamples.map((phase) => phase.durationMs),
          ),
          ...counts,
        },
      ];
    }),
  );
  const complete =
    samples.length === documentRenderCacheBenchmarkInterface.measurementCount;
  return {
    measurementCount: samples.length,
    phases,
    reason: complete ? null : "incomplete-document-render-cache-measurements",
    scenarioId: documentRenderCacheBenchmarkInterface.scenarioId,
    schemaVersion: documentRenderCacheBenchmarkInterface.schemaVersion,
    status: complete ? "ok" : "failed",
    warmupCount: documentRenderCacheBenchmarkInterface.warmupCount,
  };
}

function deriveDocumentRenderCacheResult(summary) {
  if (!summary.phases?.["revisit-a"]?.duration) {
    return workflowResult({
      category: "render",
      fixtureId: summary.scenarioId,
      id: "document-render-cache-tab-revisit",
      metric: "revisit-a.durationMs.p50",
      reason: summary.reason,
      source: `ui-cache-benchmark:${summary.scenarioId}`,
      status: summary.status === "failed" ? "failed" : "skipped",
    });
  }
  const phaseBreakdown = documentRenderCacheBenchmarkInterface.phases.map(
    (phaseName) => {
      const phase = summary.phases[phaseName];
      return {
        details: {
          p50Ms: phase.duration.p50Ms,
          p95Ms: phase.duration.p95Ms,
          sampleCount: phase.duration.count,
          coreProducerCountMax: phase.coreProducerCount.max,
          prepareProducerCountMax: phase.prepareProducerCount.max,
          cacheHitCountMax: phase.cacheHitCount.max,
          inFlightActiveCountFinalMax: phase.inFlightActiveCountFinal.max,
          inFlightFollowerCountMax: phase.inFlightCount.max,
          inFlightSnapshotCountMin: phase.inFlightSnapshotCount.min,
          residentBytesMax: phase.residentBytesMax.max,
          entryCountMax: phase.entryCountMax.max,
        },
        durationMs: phase.duration.p50Ms,
        name: phaseName,
        status: "ok",
      };
    },
  );
  return workflowResult({
    category: "render",
    durationMs: summary.phases["revisit-a"].duration.p50Ms,
    eventCount:
      summary.measurementCount *
      documentRenderCacheBenchmarkInterface.phases.length,
    fixtureId: summary.scenarioId,
    id: "document-render-cache-tab-revisit",
    metric: "revisit-a.durationMs.p50",
    phaseBreakdown,
    reason: summary.reason,
    source: `ui-cache-benchmark:${summary.scenarioId}`,
    status: summary.status,
  });
}

export {
  deriveDocumentRenderCacheResult,
  deriveWorkspaceBootResult,
  documentRenderCacheBenchmarkInterface,
  documentRenderCacheBenchmarkPlan,
  normalizeDocumentRenderCacheSample,
  normalizeWorkspaceBootSample,
  percentile,
  summarizeDocumentRenderCacheBenchmark,
  summarizeDurations,
  summarizeWorkspaceBootBenchmark,
  workspaceBootBenchmarkInterface,
  workspaceBootBenchmarkPlan,
  workspaceBootScenarioUrl,
};
