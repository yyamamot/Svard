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
  const markers = blocks
    .map((block, changeIndex) =>
      markerForBlock({
        block,
        blocks,
        changeIndex,
        side,
      }),
    )
    .filter((marker): marker is PostDiffGitMarker => marker !== null);

  if (markers.length === 0) {
    return null;
  }

  return {
    markers: markers.slice(0, postDiffGitMarkerBudget),
    renderedCount: Math.min(markers.length, postDiffGitMarkerBudget),
    totalCount: markers.length,
  };
}
