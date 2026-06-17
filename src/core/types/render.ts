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
}

export interface SourceLocation {
  line?: number;
  column?: number;
  sourcePath?: string;
  sourceId?: string;
}

export interface Heading {
  id: string;
  level: number;
  text: string;
  sourceLocation?: SourceLocation;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
  sourceBlocks: SourceBlock[];
  diagnostics: RenderDiagnostic[];
  missingAsciiDocIncludes?: MissingAsciiDocInclude[];
  diagramSlots: DiagramSlot[];
  mermaidDiagrams: MermaidDiagram[];
  plantUmlDiagrams: PlantUmlDiagram[];
  graphvizDiagrams: GraphvizDiagram[];
  krokiDiagrams: KrokiDiagram[];
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
