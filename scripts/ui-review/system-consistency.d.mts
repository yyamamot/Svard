export const SYSTEM_UI_CONSISTENCY_SCHEMA_VERSION: 1;
export const DEFAULT_SYSTEM_UI_SCENARIOS: string[];

export interface SystemReviewArgs {
  id: string;
  reuseLatest: boolean;
  scenarioIds: string[];
}

export interface SystemFindingInput {
  category?: unknown;
  severity?: unknown;
  description?: unknown;
  evidenceScreens?: unknown;
  recommendation?: unknown;
}

export interface SystemFinding {
  category: string;
  severity: string;
  description: string;
  evidenceScreens: string[];
  recommendation: string;
}

export interface SystemConsistencyReviewOptions {
  id?: string;
  scenarioIds?: string[];
  reuseLatest?: boolean;
  baseURL?: string;
  artifactRoot?: string;
  capture?: (input: {
    scenario: string;
    id: string;
    artifactRoot: string;
    baseURL: string;
  }) => Promise<unknown>;
  findArtifact?: (scenarioId: string) => Promise<string | null>;
}

export interface SystemConsistencyReviewResult {
  schemaVersion: number;
  runId: string;
  featureId: string;
  scenarioIds: string[];
  outcome: string;
  screens: Array<Record<string, unknown>>;
  findings: SystemFinding[];
  artifactRoot: string;
}

export function parseSystemReviewArgs(argv: string[]): SystemReviewArgs;
export function normalizeSystemFinding(
  finding: SystemFindingInput,
): SystemFinding;
export function findLatestScenarioArtifact(
  scenarioId: string,
  uiReviewRoot?: string,
): Promise<string | null>;
export function runSystemConsistencyReview(
  options?: SystemConsistencyReviewOptions,
): Promise<SystemConsistencyReviewResult>;
