export type NativeScenarioId =
  | "core-three-turn"
  | "context-rendering"
  | "agent-approval-write"
  | "workspace-isolation-cleanup"
  | "provider-crash-streaming"
  | "provider-crash-approval"
  | "native-layouts"
  | "full-access-network";

export type NativeFailureClass =
  | "approval-not-granted"
  | "assertion-failed"
  | "environment-error"
  | "model-unavailable"
  | "operator-blocked"
  | "privacy-violation"
  | "process-owner-ambiguous"
  | "process-termination-failed"
  | "provider-unavailable"
  | "runtime-cleanup-failed";

export interface NativeScenarioDefinition {
  id: NativeScenarioId;
  assertions: ReadonlyArray<{ id: string }>;
}

export interface NativeRegressionReport {
  schemaVersion: 1;
  runId: string;
  gitHead: string;
  platform: "darwin";
  arch: string;
  runtime: {
    nodeVersion: string;
    codexVersion: string | null;
    model: string | null;
    reasoningEffort: "medium" | null;
  };
  outcome: "in-progress" | "passed" | "failed" | "blocked";
  privacyCheck: "pending" | "passed" | "failed";
  processCleanup: "pending" | "passed" | "failed";
  scenarios: Array<{
    id: NativeScenarioId;
    status: "pending" | "passed" | "failed" | "blocked";
    failureClass: NativeFailureClass | null;
    assertions: Array<{
      id: string;
      status: "pending" | "passed" | "failed";
    }>;
  }>;
}

export const nativeScenarioDefinitions: readonly NativeScenarioDefinition[];
export const nativeScenarioIds: readonly NativeScenarioId[];
export const nativeFailureClasses: readonly NativeFailureClass[];

export function createNativeRegressionReport(input: {
  arch: string;
  gitHead: string;
  nodeVersion: string;
  runId: string;
}): NativeRegressionReport;

export function recordNativeScenario(
  report: NativeRegressionReport,
  input: {
    codexVersion?: string;
    failedAssertion?: string;
    failureClass?: NativeFailureClass;
    model?: string;
    reasoningEffort?: "medium";
    scenarioId: NativeScenarioId;
    status: "passed" | "failed" | "blocked";
  },
): NativeRegressionReport;

export function finalizeNativeRegressionReport(
  report: NativeRegressionReport,
  cleanupPassed: boolean,
): NativeRegressionReport;

export function validateNativeRegressionReport(
  report: unknown,
  options?: { final?: boolean },
): NativeRegressionReport;

export function assertPrivacySafeNativeReport(
  report: NativeRegressionReport,
): NativeRegressionReport;

export function validateNativeRunId(runId: string): string;
