import type { InlineDiffRange } from "./types";

function wrapTextNodeRange(
  root: HTMLElement,
  node: Text,
  start: number,
  end: number,
  kind: InlineDiffRange["kind"],
): void {
  if (end <= start) {
    return;
  }
  const range = root.ownerDocument.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const marker = root.ownerDocument.createElement("span");
  marker.className = `git-inline-word-highlight ${kind}`;
  if (!node.parentElement?.closest("pre")) {
    marker.setAttribute("data-review-id", "git-diff-word-highlight");
  }
  range.surroundContents(marker);
}

interface NormalizedTextPoint {
  node: Text;
  offset: number;
}

interface NormalizedTextSegment {
  node: Text;
  start: number;
  end: number;
  kind: InlineDiffRange["kind"];
}

export interface InlineDiffHighlightOptions {
  includeSourceBlocks?: boolean;
}

function isInlineDiffTextExcluded(
  element: Element | null,
  options: InlineDiffHighlightOptions = {},
): boolean {
  if (!options.includeSourceBlocks && element?.closest("pre")) {
    return true;
  }
  return Boolean(
    element?.closest(".katex, .math-inline, .math-block, .diagram-inline, svg"),
  );
}

function normalizedTextPoints(
  root: HTMLElement,
  options: InlineDiffHighlightOptions = {},
): NormalizedTextPoint[] {
  const points: NormalizedTextPoint[] = [];
  let previousWasWhitespace = true;
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (isInlineDiffTextExcluded(node.parentElement, options)) {
      node = walker.nextNode() as Text | null;
      continue;
    }
    for (let offset = 0; offset < node.data.length; offset += 1) {
      const char = node.data[offset] ?? "";
      if (/\s/u.test(char)) {
        if (!previousWasWhitespace) {
          points.push({ node, offset });
          previousWasWhitespace = true;
        }
        continue;
      }
      points.push({ node, offset });
      previousWasWhitespace = false;
    }
    node = walker.nextNode() as Text | null;
  }
  return points;
}

export function applyInlineDiffHighlights(
  root: HTMLElement,
  ranges: InlineDiffRange[],
  options: InlineDiffHighlightOptions = {},
): void {
  const points = normalizedTextPoints(root, options);
  const segments: NormalizedTextSegment[] = [];
  for (const range of ranges) {
    const startPoint = points[range.start];
    const endPoint = points[Math.max(range.start, range.end - 1)];
    if (!startPoint || !endPoint) {
      continue;
    }
    const firstIndex = points.indexOf(startPoint);
    const lastIndex = points.indexOf(endPoint);
    let index = firstIndex;
    while (index <= lastIndex) {
      const node = points[index]?.node;
      if (!node) {
        break;
      }
      const start = points[index]?.offset ?? 0;
      let end = start + 1;
      index += 1;
      while (index <= lastIndex && points[index]?.node === node) {
        end = (points[index]?.offset ?? end - 1) + 1;
        index += 1;
      }
      if (!node.data.slice(start, end).trim()) {
        continue;
      }
      segments.push({ node, start, end, kind: range.kind });
    }
  }

  segments
    .sort((left, right) => {
      if (left.node === right.node) {
        return right.start - left.start;
      }
      return 0;
    })
    .forEach((segment) => {
      wrapTextNodeRange(
        root,
        segment.node,
        segment.start,
        segment.end,
        segment.kind,
      );
    });
}
