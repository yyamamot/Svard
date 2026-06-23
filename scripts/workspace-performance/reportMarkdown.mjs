export function reportMarkdown(summary) {
  const lines = [
    "# Workspace Performance Benchmark",
    "",
    `- Profile: \`${summary.profile}\``,
    `- Workflow count: ${summary.workflows.length}`,
    "",
    "## Bottleneck Candidates",
    "",
  ];
  if (summary.bottleneckCandidates.length === 0) {
    lines.push("- No measured bottleneck candidates.");
  } else {
    for (const candidate of summary.bottleneckCandidates) {
      lines.push(
        `- ${candidate.id}: ${candidate.durationMs}ms (${candidate.category}, ${candidate.metric})`,
      );
    }
  }
  lines.push("", "## Workflow Summary", "");
  for (const workflow of summary.workflows) {
    const duration =
      typeof workflow.durationMs === "number"
        ? `${workflow.durationMs}ms`
        : "-";
    const reason = workflow.reason ? `, reason: ${workflow.reason}` : "";
    lines.push(
      `- ${workflow.id}: ${workflow.status}, ${workflow.category}, ${duration}${reason}`,
    );
    if (workflow.phaseBreakdown?.length > 0) {
      for (const phase of workflow.phaseBreakdown) {
        const phaseDuration =
          typeof phase.durationMs === "number" ? `${phase.durationMs}ms` : "-";
        const details = phase.details
          ? ` (${Object.entries(phase.details)
              .map(([key, value]) => `${key}: ${value}`)
              .join(", ")})`
          : "";
        lines.push(
          `  - ${phase.name}: ${phase.status}, ${phaseDuration}${details}`,
        );
      }
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
