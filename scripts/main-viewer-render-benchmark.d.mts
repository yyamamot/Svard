export interface MainViewerRenderBenchmarkArgs {
  baseline: string | null;
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
export function runMainViewerRenderBenchmark(
  argv?: string[],
): Promise<Record<string, unknown>>;
