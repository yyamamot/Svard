export interface CriticalPathInterval {
  startMs: number;
  endMs: number;
}

export function round(value: unknown): number | null;
export function percentile(
  values: unknown[],
  percentileValue: number,
): number | null;
export function medianAbsoluteDeviation(values: unknown[]): number | null;
export function summarizeSamples(values: unknown[]): {
  count: number;
  madMs: number | null;
  maxMs: number | null;
  minMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
};
export function criticalPathUnionMs(intervals: CriticalPathInterval[]): number;
export function criticalPathReductionMs(
  allIntervals: CriticalPathInterval[],
  removableIntervals: CriticalPathInterval[],
): number;
export function splitHalfDriftPercent(values: unknown[]): number | null;
export function evaluateHeadroom(input: {
  avoidableCriticalPathUpperBoundValues: unknown[];
  fixtureId: string;
  targetValues: unknown[];
}): Record<string, unknown>;
export function buildDiffRenderDecisions<
  Sample extends {
    avoidableCriticalPathUpperBoundMs: number;
    exactDuplicateCount: number;
    fixtureId: string;
    identityStatus: string;
    targetMs: number;
  },
>(samples: readonly Sample[]): Record<string, unknown>;
export function summarizeFixtureSamples(
  samples: readonly unknown[],
): Record<string, unknown>;
export function assertDiffRenderArtifactSafe(value: unknown): void;
