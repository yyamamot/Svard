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
        side: item.kind === "changed" ? "both" : item.kind === "added" ? "right" : "left",
        block: item,
      })),
    entryChangeIndexes: new Map(),
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
