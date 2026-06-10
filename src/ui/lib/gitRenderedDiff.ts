export type {
  GitRenderedDiffSummary,
  GitRenderedDiffSummaryOptions,
  InlineDiffRange,
  RenderedBlock,
  RenderedBlockDiff,
  RenderedBlockDiffKind,
  RenderedBlockKind,
  RenderedDiffContentCursorTarget,
  RenderedDiffFallbackKind,
  RenderedDiffFallbackReason,
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
export { matchRenderedTableChanges } from "./gitRenderedDiff/tableChanges";
export {
  applyRenderedListItemHighlights,
  renderedListItemHighlightsForSide,
} from "./gitRenderedDiff/listItemHighlights";
export {
  applyRenderedTableHighlights,
  renderedTableHighlightsForSide,
} from "./gitRenderedDiff/tableHighlights";
export { applyInlineDiffHighlights } from "./gitRenderedDiff/inlineHighlights";
export { deriveGitRenderedDiffSummary } from "./gitRenderedDiff/renderSummary";
export {
  buildPostDiffGitMarkerContext,
  postDiffGitMarkerBudget,
} from "./gitRenderedDiff/postDiffGitMarkers";
