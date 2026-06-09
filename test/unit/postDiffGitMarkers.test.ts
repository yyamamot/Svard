import { describe, expect, it } from "vitest";

import type { DocumentDiffPreview } from "../../src/core/types";
import {
  buildPostDiffGitMarkerContext,
  postDiffGitMarkerBudget,
} from "../../src/ui/lib/gitRenderedDiff";
import type {
  RenderedBlockDiff,
  RenderedDiffPresentation,
} from "../../src/ui/lib/gitRenderedDiff";

const activePath = "/workspace/docs/current.md";

function block(
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

function listBlock(
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

function tableBlock(
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
      html: '<table><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Draft review</td></tr></tbody></table>',
    },
    right: {
      id,
      kind: "table",
      tagName: "table",
      text: "Name Status Feature Status Done review",
      html: '<table><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Done review</td></tr></tbody></table>',
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

function presentation(blocks: RenderedBlockDiff[]): RenderedDiffPresentation {
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
    entryChangeIndexes: new Map(),
    entryChildChangeIndexes: new Map(),
    entryTableRowChangeIndexes: new Map(),
    entryTargetSides: new Map(),
  };
}

function preview(
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

describe("post-diff git markers", () => {
  it("ignores previews that do not target the active document", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: "/workspace/docs/other.md",
      preview: preview(),
      renderedPresentation: presentation([block("rendered-block:0", "changed")]),
    });

    expect(context).toBeNull();
  });

  it("builds markers for the active working tree side", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        block("rendered-block:0", "changed"),
        block("rendered-block:1", "added"),
      ]),
    });

    expect(context).toMatchObject({
      totalCount: 2,
      renderedCount: 2,
      markers: [
        { kind: "changed", anchorBlockId: "rendered-block:0" },
        { kind: "added", anchorBlockId: "rendered-block:1" },
      ],
    });
    expect(context?.markers[0]?.inlineDiffRanges).toEqual([
      expect.objectContaining({ kind: "added" }),
    ]);
    expect(context?.markers[0]?.inlineDiffRanges?.[0]?.end).toBeGreaterThan(
      context?.markers[0]?.inlineDiffRanges?.[0]?.start ?? 0,
    );
  });

  it("matches Git previews that only carry a relative path", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview({
        leftPath: null,
        rightPath: null,
        relativePath: "docs/current.md",
      }),
      renderedPresentation: presentation([block("rendered-block:0", "changed")]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "changed",
        anchorBlockId: "rendered-block:0",
      }),
    ]);
  });

  it("does not use relative path fallback for file-to-file previews", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview({
        source: "file",
        leftPath: "/workspace/docs/base.md",
        rightPath: "/workspace/docs/other.md",
        relativePath: "docs/current.md",
      }),
      renderedPresentation: presentation([block("rendered-block:0", "changed")]),
    });

    expect(context).toBeNull();
  });

  it("uses the matching side for file-to-file previews", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: "/workspace/docs/base.md",
      preview: preview({
        source: "file",
        leftPath: "/workspace/docs/base.md",
        rightPath: activePath,
      }),
      renderedPresentation: presentation([
        block("rendered-block:0", "removed"),
        block("rendered-block:1", "added"),
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "removed",
        anchorBlockId: "rendered-block:0",
      }),
    ]);
  });

  it("keeps removed inline ranges for the active left side", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: "/workspace/docs/base.md",
      preview: preview({
        source: "file",
        leftPath: "/workspace/docs/base.md",
        rightPath: activePath,
      }),
      renderedPresentation: presentation([
        {
          ...block("rendered-block:0", "changed"),
          left: {
            id: "rendered-block:0",
            kind: "paragraph",
            tagName: "p",
            text: "left removed token",
            html: "<p>left removed token</p>",
          },
          right: {
            id: "rendered-block:0",
            kind: "paragraph",
            tagName: "p",
            text: "left token",
            html: "<p>left token</p>",
          },
        },
      ]),
    });

    expect(context?.markers[0]?.inlineDiffRanges).toEqual([
      expect.objectContaining({ kind: "removed" }),
    ]);
    expect(context?.markers[0]?.inlineDiffRanges?.[0]?.end).toBeGreaterThan(
      context?.markers[0]?.inlineDiffRanges?.[0]?.start ?? 0,
    );
  });

  it("does not build markers for clean working tree previews", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview({
        status: "clean",
        hunks: [],
      }),
      renderedPresentation: presentation([block("rendered-block:0", "changed")]),
    });

    expect(context).toBeNull();
  });

  it("does not build marker context when rendered changes have no visible markers", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([block("rendered-block:0", "unchanged")]),
    });

    expect(context).toBeNull();
  });

  it("builds markers for every block in grouped added sections", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        block("rendered-block:0", "unchanged"),
        {
          ...block("rendered-block:1", "added"),
          blockKind: "heading",
        },
        {
          ...block("rendered-block:2", "added"),
          blockKind: "list",
        },
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "added",
        anchorBlockId: "rendered-block:1",
      }),
      expect.objectContaining({
        kind: "added",
        anchorBlockId: "rendered-block:2",
      }),
    ]);
  });

  it("builds item markers for changed list items without parent block markers", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([listBlock("rendered-block:0")]),
    });

    expect(context).toMatchObject({
      totalCount: 1,
      renderedCount: 1,
      markers: [
        {
          kind: "changed",
          anchorBlockId: "rendered-block:0",
          anchorItemIndex: 1,
          targetKind: "list-item",
        },
      ],
    });
    expect(context?.markers[0]?.inlineDiffRanges).toEqual([
      expect.objectContaining({ kind: "added" }),
    ]);
  });

  it("builds item markers for added list items on the current side", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        listBlock("rendered-block:0", {
          left: {
            id: "rendered-block:0",
            kind: "list",
            tagName: "ul",
            text: "Stable item",
            html: "<ul><li>Stable item</li></ul>",
          },
          right: {
            id: "rendered-block:0",
            kind: "list",
            tagName: "ul",
            text: "Stable item Added item",
            html: "<ul><li>Stable item</li><li>Added item</li></ul>",
          },
          childChanges: [
            {
              kind: "added",
              side: "right",
              confidence: "high",
              rightIndex: 1,
            },
          ],
        }),
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "added",
        anchorBlockId: "rendered-block:0",
        anchorItemIndex: 1,
        targetKind: "list-item",
      }),
    ]);
  });

  it("builds item markers for removed list items on the active left side", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: "/workspace/docs/base.md",
      preview: preview({
        source: "file",
        leftPath: "/workspace/docs/base.md",
        rightPath: activePath,
      }),
      renderedPresentation: presentation([
        listBlock("rendered-block:0", {
          childChanges: [
            {
              kind: "removed",
              side: "left",
              confidence: "high",
              leftIndex: 1,
            },
          ],
        }),
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "removed",
        anchorBlockId: "rendered-block:0",
        anchorItemIndex: 1,
        targetKind: "list-item",
      }),
    ]);
  });

  it("falls back without highlighting when a removed list item is hidden on the active side", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        listBlock("rendered-block:0", {
          childChanges: [
            {
              kind: "removed",
              side: "left",
              confidence: "high",
              leftIndex: 1,
            },
          ],
        }),
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "removed",
        anchorBlockId: "rendered-block:0",
        highlightBlock: false,
        targetKind: "block",
      }),
    ]);
    expect(context?.markers[0]?.anchorItemIndex).toBeUndefined();
  });

  it("keeps low-confidence list changes as block-level markers", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        listBlock("rendered-block:0", {
          childChanges: undefined,
          childChangeFallback: { reason: "reorder" },
        }),
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "changed",
        anchorBlockId: "rendered-block:0",
        targetKind: "block",
      }),
    ]);
    expect(context?.markers[0]?.anchorItemIndex).toBeUndefined();
  });

  it("builds table row markers for changed table cells without parent block markers", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([tableBlock("rendered-block:0")]),
    });

    expect(context).toMatchObject({
      totalCount: 1,
      renderedCount: 1,
      markers: [
        {
          kind: "changed",
          anchorBlockId: "rendered-block:0",
          anchorTableRowIndex: 1,
          targetKind: "table-row",
          tableCellHighlights: [
            {
              cellIndex: 1,
              kind: "changed",
            },
          ],
        },
      ],
    });
    expect(context?.markers[0]?.inlineDiffRanges).toBeUndefined();
    expect(context?.markers[0]?.tableCellHighlights?.[0]?.inlineDiffRanges).toEqual([
      expect.objectContaining({ kind: "added" }),
    ]);
  });

  it("groups multiple changed table cells in the same row into one marker", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        tableBlock("rendered-block:0", {
          left: {
            id: "rendered-block:0",
            kind: "table",
            tagName: "table",
            text: "A B C D",
            html: "<table><tbody><tr><td>Alpha before</td><td>Beta before</td></tr></tbody></table>",
          },
          right: {
            id: "rendered-block:0",
            kind: "table",
            tagName: "table",
            text: "A B C D",
            html: "<table><tbody><tr><td>Alpha after</td><td>Beta after</td></tr></tbody></table>",
          },
          tableChanges: [
            {
              kind: "changed",
              side: "both",
              confidence: "high",
              leftRowIndex: 0,
              rightRowIndex: 0,
              leftCellIndex: 0,
              rightCellIndex: 0,
            },
            {
              kind: "changed",
              side: "both",
              confidence: "high",
              leftRowIndex: 0,
              rightRowIndex: 0,
              leftCellIndex: 1,
              rightCellIndex: 1,
            },
          ],
        }),
      ]),
    });

    expect(context?.markers).toHaveLength(1);
    expect(context?.markers[0]).toMatchObject({
      anchorTableRowIndex: 0,
      targetKind: "table-row",
      tableCellHighlights: [
        expect.objectContaining({ cellIndex: 0 }),
        expect.objectContaining({ cellIndex: 1 }),
      ],
    });
  });

  it("falls back without highlighting when a removed table row is hidden on the active side", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        tableBlock("rendered-block:0", {
          tableChanges: [
            {
              kind: "removed",
              side: "left",
              confidence: "high",
              leftRowIndex: 1,
              leftCellIndex: 1,
            },
          ],
        }),
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "removed",
        anchorBlockId: "rendered-block:0",
        highlightBlock: false,
        targetKind: "block",
      }),
    ]);
    expect(context?.markers[0]?.anchorTableRowIndex).toBeUndefined();
  });

  it("builds table row markers for added rows on the current side", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        tableBlock("rendered-block:0", {
          tableChanges: [
            {
              kind: "added",
              side: "right",
              confidence: "high",
              rightRowIndex: 2,
              rightCellIndex: 0,
            },
            {
              kind: "added",
              side: "right",
              confidence: "high",
              rightRowIndex: 2,
              rightCellIndex: 1,
            },
          ],
        }),
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "added",
        anchorTableRowIndex: 2,
        targetKind: "table-row",
        tableCellHighlights: [
          expect.objectContaining({ cellIndex: 0, kind: "added" }),
          expect.objectContaining({ cellIndex: 1, kind: "added" }),
        ],
      }),
    ]);
  });

  it("builds table row markers for removed rows on the active left side", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: "/workspace/docs/base.md",
      preview: preview({
        source: "file",
        leftPath: "/workspace/docs/base.md",
        rightPath: activePath,
      }),
      renderedPresentation: presentation([
        tableBlock("rendered-block:0", {
          tableChanges: [
            {
              kind: "removed",
              side: "left",
              confidence: "high",
              leftRowIndex: 1,
              leftCellIndex: 0,
            },
          ],
        }),
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "removed",
        anchorTableRowIndex: 1,
        targetKind: "table-row",
        tableCellHighlights: [
          expect.objectContaining({ cellIndex: 0, kind: "removed" }),
        ],
      }),
    ]);
  });

  it("keeps low-confidence table changes as block-level markers", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        tableBlock("rendered-block:0", {
          tableChanges: undefined,
          tableChangeFallback: { reason: "complex" },
        }),
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "changed",
        anchorBlockId: "rendered-block:0",
        targetKind: "block",
      }),
    ]);
    expect(context?.markers[0]?.anchorTableRowIndex).toBeUndefined();
  });

  it("keeps table marker context privacy-safe", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([tableBlock("rendered-block:0")]),
    });
    const serialized = JSON.stringify(context);

    expect(serialized).not.toContain("Status Draft review");
    expect(serialized).not.toContain("Status Done review");
    expect(serialized).not.toContain("@@");
    expect(serialized).not.toContain(activePath);
  });

  it("caps markers after expanding list item markers", () => {
    const childChanges = Array.from(
      { length: postDiffGitMarkerBudget + 5 },
      (_, index) => ({
        kind: "added" as const,
        side: "right" as const,
        confidence: "high" as const,
        rightIndex: index,
      }),
    );
    const rightItems = childChanges
      .map((_, index) => `<li>Added item ${index}</li>`)
      .join("");
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        listBlock("rendered-block:0", {
          right: {
            id: "rendered-block:0",
            kind: "list",
            tagName: "ul",
            text: "Added items",
            html: `<ul>${rightItems}</ul>`,
          },
          childChanges,
        }),
      ]),
    });

    expect(context?.totalCount).toBe(postDiffGitMarkerBudget + 5);
    expect(context?.renderedCount).toBe(postDiffGitMarkerBudget);
    expect(context?.markers).toHaveLength(postDiffGitMarkerBudget);
    expect(context?.markers[0]).toMatchObject({
      anchorItemIndex: 0,
      targetKind: "list-item",
    });
  });

  it("caps markers after expanding table row markers", () => {
    const tableChanges = Array.from(
      { length: postDiffGitMarkerBudget + 5 },
      (_, index) => ({
        kind: "added" as const,
        side: "right" as const,
        confidence: "high" as const,
        rightRowIndex: index,
        rightCellIndex: 0,
      }),
    );
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        tableBlock("rendered-block:0", { tableChanges }),
      ]),
    });

    expect(context?.totalCount).toBe(postDiffGitMarkerBudget + 5);
    expect(context?.renderedCount).toBe(postDiffGitMarkerBudget);
    expect(context?.markers).toHaveLength(postDiffGitMarkerBudget);
    expect(context?.markers[0]).toMatchObject({
      anchorTableRowIndex: 0,
      targetKind: "table-row",
    });
  });

  it("keeps list item marker context privacy-safe", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([listBlock("rendered-block:0")]),
    });
    const serialized = JSON.stringify(context);

    expect(serialized).not.toContain("Status: Draft / Later");
    expect(serialized).not.toContain("Status: Draft / Paused");
    expect(serialized).not.toContain("@@");
    expect(serialized).not.toContain(activePath);
  });

  it("anchors deletion-only working tree markers to the nearest following current block", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        block("removed-source-block", "removed"),
        block("rendered-block:1", "unchanged"),
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "removed",
        anchorBlockId: "rendered-block:1",
        highlightBlock: false,
      }),
    ]);
  });

  it("caps rendered markers at the marker budget", () => {
    const blocks = Array.from({ length: postDiffGitMarkerBudget + 5 }, (_, index) =>
      block(`rendered-block:${index}`, "changed"),
    );
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation(blocks),
    });

    expect(context?.totalCount).toBe(postDiffGitMarkerBudget + 5);
    expect(context?.renderedCount).toBe(postDiffGitMarkerBudget);
    expect(context?.markers).toHaveLength(postDiffGitMarkerBudget);
  });
});
