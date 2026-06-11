/// <reference lib="webworker" />
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
import { expandAsciiDocIncludes } from "./asciidocInclude";
import { extractHeadings, extractSourceBlocks } from "./asciidocSourceMap";
import type {
  AsciiDocIncludeFile,
  AsciiDocRenderContext,
  RenderResult,
} from "./types";
import type {
  RenderWorkerRequest,
  RenderWorkerResponse,
} from "./renderWorkerPool";

const asciidoctor = Asciidoctor();

interface AsciiDocRenderPayload {
  source: string;
  path?: string;
  includeFiles?: AsciiDocIncludeFile[];
  asciidocContext?: AsciiDocRenderContext | null;
}

self.onmessage = (
  event: MessageEvent<RenderWorkerRequest<AsciiDocRenderPayload>>,
) => {
  const { requestId, payload } = event.data;
  try {
    const expanded = expandAsciiDocIncludes(
      payload.source,
      payload.path,
      payload.includeFiles ?? [],
      { attributes: payload.asciidocContext?.attributes ?? {} },
    );
    const source = expanded.source;
    const renderSource = replaceDiagramBlocksWithPlaceholders(source);
    const html = asciidoctor.convert(renderSource, {
      base_dir: payload.asciidocContext?.baseDir,
      safe: "safe",
      sourcemap: true,
      attributes: {
        showtitle: true,
        icons: "font",
        ...(payload.asciidocContext?.attributes ?? {}),
      },
    }) as string;

    const result: RenderResult = {
      html,
      headings: extractHeadings(html, source, expanded.lineOrigins),
      sourceBlocks: extractSourceBlocks(source, expanded.lineOrigins),
      diagnostics: [
        ...expanded.diagnostics,
        ...detectDiagramDiagnostics(source, expanded.lineOrigins),
      ],
      missingAsciiDocIncludes: expanded.missingIncludes,
      diagramSlots: extractDiagramSlots(source, expanded.lineOrigins),
      mermaidDiagrams: extractMermaidDiagrams(source, expanded.lineOrigins),
      plantUmlDiagrams: extractPlantUmlDiagrams(source, expanded.lineOrigins),
      graphvizDiagrams: extractGraphvizDiagrams(source, expanded.lineOrigins),
      krokiDiagrams: extractKrokiDiagrams(source, expanded.lineOrigins),
    };

    self.postMessage({
      requestId,
      ok: true,
      result,
    } satisfies RenderWorkerResponse<RenderResult>);
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      message:
        error instanceof Error ? error.message : "AsciiDoc render failed",
    } satisfies RenderWorkerResponse<RenderResult>);
  }
};
