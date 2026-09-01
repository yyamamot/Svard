export interface MainViewerRenderBenchmarkArgs {
  baseline: string | null;
  candidate: "raster-sidecar" | null;
  confirmation: string | null;
  headroomFormal: string | null;
  out: string;
  port: number;
  runMode: "formal" | "confirmation";
  smoke: boolean;
  url: string | null;
}

export function parseMainViewerRenderBenchmarkArgs(
  argv: string[],
): MainViewerRenderBenchmarkArgs;
export function buildMainViewerRenderSample(input: {
  arm?: "baseline" | "candidate";
  candidateName?: "raster-sidecar" | null;
  events: Array<Record<string, unknown>>;
  expectedMediaCount: number;
  fixtureId: string;
  sampleIndex: number;
  sampleStartedAt: number | null;
  waitCompleted: boolean;
}): {
  counts: Record<string, number | null>;
  fixtureId: string;
  sampleIndex: number;
  status: "ok" | "incomplete";
  timings: Record<string, number | null>;
};
export function mainViewerCandidateArmOrder(
  runMode: "formal" | "confirmation",
): Array<"baseline" | "candidate">;
export function runMainViewerRenderBenchmark(
  argv?: string[],
): Promise<Record<string, unknown>>;
