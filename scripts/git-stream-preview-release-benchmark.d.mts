export interface GitStreamPreviewBenchmarkArgs {
  confirmation: string | null;
  out: string;
}

export function parseGitStreamPreviewBenchmarkArgs(
  argv: string[],
): GitStreamPreviewBenchmarkArgs;
export function assertGitStreamPreviewArtifactSafe<T>(report: T): T;
