export const lineDiffProbeFixtureIds: readonly string[];
export const lineDiffProbeComparisonIds: readonly [
  "imp416-common-edge-trim",
  "imp417-linear-memory",
  "imp419-work-budget",
];

export type LineDiffProbeMode =
  | "full-lcs"
  | "common-edge-trim"
  | "linear-memory";
export type LineDiffProbeComparisonId =
  | "imp416-common-edge-trim"
  | "imp417-linear-memory"
  | "imp419-work-budget";

export function parseLineDiffProbeArgs(argv: string[]): {
  baseline: string | null;
  comparison: LineDiffProbeComparisonId | null;
  out: string;
};

export function validateLineDiffProbeReport(report: unknown): LineDiffProbeMode;

export interface LineDiffProbeComparison {
  baselineMode: LineDiffProbeMode | "unknown";
  candidateMode: LineDiffProbeMode | "unknown";
  comparisonId: LineDiffProbeComparisonId;
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
  schemaVersion: 2;
  status: "go" | "no-go";
  violations: string[];
  workBudget?: {
    adversarialAvailability: "available" | "too-complex";
    adversarialReason: "work-budget-exceeded" | null;
    adversarialWorkUnits: number;
    budget: number;
    disjoint5000Availability: "available" | "too-complex";
  } | null;
}

export function buildLineDiffProbeComparison(
  baseline: unknown,
  candidate: unknown,
  requestedComparison?: LineDiffProbeComparisonId | null,
): LineDiffProbeComparison;

export function validateLineDiffProbeComparison(comparison: unknown): void;
