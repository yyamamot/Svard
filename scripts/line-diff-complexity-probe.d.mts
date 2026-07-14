export const lineDiffProbeFixtureIds: readonly string[];

export function parseLineDiffProbeArgs(argv: string[]): {
  baseline: string | null;
  out: string;
};

export function validateLineDiffProbeReport(
  report: unknown,
): "full-lcs" | "common-edge-trim";

export interface LineDiffProbeComparison {
  fixtures: Array<{
    baselineP95Ms: number;
    baselinePeakScratchEntries: number;
    baselineWorkUnits: number;
    candidateP95Ms: number;
    candidatePeakScratchEntries: number;
    candidateWorkUnits: number;
    fixtureId: string;
    p95RegressionPercent: number;
  }>;
  schemaVersion: 1;
  status: "go" | "no-go";
  violations: string[];
}

export function buildLineDiffProbeComparison(
  baseline: unknown,
  candidate: unknown,
): LineDiffProbeComparison;

export function validateLineDiffProbeComparison(comparison: unknown): void;
