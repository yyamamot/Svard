export interface DocumentOrderPatternProbeReport {
  sampleCount: number;
  readFailures: number;
  byKind: Record<string, number>;
  patterns: Record<string, number>;
}

export function analyzeDocumentOrderSources(
  sources: string[],
): Promise<DocumentOrderPatternProbeReport>;
