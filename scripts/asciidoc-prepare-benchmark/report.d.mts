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

export function assertAsciiDocPrepareArtifactSafe(value: unknown): void;
export function round(value: unknown): number | null;
export function percentile(
  values: number[],
  percentileValue: number,
): number | null;
export function medianAbsoluteDeviation(values: number[]): number | null;
export function summarizeSamples(values: number[]): DurationSummary;
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
