export type {
  GitRenderedDiffSummary,
  GitRenderedDiffSummaryOptions,
  GitDiffPerfOwner,
  InlineDiffRange,
  RenderedBlock,
  RenderedBlockDiff,
  RenderedBlockDiffKind,
  RenderedBlockKind,
  RenderedDiffContentCursorTarget,
  RenderedDiffFallbackKind,
  RenderedDiffFallbackReason,
  RenderedDiffInlineDiagnostic,
  RenderedDiffInlineDiagnosticCategory,
  RenderedDiffNavigationTarget,
  RenderedDiffPresentation,
  RenderedDiffPresentationEntry,
  PostDiffGitMarker,
  PostDiffGitMarkerContext,
  PostDiffGitMarkerKind,
  PostDiffGitTableCellHighlight,
  RenderedListItemChildChange,
  RenderedListItemFallback,
  RenderedListItemSnapshot,
  RenderedStructuredChildChange,
  RenderedStructuredChildRole,
  RenderedStructuredChildSnapshot,
  RenderedStructuredFallback,
  RenderedTableCellChange,
  RenderedTableFallback,
  RenderedTableRowSnapshot,
  WordDiffPart,
} from "./gitRenderedDiff/types";
export {
  buildRenderedDiffPresentation,
  changedRenderedBlocks,
  isRenderedChangeBlock,
  isRenderedDiffPresentationChangeEntry,
  nextRenderedDiffContentCursorTarget,
  renderedBlockVisualClass,
  renderedDiffContentCursorTargets,
  renderedDiffListItemChangeIndex,
  renderedDiffPresentationEntryBlockKind,
  renderedDiffPresentationEntryBlocks,
  renderedDiffPresentationEntryChangeKind,
  renderedDiffStructuredChildChangeIndex,
  renderedDiffTableRowChangeIndex,
} from "./gitRenderedDiff/presentation";
export { extractRenderedBlocksFromHtml } from "./gitRenderedDiff/extraction";
export {
  alignRenderedBlocksByAnchors,
  compareRenderedBlocks,
  pairChangedBlocksInGap,
} from "./gitRenderedDiff/matching";
export {
  renderedInlineDiffRanges,
  renderedTextOverlap,
  wordDiffParts,
} from "./gitRenderedDiff/text";
export { matchRenderedListItemChanges } from "./gitRenderedDiff/listItemChanges";
export { matchRenderedStructuredChanges } from "./gitRenderedDiff/structuredChanges";
export { matchRenderedTableChanges } from "./gitRenderedDiff/tableChanges";
export {
  applyRenderedListItemHighlights,
  renderedListItemHighlightsForSide,
} from "./gitRenderedDiff/listItemHighlights";
export {
  applyRenderedTableHighlights,
  renderedTableHighlightsForSide,
} from "./gitRenderedDiff/tableHighlights";
export {
  applyRenderedStructuredChildHighlights,
  renderedStructuredChildHighlightsForSide,
} from "./gitRenderedDiff/structuredHighlights";
export { applyInlineDiffHighlights } from "./gitRenderedDiff/inlineHighlights";
export { deriveGitRenderedDiffSummary } from "./gitRenderedDiff/renderSummary";
export {
  buildPostDiffGitMarkerContext,
  postDiffGitMarkerBudget,
} from "./gitRenderedDiff/postDiffGitMarkers";
