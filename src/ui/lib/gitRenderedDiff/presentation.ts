import type {
  RenderedBlock,
  RenderedBlockDiff,
  RenderedBlockDiffKind,
  RenderedBlockKind,
  RenderedDiffContentCursorTarget,
  RenderedDiffNavigationTarget,
  RenderedDiffPresentation,
  RenderedDiffPresentationEntry,
} from "./types";
import { normalizedText } from "./text";

function listItemTargetKey(
  entryId: string,
  side: "left" | "right",
  itemIndex: number,
): string {
  return `${entryId}:${side}:${itemIndex}`;
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

function childNavigationTargetsForBlock(
  block: RenderedBlockDiff,
): Array<{ childChangeIndex: number; side: "left" | "right" }> {
  if (block.kind !== "changed" || block.blockKind !== "list") {
    return [];
  }
  return (block.childChanges ?? []).flatMap((childChange, childChangeIndex) => {
    const target = listItemChangeSideAndIndex(childChange);
    return target ? [{ childChangeIndex, side: target.side }] : [];
  });
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
  const entryTargetSides = new Map<string, "left" | "right" | "both">();

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
          block: targetBlock,
          childChangeIndex: childTarget.childChangeIndex,
        });
        entryChildChangeIndexes.set(
          listItemTargetKey(entry.id, childTarget.side, target.itemIndex),
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
      block: targetBlock,
    });
    entryChangeIndexes.set(entry.id, targetIndex);
    entryTargetSides.set(entry.id, targetSide);
  }

  return {
    entries,
    navigationTargets,
    entryChangeIndexes,
    entryChildChangeIndexes,
    entryTargetSides,
  };
}

export function renderedDiffListItemChangeIndex(
  presentation: RenderedDiffPresentation,
  entry: RenderedDiffPresentationEntry,
  side: "left" | "right",
  itemIndex: number,
): number | null {
  return (
    presentation.entryChildChangeIndexes.get(
      listItemTargetKey(entry.id, side, itemIndex),
    ) ?? null
  );
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
          target.childChangeIndex === activeTarget.childChangeIndex,
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
