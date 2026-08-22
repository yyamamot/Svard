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
import {
  fallbackSourceLocation,
  slugifyHeading,
  sourceLocationForToken,
} from "./metadata";
import type { DiagramRenderer, MarkdownDiagramSlot } from "./types";
import type {
  DiagramSlot,
  Heading,
  RenderPerfStage,
  RenderDiagnostic,
  RenderResult,
  SourceBlock,
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

function perfNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function perfDuration(startedAt: number): number {
  return Number((perfNow() - startedAt).toFixed(2));
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
  const placeholders = new MarkdownPlaceholderRegistry(
    source,
    markdownReplacementBudgetForSourceBytes(sourceBytes),
  );
  const { body, htmlPrefix, lineOffset } = splitFrontmatter(source);
  recordPerf("markdown.frontmatter", frontmatterStartedAt, {
    bytes: sourceBytes,
  });

  const detailsStartedAt = perfNow();
  const details = extractMarkdownDetails(body, placeholders);
  recordPerf("markdown.details", detailsStartedAt, {
    count: details.count,
  });

  const compatStartedAt = perfNow();
  const compatibility = extractMarkdownCompatibility(
    details.source,
    placeholders,
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

    if (token.type === "paragraph_open" && token.level === 0 && token.map) {
      const block: SourceTextBlock = {
        id: `text-${sourceTextBlocks.length + 1}`,
        kind: "paragraph",
        startLine: token.map[0] + lineOffset + 1,
        endLine: token.map[1] + lineOffset,
      };
      token.attrSet("data-source-text-block-id", block.id);
      sourceTextBlocks.push(block);
      continue;
    }

    if (token.type === "heading_open") {
      const level = Number(token.tag.replace(/^h/, ""));
      const inline = tokens[index + 1];
      const rawText = inline?.type === "inline" ? inline.content : "";
      const headingMetadata = headingInlineMetadata(inline?.children);
      const id = slugifyHeading(rawText, usedHeadingIds);
      token.attrSet("id", id);
      headings.push({
        id,
        level,
        text: headingMetadata.text,
        rawText,
        ...(headingMetadata.inline ? { inline: headingMetadata.inline } : {}),
        ...(sourceLocationForToken(token, lineOffset)
          ? { sourceLocation: sourceLocationForToken(token, lineOffset) }
          : {}),
      });
      continue;
    }

    if (token.type !== "fence") {
      continue;
    }

    const language = token.info.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
    const renderer = rendererForType(language);
    if (!renderer) {
      sourceBlocks.push({
        id: `source-${sourceBlocks.length + 1}`,
        ...(language ? { language } : {}),
        ...(sourceLocationForToken(token, lineOffset)
          ? { sourceLocation: sourceLocationForToken(token, lineOffset) }
          : {}),
      });
      continue;
    }

    const sourceLocation =
      sourceLocationForToken(token, lineOffset) ?? fallbackSourceLocation();
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

    token.type = "diagram_slot";
    token.tag = "";
    token.nesting = 0;
    token.attrs = null;
    token.content = diagramPlaceholder(slot);
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
  const html = htmlWriter.toString();
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
    sourceSelectionBlocks: extractSourceSelectionBlocks(source, "markdown"),
    diagnostics,
    diagramSlots,
    perf,
    ...buildDiagramResults(markdownDiagramSlots),
  };
}
