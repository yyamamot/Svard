import type {
  RenderedStructuredChildChange,
  RenderedStructuredChildSnapshot,
  RenderedStructuredFallback,
} from "./types";

export interface RenderedStructuredChangeResult {
  structuredChanges: RenderedStructuredChildChange[];
  fallback?: RenderedStructuredFallback;
}

const changedStructuredMinimumLength = 6;
const changedStructuredMinimumOverlap = 0.3;

export function matchRenderedStructuredChanges(
  leftChildren: readonly RenderedStructuredChildSnapshot[] = [],
  rightChildren: readonly RenderedStructuredChildSnapshot[] = [],
): RenderedStructuredChangeResult {
  if (leftChildren.length === 0 && rightChildren.length === 0) {
    return { structuredChanges: [], fallback: { reason: "no-children" } };
  }
  if (
    hasShortOrEmptyChildren(leftChildren) ||
    hasShortOrEmptyChildren(rightChildren)
  ) {
    return { structuredChanges: [], fallback: { reason: "short-or-empty" } };
  }
  if (!sameRoleSet(leftChildren, rightChildren)) {
    return { structuredChanges: [], fallback: { reason: "role-mismatch" } };
  }
  if (
    hasDuplicatePrimaryHashes(leftChildren) ||
    hasDuplicatePrimaryHashes(rightChildren)
  ) {
    return { structuredChanges: [], fallback: { reason: "ambiguous" } };
  }
  if (hasReorderedCommonChildren(leftChildren, rightChildren)) {
    return { structuredChanges: [], fallback: { reason: "reorder" } };
  }

  const structuredChanges: RenderedStructuredChildChange[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  let matchedBefore = false;

  while (leftIndex < leftChildren.length || rightIndex < rightChildren.length) {
    const left = leftChildren[leftIndex];
    const right = rightChildren[rightIndex];

    if (left && right && sameChild(left, right)) {
      leftIndex += 1;
      rightIndex += 1;
      matchedBefore = true;
      continue;
    }

    if (!left && right) {
      structuredChanges.push({
        kind: "added",
        side: "right",
        confidence: "high",
        role: right.role,
        rightIndex: right.index,
      });
      rightIndex += 1;
      continue;
    }

    if (left && !right) {
      structuredChanges.push({
        kind: "removed",
        side: "left",
        confidence: "high",
        role: left.role,
        leftIndex: left.index,
      });
      leftIndex += 1;
      continue;
    }

    if (left && right) {
      const nextRightMatch = rightChildren
        .slice(rightIndex + 1)
        .findIndex((candidate) => sameChild(left, candidate));
      if (nextRightMatch >= 0) {
        structuredChanges.push({
          kind: "added",
          side: "right",
          confidence: "high",
          role: right.role,
          rightIndex: right.index,
        });
        rightIndex += 1;
        continue;
      }

      const nextLeftMatch = leftChildren
        .slice(leftIndex + 1)
        .findIndex((candidate) => sameChild(candidate, right));
      if (nextLeftMatch >= 0) {
        structuredChanges.push({
          kind: "removed",
          side: "left",
          confidence: "high",
          role: left.role,
          leftIndex: left.index,
        });
        leftIndex += 1;
        continue;
      }

      if (
        left.role !== right.role ||
        !samePrimary(left, right) ||
        (!isHighConfidenceChangedChild(left, right) &&
          !isAnchoredReplacement({
            leftChildren,
            rightChildren,
            leftIndex,
            rightIndex,
            matchedBefore,
          }))
      ) {
        return { structuredChanges: [], fallback: { reason: "low-overlap" } };
      }
      structuredChanges.push({
        kind: "changed",
        side: "both",
        confidence: "high",
        role: right.role,
        leftIndex: left.index,
        rightIndex: right.index,
      });
      leftIndex += 1;
      rightIndex += 1;
      matchedBefore = true;
    }
  }

  return { structuredChanges };
}

function hasShortOrEmptyChildren(
  children: readonly RenderedStructuredChildSnapshot[],
): boolean {
  return children.some(
    (child) => child.textLength < changedStructuredMinimumLength,
  );
}

function sameRoleSet(
  leftChildren: readonly RenderedStructuredChildSnapshot[],
  rightChildren: readonly RenderedStructuredChildSnapshot[],
): boolean {
  if (leftChildren.length === 0 || rightChildren.length === 0) {
    return true;
  }
  return leftChildren.every((left) =>
    rightChildren.some((right) => right.role === left.role),
  );
}

function hasDuplicatePrimaryHashes(
  children: readonly RenderedStructuredChildSnapshot[],
): boolean {
  const hashes = new Set<string>();
  for (const child of children) {
    const key = `${child.role}:${child.primaryHash}`;
    if (hashes.has(key)) {
      return true;
    }
    hashes.add(key);
  }
  return false;
}

function hasReorderedCommonChildren(
  leftChildren: readonly RenderedStructuredChildSnapshot[],
  rightChildren: readonly RenderedStructuredChildSnapshot[],
): boolean {
  const rightOrder = new Map(
    rightChildren.map((child, index) => [
      `${child.role}:${child.primaryHash}`,
      index,
    ]),
  );
  let previousRightIndex = -1;
  for (const leftChild of leftChildren) {
    const rightIndex = rightOrder.get(
      `${leftChild.role}:${leftChild.primaryHash}`,
    );
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

function samePrimary(
  left: RenderedStructuredChildSnapshot,
  right: RenderedStructuredChildSnapshot,
): boolean {
  return left.role === right.role && left.primaryHash === right.primaryHash;
}

function sameChild(
  left: RenderedStructuredChildSnapshot,
  right: RenderedStructuredChildSnapshot,
): boolean {
  return (
    samePrimary(left, right) &&
    left.normalizedTextHash === right.normalizedTextHash
  );
}

function isAnchoredReplacement({
  leftChildren,
  rightChildren,
  leftIndex,
  rightIndex,
  matchedBefore,
}: {
  leftChildren: readonly RenderedStructuredChildSnapshot[];
  rightChildren: readonly RenderedStructuredChildSnapshot[];
  leftIndex: number;
  rightIndex: number;
  matchedBefore: boolean;
}): boolean {
  const left = leftChildren[leftIndex];
  const right = rightChildren[rightIndex];
  if (!left || !right || !samePrimary(left, right)) {
    return false;
  }
  return (
    (matchedBefore &&
      leftIndex === leftChildren.length - 1 &&
      rightIndex === rightChildren.length - 1) ||
    hasCommonChildAfter(
      leftChildren,
      rightChildren,
      leftIndex + 1,
      rightIndex + 1,
    )
  );
}

function hasCommonChildAfter(
  leftChildren: readonly RenderedStructuredChildSnapshot[],
  rightChildren: readonly RenderedStructuredChildSnapshot[],
  leftStart: number,
  rightStart: number,
): boolean {
  const rightKeys = new Set(
    rightChildren
      .slice(rightStart)
      .map((child) => `${child.role}:${child.primaryHash}`),
  );
  return leftChildren
    .slice(leftStart)
    .some((child) => rightKeys.has(`${child.role}:${child.primaryHash}`));
}

function isHighConfidenceChangedChild(
  left: RenderedStructuredChildSnapshot,
  right: RenderedStructuredChildSnapshot,
): boolean {
  if (
    Math.min(left.textLength, right.textLength) < changedStructuredMinimumLength
  ) {
    return false;
  }
  return (
    segmentOverlap(left.textSegmentHashes, right.textSegmentHashes) >=
    changedStructuredMinimumOverlap
  );
}

function segmentOverlap(left: readonly string[], right: readonly string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const rightSet = new Set(right);
  const shared = new Set(left.filter((item) => rightSet.has(item)));
  const union = new Set([...left, ...right]);
  return shared.size / union.size;
}
