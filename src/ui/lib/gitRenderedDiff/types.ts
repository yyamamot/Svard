import type {
  AppConfig,
  DocumentPayload,
  KrokiRequest,
  KrokiResult,
  LocalImageResult,
} from "../../../core/types";

export type RenderedBlockKind =
  | "heading"
  | "paragraph"
  | "list"
  | "table"
  | "source-block"
  | "admonition"
  | "blockquote"
  | "diagram"
  | "image";

export type RenderedBlockDiffKind =
  | "unchanged"
  | "added"
  | "removed"
  | "changed";

export interface RenderedBlock {
  id: string;
  kind: RenderedBlockKind;
  tagName: string;
  text: string;
  html: string;
  signature?: string;
}

export interface RenderedBlockDiff {
  id: string;
  kind: RenderedBlockDiffKind;
  blockKind: RenderedBlockKind;
  left?: RenderedBlock;
  right?: RenderedBlock;
}

export type RenderedDiffPresentationEntry =
  | {
      id: string;
      kind: "block";
      block: RenderedBlockDiff;
    }
  | {
      id: string;
      kind: "group";
      changeKind: "added" | "removed";
      blocks: RenderedBlockDiff[];
    };

export interface RenderedDiffNavigationTarget {
  index: number;
  entryId: string;
  side: "left" | "right" | "both";
  block: RenderedBlockDiff;
}

export interface RenderedDiffPresentation {
  entries: RenderedDiffPresentationEntry[];
  navigationTargets: RenderedDiffNavigationTarget[];
  entryChangeIndexes: Map<string, number>;
  entryTargetSides: Map<string, "left" | "right" | "both">;
}

export interface RenderedDiffContentCursorTarget {
  entryId: string;
  side: "left" | "right";
  changeIndex: number;
}

export type PostDiffGitMarkerKind = "added" | "changed" | "removed";

export interface PostDiffGitMarker {
  id: string;
  kind: PostDiffGitMarkerKind;
  anchorBlockId: string | null;
  changeIndex: number;
  inlineDiffRanges?: InlineDiffRange[];
  includeSourceBlocks?: boolean;
}

export interface PostDiffGitMarkerContext {
  markers: PostDiffGitMarker[];
  renderedCount: number;
  totalCount: number;
}

export interface GitRenderedDiffSummary {
  blocks: RenderedBlockDiff[];
  fallbackMessage?: string;
}

export interface GitRenderedDiffSummaryOptions {
  config?: AppConfig | null;
  loadDocumentContext?: (
    documentPath: string,
  ) => Promise<Pick<
    DocumentPayload,
    "includeFiles" | "asciidocContext"
  > | null>;
  resolveLocalImage?: (
    source: string,
    documentPath: string,
    context: DocumentPayload["asciidocContext"],
  ) => Promise<LocalImageResult>;
  renderDiagram?: (request: KrokiRequest) => Promise<KrokiResult>;
  confirmedRemoteDiagramKeys?: ReadonlySet<string>;
  krokiFallbackDiagramKeys?: ReadonlySet<string>;
}

export interface RenderedBlockExtractionOptions {
  diagramSignatures?: ReadonlyMap<string, string>;
  showExternalImages?: boolean;
}

export interface WordDiffPart {
  kind: "added" | "removed" | "unchanged";
  value: string;
}

export interface InlineDiffRange {
  kind: "added" | "removed";
  start: number;
  end: number;
}
