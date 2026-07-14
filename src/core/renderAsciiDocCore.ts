import Asciidoctor from "@asciidoctor/core";

import {
  detectDiagramDiagnostics,
  extractDiagramSlots,
  extractGraphvizDiagrams,
  extractKrokiDiagrams,
  extractMermaidDiagrams,
  extractPlantUmlDiagrams,
  replaceDiagramBlocksWithPlaceholders,
} from "./extractDiagrams";
import { extractAsciiDocDocumentAttributes } from "./asciidocAttributes";
import { expandAsciiDocIncludes } from "./asciidocInclude";
import { extractHeadings, extractSourceBlocks } from "./asciidocSourceMap";
import { extractAsciiDocParagraphSourceBlocks } from "./sourceTextBlocks";
import { extractSourceSelectionBlocks } from "./sourceSelectionBlocks";
import type {
  AsciiDocWorkerPhaseDurationKey,
  AsciiDocWorkerPhaseMetrics,
} from "./renderWorkerMetrics";
import type {
  AsciiDocIncludeFile,
  AsciiDocRenderContext,
  RenderResult,
} from "./types";

const asciidoctor = Asciidoctor();

export interface AsciiDocRenderPayload {
  source: string;
  path?: string;
  includeFiles?: AsciiDocIncludeFile[];
  asciidocContext?: AsciiDocRenderContext | null;
}

interface RenderAsciiDocCoreOptions {
  collectMetrics?: boolean;
}

interface RenderAsciiDocCoreOutput {
  result: RenderResult;
  phaseMetrics?: AsciiDocWorkerPhaseMetrics;
}

export function renderAsciiDocCore(
  payload: AsciiDocRenderPayload,
  options: RenderAsciiDocCoreOptions = {},
): RenderAsciiDocCoreOutput {
  const totalStartedAt = options.collectMetrics ? perfNow() : 0;
  const durations = {} as Record<AsciiDocWorkerPhaseDurationKey, number>;
  const measure = <Value>(
    key: Exclude<AsciiDocWorkerPhaseDurationKey, "totalMs">,
    operation: () => Value,
  ): Value => {
    if (!options.collectMetrics) {
      return operation();
    }
    const startedAt = perfNow();
    const value = operation();
    durations[key] = duration(startedAt);
    return value;
  };

  const expanded = measure("expandIncludesMs", () =>
    expandAsciiDocIncludes(
      payload.source,
      payload.path,
      payload.includeFiles ?? [],
      { attributes: payload.asciidocContext?.attributes ?? {} },
    ),
  );
  const documentAttributes = measure("documentAttributesMs", () =>
    extractAsciiDocDocumentAttributes(payload.source),
  );
  const source = expanded.source;
  const renderSource = measure("diagramPlaceholderMs", () =>
    replaceDiagramBlocksWithPlaceholders(source),
  );
  const renderedHtml = measure(
    "convertMs",
    () =>
      asciidoctor.convert(renderSource, {
        base_dir: payload.asciidocContext?.baseDir,
        safe: "safe",
        sourcemap: true,
        attributes: {
          showtitle: true,
          icons: "font",
          ...(payload.asciidocContext?.attributes ?? {}),
        },
      }) as string,
  );
  const html = `${documentAttributes.htmlPrefix}${renderedHtml}`;

  const headings = measure("headingsMs", () =>
    extractHeadings(html, source, expanded.lineOrigins),
  );
  const sourceBlocks = measure("sourceBlocksMs", () =>
    extractSourceBlocks(source, expanded.lineOrigins),
  );
  const sourceTextBlocks = measure("sourceTextBlocksMs", () =>
    extractAsciiDocParagraphSourceBlocks(source, expanded.lineOrigins),
  );
  const sourceSelectionBlocks = measure("sourceSelectionBlocksMs", () =>
    extractSourceSelectionBlocks(source, "asciidoc", expanded.lineOrigins),
  );
  const diagramDiagnostics = measure("diagramDiagnosticsMs", () =>
    detectDiagramDiagnostics(source, expanded.lineOrigins),
  );
  const diagramSlots = measure("diagramSlotsMs", () =>
    extractDiagramSlots(source, expanded.lineOrigins),
  );
  const mermaidDiagrams = measure("mermaidMs", () =>
    extractMermaidDiagrams(source, expanded.lineOrigins),
  );
  const plantUmlDiagrams = measure("plantUmlMs", () =>
    extractPlantUmlDiagrams(source, expanded.lineOrigins),
  );
  const graphvizDiagrams = measure("graphvizMs", () =>
    extractGraphvizDiagrams(source, expanded.lineOrigins),
  );
  const krokiDiagrams = measure("krokiMs", () =>
    extractKrokiDiagrams(source, expanded.lineOrigins),
  );

  const result: RenderResult = {
    html,
    headings,
    sourceBlocks,
    sourceTextBlocks,
    sourceSelectionBlocks,
    diagnostics: [...expanded.diagnostics, ...diagramDiagnostics],
    missingAsciiDocIncludes: expanded.missingIncludes,
    diagramSlots,
    mermaidDiagrams,
    plantUmlDiagrams,
    graphvizDiagrams,
    krokiDiagrams,
  };

  if (!options.collectMetrics) {
    return { result };
  }

  const sourceAnalysisPasses = 11;
  const expandedLines = expanded.lineOrigins.length;
  durations.totalMs = duration(totalStartedAt);
  return {
    result,
    phaseMetrics: {
      ...durations,
      expandedBytes: source.length,
      expandedLines,
      includeCount: payload.includeFiles?.length ?? 0,
      headingCount: headings.length,
      sourceBlockCount: sourceBlocks.length,
      sourceTextBlockCount: sourceTextBlocks.length,
      sourceSelectionBlockCount: sourceSelectionBlocks.length,
      diagramCount: diagramSlots.length,
      sourceAnalysisPasses,
      sourceAnalysisVisitedCodeUnitsEstimate:
        source.length * sourceAnalysisPasses,
    },
  };
}

function perfNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function duration(startedAt: number): number {
  return Number((perfNow() - startedAt).toFixed(2));
}
