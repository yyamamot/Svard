export const WORKSPACE_BOOT_BENCHMARK_SCENARIO: string;
export const WORKSPACE_BOOT_BENCHMARK_PROFILES: readonly [
  "fast",
  "normal",
  "stress",
];

export function buildWorkspaceBootBenchmarkUrl(
  baseURL: string,
  profile?: string,
): string;

export function installWorkspaceBootBenchmarkCollector(page: {
  addInitScript: (...args: never[]) => unknown;
}): Promise<void>;
