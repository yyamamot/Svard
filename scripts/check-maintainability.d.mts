export function isExcludedMaintainabilityPath(relativePath: string): boolean;
export const maintainabilityBudgets: {
  severeCountMax: number;
  warningCountMax: number;
  severeFileLineMax: Record<string, number>;
};
