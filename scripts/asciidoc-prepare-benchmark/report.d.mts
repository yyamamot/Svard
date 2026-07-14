export interface DurationSummary {
  count: number;
  samplesMs: number[];
  minMs: number | null;
  maxMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  madMs: number | null;
}

export interface HeadroomEvaluation {
  conservativeHeadroomMs?: number | null;
  decision: "go" | "no-go" | "needs-decision";
  driftPercent?: number | null;
  noiseFloorMs?: number | null;
  parentP50Ms?: number | null;
  parentValueThresholdMs?: number | null;
  reason:
    | "headroom-confirmed"
    | "baseline-unstable"
    | "insufficient-target-headroom"
    | "insufficient-parent-value"
    | "missing-samples";
  requiredSavingMs?: number | null;
  targetP50Ms?: number | null;
  upperBoundP50Ms?: number | null;
}

export interface AsciiDocPrepareComparison {
  duplicateImagesP50ImprovementPercent: number | null;
  duplicateLinksP50ImprovementPercent: number | null;
  duplicateMaxConcurrency: number | null;
  duplicateResolverCallCount: number | null;
  duplicateResolverTotalP50ImprovementPercent: number | null;
  duplicateResolverUniqueCount: number | null;
  plainLargeP95RegressionPercent: number | null;
  includeHeavyP95RegressionPercent: number | null;
  diagramHeavyP95RegressionPercent: number | null;
  productionWorkerP95RegressionPercent: number | null;
  reasons: string[];
  status: "go" | "no-go" | "needs-decision";
  uniqueMaxConcurrency: number | null;
  uniquePrepareP95RegressionPercent: number | null;
  uniqueResolverCallCount: number | null;
  uniqueTotalP95RegressionPercent: number | null;
}

export function assertAsciiDocPrepareArtifactSafe(value: unknown): void;
export function round(value: unknown): number | null;
export function percentile(
  values: number[],
  percentileValue: number,
): number | null;
export function medianAbsoluteDeviation(values: number[]): number | null;
export function summarizeSamples(values: number[]): DurationSummary;
export function buildAsciiDocPrepareComparison(
  baseline: unknown,
  current: unknown,
): AsciiDocPrepareComparison;
export function estimateBoundedConcurrencyMs(
  durations: number[],
  concurrency: number,
): number | null;
export function splitHalfDriftPercent(values: number[]): number | null;
export function evaluateHeadroom(input: {
  parentValues: number[];
  targetValues: number[];
  upperBoundValues: number[];
}): HeadroomEvaluation;
