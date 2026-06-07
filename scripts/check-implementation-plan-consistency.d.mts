export interface ImplementationPlanConsistencyInput {
  planMarkdown: string;
  historyMarkdown?: string;
  historyMarkdowns?: string[];
}

export interface ImplementationPlanConsistencyResult {
  completedIds: string[];
  conflicts: string[];
}

export interface ImplementationPlanConsistencyCheckResult {
  passed: boolean;
  messages: string[];
}

export function implementationPlanConsistency(
  input: ImplementationPlanConsistencyInput,
): ImplementationPlanConsistencyResult;

export function checkImplementationPlanConsistency(
  input: ImplementationPlanConsistencyInput,
): ImplementationPlanConsistencyCheckResult;

export function extractCompletedImpIds(historyMarkdown: string): string[];

export function extractActiveBacklogMarkdown(planMarkdown: string): string;
