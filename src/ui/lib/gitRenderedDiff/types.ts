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
  listItems?: RenderedListItemSnapshot[];
  tableRows?: RenderedTableRowSnapshot[];
}

export interface RenderedBlockDiff {
  id: string;
  kind: RenderedBlockDiffKind;
  blockKind: RenderedBlockKind;
  left?: RenderedBlock;
  right?: RenderedBlock;
  childChanges?: RenderedListItemChildChange[];
  childChangeFallback?: RenderedListItemFallback;
  tableChanges?: RenderedTableCellChange[];
  tableChangeFallback?: RenderedTableFallback;
}

export interface RenderedListItemSnapshot {
  index: number;
  normalizedTextHash: string;
  directTextHash: string;
  nestedSignatureHash: string;
  textSegmentHashes: string[];
  textLength: number;
  directTextLength: number;
}

export type RenderedListItemChildChangeKind = "added" | "removed" | "changed";

export type RenderedListItemChangeSide = "left" | "right" | "both";

export interface RenderedListItemChildChange {
  kind: RenderedListItemChildChangeKind;
  side: RenderedListItemChangeSide;
  confidence: "high";
  leftIndex?: number;
  rightIndex?: number;
}

export type RenderedListItemFallbackReason =
  | "ambiguous"
  | "low-overlap"
  | "no-items"
  | "reorder"
  | "short-or-empty";

export interface RenderedListItemFallback {
  reason: RenderedListItemFallbackReason;
}

export interface RenderedTableCellSnapshot {
  index: number;
  normalizedTextHash: string;
  textSegmentHashes: string[];
  textLength: number;
  header: boolean;
}

export interface RenderedTableRowSnapshot {
  index: number;
  normalizedTextHash: string;
  cellCount: number;
  cells: RenderedTableCellSnapshot[];
}

export type RenderedTableCellChangeKind = "added" | "removed" | "changed";

export type RenderedTableCellChangeSide = "left" | "right" | "both";

export interface RenderedTableCellChange {
  kind: RenderedTableCellChangeKind;
  side: RenderedTableCellChangeSide;
  confidence: "high";
  leftRowIndex?: number;
  rightRowIndex?: number;
  leftCellIndex?: number;
  rightCellIndex?: number;
}

export type RenderedTableFallbackReason =
  | "ambiguous"
  | "complex"
  | "low-overlap"
  | "shape-mismatch";

export interface RenderedTableFallback {
  reason: RenderedTableFallbackReason;
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
  primarySide: "left" | "right";
  targetKind: "block" | "list-item" | "table-row";
  block: RenderedBlockDiff;
  childChangeIndex?: number;
  itemIndex?: number;
  tableRowIndex?: number;
}

export interface RenderedDiffSectionOutlineItem {
  id: string;
  label: string;
  level: number;
  firstChangeIndex: number;
  changeCount: number;
}

export interface RenderedDiffPresentation {
  entries: RenderedDiffPresentationEntry[];
  navigationTargets: RenderedDiffNavigationTarget[];
  sectionOutline: RenderedDiffSectionOutlineItem[];
  entryChangeIndexes: Map<string, number>;
  entryChildChangeIndexes: Map<string, number>;
  entryTableRowChangeIndexes: Map<string, number>;
  entryTargetSides: Map<string, "left" | "right" | "both">;
}

export interface RenderedDiffContentCursorTarget {
  entryId: string;
  side: "left" | "right";
  changeIndex: number;
  childChangeIndex?: number;
  tableRowIndex?: number;
}

export type PostDiffGitMarkerKind = "added" | "changed" | "removed";

export interface PostDiffGitTableCellHighlight {
  cellIndex: number;
  kind: PostDiffGitMarkerKind;
  inlineDiffRanges?: InlineDiffRange[];
}

export interface PostDiffGitMarker {
  id: string;
  kind: PostDiffGitMarkerKind;
  anchorBlockId: string | null;
  anchorItemIndex?: number;
  anchorTableRowIndex?: number;
  changeIndex: number;
  highlightBlock?: boolean;
  inlineDiffRanges?: InlineDiffRange[];
  includeSourceBlocks?: boolean;
  tableCellHighlights?: PostDiffGitTableCellHighlight[];
  targetKind?: "block" | "list-item" | "table-row";
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
