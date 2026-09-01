export interface UiReviewVlmFinding {
  severity: "minor" | "major" | "blocker";
  reviewId: string;
  category: "missing-control" | "density" | "blank-or-broken-render" | "schema";
  description: string;
}

export interface UiReviewVlmResult {
  schemaVersion: number;
  runId: string;
  scenarioId: string;
  outcome: "passed" | "needs-fix" | "blocked";
  findings: UiReviewVlmFinding[];
  artifactRoot: string;
}

export function runVlmReview(artifactRoot: string): Promise<UiReviewVlmResult>;
