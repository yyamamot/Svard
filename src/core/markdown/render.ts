import {
  addKrokiDisabledDiagnostic,
  buildDiagramResults,
  diagramPlaceholder,
  normalizeDiagramType,
  rendererForType,
  slotIdForRenderer,
} from "./diagrams";
import { extractMarkdownDetails } from "./details";
import { extractMarkdownCompatibility } from "./compat";
import {
  enhanceGithubAlerts,
  enhanceTaskLists,
  transformSimpleAdmonitionsWithLineMap,
} from "./enhancements";
import { splitFrontmatter } from "./frontmatter";
import { extractSourceSelectionBlocks } from "../sourceSelectionBlocks";
import { markdown } from "./markdownIt";
import { headingInlineMetadata } from "./headingInline";
import { fallbackSourceLocation, slugifyHeading } from "./metadata";
import type { DiagramRenderer, MarkdownDiagramSlot } from "./types";
import type {
  DiagramSlot,
  Heading,
  RenderPerfStage,
  RenderDiagnostic,
  RenderResult,
  SourceBlock,
  SourceSelectionBlock,
  SourceTextBlock,
} from "../types";
import {
  attachMarkdownPlaceholderRegistry,
  bindMarkdownPlaceholderTokens,
  markdownFinalHtmlBudgetForSourceBytes,
  markdownReplacementBudgetForSourceBytes,
  MarkdownPlaceholderRegistry,
  renderMarkdownTokensToWriter,
  utf8ByteLength,
  Utf8ChunkWriter,
} from "./placeholders";
import {
  MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE,
  MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR,
  MarkdownRendererProvenanceRegistry,
} from "./rendererProvenance";
import {
  MarkdownOriginalSourceMap,
  originalLineRangeForTokenMap,
  type MarkdownOriginalLineRange,
} from "./sourceSpans";
import {
  attachMarkdownAuthorHtmlRegistry,
  containsMarkdownAuthorHtmlToken,
  MarkdownAuthorHtmlRegistry,
  scanMarkdownAuthorHtml,
} from "./authorHtmlRuntime";

function perfNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function perfDuration(startedAt: number): number {
  return Number((perfNow() - startedAt).toFixed(2));
}

function sourceSelectionRangeKey(
  range: MarkdownOriginalLineRange,
  kind: SourceSelectionBlock["kind"],
): string {
  return `${range.startLine + 1}\0${range.endLine}\0${kind}`;
}

function indexSourceSelectionBlocks(
  blocks: readonly SourceSelectionBlock[],
): ReadonlyMap<string, string | null> {
  const index = new Map<string, string | null>();
  for (const block of blocks) {
    const key = `${block.startLine}\0${block.endLine}\0${block.kind}`;
    index.set(key, index.has(key) ? null : block.id);
  }
  return index;
}

function sourceSelectionBlockIdForRange(
  index: ReadonlyMap<string, string | null>,
  range: MarkdownOriginalLineRange,
  kind: SourceSelectionBlock["kind"],
): string | undefined {
  return index.get(sourceSelectionRangeKey(range, kind)) ?? undefined;
}

function sourceSpanForRange(
  sourceMap: MarkdownOriginalSourceMap,
  range: MarkdownOriginalLineRange,
) {
  const sourceSpan = sourceMap.spanForLineRange(range.startLine, range.endLine);
  if (!sourceSpan) {
    throw new Error(MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR);
  }
  return sourceSpan;
}

export function renderMarkdownDocument(source: string): RenderResult {
  const totalStartedAt = perfNow();
  const perf: RenderPerfStage[] = [];
  const recordPerf = (
    event: string,
    startedAt: number,
    extras: Omit<RenderPerfStage, "event" | "durationMs"> = {},
  ) => {
    perf.push({ event, durationMs: perfDuration(startedAt), ...extras });
  };

  const frontmatterStartedAt = perfNow();
  const env = {};
  const sourceBytes = utf8ByteLength(source);
  const sourceMap = new MarkdownOriginalSourceMap(source);
  const provenance = new MarkdownRendererProvenanceRegistry(source);
  const sourceSelectionBlocks = extractSourceSelectionBlocks(
    source,
    "markdown",
  );
  const sourceSelectionBlocksByRange = indexSourceSelectionBlocks(
    sourceSelectionBlocks,
  );
  const placeholders = new MarkdownPlaceholderRegistry(
    source,
    markdownReplacementBudgetForSourceBytes(sourceBytes),
  );
  const { body, htmlPrefix, lineOffset } = splitFrontmatter(source, provenance);
  recordPerf("markdown.frontmatter", frontmatterStartedAt, {
    bytes: sourceBytes,
  });

  const authorHtmlRegistry = source.includes("<")
    ? new MarkdownAuthorHtmlRegistry(source)
    : undefined;
  const authorHtmlStartedAt = perfNow();
  const scannedAuthorHtml = authorHtmlRegistry
    ? scanMarkdownAuthorHtml(
        body,
        source.length - body.length,
        authorHtmlRegistry,
      )
    : { count: 0, source: body };
  recordPerf("markdown.authorHtml", authorHtmlStartedAt, {
    count: scannedAuthorHtml.count,
  });

  const detailsStartedAt = perfNow();
  const details = extractMarkdownDetails(
    scannedAuthorHtml.source,
    placeholders,
    {
      originalBodyLineOffset: lineOffset,
      registry: provenance,
      sourceMap,
      ...(authorHtmlRegistry ? { authorHtmlRegistry } : {}),
    },
  );
  recordPerf("markdown.details", detailsStartedAt, {
    count: details.count,
  });

  const compatStartedAt = perfNow();
  const compatibility = extractMarkdownCompatibility(
    details.source,
    placeholders,
    {
      originalBodyLineOffset: lineOffset,
      registry: provenance,
      sourceMap,
      ...(authorHtmlRegistry ? { authorHtmlRegistry } : {}),
    },
  );
  recordPerf("markdown.compatibility", compatStartedAt, {
    count: compatibility.count,
  });

  const transformStartedAt = perfNow();
  const transformed = transformSimpleAdmonitionsWithLineMap(
    compatibility.source,
  );
  placeholders.remapExpectedLines(transformed.outputLineForInputLine);
  const transformedSource = transformed.source;
  recordPerf("markdown.transformSimpleAdmonitions", transformStartedAt);

  const parseStartedAt = perfNow();
  if (authorHtmlRegistry) {
    attachMarkdownAuthorHtmlRegistry(env, authorHtmlRegistry);
  }
  const tokens = markdown.parse(transformedSource, env);
  bindMarkdownPlaceholderTokens(tokens, transformedSource, placeholders);
  attachMarkdownPlaceholderRegistry(env, placeholders);
  recordPerf("markdown.parse", parseStartedAt, { count: tokens.length });

  const enhanceStartedAt = perfNow();
  enhanceGithubAlerts(tokens);
  enhanceTaskLists(tokens);
  recordPerf("markdown.enhanceTokens", enhanceStartedAt, {
    count: tokens.length,
  });

  const metadataStartedAt = perfNow();
  const headings: Heading[] = [];
  const sourceBlocks: SourceBlock[] = [];
  const sourceTextBlocks: SourceTextBlock[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  const diagramSlots: DiagramSlot[] = [];
  const markdownDiagramSlots: MarkdownDiagramSlot[] = [];
  const usedHeadingIds = new Map<string, number>();
  const diagramCounters: Record<DiagramRenderer, number> = {
    mermaid: 0,
    plantuml: 0,
    graphviz: 0,
    kroki: 0,
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const mappedOriginalRange = originalLineRangeForTokenMap(
      token.map,
      transformed.inputLineForOutputLine,
      lineOffset,
    );
    const originalRange = mappedOriginalRange
      ? sourceMap.trimBlankBoundaryLines(mappedOriginalRange)
      : null;

    if (token.type === "paragraph_open" && token.level === 0 && token.map) {
      const containsAuthorHtml = containsMarkdownAuthorHtmlToken(
        tokens[index + 1]?.type === "inline"
          ? tokens[index + 1].children
          : undefined,
      );
      const metadataRange = originalRange ?? {
        startLine: token.map[0] + lineOffset,
        endLine: token.map[1] + lineOffset,
      };
      const block: SourceTextBlock = {
        id: `text-${sourceTextBlocks.length + 1}`,
        kind: "paragraph",
        startLine: metadataRange.startLine + 1,
        endLine: metadataRange.endLine,
      };
      sourceTextBlocks.push(block);
      if (originalRange && !containsAuthorHtml) {
        const sourceSelectionBlockId = sourceSelectionBlockIdForRange(
          sourceSelectionBlocksByRange,
          originalRange,
          "paragraph",
        );
        const rendererId = provenance.add({
          kind: "paragraph",
          tagName: "p",
          sourceSpan: sourceSpanForRange(sourceMap, originalRange),
          sourceTextBlockId: block.id,
          ...(sourceSelectionBlockId ? { sourceSelectionBlockId } : {}),
        });
        token.attrSet(MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE, rendererId);
      }
      continue;
    }

    if (token.type === "heading_open") {
      const level = Number(token.tag.replace(/^h/, ""));
      const inline = tokens[index + 1];
      const containsAuthorHtml = containsMarkdownAuthorHtmlToken(
        inline?.children,
      );
      const rawText =
        inline?.type === "inline"
          ? containsAuthorHtml && authorHtmlRegistry
            ? authorHtmlRegistry.restoreMarkers(inline.content)
            : inline.content
          : "";
      const headingMetadata = headingInlineMetadata(inline?.children);
      const id = slugifyHeading(
        containsAuthorHtml ? headingMetadata.text : rawText,
        usedHeadingIds,
      );
      token.attrSet("id", id);
      const sourceLocation = originalRange
        ? { line: originalRange.startLine + 1, column: 1 }
        : token.map
          ? { line: token.map[0] + lineOffset + 1, column: 1 }
          : undefined;
      headings.push({
        id,
        level,
        text: headingMetadata.text,
        rawText,
        ...(headingMetadata.inline ? { inline: headingMetadata.inline } : {}),
        ...(sourceLocation ? { sourceLocation } : {}),
      });
      if (token.level === 0 && originalRange && !containsAuthorHtml) {
        const sourceSelectionBlockId = sourceSelectionBlockIdForRange(
          sourceSelectionBlocksByRange,
          originalRange,
          "heading",
        );
        if (sourceSelectionBlockId) {
          const rendererId = provenance.add({
            headingId: id,
            kind: "heading",
            sourceSelectionBlockId,
            sourceSpan: sourceSpanForRange(sourceMap, originalRange),
            tagName: token.tag,
          });
          token.attrSet(MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE, rendererId);
        }
      }
      continue;
    }

    if (
      (token.type === "bullet_list_open" ||
        token.type === "ordered_list_open") &&
      token.level === 0 &&
      token.map
    ) {
      if (!originalRange) {
        continue;
      }
      const sourceSelectionBlockId = sourceSelectionBlockIdForRange(
        sourceSelectionBlocksByRange,
        originalRange,
        "list",
      );
      const rendererId = provenance.add({
        kind: "list",
        sourceSpan: sourceSpanForRange(sourceMap, originalRange),
        tagName: token.tag,
        ...(sourceSelectionBlockId ? { sourceSelectionBlockId } : {}),
      });
      token.attrSet(MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE, rendererId);
      continue;
    }

    if (token.type === "table_open" && token.level === 0 && token.map) {
      if (!originalRange) {
        continue;
      }
      const sourceSelectionBlockId = sourceSelectionBlockIdForRange(
        sourceSelectionBlocksByRange,
        originalRange,
        "table",
      );
      const rendererId = provenance.add({
        kind: "table",
        sourceSpan: sourceSpanForRange(sourceMap, originalRange),
        tableKind: "standard",
        tagName: "table",
        ...(sourceSelectionBlockId ? { sourceSelectionBlockId } : {}),
      });
      token.attrSet(MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE, rendererId);
      continue;
    }

    if (token.type !== "fence") {
      continue;
    }

    const isTopLevelFence = token.level === 0 && Boolean(originalRange);
    const sourceLocation = originalRange
      ? { line: originalRange.startLine + 1, column: 1 }
      : token.map
        ? { line: token.map[0] + lineOffset + 1, column: 1 }
        : fallbackSourceLocation();

    const language = token.info.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
    const renderer = rendererForType(language);
    if (!renderer) {
      const block: SourceBlock = {
        id: `source-${sourceBlocks.length + 1}`,
        ...(language ? { language } : {}),
        sourceLocation,
      };
      sourceBlocks.push(block);
      if (isTopLevelFence && originalRange) {
        const sourceSelectionBlockId = sourceSelectionBlockIdForRange(
          sourceSelectionBlocksByRange,
          originalRange,
          "code",
        );
        if (sourceSelectionBlockId) {
          const rendererId = provenance.add({
            kind: "source",
            sourceBlockId: block.id,
            sourceSelectionBlockId,
            sourceSpan: sourceSpanForRange(sourceMap, originalRange),
            tagName: "pre",
          });
          token.attrSet(MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE, rendererId);
        }
      }
      continue;
    }

    const diagramType = normalizeDiagramType(language);
    const slot: DiagramSlot = {
      id: slotIdForRenderer(renderer, diagramCounters),
      diagramType,
      renderer,
      sourceLocation,
    };
    diagramSlots.push(slot);
    markdownDiagramSlots.push({
      id: slot.id,
      diagramType: slot.diagramType,
      renderer: slot.renderer,
      sourceLocation,
      source: token.content.trim(),
    });

    addKrokiDisabledDiagnostic(diagnostics, slot);

    let rendererId: string | undefined;
    if (isTopLevelFence && originalRange) {
      const sourceSelectionBlockId = sourceSelectionBlockIdForRange(
        sourceSelectionBlocksByRange,
        originalRange,
        "diagram",
      );
      if (sourceSelectionBlockId) {
        rendererId = provenance.add({
          diagramId: slot.id,
          kind: "diagram",
          sourceSelectionBlockId,
          sourceSpan: sourceSpanForRange(sourceMap, originalRange),
          tagName: "div",
        });
      }
    }

    token.type = "diagram_slot";
    token.tag = "";
    token.nesting = 0;
    token.attrs = null;
    token.content = diagramPlaceholder(slot, rendererId);
    token.markup = "";
    token.info = "";
  }
  recordPerf("markdown.metadata", metadataStartedAt, {
    count: headings.length + sourceBlocks.length + diagramSlots.length,
  });

  const detailsReplaceStartedAt = perfNow();
  const htmlStartedAt = perfNow();
  const htmlWriter = new Utf8ChunkWriter(
    markdownFinalHtmlBudgetForSourceBytes(sourceBytes),
  );
  htmlWriter.append(htmlPrefix);
  renderMarkdownTokensToWriter(
    tokens,
    markdown.options,
    env,
    markdown.renderer,
    htmlWriter,
  );
  placeholders.assertAllRendered();
  authorHtmlRegistry?.assertAllConsumed();
  const html = htmlWriter.toString();
  const markdownRendererProvenance = provenance.records();
  const markdownAuthorHtmlFragments = authorHtmlRegistry?.fragments() ?? [];
  recordPerf("markdown.htmlRender", htmlStartedAt, {
    bytes: htmlWriter.byteLength,
  });

  recordPerf("markdown.replaceDetails", detailsReplaceStartedAt, {
    bytes: placeholders.replacementBytes,
    count: details.count + compatibility.count,
  });

  recordPerf("markdown.total", totalStartedAt, {
    bytes: sourceBytes,
  });

  return {
    html,
    headings,
    sourceBlocks,
    sourceTextBlocks,
    sourceSelectionBlocks,
    diagnostics,
    diagramSlots,
    perf,
    ...(markdownRendererProvenance.length > 0
      ? { markdownRendererProvenance: [...markdownRendererProvenance] }
      : {}),
    ...(markdownAuthorHtmlFragments.length > 0
      ? { markdownAuthorHtmlFragments: [...markdownAuthorHtmlFragments] }
      : {}),
    ...buildDiagramResults(markdownDiagramSlots),
  };
}
