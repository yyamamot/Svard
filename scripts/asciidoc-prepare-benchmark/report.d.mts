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

export interface AsciiDocResolverConcurrencyFixtureComparison {
  boundedMaxConcurrency: number | null;
  boundedPendingCount: number | null;
  boundedResolverCallCount: number | null;
  boundedResolverResolvedCount: number | null;
  boundedResolverUniqueCount: number | null;
  fixtureId: string;
  imagesP50ImprovementPercent: number | null;
  imagesSplitHalfDriftPercent: number | null;
  linksP50ImprovementPercent: number | null;
  linksSplitHalfDriftPercent: number | null;
  orderingViolationCount: number | null;
  prepareP50ImprovementPercent: number | null;
  prepareSplitHalfDriftPercent: number | null;
  profile: string;
  resolverCountViolationCount: number | null;
  serialMaxConcurrency: number | null;
  serialPendingCount: number | null;
  serialResolverCallCount: number | null;
  serialResolverResolvedCount: number | null;
  serialResolverUniqueCount: number | null;
  splitHalfDriftPercent: number | null;
  totalNoiseFloorMs: number | null;
  totalP95DeltaMs: number | null;
  totalP95RegressionPercent: number | null;
}

export interface AsciiDocResolverConcurrencyComparison {
  fixtures: AsciiDocResolverConcurrencyFixtureComparison[];
  productionWorkerP95RegressionPercent: number | null;
  reasons: string[];
  status: "go" | "no-go" | "needs-decision";
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
export function buildAsciiDocResolverConcurrencyComparison(
  baseline: unknown,
  current: unknown,
): AsciiDocResolverConcurrencyComparison;
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
