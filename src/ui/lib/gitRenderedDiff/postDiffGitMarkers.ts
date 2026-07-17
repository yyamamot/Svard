import type { DocumentDiffPreview } from "../../../core/types";
import type {
  GitDiffPerfOwner,
  PostDiffGitMarker,
  PostDiffGitMarkerContext,
  PostDiffGitTableClassificationReason,
  PostDiffGitTableClassificationSummary,
  PostDiffGitTableCellHighlight,
  RenderedBlockDiff,
  RenderedDiffPresentation,
} from "./types";
import { renderedInlineDiffRanges } from "./text";
import {
  perfDuration,
  perfNow,
  perfTraceEnabled,
  tracePerf,
} from "../perfTrace";

export const postDiffGitMarkerBudget = 200;

type PostDiffGitMarkerPerfMode = "initial" | "handoff";

interface PostDiffGitMarkerPerfMetrics {
  owner: GitDiffPerfOwner;
  mode: PostDiffGitMarkerPerfMode;
  startedAt: number;
  blockCount: number;
  leftBlockParseCount: number;
  leftBlockParseDurationMs: number;
  // Multiple parse calls use a first-start to last-end bounding interval.
  leftBlockParseStartOffsetMs: number | null;
  leftBlockParseEndOffsetMs: number | null;
  rightBlockParseCount: number;
  rightBlockParseDurationMs: number;
  rightBlockParseStartOffsetMs: number | null;
  rightBlockParseEndOffsetMs: number | null;
}

function phaseOffsetMs(workflowStartedAt: number, timestamp: number): number {
  return Number((timestamp - workflowStartedAt).toFixed(2));
}

function phaseDurationMs(startedAt: number, endedAt: number): number {
  return Number((endedAt - startedAt).toFixed(2));
}

function traceMarkerContextReady({
  metrics,
  context,
  presentationEntryCount,
  blockCount,
}: {
  metrics: PostDiffGitMarkerPerfMetrics | null;
  context: PostDiffGitMarkerContext | null;
  presentationEntryCount: number;
  blockCount: number;
}): void {
  if (!metrics) {
    return;
  }
  tracePerf("marker-context-ready", {
    owner: metrics.owner,
    mode: metrics.mode,
    outcome: context ? "ready" : "not-applicable",
    presentationEntryCount,
    blockCount,
    markerCount: context?.totalCount ?? 0,
    renderedMarkerCount: context?.renderedCount ?? 0,
    leftBlockParseCount: metrics.leftBlockParseCount,
    leftBlockParseDurationMs: metrics.leftBlockParseDurationMs,
    leftBlockParseStartOffsetMs: metrics.leftBlockParseStartOffsetMs,
    leftBlockParseEndOffsetMs: metrics.leftBlockParseEndOffsetMs,
    rightBlockParseCount: metrics.rightBlockParseCount,
    rightBlockParseDurationMs: metrics.rightBlockParseDurationMs,
    rightBlockParseStartOffsetMs: metrics.rightBlockParseStartOffsetMs,
    rightBlockParseEndOffsetMs: metrics.rightBlockParseEndOffsetMs,
    totalDurationMs: perfDuration(metrics.startedAt),
  });
}

function parseMeasuredMarkerBlockHtml(
  html: string,
  side: "left" | "right",
  metrics: PostDiffGitMarkerPerfMetrics,
): Document {
  const startedAt = perfNow();
  if (side === "left") {
    metrics.leftBlockParseCount += 1;
    metrics.leftBlockParseStartOffsetMs ??= phaseOffsetMs(
      metrics.startedAt,
      startedAt,
    );
  } else {
    metrics.rightBlockParseCount += 1;
    metrics.rightBlockParseStartOffsetMs ??= phaseOffsetMs(
      metrics.startedAt,
      startedAt,
    );
  }
  try {
    return new DOMParser().parseFromString(html, "text/html");
  } finally {
    const endedAt = perfNow();
    if (side === "left") {
      metrics.leftBlockParseDurationMs += phaseDurationMs(startedAt, endedAt);
      metrics.leftBlockParseEndOffsetMs = phaseOffsetMs(
        metrics.startedAt,
        endedAt,
      );
    } else {
      metrics.rightBlockParseDurationMs += phaseDurationMs(startedAt, endedAt);
      metrics.rightBlockParseEndOffsetMs = phaseOffsetMs(
        metrics.startedAt,
        endedAt,
      );
    }
  }
}

function emptyTableSummary(): PostDiffGitTableClassificationSummary {
  return {
    tableCellMarkerCount: 0,
    tableAddedRowMarkerCount: 0,
    tableBlockFallbackCount: 0,
    tableNotApplicableCount: 0,
    reasonCounts: {},
  };
}

function recordTableReason(
  tableSummary: PostDiffGitTableClassificationSummary,
  reason: PostDiffGitTableClassificationReason,
  bucket:
    | "cell-marker"
    | "added-row-marker"
    | "block-fallback"
    | "not-applicable",
) {
  if (bucket === "cell-marker") {
    tableSummary.tableCellMarkerCount += 1;
  } else if (bucket === "added-row-marker") {
    tableSummary.tableAddedRowMarkerCount += 1;
  } else if (bucket === "block-fallback") {
    tableSummary.tableBlockFallbackCount += 1;
  } else {
    tableSummary.tableNotApplicableCount += 1;
  }
  tableSummary.reasonCounts[reason] =
    (tableSummary.reasonCounts[reason] ?? 0) + 1;
}

function reasonForAddedTableRows(
  preview: DocumentDiffPreview,
): PostDiffGitTableClassificationReason {
  return preview.status === "untracked"
    ? "untracked-or-whole-file-added"
    : "added-or-removed-table-block";
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
  perfMetrics: PostDiffGitMarkerPerfMetrics | null,
): string {
  const html = side === "left" ? block.left?.html : block.right?.html;
  if (!html) {
    return "";
  }
  const doc = perfMetrics
    ? parseMeasuredMarkerBlockHtml(html, side, perfMetrics)
    : new DOMParser().parseFromString(html, "text/html");
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
  perfMetrics: PostDiffGitMarkerPerfMetrics | null,
) {
  if (block.kind !== "changed") {
    return [];
  }
  const leftText = topLevelListItemText(block, "left", itemIndex, perfMetrics);
  const rightText = topLevelListItemText(
    block,
    "right",
    itemIndex,
    perfMetrics,
  );
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
  perfMetrics: PostDiffGitMarkerPerfMetrics | null,
): string {
  const html = side === "left" ? block.left?.html : block.right?.html;
  if (!html) {
    return "";
  }
  const doc = perfMetrics
    ? parseMeasuredMarkerBlockHtml(html, side, perfMetrics)
    : new DOMParser().parseFromString(html, "text/html");
  const table = doc.body.querySelector("table");
  const cell = table?.rows[rowIndex]?.cells[cellIndex];
  return cell?.textContent ?? "";
}

function inlineDiffRangesForTableCell(
  block: RenderedBlockDiff,
  side: "left" | "right",
  rowIndex: number,
  cellIndex: number,
  perfMetrics: PostDiffGitMarkerPerfMetrics | null,
) {
  if (block.kind !== "changed") {
    return [];
  }
  const leftText = tableCellText(
    block,
    "left",
    rowIndex,
    cellIndex,
    perfMetrics,
  );
  const rightText = tableCellText(
    block,
    "right",
    rowIndex,
    cellIndex,
    perfMetrics,
  );
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
    diffBlockId: block.id,
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
  perfMetrics,
}: {
  block: RenderedBlockDiff;
  blocks: RenderedBlockDiff[];
  changeIndexStart: number;
  side: "left" | "right";
  perfMetrics: PostDiffGitMarkerPerfMetrics | null;
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
      perfMetrics,
    );
    markers.push({
      id: `post-diff-marker:${changeIndex}:${block.id}:item:${itemIndex}`,
      diffBlockId: block.id,
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
  perfMetrics,
}: {
  block: RenderedBlockDiff;
  blocks: RenderedBlockDiff[];
  changeIndexStart: number;
  side: "left" | "right";
  perfMetrics: PostDiffGitMarkerPerfMetrics | null;
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
        ? inlineDiffRangesForTableCell(
            block,
            side,
            rowIndex,
            cellIndex,
            perfMetrics,
          )
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
      diffBlockId: block.id,
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

function markersForAddedTableRows({
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
    side !== "right" ||
    block.kind !== "added" ||
    block.blockKind !== "table"
  ) {
    return [];
  }
  const rows = block.right?.tableRows;
  if (!rows?.length) {
    return [];
  }
  const anchorBlockId = visibleAnchorForBlock(blocks, block, side);
  if (!anchorBlockId) {
    return [];
  }

  return rows.map((row, rowOffset) => {
    const changeIndex = changeIndexStart + rowOffset;
    return {
      id: `post-diff-marker:${changeIndex}:${block.id}:table-row:${row.index}`,
      diffBlockId: block.id,
      kind: "added",
      anchorBlockId,
      anchorTableRowIndex: row.index,
      changeIndex,
      tableCellHighlights: row.cells.map((cell) => ({
        cellIndex: cell.index,
        kind: "added",
      })),
      targetKind: "table-row",
    };
  });
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
      diffBlockId: block.id,
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
    diffBlockId: block.id,
    kind: block.kind,
    anchorBlockId,
    changeIndex,
    inlineDiffRanges:
      inlineDiffRanges.length > 0 ? inlineDiffRanges : undefined,
    includeSourceBlocks: block.blockKind === "source-block" || undefined,
    targetKind: "block",
  };
}

function buildPostDiffGitMarkerContextCore(
  activeDocumentPath: string | null | undefined,
  preview: DocumentDiffPreview,
  renderedPresentation: RenderedDiffPresentation,
  perfMetrics: PostDiffGitMarkerPerfMetrics | null,
): PostDiffGitMarkerContext | null {
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
  if (perfMetrics) {
    perfMetrics.blockCount = blocks.length;
  }
  const markers: PostDiffGitMarker[] = [];
  const tableSummary = emptyTableSummary();
  for (const block of blocks) {
    const itemMarkers = markersForListItemChanges({
      block,
      blocks,
      changeIndexStart: markers.length,
      side,
      perfMetrics,
    });
    if (itemMarkers.length > 0) {
      markers.push(...itemMarkers);
      continue;
    }
    const addedTableRowMarkers = markersForAddedTableRows({
      block,
      blocks,
      changeIndexStart: markers.length,
      side,
    });
    if (addedTableRowMarkers.length > 0) {
      markers.push(...addedTableRowMarkers);
      addedTableRowMarkers.forEach(() =>
        recordTableReason(
          tableSummary,
          reasonForAddedTableRows(preview),
          "added-row-marker",
        ),
      );
      continue;
    }
    const tableMarkers = markersForTableChanges({
      block,
      blocks,
      changeIndexStart: markers.length,
      side,
      perfMetrics,
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

export function buildPostDiffGitMarkerContext({
  activeDocumentPath,
  preview,
  renderedPresentation,
  perfOwner,
  perfMode = "initial",
}: {
  activeDocumentPath: string | null | undefined;
  preview: DocumentDiffPreview;
  renderedPresentation: RenderedDiffPresentation;
  perfOwner?: GitDiffPerfOwner;
  perfMode?: PostDiffGitMarkerPerfMode;
}): PostDiffGitMarkerContext | null {
  if (!perfOwner || !perfTraceEnabled()) {
    return buildPostDiffGitMarkerContextCore(
      activeDocumentPath,
      preview,
      renderedPresentation,
      null,
    );
  }

  const perfMetrics: PostDiffGitMarkerPerfMetrics = {
    owner: perfOwner,
    mode: perfMode,
    startedAt: perfNow(),
    blockCount: 0,
    leftBlockParseCount: 0,
    leftBlockParseDurationMs: 0,
    leftBlockParseStartOffsetMs: null,
    leftBlockParseEndOffsetMs: null,
    rightBlockParseCount: 0,
    rightBlockParseDurationMs: 0,
    rightBlockParseStartOffsetMs: null,
    rightBlockParseEndOffsetMs: null,
  };
  const context = buildPostDiffGitMarkerContextCore(
    activeDocumentPath,
    preview,
    renderedPresentation,
    perfMetrics,
  );
  traceMarkerContextReady({
    metrics: perfMetrics,
    context,
    presentationEntryCount: renderedPresentation.entries.length,
    blockCount: perfMetrics.blockCount,
  });
  return context;
}
