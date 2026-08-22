import type { KrokiConfig } from "./config";

export interface KrokiRequest {
  diagramType: string;
  source: string;
  config: KrokiConfig;
  confirmedRemoteSend?: boolean;
}

export interface KrokiResult {
  status: "disabled" | "rendered" | "error";
  message?: string;
  artifactUrl?: string;
  mediaType?: string;
  content?: string;
  cacheStatus?: "disabled" | "hit" | "miss" | "not-written";
}

export interface LocalImageResult {
  status: "resolved" | "blocked" | "error";
  mediaType?: string;
  content?: string;
  encoding?: "base64" | "utf8";
  placeholderText?: string;
  resolvedPath?: string;
}

export interface SourceLocation {
  line?: number;
  column?: number;
  sourcePath?: string;
  sourceId?: string;
}

export type HeadingInlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; children: HeadingInlineNode[] }
  | { type: "emphasis"; children: HeadingInlineNode[] }
  | { type: "code"; value: string };

export interface Heading {
  id: string;
  level: number;
  text: string;
  rawText?: string;
  inline?: HeadingInlineNode[];
  sourceLocation?: SourceLocation;
}

export interface MarkdownAuthorHtmlFragment {
  id: string;
  kind: "inline" | "block";
  sourceSpan: {
    startOffset: number;
    endOffset: number;
  };
}

export interface MarkdownRendererSourceSpan {
  startOffset: number;
  endOffset: number;
}

export interface MarkdownRendererProvenanceBase {
  id: string;
  kind:
    | "heading"
    | "paragraph"
    | "list"
    | "source"
    | "table"
    | "diagram"
    | "frontmatter"
    | "details";
  tagName: string;
  sourceSpan: MarkdownRendererSourceSpan;
}

export type MarkdownRendererProvenance =
  | (MarkdownRendererProvenanceBase & {
      kind: "heading";
      headingId: string;
      sourceSelectionBlockId: string;
    })
  | (MarkdownRendererProvenanceBase & {
      kind: "paragraph";
      sourceTextBlockId: string;
      sourceSelectionBlockId?: string;
    })
  | (MarkdownRendererProvenanceBase & {
      kind: "list";
      sourceSelectionBlockId?: string;
    })
  | (MarkdownRendererProvenanceBase & {
      kind: "source";
      sourceBlockId: string;
      sourceSelectionBlockId: string;
    })
  | (MarkdownRendererProvenanceBase & {
      kind: "table";
      tableKind: "standard";
      sourceSelectionBlockId?: string;
    })
  | (MarkdownRendererProvenanceBase & {
      kind: "table";
      tableKind: "compatibility";
    })
  | (MarkdownRendererProvenanceBase & {
      kind: "diagram";
      diagramId: string;
      sourceSelectionBlockId: string;
    })
  | (MarkdownRendererProvenanceBase & {
      kind: "frontmatter";
    })
  | (MarkdownRendererProvenanceBase & {
      kind: "details";
    });

export interface RenderResult {
  html: string;
  headings: Heading[];
  sourceBlocks: SourceBlock[];
  sourceTextBlocks?: SourceTextBlock[];
  sourceSelectionBlocks?: SourceSelectionBlock[];
  diagnostics: RenderDiagnostic[];
  missingAsciiDocIncludes?: MissingAsciiDocInclude[];
  diagramSlots: DiagramSlot[];
  mermaidDiagrams: MermaidDiagram[];
  plantUmlDiagrams: PlantUmlDiagram[];
  graphvizDiagrams: GraphvizDiagram[];
  krokiDiagrams: KrokiDiagram[];
  markdownAuthorHtmlFragments?: MarkdownAuthorHtmlFragment[];
  markdownRendererProvenance?: MarkdownRendererProvenance[];
  perf?: RenderPerfStage[];
}

export interface RenderPerfStage {
  event: string;
  durationMs: number;
  bytes?: number;
  count?: number;
}

export interface SourceBlock {
  id: string;
  language?: string;
  sourceLocation?: SourceLocation;
}

export interface SourceTextBlock {
  id: string;
  kind: "paragraph";
  startLine: number;
  endLine: number;
  sourceLocation?: SourceLocation;
}

export interface SourceSelectionBlock {
  id: string;
  kind: "heading" | "paragraph" | "list" | "table" | "code" | "diagram";
  startLine: number;
  endLine: number;
  sourceLocation?: SourceLocation;
}

export interface RenderDiagnostic {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  sourceLocation?: SourceLocation;
}

export interface MissingAsciiDocInclude {
  target: string;
  reason: "missing" | "unsafe" | "recursive" | "depth-limit";
  sourceLocation?: SourceLocation;
}

export interface DiagramSlot {
  id: string;
  diagramType: string;
  renderer: "mermaid" | "plantuml" | "graphviz" | "kroki";
  sourceLocation?: SourceLocation;
}

export interface MermaidDiagram {
  id: string;
  source: string;
  sourceLocation?: SourceLocation;
}

export interface PlantUmlDiagram {
  id: string;
  source: string;
  sourceLocation?: SourceLocation;
}

export interface PlantUmlRenderInput {
  source: string;
  theme: "light" | "dark";
  timeoutMs: number;
  probeMode?: "normal" | "skip-diagnostic" | "dummy-svg";
}

export interface ExternalPlantUmlRenderInput {
  source: string;
  theme: "light" | "dark";
  timeoutMs: number;
  binaryPath: string | null;
  dotPath?: string | null;
}

export interface ExternalPlantUmlTestInput {
  timeoutMs: number;
  binaryPath: string | null;
  dotPath?: string | null;
}

export interface PlantUmlSvgCacheReadInput {
  key: string;
}

export interface PlantUmlSvgCacheReadResult {
  status: "hit" | "miss" | "error";
  svg?: string;
}

export interface PlantUmlSvgCacheWriteInput {
  key: string;
  svg: string;
  metadata?: {
    renderer: "plantuml";
    theme: "light" | "dark";
    version: string;
  };
}

export interface PlantUmlSvgCacheWriteResult {
  status: "written" | "skipped" | "error";
}

export interface PlantUmlRenderResult {
  status: "rendered" | "error" | "timeout";
  svg?: string;
  diagnostics: string[];
  metrics?: {
    initMs?: number;
    renderMs: number;
    queueWaitMs?: number;
    workerReadyWaitMs?: number;
    parentRoundTripMs?: number;
    workerTotalMs?: number;
    renderCoreMs?: number;
    diagnosticMs?: number;
    encodeMs?: number;
    postMessageMs?: number;
    svgBytes?: number;
    cacheStatus?: "disabled" | "hit" | "miss" | "not-written";
    cacheLayer?: "memory" | "persistent";
    externalVersion?: string;
    mode?: "renderToString" | "dom" | "dummy";
  };
}

export interface GraphvizDiagram {
  id: string;
  diagramType: "graphviz" | "dot";
  source: string;
  sourceLocation?: SourceLocation;
}

export interface GraphvizRenderInput {
  source: string;
  timeoutMs: number;
}

export interface GraphvizRenderResult {
  status: "rendered" | "error" | "timeout";
  svg?: string;
  diagnostics: string[];
  metrics?: {
    renderMs: number;
    queueWaitMs?: number;
    workerReadyWaitMs?: number;
    parentRoundTripMs?: number;
    workerTotalMs?: number;
    svgBytes?: number;
  };
}

export interface KrokiDiagram {
  id: string;
  diagramType: string;
  source: string;
  sourceLocation?: SourceLocation;
}
