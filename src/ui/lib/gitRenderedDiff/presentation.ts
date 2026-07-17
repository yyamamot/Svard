import type {
  RenderedBlock,
  RenderedBlockDiff,
  RenderedBlockDiffKind,
  RenderedBlockKind,
  RenderedDiffContentCursorTarget,
  RenderedDiffFallbackReason,
  RenderedDiffInlineDiagnostic,
  RenderedDiffNavigationTarget,
  RenderedDiffPresentation,
  RenderedDiffPresentationEntry,
  RenderedDiffSectionOutlineItem,
} from "./types";
import { normalizedText } from "./text";

function listItemTargetKey(
  entryId: string,
  side: "left" | "right",
  itemIndex: number,
): string {
  return `${entryId}:${side}:${itemIndex}`;
}

function tableRowTargetKey(
  entryId: string,
  side: "left" | "right",
  rowIndex: number,
): string {
  return `${entryId}:table:${side}:${rowIndex}`;
}

function structuredChildTargetKey(
  entryId: string,
  side: "left" | "right",
  childIndex: number,
): string {
  return `${entryId}:structured:${side}:${childIndex}`;
}

export function isRenderedChangeBlock(block: RenderedBlockDiff): boolean {
  return block.kind !== "unchanged";
}

export function changedRenderedBlocks(
  blocks: RenderedBlockDiff[],
): RenderedBlockDiff[] {
  return blocks.filter(isRenderedChangeBlock);
}

function isMeaningfulRenderedBlock(block: RenderedBlock | undefined): boolean {
  return normalizedText(block?.text).length > 0;
}

function targetSideForBlock(
  block: RenderedBlockDiff,
): "left" | "right" | "both" | null {
  if (!isRenderedChangeBlock(block)) {
    return null;
  }
  if (block.kind === "added") {
    return isMeaningfulRenderedBlock(block.right) ? "right" : null;
  }
  if (block.kind === "removed") {
    return isMeaningfulRenderedBlock(block.left) ? "left" : null;
  }
  const hasLeft = isMeaningfulRenderedBlock(block.left);
  const hasRight = isMeaningfulRenderedBlock(block.right);
  if (hasLeft && hasRight) {
    return "both";
  }
  if (hasLeft) {
    return "left";
  }
  if (hasRight) {
    return "right";
  }
  return null;
}

function oneSidedChangeKind(
  block: RenderedBlockDiff,
): "added" | "removed" | null {
  return block.kind === "added" || block.kind === "removed" ? block.kind : null;
}

function presentationEntryBlocks(
  entry: RenderedDiffPresentationEntry,
): RenderedBlockDiff[] {
  return entry.kind === "block" ? [entry.block] : entry.blocks;
}

function renderedBlockText(block: RenderedBlock | undefined): string {
  return normalizedText(block?.text);
}

function renderedHeadingLabel(block: RenderedBlockDiff): string {
  return (
    renderedBlockText(block.right) ||
    renderedBlockText(block.left) ||
    "Untitled section"
  );
}

function renderedHeadingLevel(block: RenderedBlockDiff): number {
  const tagName = (
    block.right?.tagName ||
    block.left?.tagName ||
    ""
  ).toLowerCase();
  const match = /^h([1-6])$/.exec(tagName);
  return match ? Number(match[1]) : 0;
}

function buildSectionOutline(
  entries: RenderedDiffPresentationEntry[],
  navigationTargets: RenderedDiffNavigationTarget[],
): RenderedDiffSectionOutlineItem[] {
  const targetsByEntry = new Map<string, RenderedDiffNavigationTarget[]>();
  for (const target of navigationTargets) {
    const targets = targetsByEntry.get(target.entryId);
    if (targets) {
      targets.push(target);
    } else {
      targetsByEntry.set(target.entryId, [target]);
    }
  }

  let currentSection: Pick<
    RenderedDiffSectionOutlineItem,
    "id" | "label" | "level"
  > = {
    id: "rendered-section:document-start",
    label: "Document start",
    level: 0,
  };
  const outline: RenderedDiffSectionOutlineItem[] = [];
  const outlineBySectionId = new Map<string, RenderedDiffSectionOutlineItem>();

  for (const entry of entries) {
    const headingBlock = presentationEntryBlocks(entry).find(
      (block) => block.blockKind === "heading",
    );
    if (headingBlock) {
      currentSection = {
        id: `rendered-section:${entry.id}`,
        label: renderedHeadingLabel(headingBlock),
        level: renderedHeadingLevel(headingBlock),
      };
    }

    const targets = targetsByEntry.get(entry.id);
    if (!targets || targets.length === 0) {
      continue;
    }

    let section = outlineBySectionId.get(currentSection.id);
    if (!section) {
      section = {
        ...currentSection,
        firstChangeIndex: targets[0]?.index ?? 0,
        changeCount: 0,
      };
      outlineBySectionId.set(currentSection.id, section);
      outline.push(section);
    }
    section.changeCount += targets.length;
  }

  return outline;
}

export function renderedDiffPresentationEntryBlocks(
  entry: RenderedDiffPresentationEntry,
): RenderedBlockDiff[] {
  return presentationEntryBlocks(entry);
}

export function renderedDiffPresentationEntryChangeKind(
  entry: RenderedDiffPresentationEntry,
): RenderedBlockDiffKind {
  return entry.kind === "block" ? entry.block.kind : entry.changeKind;
}

export function renderedDiffPresentationEntryBlockKind(
  entry: RenderedDiffPresentationEntry,
): RenderedBlockKind {
  return entry.kind === "block"
    ? entry.block.blockKind
    : (entry.blocks[0]?.blockKind ?? "paragraph");
}

export function isRenderedDiffPresentationChangeEntry(
  entry: RenderedDiffPresentationEntry,
): boolean {
  return presentationEntryBlocks(entry).some(isRenderedChangeBlock);
}

function listItemChangeSideAndIndex(
  childChange: NonNullable<RenderedBlockDiff["childChanges"]>[number],
): { side: "left" | "right"; itemIndex: number } | null {
  if (childChange.kind === "removed" && childChange.leftIndex !== undefined) {
    return { side: "left", itemIndex: childChange.leftIndex };
  }
  if (childChange.rightIndex !== undefined) {
    return { side: "right", itemIndex: childChange.rightIndex };
  }
  return null;
}

function listItemTargetSideAndIndex(
  childChange: NonNullable<RenderedBlockDiff["childChanges"]>[number],
  side: "left" | "right",
): { side: "left" | "right"; itemIndex: number } | null {
  if (side === "left" && childChange.leftIndex !== undefined) {
    return { side, itemIndex: childChange.leftIndex };
  }
  if (side === "right" && childChange.rightIndex !== undefined) {
    return { side, itemIndex: childChange.rightIndex };
  }
  return null;
}

function childNavigationTargetsForBlock(block: RenderedBlockDiff): Array<{
  childChangeIndex: number;
  itemIndex: number;
  side: "left" | "right";
}> {
  if (block.kind !== "changed" || block.blockKind !== "list") {
    return [];
  }
  return (block.childChanges ?? []).flatMap((childChange, childChangeIndex) => {
    const target = listItemChangeSideAndIndex(childChange);
    return target
      ? [
          {
            childChangeIndex,
            itemIndex: target.itemIndex,
            side: target.side,
          },
        ]
      : [];
  });
}

function tableRowChangeSideAndIndex(
  tableChange: NonNullable<RenderedBlockDiff["tableChanges"]>[number],
): { side: "left" | "right"; rowIndex: number } | null {
  if (
    tableChange.kind === "removed" &&
    tableChange.leftRowIndex !== undefined
  ) {
    return { side: "left", rowIndex: tableChange.leftRowIndex };
  }
  if (tableChange.rightRowIndex !== undefined) {
    return { side: "right", rowIndex: tableChange.rightRowIndex };
  }
  return null;
}

function tableRowTargetSideAndIndex(
  tableChange: NonNullable<RenderedBlockDiff["tableChanges"]>[number],
  side: "left" | "right",
): { side: "left" | "right"; rowIndex: number } | null {
  if (side === "left" && tableChange.leftRowIndex !== undefined) {
    return { side, rowIndex: tableChange.leftRowIndex };
  }
  if (side === "right" && tableChange.rightRowIndex !== undefined) {
    return { side, rowIndex: tableChange.rightRowIndex };
  }
  return null;
}

function tableRowNavigationTargetsForBlock(block: RenderedBlockDiff): Array<{
  side: "left" | "right";
  tableRowIndex: number;
}> {
  if (block.kind !== "changed" || block.blockKind !== "table") {
    return [];
  }
  const seen = new Set<string>();
  return (block.tableChanges ?? []).flatMap((tableChange) => {
    const target = tableRowChangeSideAndIndex(tableChange);
    if (!target) {
      return [];
    }
    const key = `${target.side}:${target.rowIndex}`;
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [{ side: target.side, tableRowIndex: target.rowIndex }];
  });
}

function structuredChildChangeSideAndIndex(
  structuredChange: NonNullable<RenderedBlockDiff["structuredChanges"]>[number],
): { side: "left" | "right"; structuredChildIndex: number } | null {
  if (
    structuredChange.kind === "removed" &&
    structuredChange.leftIndex !== undefined
  ) {
    return { side: "left", structuredChildIndex: structuredChange.leftIndex };
  }
  if (structuredChange.rightIndex !== undefined) {
    return { side: "right", structuredChildIndex: structuredChange.rightIndex };
  }
  return null;
}

function structuredChildTargetSideAndIndex(
  structuredChange: NonNullable<RenderedBlockDiff["structuredChanges"]>[number],
  side: "left" | "right",
): { side: "left" | "right"; structuredChildIndex: number } | null {
  if (side === "left" && structuredChange.leftIndex !== undefined) {
    return { side, structuredChildIndex: structuredChange.leftIndex };
  }
  if (side === "right" && structuredChange.rightIndex !== undefined) {
    return { side, structuredChildIndex: structuredChange.rightIndex };
  }
  return null;
}

function structuredChildNavigationTargetsForBlock(
  block: RenderedBlockDiff,
): Array<{
  side: "left" | "right";
  structuredChangeIndex: number;
  structuredChildIndex: number;
}> {
  if (
    block.kind !== "changed" ||
    (block.blockKind !== "definition-list" && block.blockKind !== "admonition")
  ) {
    return [];
  }
  return (block.structuredChanges ?? []).flatMap(
    (structuredChange, structuredChangeIndex) => {
      const target = structuredChildChangeSideAndIndex(structuredChange);
      return target
        ? [
            {
              side: target.side,
              structuredChangeIndex,
              structuredChildIndex: target.structuredChildIndex,
            },
          ]
        : [];
    },
  );
}

function primarySideForTargetSide(
  targetSide: "left" | "right" | "both",
): "left" | "right" {
  return targetSide === "left" ? "left" : "right";
}

function fallbackReasonsForEntry(
  entry: RenderedDiffPresentationEntry,
): RenderedDiffFallbackReason[] {
  if (entry.kind !== "block" || entry.block.kind !== "changed") {
    return [];
  }
  const reasons: RenderedDiffFallbackReason[] = [];
  if (entry.block.childChangeFallback) {
    reasons.push({
      blockId: entry.block.id,
      entryId: entry.id,
      kind: "list",
      reason: entry.block.childChangeFallback.reason,
    });
  }
  if (entry.block.structuredChangeFallback) {
    reasons.push({
      blockId: entry.block.id,
      entryId: entry.id,
      kind: "structured",
      reason: entry.block.structuredChangeFallback.reason,
    });
  }
  if (entry.block.tableChangeFallback) {
    reasons.push({
      blockId: entry.block.id,
      entryId: entry.id,
      kind: "table",
      reason: entry.block.tableChangeFallback.reason,
    });
  }
  return reasons;
}

function fallbackReasonText(
  reason: RenderedDiffFallbackReason["reason"],
): string {
  return reason.replace(/-/g, " ");
}

function fallbackKindText(kind: RenderedDiffFallbackReason["kind"]): string {
  if (kind === "list") {
    return "List fallback";
  }
  if (kind === "structured") {
    return "Structured fallback";
  }
  return "Table fallback";
}

function fallbackDiagnostic(
  reason: RenderedDiffFallbackReason,
): RenderedDiffInlineDiagnostic {
  return {
    id: `inline-diagnostic:${reason.entryId}:${reason.kind}:${reason.reason}`,
    entryId: reason.entryId,
    blockId: reason.blockId,
    category: "fallback",
    label: `${fallbackKindText(reason.kind)}: ${fallbackReasonText(
      reason.reason,
    )}`,
    detail:
      "Svard kept this change at block level because detailed matching was not reliable for this target.",
  };
}

function blockHtmlIncludes(block: RenderedBlockDiff, value: string): boolean {
  return Boolean(
    block.left?.html.includes(value) || block.right?.html.includes(value),
  );
}

function placeholderDiagnosticForEntry(
  entry: RenderedDiffPresentationEntry,
): RenderedDiffInlineDiagnostic[] {
  if (entry.kind !== "block" || !isRenderedChangeBlock(entry.block)) {
    return [];
  }
  const block = entry.block;
  if (block.blockKind === "diagram") {
    if (
      blockHtmlIncludes(block, "diagram-inline-diagnostic") ||
      blockHtmlIncludes(block, "Diagram placeholder")
    ) {
      return [
        {
          id: `inline-diagnostic:${entry.id}:unsupported-diagram`,
          entryId: entry.id,
          blockId: block.id,
          category: "unsupported",
          label: "Unsupported diagram",
          detail:
            "Diagram output is unavailable for this rendered diff target.",
        },
      ];
    }
  }
  if (block.blockKind !== "image") {
    return [];
  }
  if (
    blockHtmlIncludes(block, "External image blocked") ||
    blockHtmlIncludes(block, "Local image blocked") ||
    blockHtmlIncludes(block, "Data image blocked")
  ) {
    return [
      {
        id: `inline-diagnostic:${entry.id}:blocked-asset`,
        entryId: entry.id,
        blockId: block.id,
        category: "blocked-asset",
        label: "Blocked asset",
        detail:
          "Image output is hidden by the current security or render policy.",
      },
    ];
  }
  if (blockHtmlIncludes(block, "Image placeholder")) {
    return [
      {
        id: `inline-diagnostic:${entry.id}:missing-image`,
        entryId: entry.id,
        blockId: block.id,
        category: "missing-reference",
        label: "Missing image",
        detail: "Image output is not available for this rendered diff target.",
      },
    ];
  }
  return [];
}

function inlineDiagnosticsForEntries(
  entries: RenderedDiffPresentationEntry[],
  fallbackReasons: RenderedDiffFallbackReason[],
): RenderedDiffInlineDiagnostic[] {
  return [
    ...fallbackReasons.map(fallbackDiagnostic),
    ...entries.flatMap(placeholderDiagnosticForEntry),
  ];
}

export function buildRenderedDiffPresentation(
  blocks: RenderedBlockDiff[],
): RenderedDiffPresentation {
  const entries: RenderedDiffPresentationEntry[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    const changeKind = block ? oneSidedChangeKind(block) : null;
    if (!block || !changeKind) {
      if (block) {
        entries.push({
          id: `rendered-presentation:${entries.length}:${block.id}`,
          kind: "block",
          block,
        });
      }
      index += 1;
      continue;
    }

    const group = [block];
    index += 1;
    while (
      index < blocks.length &&
      oneSidedChangeKind(blocks[index] as RenderedBlockDiff) === changeKind
    ) {
      group.push(blocks[index] as RenderedBlockDiff);
      index += 1;
    }

    if (group.length === 1) {
      entries.push({
        id: `rendered-presentation:${entries.length}:${block.id}`,
        kind: "block",
        block,
      });
    } else {
      entries.push({
        id: `rendered-presentation:${entries.length}:${changeKind}`,
        kind: "group",
        changeKind,
        blocks: group,
      });
    }
  }

  const navigationTargets: RenderedDiffNavigationTarget[] = [];
  const entryChangeIndexes = new Map<string, number>();
  const entryChildChangeIndexes = new Map<string, number>();
  const entryStructuredChildChangeIndexes = new Map<string, number>();
  const entryTableRowChangeIndexes = new Map<string, number>();
  const entryTargetSides = new Map<string, "left" | "right" | "both">();
  const fallbackReasons = entries.flatMap(fallbackReasonsForEntry);
  const inlineDiagnostics = inlineDiagnosticsForEntries(
    entries,
    fallbackReasons,
  );

  for (const entry of entries) {
    const targetBlock = presentationEntryBlocks(entry).find(
      (candidate) => targetSideForBlock(candidate) !== null,
    );
    if (!targetBlock) {
      continue;
    }
    const targetSide = targetSideForBlock(targetBlock);
    if (!targetSide) {
      continue;
    }

    const childTargets =
      entry.kind === "block" ? childNavigationTargetsForBlock(targetBlock) : [];
    if (childTargets.length > 0) {
      for (const childTarget of childTargets) {
        const childChange =
          targetBlock.childChanges?.[childTarget.childChangeIndex];
        const target = childChange
          ? listItemTargetSideAndIndex(childChange, childTarget.side)
          : null;
        if (!target) {
          continue;
        }
        const targetIndex = navigationTargets.length;
        navigationTargets.push({
          index: targetIndex,
          entryId: entry.id,
          side: childTarget.side,
          primarySide: childTarget.side,
          targetKind: "list-item",
          block: targetBlock,
          childChangeIndex: childTarget.childChangeIndex,
          itemIndex: childTarget.itemIndex,
        });
        entryChildChangeIndexes.set(
          listItemTargetKey(entry.id, childTarget.side, target.itemIndex),
          targetIndex,
        );
      }
      continue;
    }

    const structuredTargets =
      entry.kind === "block"
        ? structuredChildNavigationTargetsForBlock(targetBlock)
        : [];
    if (structuredTargets.length > 0) {
      for (const structuredTarget of structuredTargets) {
        const structuredChange =
          targetBlock.structuredChanges?.[
            structuredTarget.structuredChangeIndex
          ];
        const target = structuredChange
          ? structuredChildTargetSideAndIndex(
              structuredChange,
              structuredTarget.side,
            )
          : null;
        if (!target) {
          continue;
        }
        const targetIndex = navigationTargets.length;
        navigationTargets.push({
          index: targetIndex,
          entryId: entry.id,
          side: structuredTarget.side,
          primarySide: structuredTarget.side,
          targetKind: "structured-child",
          block: targetBlock,
          structuredChildIndex: structuredTarget.structuredChildIndex,
          structuredChildRole: structuredChange?.role,
        });
        entryStructuredChildChangeIndexes.set(
          structuredChildTargetKey(
            entry.id,
            structuredTarget.side,
            target.structuredChildIndex,
          ),
          targetIndex,
        );
      }
      continue;
    }

    const tableRowTargets =
      entry.kind === "block"
        ? tableRowNavigationTargetsForBlock(targetBlock)
        : [];
    if (tableRowTargets.length > 0) {
      for (const rowTarget of tableRowTargets) {
        const tableChange = targetBlock.tableChanges?.find((candidate) => {
          const target = tableRowTargetSideAndIndex(candidate, rowTarget.side);
          return target?.rowIndex === rowTarget.tableRowIndex;
        });
        const target = tableChange
          ? tableRowTargetSideAndIndex(tableChange, rowTarget.side)
          : null;
        if (!target) {
          continue;
        }
        const targetIndex = navigationTargets.length;
        navigationTargets.push({
          index: targetIndex,
          entryId: entry.id,
          side: rowTarget.side,
          primarySide: rowTarget.side,
          targetKind: "table-row",
          block: targetBlock,
          tableRowIndex: rowTarget.tableRowIndex,
        });
        entryTableRowChangeIndexes.set(
          tableRowTargetKey(entry.id, rowTarget.side, target.rowIndex),
          targetIndex,
        );
      }
      continue;
    }

    const targetIndex = navigationTargets.length;
    navigationTargets.push({
      index: targetIndex,
      entryId: entry.id,
      side: targetSide,
      primarySide: primarySideForTargetSide(targetSide),
      targetKind: "block",
      block: targetBlock,
    });
    entryChangeIndexes.set(entry.id, targetIndex);
    entryTargetSides.set(entry.id, targetSide);
  }

  return {
    entries,
    navigationTargets,
    sectionOutline: buildSectionOutline(entries, navigationTargets),
    fallbackReasons,
    inlineDiagnostics,
    entryChangeIndexes,
    entryChildChangeIndexes,
    entryStructuredChildChangeIndexes,
    entryTableRowChangeIndexes,
    entryTargetSides,
  };
}

export function renderedDiffListItemChangeIndex(
  presentation: RenderedDiffPresentation,
  entry: RenderedDiffPresentationEntry,
  side: "left" | "right",
  itemIndex: number,
): number | null {
  const exactIndex = presentation.entryChildChangeIndexes.get(
    listItemTargetKey(entry.id, side, itemIndex),
  );
  if (exactIndex !== undefined || entry.kind !== "block") {
    return exactIndex ?? null;
  }
  const childChange = entry.block.childChanges?.find((candidate) =>
    side === "left"
      ? candidate.leftIndex === itemIndex
      : candidate.rightIndex === itemIndex,
  );
  const primaryTarget = childChange
    ? listItemChangeSideAndIndex(childChange)
    : null;
  return primaryTarget
    ? (presentation.entryChildChangeIndexes.get(
        listItemTargetKey(
          entry.id,
          primaryTarget.side,
          primaryTarget.itemIndex,
        ),
      ) ?? null)
    : null;
}

export function renderedDiffTableRowChangeIndex(
  presentation: RenderedDiffPresentation,
  entry: RenderedDiffPresentationEntry,
  side: "left" | "right",
  rowIndex: number,
): number | null {
  const exactIndex = presentation.entryTableRowChangeIndexes.get(
    tableRowTargetKey(entry.id, side, rowIndex),
  );
  if (exactIndex !== undefined || entry.kind !== "block") {
    return exactIndex ?? null;
  }
  const tableChange = entry.block.tableChanges?.find((candidate) =>
    side === "left"
      ? candidate.leftRowIndex === rowIndex
      : candidate.rightRowIndex === rowIndex,
  );
  const primaryTarget = tableChange
    ? tableRowChangeSideAndIndex(tableChange)
    : null;
  return primaryTarget
    ? (presentation.entryTableRowChangeIndexes.get(
        tableRowTargetKey(entry.id, primaryTarget.side, primaryTarget.rowIndex),
      ) ?? null)
    : null;
}

export function renderedDiffStructuredChildChangeIndex(
  presentation: RenderedDiffPresentation,
  entry: RenderedDiffPresentationEntry,
  side: "left" | "right",
  childIndex: number,
): number | null {
  const exactIndex = presentation.entryStructuredChildChangeIndexes.get(
    structuredChildTargetKey(entry.id, side, childIndex),
  );
  if (exactIndex !== undefined || entry.kind !== "block") {
    return exactIndex ?? null;
  }
  const structuredChange = entry.block.structuredChanges?.find((candidate) =>
    side === "left"
      ? candidate.leftIndex === childIndex
      : candidate.rightIndex === childIndex,
  );
  const primaryTarget = structuredChange
    ? structuredChildChangeSideAndIndex(structuredChange)
    : null;
  return primaryTarget
    ? (presentation.entryStructuredChildChangeIndexes.get(
        structuredChildTargetKey(
          entry.id,
          primaryTarget.side,
          primaryTarget.structuredChildIndex,
        ),
      ) ?? null)
    : null;
}

export function renderedDiffContentCursorTargets(
  presentation: RenderedDiffPresentation,
  visibleEntries: RenderedDiffPresentationEntry[] = presentation.entries,
): RenderedDiffContentCursorTarget[] {
  const visibleEntryIds = new Set(visibleEntries.map((entry) => entry.id));
  return presentation.navigationTargets
    .filter((target) => visibleEntryIds.has(target.entryId))
    .map((target) => ({
      entryId: target.entryId,
      side: target.side === "left" ? "left" : "right",
      changeIndex: target.index,
      childChangeIndex: target.childChangeIndex,
      structuredChildIndex: target.structuredChildIndex,
      tableRowIndex: target.tableRowIndex,
    }));
}

export function nextRenderedDiffContentCursorTarget({
  targets,
  activeTarget,
  activeChangeIndex,
  direction,
}: {
  targets: RenderedDiffContentCursorTarget[];
  activeTarget: RenderedDiffContentCursorTarget | null;
  activeChangeIndex: number;
  direction: "next" | "previous";
}): RenderedDiffContentCursorTarget | null {
  if (targets.length === 0) {
    return null;
  }

  const activeIndex = activeTarget
    ? targets.findIndex(
        (target) =>
          target.entryId === activeTarget.entryId &&
          target.side === activeTarget.side &&
          target.childChangeIndex === activeTarget.childChangeIndex &&
          target.tableRowIndex === activeTarget.tableRowIndex,
      )
    : -1;
  if (activeIndex >= 0) {
    const delta = direction === "next" ? 1 : -1;
    return targets[(activeIndex + delta + targets.length) % targets.length];
  }

  const changeIndex = targets.findIndex(
    (target) => target.changeIndex === activeChangeIndex,
  );
  if (changeIndex >= 0) {
    return direction === "next"
      ? targets[changeIndex]
      : targets[(changeIndex - 1 + targets.length) % targets.length];
  }

  return direction === "next" ? targets[0] : targets[targets.length - 1];
}

export function renderedBlockVisualClass(
  block: RenderedBlockDiff,
  side: "left" | "right",
): string {
  const hiddenOnSide =
    (side === "left" && block.kind === "added") ||
    (side === "right" && block.kind === "removed");
  if (hiddenOnSide) {
    return "blank";
  }
  return block.kind;
}
