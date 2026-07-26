export function round(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(2))
    : null;
}

export function workflowResult({
  category,
  durationMs = null,
  eventCount = 0,
  fixtureId = null,
  id,
  metric = "durationMs",
  phaseBreakdown = [],
  reason = null,
  source = null,
  status = "ok",
}) {
  return {
    category,
    durationMs: round(durationMs),
    eventCount,
    fixtureId,
    id,
    metric,
    phaseBreakdown,
    reason,
    source,
    status,
  };
}
