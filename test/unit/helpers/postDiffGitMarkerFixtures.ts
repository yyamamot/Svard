import type { DocumentDiffPreview } from "../../../src/core/types";
import type {
  RenderedBlockDiff,
  RenderedDiffPresentation,
} from "../../../src/ui/lib/gitRenderedDiff";

export const activePath = "/workspace/docs/current.md";

export function block(
  id: string,
  kind: RenderedBlockDiff["kind"],
): RenderedBlockDiff {
  return {
    id,
    kind,
    blockKind: "paragraph",
    left:
      kind === "added"
        ? undefined
        : {
            id,
            kind: "paragraph",
            tagName: "p",
            text: `left ${id}`,
            html: `<p>left ${id}</p>`,
          },
    right:
      kind === "removed"
        ? undefined
        : {
            id,
            kind: "paragraph",
            tagName: "p",
            text: `right ${id}`,
            html: `<p>right ${id}</p>`,
          },
  };
}

export function listBlock(
  id: string,
  overrides: Partial<RenderedBlockDiff> = {},
): RenderedBlockDiff {
  return {
    id,
    kind: "changed",
    blockKind: "list",
    left: {
      id,
      kind: "list",
      tagName: "ul",
      text: "Stable item Status Draft Later",
      html: "<ul><li>Stable item</li><li>Status: Draft / Later.</li></ul>",
    },
    right: {
      id,
      kind: "list",
      tagName: "ul",
      text: "Stable item Status Draft Paused",
      html: "<ul><li>Stable item</li><li>Status: Draft / Paused.</li></ul>",
    },
    childChanges: [
      {
        kind: "changed",
        side: "both",
        confidence: "high",
        leftIndex: 1,
        rightIndex: 1,
      },
    ],
    ...overrides,
  };
}

export function tableBlock(
  id: string,
  overrides: Partial<RenderedBlockDiff> = {},
): RenderedBlockDiff {
  return {
    id,
    kind: "changed",
    blockKind: "table",
    left: {
      id,
      kind: "table",
      tagName: "table",
      text: "Name Status Feature Status Draft review",
      html: "<table><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Draft review</td></tr></tbody></table>",
      tableRows: [
        {
          index: 0,
          normalizedTextHash: "left-header",
          cellCount: 2,
          cells: [
            {
              index: 0,
              normalizedTextHash: "name",
              textSegmentHashes: ["name"],
              textLength: 4,
              header: true,
            },
            {
              index: 1,
              normalizedTextHash: "status",
              textSegmentHashes: ["status"],
              textLength: 6,
              header: true,
            },
          ],
        },
        {
          index: 1,
          normalizedTextHash: "left-feature",
          cellCount: 2,
          cells: [
            {
              index: 0,
              normalizedTextHash: "feature",
              textSegmentHashes: ["feature"],
              textLength: 7,
              header: false,
            },
            {
              index: 1,
              normalizedTextHash: "draft",
              textSegmentHashes: ["draft"],
              textLength: 19,
              header: false,
            },
          ],
        },
      ],
    },
    right: {
      id,
      kind: "table",
      tagName: "table",
      text: "Name Status Feature Status Done review",
      html: "<table><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Done review</td></tr></tbody></table>",
      tableRows: [
        {
          index: 0,
          normalizedTextHash: "right-header",
          cellCount: 2,
          cells: [
            {
              index: 0,
              normalizedTextHash: "name",
              textSegmentHashes: ["name"],
              textLength: 4,
              header: true,
            },
            {
              index: 1,
              normalizedTextHash: "status",
              textSegmentHashes: ["status"],
              textLength: 6,
              header: true,
            },
          ],
        },
        {
          index: 1,
          normalizedTextHash: "right-feature",
          cellCount: 2,
          cells: [
            {
              index: 0,
              normalizedTextHash: "feature",
              textSegmentHashes: ["feature"],
              textLength: 7,
              header: false,
            },
            {
              index: 1,
              normalizedTextHash: "done",
              textSegmentHashes: ["done"],
              textLength: 18,
              header: false,
            },
          ],
        },
      ],
    },
    tableChanges: [
      {
        kind: "changed",
        side: "both",
        confidence: "high",
        leftRowIndex: 1,
        rightRowIndex: 1,
        leftCellIndex: 1,
        rightCellIndex: 1,
      },
    ],
    ...overrides,
  };
}

export function presentation(
  blocks: RenderedBlockDiff[],
): RenderedDiffPresentation {
  return {
    entries: blocks.map((item, index) => ({
      id: `entry:${index}`,
      kind: "block",
      block: item,
    })),
    navigationTargets: blocks
      .filter((item) => item.kind !== "unchanged")
      .map((item, index) => ({
        index,
        entryId: `entry:${blocks.indexOf(item)}`,
        side:
          item.kind === "changed"
            ? "both"
            : item.kind === "added"
              ? "right"
              : "left",
        primarySide: item.kind === "removed" ? "left" : "right",
        targetKind: "block" as const,
        block: item,
      })),
    sectionOutline: [],
    fallbackReasons: [],
    inlineDiagnostics: [],
    entryChangeIndexes: new Map(),
    entryChildChangeIndexes: new Map(),
    entryStructuredChildChangeIndexes: new Map(),
    entryTableRowChangeIndexes: new Map(),
    entryTargetSides: new Map(),
  };
}

export function preview(
  overrides: Partial<DocumentDiffPreview> = {},
): DocumentDiffPreview {
  return {
    source: "git",
    repositoryRoot: "/workspace",
    relativePath: "docs/current.md",
    leftPath: activePath,
    rightPath: activePath,
    status: "modified",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    hunks: [
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [],
      },
    ],
    ...overrides,
  };
}
