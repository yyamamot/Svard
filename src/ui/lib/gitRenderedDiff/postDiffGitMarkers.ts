import type { DocumentDiffPreview } from "../../../core/types";
import type {
  PostDiffGitMarker,
  PostDiffGitMarkerContext,
  RenderedBlockDiff,
  RenderedDiffPresentation,
} from "./types";
import { renderedInlineDiffRanges } from "./text";

export const postDiffGitMarkerBudget = 200;

function matchingPreviewSide(
  preview: DocumentDiffPreview,
  activeDocumentPath: string | null | undefined,
): "left" | "right" | null {
  if (!activeDocumentPath) {
    return null;
  }
  if (preview.rightPath === activeDocumentPath) {
    return "right";
  }
  if (
    preview.source !== "file" &&
    preview.relativePath &&
    activeDocumentPath.endsWith(preview.relativePath)
  ) {
    return "right";
  }
  if (preview.source === "file" && preview.leftPath === activeDocumentPath) {
    return "left";
  }
  if (preview.leftPath === activeDocumentPath) {
    return "left";
  }
  return null;
}

function blockIndex(blocks: RenderedBlockDiff[], block: RenderedBlockDiff) {
  const index = blocks.indexOf(block);
  if (index >= 0) {
    return index;
  }
  return blocks.findIndex((candidate) => candidate.id === block.id);
}

function visibleAnchorForBlock(
  blocks: RenderedBlockDiff[],
  block: RenderedBlockDiff,
  side: "left" | "right",
): string | null {
  const visibleBlock = side === "left" ? block.left : block.right;
  if (visibleBlock) {
    return visibleBlock.id;
  }

  const index = blockIndex(blocks, block);
  if (index < 0) {
    return null;
  }

  for (let next = index + 1; next < blocks.length; next += 1) {
    const candidate = blocks[next];
    const anchor = side === "left" ? candidate?.left?.id : candidate?.right?.id;
    if (anchor) {
      return anchor;
    }
  }

  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const candidate = blocks[previous];
    const anchor = side === "left" ? candidate?.left?.id : candidate?.right?.id;
    if (anchor) {
      return anchor;
    }
  }

  return null;
}

function topLevelListItemText(
  block: RenderedBlockDiff,
  side: "left" | "right",
  itemIndex: number,
): string {
  const html = side === "left" ? block.left?.html : block.right?.html;
  if (!html) {
    return "";
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const list = doc.body.querySelector(":scope > ul, :scope > ol");
  const item = Array.from(list?.children ?? []).filter(
    (child) => child.tagName.toLowerCase() === "li",
  )[itemIndex];
  return item?.textContent ?? "";
}

function inlineDiffRangesForListItem(
  block: RenderedBlockDiff,
  side: "left" | "right",
  itemIndex: number,
) {
  if (block.kind !== "changed") {
    return [];
  }
  const leftText = topLevelListItemText(block, "left", itemIndex);
  const rightText = topLevelListItemText(block, "right", itemIndex);
  if (!leftText || !rightText) {
    return [];
  }
  return renderedInlineDiffRanges(leftText, rightText, side);
}

function childItemIndexForSide(
  childChange: NonNullable<RenderedBlockDiff["childChanges"]>[number],
  side: "left" | "right",
): number | undefined {
  return side === "left" ? childChange.leftIndex : childChange.rightIndex;
}

function markerKindForChildChange(
  childChange: NonNullable<RenderedBlockDiff["childChanges"]>[number],
  side: "left" | "right",
): PostDiffGitMarker["kind"] {
  if (childChange.kind === "added" && side === "right") {
    return "added";
  }
  if (childChange.kind === "removed" && side === "left") {
    return "removed";
  }
  return "changed";
}

function markerFallbackForHiddenChild({
  block,
  blocks,
  changeIndex,
  childIndex,
  side,
}: {
  block: RenderedBlockDiff;
  blocks: RenderedBlockDiff[];
  changeIndex: number;
  childIndex: number;
  side: "left" | "right";
}): PostDiffGitMarker | null {
  const anchorBlockId = visibleAnchorForBlock(blocks, block, side);
  if (!anchorBlockId) {
    return null;
  }
  return {
    id: `post-diff-marker:${changeIndex}:${block.id}:child:${childIndex}:fallback`,
    kind: "removed",
    anchorBlockId,
    changeIndex,
    highlightBlock: false,
    targetKind: "block",
  };
}

function markersForListItemChanges({
  block,
  blocks,
  changeIndexStart,
  side,
}: {
  block: RenderedBlockDiff;
  blocks: RenderedBlockDiff[];
  changeIndexStart: number;
  side: "left" | "right";
}): PostDiffGitMarker[] {
  if (
    block.kind !== "changed" ||
    block.blockKind !== "list" ||
    !block.childChanges?.length
  ) {
    return [];
  }

  const anchorBlockId = visibleAnchorForBlock(blocks, block, side);
  if (!anchorBlockId) {
    return [];
  }

  const markers: PostDiffGitMarker[] = [];
  block.childChanges.forEach((childChange, childIndex) => {
    const itemIndex = childItemIndexForSide(childChange, side);
    const changeIndex = changeIndexStart + markers.length;
    if (itemIndex === undefined) {
      if (childChange.kind === "removed") {
        const fallback = markerFallbackForHiddenChild({
          block,
          blocks,
          changeIndex,
          childIndex,
          side,
        });
        if (fallback) {
          markers.push(fallback);
        }
      }
      return;
    }

    const inlineDiffRanges = inlineDiffRangesForListItem(
      block,
      side,
      itemIndex,
    );
    markers.push({
      id: `post-diff-marker:${changeIndex}:${block.id}:item:${itemIndex}`,
      kind: markerKindForChildChange(childChange, side),
      anchorBlockId,
      anchorItemIndex: itemIndex,
      changeIndex,
      inlineDiffRanges:
        inlineDiffRanges.length > 0 ? inlineDiffRanges : undefined,
      targetKind: "list-item",
    });
  });
  return markers;
}

function markerForBlock({
  block,
  blocks,
  changeIndex,
  side,
}: {
  block: RenderedBlockDiff;
  blocks: RenderedBlockDiff[];
  changeIndex: number;
  side: "left" | "right";
}): PostDiffGitMarker | null {
  if (block.kind === "unchanged") {
    return null;
  }
  if (block.kind === "changed" && block.blockKind === "list") {
    if (block.childChanges?.length) {
      return null;
    }
  }
  if (block.kind === "added" && side !== "right") {
    return null;
  }
  if (block.kind === "removed" && side !== "left") {
    const anchorBlockId = visibleAnchorForBlock(blocks, block, side);
    return {
      id: `post-diff-marker:${changeIndex}:${block.id}`,
      kind: "removed",
      anchorBlockId,
      changeIndex,
      highlightBlock: false,
      targetKind: "block",
    };
  }

  const anchorBlockId = visibleAnchorForBlock(blocks, block, side);
  if (!anchorBlockId) {
    return null;
  }
  const inlineDiffRanges =
    block.kind === "changed" && block.left?.text && block.right?.text
      ? renderedInlineDiffRanges(block.left.text, block.right.text, side)
      : [];
  return {
    id: `post-diff-marker:${changeIndex}:${block.id}`,
    kind: block.kind,
    anchorBlockId,
    changeIndex,
    inlineDiffRanges:
      inlineDiffRanges.length > 0 ? inlineDiffRanges : undefined,
    includeSourceBlocks: block.blockKind === "source-block" || undefined,
    targetKind: "block",
  };
}

export function buildPostDiffGitMarkerContext({
  activeDocumentPath,
  preview,
  renderedPresentation,
}: {
  activeDocumentPath: string | null | undefined;
  preview: DocumentDiffPreview;
  renderedPresentation: RenderedDiffPresentation;
}): PostDiffGitMarkerContext | null {
  if (preview.status === "clean" || preview.hunks.length === 0) {
    return null;
  }

  const side = matchingPreviewSide(preview, activeDocumentPath);
  if (!side) {
    return null;
  }

  const blocks = renderedPresentation.entries.flatMap((entry) =>
    entry.kind === "block" ? [entry.block] : entry.blocks,
  );
  const markers: PostDiffGitMarker[] = [];
  for (const block of blocks) {
    const itemMarkers = markersForListItemChanges({
      block,
      blocks,
      changeIndexStart: markers.length,
      side,
    });
    if (itemMarkers.length > 0) {
      markers.push(...itemMarkers);
      continue;
    }
    const marker = markerForBlock({
      block,
      blocks,
      changeIndex: markers.length,
      side,
    });
    if (marker) {
      markers.push(marker);
    }
  }

  if (markers.length === 0) {
    return null;
  }

  return {
    markers: markers.slice(0, postDiffGitMarkerBudget),
    renderedCount: Math.min(markers.length, postDiffGitMarkerBudget),
    totalCount: markers.length,
  };
}
