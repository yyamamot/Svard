import type { RenderedBlock, RenderedBlockDiff } from "./types";
import { matchRenderedListItemChanges } from "./listItemChanges";
import { matchRenderedStructuredChanges } from "./structuredChanges";
import { matchRenderedTableChanges } from "./tableChanges";
import { normalizedText, renderedTextOverlap } from "./text";

export function compareRenderedBlocks(
  leftBlocks: RenderedBlock[] = [],
  rightBlocks: RenderedBlock[] = [],
): RenderedBlockDiff[] {
  const matches = alignRenderedBlocksByAnchors(leftBlocks, rightBlocks);
  const blocks: RenderedBlockDiff[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  for (const match of matches) {
    blocks.push(
      ...pairChangedBlocksInGap(
        leftBlocks.slice(leftIndex, match.leftIndex),
        rightBlocks.slice(rightIndex, match.rightIndex),
      ),
    );
    const left = leftBlocks[match.leftIndex];
    const right = rightBlocks[match.rightIndex];
    const stableUnchangedMatch =
      left && right ? stableRenderedBlocksEqual(left, right) : false;
    blocks.push(
      withChildChanges({
        id: "",
        kind: stableUnchangedMatch ? "unchanged" : "changed",
        blockKind: right?.kind ?? "paragraph",
        left,
        right,
      }),
    );
    leftIndex = match.leftIndex + 1;
    rightIndex = match.rightIndex + 1;
  }

  blocks.push(
    ...pairChangedBlocksInGap(
      leftBlocks.slice(leftIndex),
      rightBlocks.slice(rightIndex),
    ),
  );

  return blocks.map((block, index) => ({
    ...block,
    id: `rendered-diff:${index}`,
  }));
}

function renderedBlocksEqual(
  left: RenderedBlock,
  right: RenderedBlock,
): boolean {
  if (left.kind === "diagram" && right.kind === "diagram") {
    return Boolean(left.signature && left.signature === right.signature);
  }
  if (
    left.kind === "image" &&
    right.kind === "image" &&
    left.signature &&
    right.signature &&
    left.signature !== right.signature
  ) {
    return false;
  }
  return (
    left.kind === right.kind &&
    left.tagName === right.tagName &&
    left.text === right.text &&
    renderedHtmlForComparison(left.html) ===
      renderedHtmlForComparison(right.html)
  );
}

function renderedHtmlForComparison(html: string): string {
  // Source metadata is used by location and clipboard actions after the diff is
  // rendered. Its generated IDs and line ranges can legitimately shift when a
  // preceding block is inserted, so it must not affect visual diff equality.
  return html.replace(/\sdata-source-[\w-]+(?:="[^"]*")?/gu, "");
}

function stableRenderedBlockSignature(block: RenderedBlock): string | null {
  if (block.kind === "diagram" || block.kind === "image") {
    return null;
  }
  const text = normalizedText(block.text);
  if (!text) {
    return null;
  }
  return `${block.kind}:${text}`;
}

function stableRenderedBlocksEqual(
  left: RenderedBlock,
  right: RenderedBlock,
): boolean {
  if (renderedBlocksEqual(left, right)) {
    return true;
  }
  if (left.kind !== right.kind || left.tagName !== right.tagName) {
    return false;
  }
  if (
    left.kind !== "heading" &&
    left.kind !== "source-block" &&
    left.kind !== "table"
  ) {
    return false;
  }
  const leftSignature = stableRenderedBlockSignature(left);
  const rightSignature = stableRenderedBlockSignature(right);
  return Boolean(leftSignature && leftSignature === rightSignature);
}

function renderedAnchorScore(left: RenderedBlock, right: RenderedBlock) {
  if (renderedBlocksEqual(left, right)) {
    return 3;
  }
  const leftSignature = stableRenderedBlockSignature(left);
  const rightSignature = stableRenderedBlockSignature(right);
  if (leftSignature && leftSignature === rightSignature) {
    return 1;
  }
  return 0;
}

export function alignRenderedBlocksByAnchors(
  leftBlocks: RenderedBlock[],
  rightBlocks: RenderedBlock[],
): Array<{ leftIndex: number; rightIndex: number }> {
  const rows = leftBlocks.length + 1;
  const columns = rightBlocks.length + 1;
  const scores = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => 0),
  );

  for (let leftIndex = leftBlocks.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (
      let rightIndex = rightBlocks.length - 1;
      rightIndex >= 0;
      rightIndex -= 1
    ) {
      const anchorScore = renderedAnchorScore(
        leftBlocks[leftIndex],
        rightBlocks[rightIndex],
      );
      scores[leftIndex][rightIndex] =
        anchorScore > 0
          ? scores[leftIndex + 1][rightIndex + 1] + anchorScore
          : Math.max(
              scores[leftIndex + 1][rightIndex],
              scores[leftIndex][rightIndex + 1],
            );
    }
  }

  const matches: Array<{ leftIndex: number; rightIndex: number }> = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < leftBlocks.length && rightIndex < rightBlocks.length) {
    const anchorScore = renderedAnchorScore(
      leftBlocks[leftIndex],
      rightBlocks[rightIndex],
    );
    const diagonalScore = scores[leftIndex + 1][rightIndex + 1] + anchorScore;
    if (
      anchorScore > 0 &&
      scores[leftIndex][rightIndex] === diagonalScore &&
      diagonalScore > scores[leftIndex + 1][rightIndex] &&
      diagonalScore > scores[leftIndex][rightIndex + 1]
    ) {
      matches.push({ leftIndex, rightIndex });
      leftIndex += 1;
      rightIndex += 1;
    } else if (
      scores[leftIndex + 1][rightIndex] >= scores[leftIndex][rightIndex + 1]
    ) {
      leftIndex += 1;
    } else {
      rightIndex += 1;
    }
  }
  return matches;
}

export function pairChangedBlocksInGap(
  leftGap: RenderedBlock[],
  rightGap: RenderedBlock[],
): RenderedBlockDiff[] {
  const blocks: RenderedBlockDiff[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftGap.length || rightIndex < rightGap.length) {
    const left = leftGap[leftIndex];
    const right = rightGap[rightIndex];

    if (left && right && shouldPairChangedBlocks(left, right)) {
      blocks.push(
        withChildChanges({
          id: "",
          kind: stableRenderedBlocksEqual(left, right)
            ? "unchanged"
            : "changed",
          blockKind: right.kind,
          left,
          right,
        }),
      );
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (!left && right) {
      blocks.push({
        id: "",
        kind: "added",
        blockKind: right.kind,
        right,
      });
      rightIndex += 1;
      continue;
    }

    if (left && !right) {
      blocks.push({
        id: "",
        kind: "removed",
        blockKind: left.kind,
        left,
      });
      leftIndex += 1;
      continue;
    }

    if (left && right) {
      const nextRightMatch = rightGap
        .slice(rightIndex + 1)
        .findIndex((candidate) => shouldPairChangedBlocks(left, candidate));
      if (nextRightMatch >= 0) {
        blocks.push({
          id: "",
          kind: "added",
          blockKind: right.kind,
          right,
        });
        rightIndex += 1;
        continue;
      }

      const nextLeftMatch = leftGap
        .slice(leftIndex + 1)
        .findIndex((candidate) => shouldPairChangedBlocks(candidate, right));
      if (nextLeftMatch >= 0) {
        blocks.push({
          id: "",
          kind: "removed",
          blockKind: left.kind,
          left,
        });
        leftIndex += 1;
        continue;
      }

      blocks.push({
        id: "",
        kind: "removed",
        blockKind: left.kind,
        left,
      });
      blocks.push({
        id: "",
        kind: "added",
        blockKind: right.kind,
        right,
      });
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  return blocks;
}

function shouldPairChangedBlocks(
  left: RenderedBlock,
  right: RenderedBlock,
): boolean {
  if (left.kind === "diagram" && right.kind === "diagram") {
    return true;
  }
  if (left.kind !== right.kind || left.tagName !== right.tagName) {
    return false;
  }
  if (left.kind === "admonition" || left.kind === "definition-list") {
    return true;
  }
  if (left.text === right.text) {
    return true;
  }
  return renderedTextOverlap(left.text, right.text) >= 0.2;
}

function withChildChanges(block: RenderedBlockDiff): RenderedBlockDiff {
  const withListChanges = withListItemChildChanges(block);
  const withStructuredChanges = withStructuredChildChanges(withListChanges);
  return withTableCellChanges(withStructuredChanges);
}

function withListItemChildChanges(block: RenderedBlockDiff): RenderedBlockDiff {
  if (
    block.kind !== "changed" ||
    block.blockKind !== "list" ||
    !block.left?.listItems ||
    !block.right?.listItems
  ) {
    return block;
  }
  const result = matchRenderedListItemChanges(
    block.left.listItems,
    block.right.listItems,
  );
  if (result.childChanges.length > 0) {
    return {
      ...block,
      childChanges: result.childChanges,
    };
  }
  if (result.fallback) {
    return {
      ...block,
      childChangeFallback: result.fallback,
    };
  }
  return block;
}

function withStructuredChildChanges(block: RenderedBlockDiff): RenderedBlockDiff {
  if (
    block.kind !== "changed" ||
    (block.blockKind !== "definition-list" && block.blockKind !== "admonition") ||
    !block.left?.structuredChildren ||
    !block.right?.structuredChildren
  ) {
    return block;
  }
  const result = matchRenderedStructuredChanges(
    block.left.structuredChildren,
    block.right.structuredChildren,
  );
  if (result.structuredChanges.length > 0) {
    return {
      ...block,
      structuredChanges: result.structuredChanges,
    };
  }
  if (result.fallback) {
    return {
      ...block,
      structuredChangeFallback: result.fallback,
    };
  }
  return block;
}

function withTableCellChanges(block: RenderedBlockDiff): RenderedBlockDiff {
  if (
    block.kind !== "changed" ||
    block.blockKind !== "table" ||
    !block.left ||
    !block.right
  ) {
    return block;
  }
  const result = matchRenderedTableChanges(
    block.left.tableRows,
    block.right.tableRows,
  );
  if (result.tableChanges.length > 0) {
    return {
      ...block,
      tableChanges: result.tableChanges,
    };
  }
  if (result.fallback) {
    return {
      ...block,
      tableChangeFallback: result.fallback,
    };
  }
  return block;
}
