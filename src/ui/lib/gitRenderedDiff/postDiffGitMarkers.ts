import type { DocumentDiffPreview } from "../../../core/types";
import type {
  PostDiffGitMarker,
  PostDiffGitMarkerContext,
  PostDiffGitTableClassificationReason,
  PostDiffGitTableClassificationSummary,
  PostDiffGitTableCellHighlight,
  RenderedBlockDiff,
  RenderedDiffPresentation,
} from "./types";
import { renderedInlineDiffRanges } from "./text";

export const postDiffGitMarkerBudget = 200;

function emptyTableSummary(): PostDiffGitTableClassificationSummary {
  return {
    tableCellMarkerCount: 0,
    tableBlockFallbackCount: 0,
    tableNotApplicableCount: 0,
    reasonCounts: {},
  };
}

function recordTableReason(
  tableSummary: PostDiffGitTableClassificationSummary,
  reason: PostDiffGitTableClassificationReason,
  bucket: "cell-marker" | "block-fallback" | "not-applicable",
) {
  if (bucket === "cell-marker") {
    tableSummary.tableCellMarkerCount += 1;
  } else if (bucket === "block-fallback") {
    tableSummary.tableBlockFallbackCount += 1;
  } else {
    tableSummary.tableNotApplicableCount += 1;
  }
  tableSummary.reasonCounts[reason] =
    (tableSummary.reasonCounts[reason] ?? 0) + 1;
}

function fallbackReasonForTableBlock(
  preview: DocumentDiffPreview,
  block: RenderedBlockDiff,
): {
  reason: PostDiffGitTableClassificationReason;
  bucket: "block-fallback" | "not-applicable";
} | null {
  if (block.blockKind !== "table") {
    return null;
  }
  if (block.kind === "added" || block.kind === "removed") {
    return {
      reason:
        preview.status === "untracked"
          ? "untracked-or-whole-file-added"
          : "added-or-removed-table-block",
      bucket: "not-applicable",
    };
  }
  if (block.kind !== "changed") {
    return null;
  }
  if (block.tableChanges?.length) {
    return null;
  }
  if (block.tableChangeFallback?.reason === "low-overlap") {
    return { reason: "low-confidence", bucket: "block-fallback" };
  }
  if (
    block.tableChangeFallback?.reason === "complex" ||
    block.tableChangeFallback?.reason === "shape-mismatch" ||
    block.tableChangeFallback?.reason === "ambiguous"
  ) {
    return {
      reason: "complex-or-shape-mismatch",
      bucket: "block-fallback",
    };
  }
  return { reason: "no-table-changes", bucket: "block-fallback" };
}

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

function tableCellText(
  block: RenderedBlockDiff,
  side: "left" | "right",
  rowIndex: number,
  cellIndex: number,
): string {
  const html = side === "left" ? block.left?.html : block.right?.html;
  if (!html) {
    return "";
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.body.querySelector("table");
  const cell = table?.rows[rowIndex]?.cells[cellIndex];
  return cell?.textContent ?? "";
}

function inlineDiffRangesForTableCell(
  block: RenderedBlockDiff,
  side: "left" | "right",
  rowIndex: number,
  cellIndex: number,
) {
  if (block.kind !== "changed") {
    return [];
  }
  const leftText = tableCellText(block, "left", rowIndex, cellIndex);
  const rightText = tableCellText(block, "right", rowIndex, cellIndex);
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

function tableRowIndexForSide(
  tableChange: NonNullable<RenderedBlockDiff["tableChanges"]>[number],
  side: "left" | "right",
): number | undefined {
  return side === "left" ? tableChange.leftRowIndex : tableChange.rightRowIndex;
}

function tableCellIndexForSide(
  tableChange: NonNullable<RenderedBlockDiff["tableChanges"]>[number],
  side: "left" | "right",
): number | undefined {
  return side === "left"
    ? tableChange.leftCellIndex
    : tableChange.rightCellIndex;
}

function markerKindForTableChange(
  tableChange: NonNullable<RenderedBlockDiff["tableChanges"]>[number],
  side: "left" | "right",
): PostDiffGitMarker["kind"] {
  if (tableChange.kind === "added" && side === "right") {
    return "added";
  }
  if (tableChange.kind === "removed" && side === "left") {
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

function markersForTableChanges({
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
    block.blockKind !== "table" ||
    !block.tableChanges?.length
  ) {
    return [];
  }

  const anchorBlockId = visibleAnchorForBlock(blocks, block, side);
  if (!anchorBlockId) {
    return [];
  }

  const markersByRow = new Map<
    number,
    {
      kind: PostDiffGitMarker["kind"];
      tableCellHighlights: PostDiffGitTableCellHighlight[];
    }
  >();
  const markers: PostDiffGitMarker[] = [];

  block.tableChanges.forEach((tableChange, tableChangeIndex) => {
    const rowIndex = tableRowIndexForSide(tableChange, side);
    const cellIndex = tableCellIndexForSide(tableChange, side);
    if (rowIndex === undefined || cellIndex === undefined) {
      if (tableChange.kind === "removed") {
        const fallback = markerFallbackForHiddenChild({
          block,
          blocks,
          changeIndex: changeIndexStart + markers.length,
          childIndex: tableChangeIndex,
          side,
        });
        if (fallback) {
          markers.push(fallback);
        }
      }
      return;
    }

    const markerKind = markerKindForTableChange(tableChange, side);
    const rowMarker = markersByRow.get(rowIndex) ?? {
      kind: markerKind,
      tableCellHighlights: [],
    };
    rowMarker.kind =
      rowMarker.kind === "changed" || markerKind === "changed"
        ? "changed"
        : markerKind;
    const inlineDiffRanges =
      tableChange.kind === "changed"
        ? inlineDiffRangesForTableCell(block, side, rowIndex, cellIndex)
        : [];
    rowMarker.tableCellHighlights.push({
      cellIndex,
      kind: markerKind,
      inlineDiffRanges:
        inlineDiffRanges.length > 0 ? inlineDiffRanges : undefined,
    });
    markersByRow.set(rowIndex, rowMarker);
  });

  for (const [rowIndex, rowMarker] of markersByRow) {
    const changeIndex = changeIndexStart + markers.length;
    markers.push({
      id: `post-diff-marker:${changeIndex}:${block.id}:table-row:${rowIndex}`,
      kind: rowMarker.kind,
      anchorBlockId,
      anchorTableRowIndex: rowIndex,
      changeIndex,
      tableCellHighlights: rowMarker.tableCellHighlights,
      targetKind: "table-row",
    });
  }

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
  if (block.kind === "changed" && block.blockKind === "table") {
    if (block.tableChanges?.length) {
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
  const tableSummary = emptyTableSummary();
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
    const tableMarkers = markersForTableChanges({
      block,
      blocks,
      changeIndexStart: markers.length,
      side,
    });
    if (tableMarkers.length > 0) {
      markers.push(...tableMarkers);
      tableMarkers
        .filter((marker) => marker.targetKind === "table-row")
        .forEach(() =>
          recordTableReason(
            tableSummary,
            "same-schema-cell-change",
            "cell-marker",
          ),
        );
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
      const tableFallback = fallbackReasonForTableBlock(preview, block);
      if (tableFallback) {
        recordTableReason(
          tableSummary,
          tableFallback.reason,
          tableFallback.bucket,
        );
      }
    }
  }

  if (markers.length === 0) {
    return null;
  }

  return {
    markers: markers.slice(0, postDiffGitMarkerBudget),
    renderedCount: Math.min(markers.length, postDiffGitMarkerBudget),
    totalCount: markers.length,
    tableSummary,
  };
}
