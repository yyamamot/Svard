export interface GitPreviewReleaseBenchmarkArgs {
  out: string;
}

export interface GitPreviewReleaseDurationSummary {
  p50: number;
  p95: number;
}

export interface GitPreviewReleaseSample {
  batchFirst: boolean;
  batchPreviewMs: number;
  documentCount: number;
  pairedDeltaMs: number;
  sampleIndex: number;
  singlePreviewMs: number;
}

export interface GitPreviewReleaseBenchmarkArtifact {
  batchSize: number;
  documentCount: number;
  fixtureId: string;
  measurementCount: number;
  runMode: string;
  samples: GitPreviewReleaseSample[];
  schemaVersion: number;
  summary: {
    batchPreviewMs: GitPreviewReleaseDurationSummary;
    improvementRatio: number;
    pairedDeltaMs: { mad: number; p50: number };
    passed: boolean;
    requiredDeltaMs: number;
    singlePreviewMs: GitPreviewReleaseDurationSummary;
  };
  variant: string;
  verdict: string;
  warmupCount: number;
}

export interface GitPreviewReleaseDecisionRun {
  batchP50Ms: number;
  pairedDeltaMadMs: number;
  pairedDeltaP50Ms: number;
  passed: boolean;
  requiredDeltaMs: number;
  singleP50Ms: number;
}

export interface GitPreviewReleaseDecision {
  confirmation: GitPreviewReleaseDecisionRun;
  fixtureId: string;
  formal: GitPreviewReleaseDecisionRun;
  schemaVersion: number;
  variant: string;
  verdict: string;
}

export function parseGitPreviewReleaseBenchmarkArgs(
  argv: string[],
): GitPreviewReleaseBenchmarkArgs;
export function assertGitPreviewReleaseArtifactSafe(
  report: GitPreviewReleaseBenchmarkArtifact,
): void;
export function buildGitPreviewReleaseDecision(
  formal: GitPreviewReleaseBenchmarkArtifact,
  confirmation: GitPreviewReleaseBenchmarkArtifact,
): GitPreviewReleaseDecision;
export function assertGitPreviewReleaseDecisionSafe(
  decision: GitPreviewReleaseDecision,
): void;
