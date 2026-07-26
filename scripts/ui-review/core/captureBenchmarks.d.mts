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

export const DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO: string;
export const DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES: readonly [
  "cold-a",
  "cold-b",
  "revisit-a",
  "theme-a",
  "reload-a",
];

export function buildDocumentRenderCacheBenchmarkUrl(baseURL: string): string;

export function installDocumentRenderCacheBenchmarkCollector(page: {
  addInitScript: (...args: never[]) => unknown;
}): Promise<void>;
