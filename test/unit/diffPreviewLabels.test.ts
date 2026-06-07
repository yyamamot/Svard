import { describe, expect, it } from "vitest";

import type { DocumentDiffPreview } from "../../src/core/types";
import {
  overviewStats,
  overviewSummaryItems,
} from "../../src/ui/components/gitDiffPreview/overview";
import { diffPreviewChangeCountLabel } from "../../src/ui/components/gitDiffPreview/useDiffPreviewSummaries";
import {
  hiddenRenderedGroupPlaceholderLabel,
  renderedDiffPresentationEntryMetaLabel,
} from "../../src/ui/components/gitDiffPreview/renderedView";
import type {
  GitRenderedDiffSummary,
  RenderedBlockDiff,
  RenderedDiffPresentation,
  RenderedDiffPresentationEntry,
} from "../../src/ui/lib/gitRenderedDiff";
import type { GitTableDiffSummary } from "../../src/ui/lib/gitTableDiff";

function addedBlock(
  id: string,
  blockKind: RenderedBlockDiff["blockKind"],
): RenderedBlockDiff {
  return {
    id,
    kind: "added",
    blockKind,
    right: {
      id,
      kind: blockKind,
      tagName: blockKind === "heading" ? "h2" : "p",
      text: id,
      html: `<p>${id}</p>`,
    },
  };
}

function removedBlock(
  id: string,
  blockKind: RenderedBlockDiff["blockKind"],
): RenderedBlockDiff {
  return {
    id,
    kind: "removed",
    blockKind,
    left: {
      id,
      kind: blockKind,
      tagName: blockKind === "heading" ? "h2" : "p",
      text: id,
      html: `<p>${id}</p>`,
    },
  };
}

function changedBlock(
  id: string,
  blockKind: RenderedBlockDiff["blockKind"],
  text = id,
): RenderedBlockDiff {
  return {
    id,
    kind: "changed",
    blockKind,
    left: {
      id: `${id}:left`,
      kind: blockKind,
      tagName: blockKind === "heading" ? "h2" : "p",
      text,
      html: `<p>${text}</p>`,
    },
    right: {
      id: `${id}:right`,
      kind: blockKind,
      tagName: blockKind === "heading" ? "h2" : "p",
      text,
      html: `<p>${text}</p>`,
    },
  };
}

const emptyDiffPreview: DocumentDiffPreview = {
  source: "git",
  relativePath: "docs/sample.md",
  status: "modified",
  leftLabel: "HEAD",
  rightLabel: "Working Tree",
  hunks: [],
};

const emptyTableSummary: GitTableDiffSummary = {
  renderedTables: [],
  tableMarkers: [],
};

describe("diff preview labels", () => {
  it("describes heading-led grouped additions as added sections", () => {
    const entry: RenderedDiffPresentationEntry = {
      id: "group:added",
      kind: "group",
      changeKind: "added",
      blocks: [
        addedBlock("heading", "heading"),
        addedBlock("paragraph", "paragraph"),
      ],
    };

    expect(renderedDiffPresentationEntryMetaLabel(entry)).toEqual({
      primary: "Added section",
      detail: "2 blocks",
    });
  });

  it("describes non-heading grouped additions as added content", () => {
    const entry: RenderedDiffPresentationEntry = {
      id: "group:content",
      kind: "group",
      changeKind: "added",
      blocks: [
        addedBlock("paragraph-1", "paragraph"),
        addedBlock("paragraph-2", "paragraph"),
      ],
    };

    expect(renderedDiffPresentationEntryMetaLabel(entry)).toEqual({
      primary: "Added content",
      detail: "2 blocks",
    });
  });

  it("describes removed groups and hidden side placeholders", () => {
    const entry: Extract<RenderedDiffPresentationEntry, { kind: "group" }> = {
      id: "group:removed",
      kind: "group",
      changeKind: "removed",
      blocks: [
        removedBlock("heading", "heading"),
        removedBlock("paragraph", "paragraph"),
      ],
    };

    expect(renderedDiffPresentationEntryMetaLabel(entry)).toEqual({
      primary: "Removed section",
      detail: "2 blocks",
    });
    expect(hiddenRenderedGroupPlaceholderLabel(entry)).toEqual({
      primary: "Removed on left",
      fullLabel: "Removed on left · 2 blocks",
    });
  });

  it("uses view-aware change count labels", () => {
    expect(
      diffPreviewChangeCountLabel({ view: "rendered", changeCount: 1 }),
    ).toBe("1 rendered change");
    expect(
      diffPreviewChangeCountLabel({ view: "preview", changeCount: 2 }),
    ).toBe("2 rendered changes");
    expect(
      diffPreviewChangeCountLabel({ view: "source", changeCount: 13 }),
    ).toBe("13 source changes");
    expect(diffPreviewChangeCountLabel({ view: "table", changeCount: 1 })).toBe(
      "1 table change",
    );
  });

  it("deduplicates overview sections by visible label", () => {
    const heading = changedBlock(
      "heading-change",
      "heading",
      "Repeated Section",
    );
    const paragraph = changedBlock(
      "paragraph-change",
      "paragraph",
      "Updated paragraph",
    );
    const entries: RenderedDiffPresentationEntry[] = [
      { id: "entry:heading", kind: "block", block: heading },
      { id: "entry:paragraph", kind: "block", block: paragraph },
    ];
    const renderedPresentation: RenderedDiffPresentation = {
      entries,
      navigationTargets: [],
      entryChangeIndexes: new Map([
        ["entry:heading", 0],
        ["entry:paragraph", 1],
      ]),
      entryTargetSides: new Map(),
    };
    const renderedSummary: GitRenderedDiffSummary = {
      blocks: [heading, paragraph],
    };

    const overview = overviewStats({
      preview: emptyDiffPreview,
      renderedSummary,
      renderedPresentation,
      tableSummary: emptyTableSummary,
    });

    expect(overview.changedSections).toEqual([
      {
        label: "Repeated Section",
        changeIndex: 0,
        changeCount: 2,
      },
    ]);
  });

  it("omits zero-valued overview summary items", () => {
    const items = overviewSummaryItems({
      added: 0,
      removed: 0,
      changed: 2,
      changedSections: [],
      changedTables: 1,
      changedDiagrams: 0,
      fallbackReasons: [],
    });

    expect(items).toEqual([
      { label: "Changed blocks", value: 2 },
      { label: "Tables", value: 1 },
    ]);
  });
});
