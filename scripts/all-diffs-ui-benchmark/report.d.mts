export interface AllDiffsUiBenchmarkSample {
  fixtureId: string;
  variant: string;
  sampleIndex: number;
  workflowSettledMs: number;
  [key: string]: string | number;
}

export interface AllDiffsUiComparison {
  metric: string;
  pairCount: number;
  baselineP50Ms: number;
  observedSavingMs: number;
  pairedMadMs: number;
  requiredSavingMs: number;
  status: "go" | "not-go";
}

export interface AllDiffsUiRunArtifact {
  schema: string;
  mode: string;
  sampleCount: number;
  fixtures: unknown[];
  candidate: string;
  confirmedCandidate?: string;
  confirmedEvidence?: Array<{ fixtureId: string; metric: string }>;
}

export const allDiffsUiVariants: string[];
export function medianAbsoluteDeviation(values: number[]): number;
export function comparePairedSamples(
  baselineSamples: AllDiffsUiBenchmarkSample[],
  counterfactualSamples: AllDiffsUiBenchmarkSample[],
  metric?: string,
): AllDiffsUiComparison;
export function compareCounterfactual(
  baselineSamples: AllDiffsUiBenchmarkSample[],
  counterfactualSamples: AllDiffsUiBenchmarkSample[],
): {
  metrics: Record<string, AllDiffsUiComparison>;
  status: "go" | "not-go";
};
export function summarizeAllDiffsUiRun(input: {
  mode: string;
  samples: AllDiffsUiBenchmarkSample[];
}): AllDiffsUiRunArtifact;
export function combineAllDiffsUiRuns<
  TFormal extends { candidate: string; fixtures: unknown[] },
  TConfirmation extends { candidate: string; fixtures: unknown[] },
>(
  formal: TFormal,
  confirmation: TConfirmation,
): TConfirmation & {
  confirmedCandidate: string;
  confirmedEvidence: Array<{ fixtureId: string; metric: string }>;
};
export function assertAllDiffsUiArtifactSafe<T>(value: T): T;
