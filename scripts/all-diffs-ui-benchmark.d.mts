export interface AllDiffsUiBenchmarkArgs {
  confirmation: string | null;
  out: string;
  port: number;
  smoke: boolean;
  url: string | null;
}

export function parseAllDiffsUiBenchmarkArgs(
  argv: string[],
): AllDiffsUiBenchmarkArgs;
export function assertAllDiffsUiBenchmarkRuntime(runtime: unknown): string;
