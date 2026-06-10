import { describe, expect, it } from "vitest";

import type { DocumentDiffPreview } from "../../src/core/types";
import {
  overviewStats,
  overviewSummaryItems,
} from "../../src/ui/components/gitDiffPreview/overview";
import { diffPreviewChangeCountLabel } from "../../src/ui/components/gitDiffPreview/useDiffPreviewSummaries";
import {
  hiddenRenderedGroupPlaceholderLabel,
  renderedDiffFallbackIndicatorLabel,
  renderedDiffPresentationEntryMetaLabel,
} from "../../src/ui/components/gitDiffPreview/renderedView";
import { buildRenderedDiffPresentation } from "../../src/ui/lib/gitRenderedDiff";
import type {
  GitRenderedDiffSummary,
  RenderedBlockDiff,
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

  it("uses navigation target section outline for overview sections", () => {
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
    const renderedPresentation = buildRenderedDiffPresentation([
      heading,
      paragraph,
    ]);
    const renderedSummary: GitRenderedDiffSummary = {
      blocks: [heading, paragraph],
    };

    const overview = overviewStats({
      preview: emptyDiffPreview,
      renderedSummary,
      renderedPresentation,
      tableSummary: emptyTableSummary,
      activeChangeIndex: 1,
    });

    expect(overview.changedSections).toEqual([
      {
        id: renderedPresentation.sectionOutline[0]?.id,
        label: "Repeated Section",
        level: 2,
        firstChangeIndex: 0,
        changeCount: 2,
        active: true,
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

  it("uses privacy-safe fallback indicator labels and overview counts", () => {
    const listFallback = {
      ...changedBlock("secret-list", "list", "Secret list body"),
      childChangeFallback: { reason: "low-overlap" as const },
    };
    const tableFallback = {
      ...changedBlock("secret-table", "table", "Secret table body"),
      tableChangeFallback: { reason: "complex" as const },
    };
    const renderedPresentation = buildRenderedDiffPresentation([
      listFallback,
      tableFallback,
      {
        ...changedBlock("secret-list-two", "list", "Second secret list body"),
        childChangeFallback: { reason: "low-overlap" as const },
      },
    ]);
    const renderedSummary: GitRenderedDiffSummary = {
      blocks: [listFallback, tableFallback],
    };
    const overview = overviewStats({
      preview: emptyDiffPreview,
      renderedSummary,
      renderedPresentation,
      tableSummary: emptyTableSummary,
    });

    expect(
      renderedDiffFallbackIndicatorLabel(
        renderedPresentation.fallbackReasons[0]!,
      ),
    ).toBe("List fallback: low overlap");
    expect(overview.fallbackReasons).toEqual([
      "List fallback: low overlap (2)",
      "Table fallback: complex",
    ]);
    expect(JSON.stringify(overview.fallbackReasons)).not.toContain("Secret");
  });
});
