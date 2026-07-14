export const asciiDocWorkerPhaseDurationKeys = [
  "expandIncludesMs",
  "documentAttributesMs",
  "diagramPlaceholderMs",
  "convertMs",
  "headingsMs",
  "sourceBlocksMs",
  "sourceTextBlocksMs",
  "sourceSelectionBlocksMs",
  "diagramDiagnosticsMs",
  "diagramSlotsMs",
  "mermaidMs",
  "plantUmlMs",
  "graphvizMs",
  "krokiMs",
  "totalMs",
] as const;

export const asciiDocWorkerPhaseCountKeys = [
  "expandedBytes",
  "expandedLines",
  "includeCount",
  "headingCount",
  "sourceBlockCount",
  "sourceTextBlockCount",
  "sourceSelectionBlockCount",
  "diagramCount",
  "sourceAnalysisPasses",
  "sourceAnalysisVisitedCodeUnitsEstimate",
] as const;

export type AsciiDocWorkerPhaseDurationKey =
  (typeof asciiDocWorkerPhaseDurationKeys)[number];
export type AsciiDocWorkerPhaseCountKey =
  (typeof asciiDocWorkerPhaseCountKeys)[number];

export type AsciiDocWorkerPhaseMetrics = Record<
  AsciiDocWorkerPhaseDurationKey | AsciiDocWorkerPhaseCountKey,
  number
>;
