import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportMarkdown } from "./workspace-performance/reportMarkdown.mjs";

const workflowDefinitions = [
  { id: "app-boot", category: "render" },
  { id: "workspace-boot-first-content", category: "filesystem" },
  { id: "document-render-cache-tab-revisit", category: "render" },
  { id: "initial-document-open", category: "render" },
  { id: "markdown-render", category: "render" },
  { id: "asciidoc-render", category: "render" },
  { id: "diagram-open-via-tree", category: "filesystem" },
  { id: "diagram-render-after-open", category: "diagram" },
  { id: "filetree-root-expand-refresh", category: "filesystem" },
  { id: "current-file-search", category: "search" },
  { id: "workspace-search", category: "search" },
  { id: "source-control-changes", category: "git/source-control" },
  { id: "file-history", category: "git/source-control" },
  { id: "diff-preview-open", category: "diff-preview" },
  { id: "change-review-marker-generation", category: "change-review" },
];

const categoryByEventPrefix = [
  ["render.", "render"],
  ["workspaceBoot.", "filesystem"],
  ["sourceControl.", "git/source-control"],
  ["postDiffGitMarkers.", "change-review"],
  ["viewer.render", "render"],
];

const uiWorkflowScenarios = [
  {
    workflowId: "diagram-open-via-tree",
    scenario: "viewer-diagram-samples",
  },
  {
    workflowId: "diagram-render-after-open",
    scenario: "viewer-diagram-samples-after-open",
  },
  {
    workflowId: "filetree-root-expand-refresh",
    scenario: "viewer-files-tree-auto-refresh",
  },
  {
    workflowId: "current-file-search",
    scenario: "viewer-search",
  },
  {
    workflowId: "workspace-search",
    scenario: "viewer-workspace-search-performance",
  },
  {
    workflowId: "diff-preview-open",
    scenario: "viewer-rendered-diff-quality",
  },
  {
    workflowId: "change-review-marker-generation",
    scenario: "viewer-normal-git-markers-table-cell-markdown-diagnosis",
  },
];

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

function parseArgs(argv) {
  const args = {
    out: null,
    profile: "quick",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") {
      continue;
    }
    if (value === "--profile") {
      args.profile = argv[++index] ?? args.profile;
      continue;
    }
    if (value === "--out") {
      args.out = argv[++index] ?? null;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  if (!["quick", "full", "diagnostic"].includes(args.profile)) {
    throw new Error(`Unsupported profile: ${args.profile}`);
  }
  return args;
}

function nowId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function round(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(2))
    : null;
}

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

function workflowResult({
  category,
  durationMs = null,
  eventCount = 0,
  fixtureId = null,
  id,
  metric = "durationMs",
  phaseBreakdown = [],
  reason = null,
  source = null,
  status = "ok",
}) {
  return {
    category,
    durationMs: round(durationMs),
    eventCount,
    fixtureId,
    id,
    metric,
    phaseBreakdown,
    reason,
    source,
    status,
  };
}

function eventCategory(eventName) {
  const match = categoryByEventPrefix.find(([prefix]) =>
    eventName.startsWith(prefix),
  );
  return match?.[1] ?? "other";
}

function summarizeEvents(events) {
  const normalized = events
    .filter((event) => typeof event?.event === "string")
    .map((event) => ({
      category: eventCategory(event.event),
      durationMs: round(event.durationMs),
      event: event.event,
      reason: event.reason,
      status: event.status,
    }));
  const durations = normalized
    .map((event) => event.durationMs)
    .filter((duration) => duration !== null);
  const byCategory = {};
  for (const event of normalized) {
    const bucket =
      byCategory[event.category] ??
      (byCategory[event.category] = { count: 0, durations: [] });
    bucket.count += 1;
    if (event.durationMs !== null) {
      bucket.durations.push(event.durationMs);
    }
  }
  return {
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([category, bucket]) => [
        category,
        {
          count: bucket.count,
          ...summarizeDurations(bucket.durations),
        },
      ]),
    ),
    count: normalized.length,
    slowest: normalized
      .filter((event) => event.durationMs !== null)
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 10),
    ...summarizeDurations(durations),
  };
}

function deriveMarkdownResults(report) {
  const phaseByName = Object.fromEntries(
    (report.phases ?? []).map((phase) => [phase.phase, phase]),
  );
  const bootPlain = phaseByName.bootWarmBeforeOpen?.documents?.find(
    (document) => document.basename === "plain-small.md",
  );
  const repeatedDocs = phaseByName.repeatedWarm?.documents ?? [];
  const repeatedDurations = repeatedDocs
    .map((document) => document.domReadyMs)
    .filter((value) => typeof value === "number");
  const eventCount = repeatedDocs.reduce(
    (count, document) => count + (document.events?.length ?? 0),
    0,
  );
  const diagnosticEvents = (report.diagnosticSequence ?? []).flatMap(
    (entry) => entry.events ?? [],
  );
  return {
    events: summarizeEvents(diagnosticEvents),
    workflows: [
      workflowResult({
        category: "render",
        durationMs: report.summary?.firstOpenPenaltyMs,
        eventCount: bootPlain?.events?.length ?? 0,
        fixtureId: bootPlain?.basename ?? "plain-small.md",
        id: "app-boot",
        metric: "firstOpenPenaltyMs",
        source: "perf:markdown",
        status:
          typeof report.summary?.firstOpenPenaltyMs === "number"
            ? "ok"
            : "skipped",
        reason:
          typeof report.summary?.firstOpenPenaltyMs === "number"
            ? null
            : "missing-markdown-boot-summary",
      }),
      workflowResult({
        category: "render",
        durationMs: bootPlain?.domReadyMs,
        eventCount: bootPlain?.events?.length ?? 0,
        fixtureId: bootPlain?.basename ?? "plain-small.md",
        id: "initial-document-open",
        metric: "domReadyMs",
        source: "perf:markdown",
        status: typeof bootPlain?.domReadyMs === "number" ? "ok" : "skipped",
        reason:
          typeof bootPlain?.domReadyMs === "number"
            ? null
            : "missing-markdown-open-summary",
      }),
      workflowResult({
        category: "render",
        durationMs: percentile(repeatedDurations, 95),
        eventCount,
        fixtureId: "markdown-fixtures",
        id: "markdown-render",
        metric: "repeatedWarm.domReadyMs.p95",
        source: "perf:markdown",
        status: repeatedDurations.length > 0 ? "ok" : "skipped",
        reason:
          repeatedDurations.length > 0
            ? null
            : "missing-markdown-repeated-summary",
      }),
    ],
  };
}

function deriveAsciiDocResults(report) {
  const averages = report.summary?.averages ?? {};
  const document = report.summary?.document ?? {};
  return [
    workflowResult({
      category: "render",
      durationMs: averages.totalRenderPrepareMs,
      eventCount: 0,
      fixtureId: document.basename ?? "large-asciidoc-fixture",
      id: "asciidoc-render",
      metric: "totalRenderPrepareMs.average",
      source: "perf:asciidoc",
      status:
        typeof averages.totalRenderPrepareMs === "number" ? "ok" : "skipped",
      reason:
        typeof averages.totalRenderPrepareMs === "number"
          ? null
          : "missing-asciidoc-summary",
    }),
  ];
}

function deriveSourceControlResults(report) {
  const phases = Object.fromEntries(
    (report.phases ?? []).map((phase) => [phase.phase, phase]),
  );
  const initial = phases.initialLimit;
  const cacheHit = phases.sameHeadCacheHit;
  return [
    workflowResult({
      category: "git/source-control",
      durationMs: initial?.metrics?.durationMs,
      eventCount: initial?.itemCount ?? 0,
      fixtureId: "fixture-git-repo",
      id: "source-control-changes",
      metric: "initialLimit.metrics.durationMs",
      source: "perf:source-control:file-history",
      status:
        typeof initial?.metrics?.durationMs === "number" ? "ok" : "skipped",
      reason:
        typeof initial?.metrics?.durationMs === "number"
          ? null
          : "missing-source-control-initial-summary",
    }),
    workflowResult({
      category: "git/source-control",
      durationMs: cacheHit?.metrics?.durationMs,
      eventCount: cacheHit?.itemCount ?? 0,
      fixtureId: "fixture-git-repo",
      id: "file-history",
      metric: "sameHeadCacheHit.metrics.durationMs",
      source: "perf:source-control:file-history",
      status:
        typeof cacheHit?.metrics?.durationMs === "number" ? "ok" : "skipped",
      reason:
        typeof cacheHit?.metrics?.durationMs === "number"
          ? null
          : "missing-file-history-cache-summary",
    }),
  ];
}

function deriveUiReviewResults(reports = []) {
  return reports.map((entry) => {
    const definition = workflowDefinitions.find(
      (workflow) => workflow.id === entry.workflowId,
    );
    const assertionFailures = entry.report?.assertionFailures ?? [];
    const markerCount =
      entry.report?.postDiffMarkerSummary?.markerCount ??
      entry.report?.postDiffMarkerSummary?.markers?.length ??
      0;
    const tableCellMarkerCount =
      entry.report?.postDiffMarkerSummary?.tableSummary?.tableCellMarkerCount ??
      0;
    const phaseBreakdown = normalizePhaseBreakdown(
      entry.report?.benchmarkPhases ?? [],
      entry.report,
      entry.workflowId,
    );
    const durationOverridePhase = phaseBreakdown.find(
      (phase) => phase.name === durationOverridePhaseName(entry.workflowId),
    );
    const missingOverridePhaseReason = missingDurationOverrideReason(
      entry.workflowId,
      durationOverridePhase,
    );
    const scenarioDurationMs =
      durationOverridePhase?.durationMs ??
      entry.report?.captureMetrics?.scenarioMs ??
      entry.durationMs;
    return workflowResult({
      category: definition?.category ?? "other",
      durationMs: scenarioDurationMs,
      eventCount:
        markerCount > 0 || tableCellMarkerCount > 0
          ? markerCount + tableCellMarkerCount
          : Object.keys(entry.report?.assertions ?? {}).length,
      fixtureId: entry.scenario,
      id: entry.workflowId,
      metric: durationOverridePhase
        ? `uiScenario.phase.${durationOverridePhase.name}`
        : "uiScenario.scenarioMs",
      phaseBreakdown,
      reason:
        entry.status === "ok"
          ? missingOverridePhaseReason
          : assertionFailures.length > 0
            ? "ui-scenario-assertion-failure"
            : (entry.reason ?? "ui-scenario-failed"),
      source: `ui-review:${entry.scenario}`,
      status: entry.status,
    });
  });
}

function durationOverridePhaseName(workflowId) {
  if (workflowId === "diagram-open-via-tree") {
    return "document-heading-visible";
  }
  if (workflowId === "diagram-render-after-open") {
    return "all-diagrams-visible-after-heading";
  }
  if (workflowId === "current-file-search") {
    return "search-interaction-complete";
  }
  return null;
}

function missingDurationOverrideReason(workflowId, durationOverridePhase) {
  const phaseName = durationOverridePhaseName(workflowId);
  if (phaseName === null || durationOverridePhase !== undefined) {
    return null;
  }
  return `missing-phase:${phaseName}`;
}

function normalizePhaseBreakdown(phases, report = null, workflowId = "") {
  const normalized = Array.isArray(phases)
    ? phases
        .filter((phase) => typeof phase?.name === "string")
        .map((phase) => ({
          details: safePhaseDetails(phase.details),
          durationMs: round(phase.durationMs),
          name: phase.name,
          status: phase.status === "skipped" ? "skipped" : "ok",
        }))
    : [];
  const shouldIncludeDiagramMetrics =
    workflowId === "diagram-render-after-open";
  const plantUmlMetrics = shouldIncludeDiagramMetrics
    ? report?.plantUmlMetrics
    : null;
  if (plantUmlMetrics) {
    normalized.push({
      details: plantUmlMetricDetails(plantUmlMetrics),
      durationMs: round(plantUmlMetrics.totalMs),
      name: "plantuml-render-batch",
      status: "ok",
    });
  }
  const graphvizMetrics = shouldIncludeDiagramMetrics
    ? report?.graphvizMetrics
    : null;
  if (graphvizMetrics) {
    normalized.push({
      details: graphvizMetricDetails(graphvizMetrics),
      durationMs: round(graphvizMetrics.totalMs),
      name: "graphviz-render-batch",
      status: "ok",
    });
  }
  return normalized;
}

function safePhaseDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }
  const safe = {};
  for (const [key, value] of Object.entries(details)) {
    if (
      (typeof value === "number" && Number.isFinite(value)) ||
      typeof value === "boolean"
    ) {
      safe[key] = round(value);
    } else if (typeof value === "string" && /^[a-z0-9_.:-]+$/iu.test(value)) {
      safe[key] = value;
    }
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

function plantUmlMetricDetails(metrics) {
  const componentP50 = metrics.componentP50Ms ?? {};
  const componentP95 = metrics.componentP95Ms ?? {};
  return safePhaseDetails({
    cacheHitCount: metrics.cacheHitCount,
    cacheMissCount: metrics.cacheMissCount,
    concurrency: metrics.concurrency,
    diagramCount: metrics.diagramCount,
    errorCount: metrics.errorCount,
    memoryHitCount: metrics.memoryHitCount,
    p50Ms: metrics.p50Ms,
    p95Ms: metrics.p95Ms,
    persistentHitCount: metrics.persistentHitCount,
    queueWaitP50Ms: componentP50.queueWaitMs,
    queueWaitP95Ms: componentP95.queueWaitMs,
    renderCoreP50Ms: componentP50.renderCoreMs,
    renderCoreP95Ms: componentP95.renderCoreMs,
    renderedCount: metrics.renderedCount,
    timeoutCount: metrics.timeoutCount,
    workerCount: metrics.workerCount,
    workerReadyWaitP50Ms: componentP50.workerReadyWaitMs,
    workerReadyWaitP95Ms: componentP95.workerReadyWaitMs,
    workerTotalP50Ms: componentP50.workerTotalMs,
    workerTotalP95Ms: componentP95.workerTotalMs,
  });
}

function graphvizMetricDetails(metrics) {
  const componentP50 = metrics.componentP50Ms ?? {};
  const componentP95 = metrics.componentP95Ms ?? {};
  return safePhaseDetails({
    concurrency: metrics.concurrency,
    diagramCount: metrics.diagramCount,
    errorCount: metrics.errorCount,
    p50Ms: metrics.p50Ms,
    p95Ms: metrics.p95Ms,
    queueWaitP50Ms: componentP50.queueWaitMs,
    queueWaitP95Ms: componentP95.queueWaitMs,
    renderedCount: metrics.renderedCount,
    timeoutCount: metrics.timeoutCount,
    workerCount: metrics.workerCount,
    workerReadyWaitP50Ms: componentP50.workerReadyWaitMs,
    workerReadyWaitP95Ms: componentP95.workerReadyWaitMs,
    workerTotalP50Ms: componentP50.workerTotalMs,
    workerTotalP95Ms: componentP95.workerTotalMs,
  });
}

function skippedWorkflow(id, reason) {
  const definition = workflowDefinitions.find((workflow) => workflow.id === id);
  return workflowResult({
    category: definition?.category ?? "other",
    id,
    reason,
    status: "skipped",
  });
}

function fillMissingWorkflows(workflows, profile) {
  const existing = new Set(workflows.map((workflow) => workflow.id));
  const reason =
    profile === "quick"
      ? "not-measured-in-quick-profile"
      : "requires-ui-scenario-instrumentation";
  return [
    ...workflows,
    ...workflowDefinitions
      .filter((workflow) => !existing.has(workflow.id))
      .map((workflow) => skippedWorkflow(workflow.id, reason)),
  ];
}

function classifyBottlenecks(workflows) {
  return workflows
    .filter(
      (workflow) =>
        workflow.status === "ok" && typeof workflow.durationMs === "number",
    )
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 8)
    .map((workflow) => ({
      category: workflow.category,
      durationMs: workflow.durationMs,
      id: workflow.id,
      metric: workflow.metric,
      source: workflow.source,
    }));
}

function validatePrivacy(value) {
  const serialized = JSON.stringify(value);
  const violations = [];
  const patterns = [
    ["absolute-private-path", /\/Users\/[^"\\\s]+/],
    ["windows-private-path", /[A-Za-z]:\\\\Users\\\\[^"\\\s]+/],
    ["repository-root", /svard-private/],
    ["endpoint-url", /https?:\/\/[^\s"\\]+/],
    ["token", /\b(token|secret|api[_-]?key)\b/i],
    ["diff-hunk", /@@\s+-\d/],
  ];
  for (const [reason, pattern] of patterns) {
    if (pattern.test(serialized)) {
      violations.push(reason);
    }
  }
  return violations;
}

function buildSummary({
  asciidocReport,
  documentRenderCacheReport = null,
  markdownReport,
  profile,
  sourceReport,
  uiReports = [],
  workspaceBootReport = null,
}) {
  const markdown = markdownReport
    ? deriveMarkdownResults(markdownReport)
    : { events: summarizeEvents([]), workflows: [] };
  const workspaceBootFirstContent = summarizeWorkspaceBootBenchmark(
    workspaceBootReport,
    profile,
  );
  const documentRenderCacheTabRevisit = summarizeDocumentRenderCacheBenchmark(
    documentRenderCacheReport,
    profile,
  );
  const workflows = fillMissingWorkflows(
    [
      ...markdown.workflows,
      deriveWorkspaceBootResult(workspaceBootFirstContent),
      deriveDocumentRenderCacheResult(documentRenderCacheTabRevisit),
      ...(asciidocReport ? deriveAsciiDocResults(asciidocReport) : []),
      ...(sourceReport ? deriveSourceControlResults(sourceReport) : []),
      ...deriveUiReviewResults(uiReports),
    ],
    profile,
  );
  const byCategory = {};
  for (const workflow of workflows) {
    const bucket =
      byCategory[workflow.category] ??
      (byCategory[workflow.category] = {
        durationMs: [],
        ok: 0,
        skipped: 0,
      });
    bucket[workflow.status] = (bucket[workflow.status] ?? 0) + 1;
    if (typeof workflow.durationMs === "number") {
      bucket.durationMs.push(workflow.durationMs);
    }
  }
  return {
    bottleneckCandidates: classifyBottlenecks(workflows),
    categories: Object.fromEntries(
      Object.entries(byCategory).map(([category, bucket]) => [
        category,
        {
          ok: bucket.ok ?? 0,
          skipped: bucket.skipped ?? 0,
          ...summarizeDurations(bucket.durationMs),
        },
      ]),
    ),
    profile,
    schemaVersion: 1,
    traceSummary: markdown.events,
    workflows,
    documentRenderCacheTabRevisit,
    workspaceBootFirstContent,
  };
}

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
    });
  });
}

function waitForServer(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    async function poll() {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Retry until timeout.
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(poll, 250);
    }
    void poll();
  });
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        server.close(() =>
          reject(new Error("Failed to allocate a local port")),
        );
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function startUiServer() {
  const port = await findAvailablePort();
  const child = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => process.stderr.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  const baseURL = `http://127.0.0.1:${port}`;
  await waitForServer(`${baseURL}/`);
  return {
    baseURL,
    stop() {
      return new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) {
          resolve();
          return;
        }
        child.once("exit", () => resolve());
        child.kill();
      });
    },
  };
}

async function runWorkspaceBootBenchmark({
  baseURL,
  buildScenarioUrl = workspaceBootScenarioUrl,
  collectorTimeoutMs = 10_000,
  installCollector,
  launchBrowser,
}) {
  const profiles = Object.fromEntries(
    workspaceBootBenchmarkInterface.profiles.map((profile) => [profile, []]),
  );
  let browser = null;
  let context = null;
  try {
    browser = await launchBrowser();
    context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    await installCollector(page);

    for (const run of workspaceBootBenchmarkPlan()) {
      await page.goto(buildScenarioUrl(baseURL, run.profile), {
        waitUntil: "domcontentloaded",
      });
      await page.waitForFunction(
        (collectorGlobal) => {
          const collector = globalThis[collectorGlobal];
          return collector?.status === "ok" || collector?.status === "failed";
        },
        workspaceBootBenchmarkInterface.collectorGlobal,
        { timeout: collectorTimeoutMs },
      );
      const rawSample = await page.evaluate(
        (collectorGlobal) => globalThis[collectorGlobal] ?? null,
        workspaceBootBenchmarkInterface.collectorGlobal,
      );
      let sample;
      try {
        sample = normalizeWorkspaceBootSample(rawSample, run.profile);
      } catch {
        return {
          profiles,
          reason: "workspace-boot-collector-contract-mismatch",
          status: "failed",
        };
      }
      if (sample.status !== "ok") {
        return {
          profiles,
          reason: sample.reason,
          status: "failed",
        };
      }
      if (run.kind === "measurement") {
        profiles[run.profile].push(sample);
      }
    }
    return {
      measurementCountPerProfile:
        workspaceBootBenchmarkInterface.measurementCountPerProfile,
      profiles,
      status: "ok",
      warmupCountPerProfile:
        workspaceBootBenchmarkInterface.warmupCountPerProfile,
    };
  } catch (error) {
    const unavailable =
      error?.name === "TimeoutError" ||
      /timeout|timed out/iu.test(String(error?.message ?? ""));
    return {
      profiles,
      reason: unavailable
        ? "workspace-boot-collector-unavailable"
        : "workspace-boot-scenario-error",
      status: unavailable ? "skipped" : "failed",
    };
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function runDocumentRenderCacheBenchmark({
  baseURL,
  installCollector,
  launchBrowser,
  runScenario,
}) {
  const samples = [];
  let browser = null;
  let context = null;
  try {
    browser = await launchBrowser();
    context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    await installCollector(page);
    for (const run of documentRenderCacheBenchmarkPlan()) {
      const rawSample = await runScenario(page, baseURL);
      let sample;
      try {
        sample = normalizeDocumentRenderCacheSample(rawSample);
      } catch {
        return {
          reason: "document-render-cache-collector-contract-mismatch",
          samples,
          status: "failed",
        };
      }
      if (sample.status !== "ok") {
        return { reason: sample.reason, samples, status: "failed" };
      }
      if (run.kind === "measurement") {
        samples.push(sample);
      }
    }
    return {
      measurementCount: documentRenderCacheBenchmarkInterface.measurementCount,
      samples,
      status: "ok",
      warmupCount: documentRenderCacheBenchmarkInterface.warmupCount,
    };
  } catch (error) {
    const unavailable =
      error?.name === "TimeoutError" ||
      /timeout|timed out/iu.test(String(error?.message ?? ""));
    return {
      reason: unavailable
        ? "document-render-cache-collector-unavailable"
        : "document-render-cache-scenario-error",
      samples,
      status: unavailable ? "skipped" : "failed",
    };
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function runProbeReports({ outputDir, profile }) {
  const probeDir = path.join(outputDir, "probes");
  await fs.mkdir(probeDir, { recursive: true });
  const markdownOut = path.join(probeDir, "markdown.json");
  const asciidocOut = path.join(probeDir, "asciidoc.json");
  const sourceOut = path.join(probeDir, "source-control-file-history.json");

  await runCommand("node", [
    "scripts/markdown-perf-probe.mjs",
    ...(profile === "diagnostic" ? ["--diagnostic"] : []),
    "--out",
    markdownOut,
  ]);
  await runCommand("node", [
    "scripts/asciidoc-perf-probe.mjs",
    "--out",
    asciidocOut,
  ]);
  await runCommand("node", [
    "scripts/source-control-file-history-perf-probe.mjs",
    "--out",
    sourceOut,
  ]);

  const reports = {
    asciidocReport: await readJson(asciidocOut),
    markdownReport: await readJson(markdownOut),
    sourceReport: await readJson(sourceOut),
  };

  if (profile === "quick") {
    return {
      ...reports,
      documentRenderCacheReport: null,
      uiReports: [],
      workspaceBootReport: null,
    };
  }

  const uiResults = await runUiReviewReports({ outputDir, profile });
  return {
    ...reports,
    ...uiResults,
  };
}

async function runUiReviewReports({ outputDir, profile }) {
  const [captureModule, playwright] = await Promise.all([
    import("./ui-review/core/capture.mjs"),
    import("@playwright/test"),
  ]);
  const {
    DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES,
    DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO,
    WORKSPACE_BOOT_BENCHMARK_PROFILES,
    WORKSPACE_BOOT_BENCHMARK_SCENARIO,
    buildWorkspaceBootBenchmarkUrl,
    captureScenario,
    installDocumentRenderCacheBenchmarkCollector,
    installWorkspaceBootBenchmarkCollector,
    runDocumentRenderCacheBenchmarkScenario,
  } = captureModule;
  const server = await startUiServer();
  const uiRoot = path.join(outputDir, "ui-scenarios");
  const reports = [];
  let workspaceBootReport;
  let documentRenderCacheReport;

  try {
    const interfaceMatches =
      WORKSPACE_BOOT_BENCHMARK_SCENARIO ===
        workspaceBootBenchmarkInterface.scenarioId &&
      workspaceBootBenchmarkInterface.profiles.every((profileId) =>
        WORKSPACE_BOOT_BENCHMARK_PROFILES.includes(profileId),
      );
    workspaceBootReport = interfaceMatches
      ? await runWorkspaceBootBenchmark({
          baseURL: server.baseURL,
          buildScenarioUrl: buildWorkspaceBootBenchmarkUrl,
          installCollector: installWorkspaceBootBenchmarkCollector,
          launchBrowser: () => playwright.chromium.launch(),
        })
      : {
          profiles: {},
          reason: "workspace-boot-collector-contract-mismatch",
          status: "failed",
        };
    const cacheInterfaceMatches =
      DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO ===
        documentRenderCacheBenchmarkInterface.scenarioId &&
      documentRenderCacheBenchmarkInterface.phases.every((phase) =>
        DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES.includes(phase),
      );
    documentRenderCacheReport = cacheInterfaceMatches
      ? await runDocumentRenderCacheBenchmark({
          baseURL: server.baseURL,
          installCollector: installDocumentRenderCacheBenchmarkCollector,
          launchBrowser: () => playwright.chromium.launch(),
          runScenario: runDocumentRenderCacheBenchmarkScenario,
        })
      : {
          reason: "document-render-cache-collector-contract-mismatch",
          samples: [],
          status: "failed",
        };
    for (const definition of uiWorkflowScenarios) {
      const scenario = definition.scenario;
      const artifactRoot = path.join(uiRoot, definition.workflowId);
      await fs.mkdir(path.join(artifactRoot, "screenshots"), {
        recursive: true,
      });
      const startedAt = Date.now();
      try {
        const report = await captureScenario({
          artifactRoot,
          baseURL: server.baseURL,
          gotoWaitUntil: "domcontentloaded",
          id: `benchmark-${profile}`,
          scenario,
        });
        reports.push({
          durationMs: Date.now() - startedAt,
          report,
          scenario,
          status: report.outcome === "passed" ? "ok" : "failed",
          workflowId: definition.workflowId,
        });
      } catch {
        reports.push({
          durationMs: Date.now() - startedAt,
          reason: "scenario-error",
          report: null,
          scenario,
          status: "failed",
          workflowId: definition.workflowId,
        });
      }
    }
  } finally {
    await server.stop();
  }

  return {
    documentRenderCacheReport,
    uiReports: reports,
    workspaceBootReport,
  };
}

async function writeOutputs(outputDir, summary) {
  await fs.mkdir(outputDir, { recursive: true });
  const privacyViolations = validatePrivacy(summary);
  const finalSummary = {
    ...summary,
    generatedAt: new Date().toISOString(),
    privacyCheck: {
      passed: privacyViolations.length === 0,
      violations: privacyViolations,
    },
  };
  await fs.writeFile(
    path.join(outputDir, "summary.json"),
    `${JSON.stringify(finalSummary, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(outputDir, "report.md"),
    reportMarkdown(finalSummary),
  );
  return finalSummary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(
    process.cwd(),
    args.out ?? `.artifacts/perf/workspace-${nowId()}`,
  );
  const reports = await runProbeReports({ outputDir, profile: args.profile });
  const summary = buildSummary({ ...reports, profile: args.profile });
  const finalSummary = await writeOutputs(outputDir, summary);
  process.stdout.write(`${JSON.stringify(finalSummary, null, 2)}\n`);
  if (!finalSummary.privacyCheck.passed) {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  await main();
}

export {
  buildSummary,
  classifyBottlenecks,
  deriveAsciiDocResults,
  deriveDocumentRenderCacheResult,
  deriveMarkdownResults,
  deriveSourceControlResults,
  deriveUiReviewResults,
  deriveWorkspaceBootResult,
  fillMissingWorkflows,
  normalizeWorkspaceBootSample,
  normalizeDocumentRenderCacheSample,
  parseArgs,
  percentile,
  reportMarkdown,
  runWorkspaceBootBenchmark,
  runDocumentRenderCacheBenchmark,
  summarizeDocumentRenderCacheBenchmark,
  summarizeWorkspaceBootBenchmark,
  summarizeDurations,
  summarizeEvents,
  validatePrivacy,
  documentRenderCacheBenchmarkInterface,
  documentRenderCacheBenchmarkPlan,
  workspaceBootBenchmarkInterface,
  workspaceBootBenchmarkPlan,
  workspaceBootScenarioUrl,
};
