export interface DependencyPolicyCheckInput {
  packageJson: Record<string, unknown> | string;
  cargoToml: string;
  workflows: Array<{ name: string; content: string }>;
}

export interface DependencyPolicyResult {
  name: string;
  current: string;
  latest: string;
  status: "ok" | "fail" | "held";
  reason: string;
}

export interface DependencyPolicyReport {
  schemaVersion: 1;
  generatedAt?: string;
  passed: boolean;
  results: DependencyPolicyResult[];
}

export function checkDependencyPolicy(
  input: DependencyPolicyCheckInput,
): DependencyPolicyReport;

export function sanitizeDependencyReport(
  value: unknown,
): Required<DependencyPolicyReport>;
