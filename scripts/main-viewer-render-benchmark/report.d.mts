export interface MainViewerRenderSample {
  fixtureId: string;
  sampleIndex: number;
  status: "ok" | "incomplete";
  timings: Record<string, number | null>;
  counts: Record<string, number | null>;
}

export const mainViewerRenderSchema: string;
export const mainViewerRenderBenchmarkId: string;
export const mainViewerRenderRuntime: string;
export const mainViewerRenderTimingKeys: readonly string[];
export const mainViewerRenderCountKeys: readonly string[];
export function round(value: unknown): number | null;
export function percentile(
  values: unknown[],
  percentileValue: number,
): number | null;
export function medianAbsoluteDeviation(values: unknown[]): number | null;
export function summarizeDurationSamples(
  values: unknown[],
): Record<string, unknown>;
export function splitHalfDriftPercent(values: unknown[]): number | null;
export function evaluateMainViewerHeadroom(input: {
  candidatePhase: string;
  fixtureId: string;
  parentValues: unknown[];
  phaseValues: unknown[];
}): Record<string, unknown>;
export function buildMainViewerHeadroom(
  samples: readonly MainViewerRenderSample[],
): Record<string, unknown>;
export function buildMainViewerRenderArtifact(input: {
  fixtures: ReadonlyArray<{
    cacheStatus: string;
    fixtureId: string;
    mediaKind: string;
    sizeBucket: string;
  }>;
  measurementCount?: number;
  mode: "formal" | "confirmation";
  runtime: string;
  samples: readonly MainViewerRenderSample[];
}): Record<string, unknown>;
export function buildMainViewerAdoptionComparison(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
): Record<string, unknown>;
export function compareMainViewerBaselineHeadroom(
  formal: Record<string, unknown>,
  confirmation: Record<string, unknown>,
): Record<string, unknown>;
export function combineMainViewerFormalConfirmation(
  formal: Record<string, unknown>,
  confirmation: Record<string, unknown>,
): Record<string, unknown>;
export function assertMainViewerRenderArtifactSafe<T>(value: T): T;
