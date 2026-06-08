import type {
  RenderedListItemChildChange,
  RenderedListItemFallback,
  RenderedListItemSnapshot,
} from "./types";

export interface RenderedListItemChangeResult {
  childChanges: RenderedListItemChildChange[];
  fallback?: RenderedListItemFallback;
}

const changedItemMinimumLength = 6;
const changedItemMinimumOverlap = 0.3;

export function matchRenderedListItemChanges(
  leftItems: readonly RenderedListItemSnapshot[] = [],
  rightItems: readonly RenderedListItemSnapshot[] = [],
): RenderedListItemChangeResult {
  if (leftItems.length === 0 && rightItems.length === 0) {
    return { childChanges: [], fallback: { reason: "no-items" } };
  }
  if (hasEmptyItems(leftItems) || hasEmptyItems(rightItems)) {
    return { childChanges: [], fallback: { reason: "short-or-empty" } };
  }
  if (hasDuplicateHashes(leftItems) || hasDuplicateHashes(rightItems)) {
    return { childChanges: [], fallback: { reason: "ambiguous" } };
  }
  if (hasReorderedCommonItems(leftItems, rightItems)) {
    return { childChanges: [], fallback: { reason: "reorder" } };
  }

  const childChanges: RenderedListItemChildChange[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  let matchedBefore = false;

  while (leftIndex < leftItems.length || rightIndex < rightItems.length) {
    const left = leftItems[leftIndex];
    const right = rightItems[rightIndex];

    if (left && right && sameItem(left, right)) {
      leftIndex += 1;
      rightIndex += 1;
      matchedBefore = true;
      continue;
    }

    if (!left && right) {
      childChanges.push({
        kind: "added",
        side: "right",
        confidence: "high",
        rightIndex: right.index,
      });
      rightIndex += 1;
      continue;
    }

    if (left && !right) {
      childChanges.push({
        kind: "removed",
        side: "left",
        confidence: "high",
        leftIndex: left.index,
      });
      leftIndex += 1;
      continue;
    }

    if (left && right) {
      const nextRightMatch = rightItems
        .slice(rightIndex + 1)
        .findIndex((candidate) => sameItem(left, candidate));
      if (nextRightMatch >= 0) {
        childChanges.push({
          kind: "added",
          side: "right",
          confidence: "high",
          rightIndex: right.index,
        });
        rightIndex += 1;
        continue;
      }

      const nextLeftMatch = leftItems
        .slice(leftIndex + 1)
        .findIndex((candidate) => sameItem(candidate, right));
      if (nextLeftMatch >= 0) {
        childChanges.push({
          kind: "removed",
          side: "left",
          confidence: "high",
          leftIndex: left.index,
        });
        leftIndex += 1;
        continue;
      }

      if (
        !isHighConfidenceChangedItem(left, right) &&
        !isAnchoredReplacement({
          leftItems,
          rightItems,
          leftIndex,
          rightIndex,
          matchedBefore,
        })
      ) {
        return { childChanges: [], fallback: { reason: "low-overlap" } };
      }
      childChanges.push({
        kind: "changed",
        side: "both",
        confidence: "high",
        leftIndex: left.index,
        rightIndex: right.index,
      });
      leftIndex += 1;
      rightIndex += 1;
      matchedBefore = true;
    }
  }

  return { childChanges };
}

function isAnchoredReplacement({
  leftItems,
  rightItems,
  leftIndex,
  rightIndex,
  matchedBefore,
}: {
  leftItems: readonly RenderedListItemSnapshot[];
  rightItems: readonly RenderedListItemSnapshot[];
  leftIndex: number;
  rightIndex: number;
  matchedBefore: boolean;
}): boolean {
  const left = leftItems[leftIndex];
  const right = rightItems[rightIndex];
  if (!left || !right) {
    return false;
  }
  if (
    Math.min(left.textLength, right.textLength) < changedItemMinimumLength
  ) {
    return false;
  }
  return (
    (matchedBefore && isEndPair(leftItems, rightItems, leftIndex, rightIndex)) ||
    hasCommonItemAfter(leftItems, rightItems, leftIndex + 1, rightIndex + 1)
  );
}

function isEndPair(
  leftItems: readonly RenderedListItemSnapshot[],
  rightItems: readonly RenderedListItemSnapshot[],
  leftIndex: number,
  rightIndex: number,
): boolean {
  return leftIndex === leftItems.length - 1 && rightIndex === rightItems.length - 1;
}

function hasCommonItemAfter(
  leftItems: readonly RenderedListItemSnapshot[],
  rightItems: readonly RenderedListItemSnapshot[],
  leftStart: number,
  rightStart: number,
): boolean {
  const rightHashes = new Set(
    rightItems.slice(rightStart).map((item) => item.normalizedTextHash),
  );
  return leftItems
    .slice(leftStart)
    .some((item) => rightHashes.has(item.normalizedTextHash));
}

function hasEmptyItems(items: readonly RenderedListItemSnapshot[]): boolean {
  return items.some((item) => item.textLength === 0);
}

function hasDuplicateHashes(
  items: readonly RenderedListItemSnapshot[],
): boolean {
  const hashes = new Set<string>();
  for (const item of items) {
    if (hashes.has(item.normalizedTextHash)) {
      return true;
    }
    hashes.add(item.normalizedTextHash);
  }
  return false;
}

function hasReorderedCommonItems(
  leftItems: readonly RenderedListItemSnapshot[],
  rightItems: readonly RenderedListItemSnapshot[],
): boolean {
  const rightOrder = new Map(
    rightItems.map((item, index) => [item.normalizedTextHash, index]),
  );
  let previousRightIndex = -1;
  for (const leftItem of leftItems) {
    const rightIndex = rightOrder.get(leftItem.normalizedTextHash);
    if (rightIndex === undefined) {
      continue;
    }
    if (rightIndex < previousRightIndex) {
      return true;
    }
    previousRightIndex = rightIndex;
  }
  return false;
}

function sameItem(
  left: RenderedListItemSnapshot,
  right: RenderedListItemSnapshot,
): boolean {
  return left.normalizedTextHash === right.normalizedTextHash;
}

function isHighConfidenceChangedItem(
  left: RenderedListItemSnapshot,
  right: RenderedListItemSnapshot,
): boolean {
  if (
    left.directTextLength >= changedItemMinimumLength &&
    left.directTextHash === right.directTextHash
  ) {
    return true;
  }
  if (
    left.nestedSignatureHash !== right.nestedSignatureHash &&
    left.directTextHash === right.directTextHash
  ) {
    return true;
  }
  if (
    Math.min(left.textLength, right.textLength) < changedItemMinimumLength
  ) {
    return false;
  }
  return (
    segmentOverlap(left.textSegmentHashes, right.textSegmentHashes) >=
    changedItemMinimumOverlap
  );
}

function segmentOverlap(leftHashes: string[], rightHashes: string[]): number {
  if (leftHashes.length === 0 || rightHashes.length === 0) {
    return 0;
  }
  const rightSet = new Set(rightHashes);
  const shared = new Set(leftHashes.filter((hash) => rightSet.has(hash)));
  const union = new Set([...leftHashes, ...rightHashes]);
  return shared.size / union.size;
}
