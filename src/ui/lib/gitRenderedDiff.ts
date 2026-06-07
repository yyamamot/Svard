export type {
  GitRenderedDiffSummary,
  GitRenderedDiffSummaryOptions,
  InlineDiffRange,
  RenderedBlock,
  RenderedBlockDiff,
  RenderedBlockDiffKind,
  RenderedBlockKind,
  RenderedDiffContentCursorTarget,
  RenderedDiffNavigationTarget,
  RenderedDiffPresentation,
  RenderedDiffPresentationEntry,
  PostDiffGitMarker,
  PostDiffGitMarkerContext,
  PostDiffGitMarkerKind,
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
  renderedDiffPresentationEntryBlockKind,
  renderedDiffPresentationEntryBlocks,
  renderedDiffPresentationEntryChangeKind,
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
export { applyInlineDiffHighlights } from "./gitRenderedDiff/inlineHighlights";
export { deriveGitRenderedDiffSummary } from "./gitRenderedDiff/renderSummary";
export {
  buildPostDiffGitMarkerContext,
  postDiffGitMarkerBudget,
} from "./gitRenderedDiff/postDiffGitMarkers";
