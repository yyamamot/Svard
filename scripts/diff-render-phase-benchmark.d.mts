export interface DiffRenderBenchmarkArgs {
  out: string;
  port: number;
  smoke: boolean;
  url: string | null;
}

export function parseDiffRenderBenchmarkArgs(
  argv: string[],
): DiffRenderBenchmarkArgs;
export function runDiffRenderBenchmark(
  argv?: string[],
): Promise<Record<string, unknown>>;
export function exactInputTupleEqual(left: unknown, right: unknown): boolean;
export function assertDiffRenderSampleContract(
  fixture: {
    expected: {
      blockParseCount: number;
      blockTextParseCount: number;
      coreRenderCount: number;
      diffOutcomes: readonly string[];
      markerOutcomes: readonly string[];
      prepareCount: number;
      tableOutcomes: readonly string[];
    };
    fixtureId: string;
  },
  sample: {
    blockParseCount: number;
    blockTextParseCount: number;
    coreRenderCount: number;
    prepareCount: number;
  },
  eventOutcomes: Record<string, readonly string[]>,
): "passed";
export function renderedTableExactDuplicateCount(fixture: {
  pairs: ReadonlyArray<{
    left: { format: string; path: string; source: string };
    right: { format: string; path: string; source: string };
  }>;
}): number;
