export type AgentSessionHistoryDateRange =
  | "any"
  | "today"
  | "last7Days"
  | "last30Days";

export function agentSessionHistoryDateBounds(
  range: AgentSessionHistoryDateRange,
  now = new Date(),
): { updatedAtFrom?: number; updatedAtBefore?: number } {
  if (range === "any") return {};
  const before = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const days = range === "today" ? 0 : range === "last7Days" ? 6 : 29;
  const from = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days,
  );
  return {
    updatedAtFrom: Math.floor(from.getTime() / 1_000),
    updatedAtBefore: Math.floor(before.getTime() / 1_000),
  };
}
