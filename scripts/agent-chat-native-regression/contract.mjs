const assertion = (id) => Object.freeze({ id });

export const nativeScenarioDefinitions = Object.freeze([
  {
    id: "core-three-turn",
    assertions: [
      assertion("observe-mode"),
      assertion("three-turn-continuation"),
      assertion("streaming-terminal"),
      assertion("activity-finished"),
      assertion("auto-markdown"),
      assertion("conversation-preserved"),
    ],
  },
  {
    id: "context-rendering",
    assertions: [
      assertion("selection-context"),
      assertion("media-context"),
      assertion("image-context"),
      assertion("current-change-context"),
      assertion("visualize-openui"),
      assertion("queue"),
      assertion("steer"),
      assertion("manual-compaction"),
      assertion("token-diagnostics"),
    ],
  },
  {
    id: "agent-approval-write",
    assertions: [
      assertion("agent-mode"),
      assertion("allow-once"),
      assertion("deny"),
      assertion("workspace-write"),
      assertion("changed-files"),
      assertion("review-changes"),
    ],
  },
  {
    id: "workspace-isolation-cleanup",
    assertions: [
      assertion("workspace-a-instructions"),
      assertion("workspace-b-instructions"),
      assertion("active-turn-ended"),
      assertion("old-runtime-cleaned"),
      assertion("local-input-reset"),
    ],
  },
  {
    id: "provider-crash-streaming",
    assertions: [
      assertion("streaming-process-terminated"),
      assertion("turn-failed"),
      assertion("activity-closed"),
      assertion("input-restorable"),
      assertion("manual-reconnect"),
      assertion("no-automatic-resend"),
      assertion("replacement-process"),
    ],
  },
  {
    id: "provider-crash-approval",
    assertions: [
      assertion("approval-process-terminated"),
      assertion("approval-closed"),
      assertion("fail-closed"),
      assertion("input-restorable"),
      assertion("manual-reconnect"),
      assertion("explicit-resend"),
    ],
  },
  {
    id: "native-layouts",
    assertions: [
      assertion("right-1280x840"),
      assertion("bottom-1280x840"),
      assertion("diff-1280x840"),
      assertion("detached-1280x840"),
      assertion("right-960x640"),
      assertion("bottom-960x640"),
      assertion("diff-960x640"),
      assertion("detached-960x640"),
      assertion("single-interactive-owner"),
    ],
  },
  {
    id: "full-access-network",
    assertions: [
      assertion("full-access-confirmed"),
      assertion("outside-sentinel-written"),
      assertion("live-https"),
      assertion("close-cleanup"),
    ],
  },
]);

export const nativeScenarioIds = Object.freeze(
  nativeScenarioDefinitions.map(({ id }) => id),
);

export const nativeFailureClasses = Object.freeze([
  "approval-not-granted",
  "assertion-failed",
  "environment-error",
  "model-unavailable",
  "operator-blocked",
  "privacy-violation",
  "process-owner-ambiguous",
  "process-termination-failed",
  "provider-unavailable",
  "runtime-cleanup-failed",
]);

const scenarioStatuses = new Set(["pending", "passed", "failed", "blocked"]);
const assertionStatuses = new Set(["pending", "passed", "failed"]);
const reportOutcomes = new Set(["in-progress", "passed", "failed", "blocked"]);
const cleanupStatuses = new Set(["pending", "passed", "failed"]);
const privacyStatuses = new Set(["pending", "passed", "failed"]);
const reasoningEfforts = new Set([null, "medium"]);
const safeMetadataPattern = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/u;
const runIdPattern = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/u;
const gitHeadPattern = /^[0-9a-f]{40}$/u;

function assertExactKeys(value, expected, label) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")
  ) {
    throw new Error(`${label} schema mismatch`);
  }
}

function assertSafeMetadata(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== "string" || !safeMetadataPattern.test(value)) {
    throw new Error(`${label} metadata mismatch`);
  }
}

function expectedDefinition(scenarioId) {
  const definition = nativeScenarioDefinitions.find(
    ({ id }) => id === scenarioId,
  );
  if (!definition) {
    throw new Error(`Unknown native scenario: ${scenarioId}`);
  }
  return definition;
}

export function createNativeRegressionReport({
  arch,
  gitHead,
  nodeVersion,
  runId,
}) {
  return {
    schemaVersion: 1,
    runId,
    gitHead,
    platform: "darwin",
    arch,
    runtime: {
      nodeVersion,
      codexVersion: null,
      model: null,
      reasoningEffort: null,
    },
    outcome: "in-progress",
    privacyCheck: "pending",
    processCleanup: "pending",
    scenarios: nativeScenarioDefinitions.map((definition) => ({
      id: definition.id,
      status: "pending",
      failureClass: null,
      assertions: definition.assertions.map(({ id }) => ({
        id,
        status: "pending",
      })),
    })),
  };
}

export function recordNativeScenario(
  report,
  {
    codexVersion,
    failedAssertion,
    failureClass,
    model,
    reasoningEffort,
    scenarioId,
    status,
  },
) {
  validateNativeRegressionReport(report);
  if (
    report.privacyCheck !== "pending" ||
    report.processCleanup !== "pending"
  ) {
    throw new Error("Finalized native regression reports are immutable");
  }
  if (!new Set(["passed", "failed", "blocked"]).has(status)) {
    throw new Error(`Unsupported native scenario status: ${status}`);
  }
  if (status === "passed" && (failureClass || failedAssertion)) {
    throw new Error("Passed scenarios cannot have failure metadata");
  }
  if (status !== "passed" && !nativeFailureClasses.includes(failureClass)) {
    throw new Error(
      "Failed or blocked scenarios require a fixed failure class",
    );
  }

  const definition = expectedDefinition(scenarioId);
  if (
    status === "failed" &&
    !definition.assertions.some(({ id }) => id === failedAssertion)
  ) {
    throw new Error("Failed scenarios require a fixed failed assertion");
  }
  if (status === "blocked" && failedAssertion) {
    throw new Error("Blocked scenarios cannot have a failed assertion");
  }

  const next = structuredClone(report);
  const scenario = next.scenarios.find(({ id }) => id === scenarioId);
  scenario.status = status;
  scenario.failureClass = status === "passed" ? null : failureClass;
  scenario.assertions = scenario.assertions.map(({ id }) => ({
    id,
    status:
      status === "passed"
        ? "passed"
        : id === failedAssertion
          ? "failed"
          : "pending",
  }));

  if (codexVersion !== undefined) {
    assertSafeMetadata(codexVersion, "Codex version");
    next.runtime.codexVersion = codexVersion;
  }
  if (model !== undefined) {
    assertSafeMetadata(model, "model");
    next.runtime.model = model;
  }
  if (reasoningEffort !== undefined) {
    if (!reasoningEfforts.has(reasoningEffort)) {
      throw new Error("Reasoning effort must be medium");
    }
    next.runtime.reasoningEffort = reasoningEffort;
  }

  const statuses = next.scenarios.map(
    ({ status: scenarioStatus }) => scenarioStatus,
  );
  next.outcome = statuses.includes("failed")
    ? "failed"
    : statuses.includes("blocked")
      ? "blocked"
      : "in-progress";
  validateNativeRegressionReport(next);
  return next;
}

export function finalizeNativeRegressionReport(report, cleanupPassed) {
  validateNativeRegressionReport(report);
  const next = structuredClone(report);
  next.processCleanup = cleanupPassed ? "passed" : "failed";
  const statuses = next.scenarios.map(({ status }) => status);
  next.outcome =
    !cleanupPassed || statuses.includes("failed")
      ? "failed"
      : statuses.includes("blocked") || statuses.includes("pending")
        ? "blocked"
        : "passed";
  next.privacyCheck = "passed";
  validateNativeRegressionReport(next, { final: true });
  return next;
}

export function validateNativeRegressionReport(report, { final = false } = {}) {
  assertExactKeys(
    report,
    [
      "arch",
      "gitHead",
      "outcome",
      "platform",
      "privacyCheck",
      "processCleanup",
      "runId",
      "runtime",
      "scenarios",
      "schemaVersion",
    ],
    "native regression report",
  );
  if (
    report.schemaVersion !== 1 ||
    !runIdPattern.test(report.runId) ||
    !gitHeadPattern.test(report.gitHead) ||
    report.platform !== "darwin" ||
    !reportOutcomes.has(report.outcome) ||
    !privacyStatuses.has(report.privacyCheck) ||
    !cleanupStatuses.has(report.processCleanup)
  ) {
    throw new Error("Native regression report metadata mismatch");
  }
  assertSafeMetadata(report.arch, "architecture");
  assertExactKeys(
    report.runtime,
    ["codexVersion", "model", "nodeVersion", "reasoningEffort"],
    "native regression runtime",
  );
  assertSafeMetadata(report.runtime.nodeVersion, "Node version");
  assertSafeMetadata(report.runtime.codexVersion, "Codex version", {
    nullable: true,
  });
  assertSafeMetadata(report.runtime.model, "model", { nullable: true });
  if (!reasoningEfforts.has(report.runtime.reasoningEffort)) {
    throw new Error("Native regression reasoning effort mismatch");
  }

  if (
    !Array.isArray(report.scenarios) ||
    report.scenarios.length !== nativeScenarioDefinitions.length
  ) {
    throw new Error("Native regression scenario count mismatch");
  }
  for (const [index, scenario] of report.scenarios.entries()) {
    const definition = nativeScenarioDefinitions[index];
    assertExactKeys(
      scenario,
      ["assertions", "failureClass", "id", "status"],
      "native regression scenario",
    );
    if (
      scenario.id !== definition.id ||
      !scenarioStatuses.has(scenario.status) ||
      (scenario.failureClass !== null &&
        !nativeFailureClasses.includes(scenario.failureClass)) ||
      !Array.isArray(scenario.assertions) ||
      scenario.assertions.length !== definition.assertions.length
    ) {
      throw new Error(`Native regression scenario mismatch: ${definition.id}`);
    }
    if (
      scenario.status === "passed" &&
      (scenario.failureClass !== null ||
        scenario.assertions.some(({ status }) => status !== "passed"))
    ) {
      throw new Error(`Passed scenario metadata mismatch: ${scenario.id}`);
    }
    if (
      new Set(["failed", "blocked"]).has(scenario.status) &&
      scenario.failureClass === null
    ) {
      throw new Error(`Incomplete scenario failure metadata: ${scenario.id}`);
    }
    for (const [assertionIndex, result] of scenario.assertions.entries()) {
      assertExactKeys(result, ["id", "status"], "native regression assertion");
      if (
        result.id !== definition.assertions[assertionIndex].id ||
        !assertionStatuses.has(result.status)
      ) {
        throw new Error(`Native regression assertion mismatch: ${result.id}`);
      }
    }
    const failedAssertions = scenario.assertions.filter(
      ({ status }) => status === "failed",
    );
    if (
      (scenario.status === "failed" && failedAssertions.length !== 1) ||
      (scenario.status !== "failed" && failedAssertions.length !== 0) ||
      (scenario.status === "blocked" &&
        scenario.assertions.some(({ status }) => status !== "pending"))
    ) {
      throw new Error(
        `Native regression assertion state mismatch: ${scenario.id}`,
      );
    }
  }
  if (
    final &&
    (report.privacyCheck !== "passed" ||
      report.processCleanup === "pending" ||
      report.outcome === "in-progress")
  ) {
    throw new Error("Final native regression report is incomplete");
  }
  return report;
}

export function assertPrivacySafeNativeReport(report) {
  validateNativeRegressionReport(report);
  const serialized = JSON.stringify(report);
  const forbidden = [
    /\//u,
    /\\/u,
    /\b(?:question|answer|reasoning|command|stderr|providerId|threadId)\b/iu,
    /https?:/iu,
  ];
  if (forbidden.some((pattern) => pattern.test(serialized))) {
    throw new Error("Native regression report privacy violation");
  }
  return report;
}

export function validateNativeRunId(runId) {
  if (!runIdPattern.test(runId)) {
    throw new Error("Invalid native regression run ID");
  }
  return runId;
}
