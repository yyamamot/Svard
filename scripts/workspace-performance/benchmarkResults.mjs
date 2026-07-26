import {
  deriveDocumentRenderCacheResult,
  deriveWorkspaceBootResult,
  percentile,
  summarizeDocumentRenderCacheBenchmark,
  summarizeDurations,
  summarizeWorkspaceBootBenchmark,
} from "./benchmarkProfiles.mjs";
import { round, workflowResult } from "./benchmarkCore.mjs";

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
  summarizeDocumentRenderCacheBenchmark,
  summarizeDurations,
  summarizeEvents,
  summarizeWorkspaceBootBenchmark,
  uiWorkflowScenarios,
  validatePrivacy,
};
