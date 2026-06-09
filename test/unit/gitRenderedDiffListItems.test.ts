import { describe, expect, it } from "vitest";

import {
  applyRenderedListItemHighlights,
  buildRenderedDiffPresentation,
  compareRenderedBlocks,
  renderedDiffContentCursorTargets,
  renderedDiffListItemChangeIndex,
  renderedListItemHighlightsForSide,
} from "../../src/ui/lib/gitRenderedDiff";
import {
  sanitizeRenderedBlockHtml,
  unwrapSafeHtml,
} from "../../src/ui/lib/sanitizeHtml";
import { blocksFromHtml, parseHtmlBody } from "./helpers/gitRenderedDiffFixtures";

describe("git rendered diff list items", () => {
  it("extracts privacy-safe top-level list item snapshots", () => {
    const [block] = blocksFromHtml(
      `<ul><li>Private item text<ul><li>Nested detail</li></ul></li></ul>`,
    );

    expect(block?.listItems).toEqual([
      expect.objectContaining({
        index: 0,
        textLength: "Private item textNested detail".length,
        directTextLength: "Private item text".length,
      }),
    ]);
    expect(JSON.stringify(block?.listItems)).not.toContain("Private item text");
    expect(JSON.stringify(block?.listItems)).not.toContain("Nested detail");
  });
  it("adds child changes for a high-confidence changed list item", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Later.</li><li>Tail item</li></ul>",
      ),
      blocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Paused.</li><li>Tail item</li></ul>",
      ),
    );

    expect(block).toMatchObject({
      kind: "changed",
      blockKind: "list",
      childChanges: [
        {
          kind: "changed",
          side: "both",
          confidence: "high",
          leftIndex: 1,
          rightIndex: 1,
        },
      ],
    });
    expect(block?.childChangeFallback).toBeUndefined();
  });

  it("adds child changes for added and removed list items on visible sides", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        "<ul><li>Stable item</li><li>Removed item</li><li>Tail item</li></ul>",
      ),
      blocksFromHtml(
        "<ul><li>Stable item</li><li>Tail item</li><li>Added item</li></ul>",
      ),
    );

    expect(block?.childChanges).toEqual([
      {
        kind: "removed",
        side: "left",
        confidence: "high",
        leftIndex: 1,
      },
      {
        kind: "added",
        side: "right",
        confidence: "high",
        rightIndex: 2,
      },
    ]);
  });

  it("treats nested list edits as a parent top-level item change", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        "<ul><li>Parent<ul><li>Nested stable</li></ul></li><li>Tail</li></ul>",
      ),
      blocksFromHtml(
        "<ul><li>Parent<ul><li>Nested changed</li></ul></li><li>Tail</li></ul>",
      ),
    );

    expect(block?.childChanges).toEqual([
      {
        kind: "changed",
        side: "both",
        confidence: "high",
        leftIndex: 0,
        rightIndex: 0,
      },
    ]);
  });

  it("adds child changes for high-overlap Japanese list item text", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        "<ul><li>差分プレビューを改善する</li><li>安定項目</li></ul>",
      ),
      blocksFromHtml(
        "<ul><li>差分表示を改善する</li><li>安定項目</li></ul>",
      ),
    );

    expect(block?.childChanges).toEqual([
      expect.objectContaining({
        kind: "changed",
        side: "both",
        confidence: "high",
        leftIndex: 0,
        rightIndex: 0,
      }),
    ]);
  });

  it("keeps item-level changes for low-overlap list item replacements with stable anchors", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        [
          "<ul>",
          "<li>Read local AsciiDoc and Markdown documents</li>",
          "<li>Compare Git changes against a merge target</li>",
          "<li>Review diagrams with local rendering first</li>",
          "<li>Avoid rewriting source for viewer convenience</li>",
          "</ul>",
        ].join(""),
      ),
      blocksFromHtml(
        [
          "<ul>",
          "<li>Read local AsciiDoc and Markdown documents</li>",
          "<li>Compare Git changes against a merge target</li>",
          "<li>Review changed list items and tables in the preview</li>",
          "<li>Keep Git change markers stable while nearby files update</li>",
          "<li>Avoid rewriting source for viewer convenience</li>",
          "</ul>",
        ].join(""),
      ),
    );

    expect(block?.childChanges).toEqual([
      {
        kind: "changed",
        side: "both",
        confidence: "high",
        leftIndex: 2,
        rightIndex: 2,
      },
      {
        kind: "added",
        side: "right",
        confidence: "high",
        rightIndex: 3,
      },
    ]);
    expect(block?.childChangeFallback).toBeUndefined();
  });

  it("falls back instead of producing low-confidence reordered list item changes", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        "<ul><li>Alpha stable item</li><li>Beta stable item</li></ul>",
      ),
      blocksFromHtml(
        "<ul><li>Beta stable item</li><li>Alpha stable item</li></ul>",
      ),
    );

    expect(block?.childChanges).toBeUndefined();
    expect(block?.childChangeFallback).toEqual({ reason: "reorder" });
  });

  it("keeps child change fallback summaries privacy-safe", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        "<ul><li>Secret Alpha</li><li>Secret Alpha</li></ul>",
      ),
      blocksFromHtml(
        "<ul><li>Secret Alpha</li><li>Secret Beta</li></ul>",
      ),
    );

    const serialized = JSON.stringify({
      childChanges: block?.childChanges,
      fallback: block?.childChangeFallback,
      leftItems: block?.left?.listItems,
      rightItems: block?.right?.listItems,
    });
    expect(serialized).not.toContain("Secret Alpha");
    expect(serialized).not.toContain("Secret Beta");
    expect(block?.childChangeFallback).toEqual({ reason: "ambiguous" });
  });

  it("uses list item child changes as rendered navigation targets", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Later.</li><li>Tail item</li></ul>",
      ),
      blocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Paused.</li><li>Tail item</li></ul>",
      ),
    );
    expect(block).toBeDefined();
    const listBlock = block as NonNullable<typeof block>;
    const presentation = buildRenderedDiffPresentation([listBlock]);
    const entry = presentation.entries[0];

    expect(presentation.navigationTargets).toEqual([
      expect.objectContaining({
        index: 0,
        entryId: entry?.id,
        primarySide: "right",
        side: "right",
        targetKind: "list-item",
        block: listBlock,
        childChangeIndex: 0,
        itemIndex: 1,
      }),
    ]);
    expect(presentation.entryChangeIndexes.get(entry?.id ?? "")).toBeUndefined();
    expect(
      entry
        ? renderedDiffListItemChangeIndex(presentation, entry, "right", 1)
        : null,
    ).toBe(0);
    expect(
      entry
        ? renderedDiffListItemChangeIndex(presentation, entry, "left", 1)
        : null,
    ).toBeNull();
    expect(renderedDiffContentCursorTargets(presentation)).toEqual([
      {
        entryId: entry?.id,
        side: "right",
        changeIndex: 0,
        childChangeIndex: 0,
      },
    ]);
  });

  it("keeps low-confidence list fallback as a block-level navigation target", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        "<ul><li>Alpha stable item</li><li>Beta stable item</li></ul>",
      ),
      blocksFromHtml(
        "<ul><li>Beta stable item</li><li>Alpha stable item</li></ul>",
      ),
    );
    expect(block).toBeDefined();
    const listBlock = block as NonNullable<typeof block>;
    const presentation = buildRenderedDiffPresentation([listBlock]);
    const entry = presentation.entries[0];

    expect(listBlock.childChanges).toBeUndefined();
    expect(listBlock.childChangeFallback).toEqual({ reason: "reorder" });
    expect(presentation.navigationTargets).toEqual([
      expect.objectContaining({
        index: 0,
        entryId: entry?.id,
        primarySide: "right",
        side: "both",
        targetKind: "block",
        block: listBlock,
      }),
    ]);
    expect(presentation.navigationTargets[0]?.childChangeIndex).toBeUndefined();
    expect(presentation.entryChangeIndexes.get(entry?.id ?? "")).toBe(0);
  });

  it("annotates only changed top-level list items for the visible side", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Later.</li><li>Tail item</li></ul>",
      ),
      blocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Paused.</li><li>Tail item</li></ul>",
      ),
    );
    expect(block).toBeDefined();
    const listBlock = block as NonNullable<typeof block>;

    const rightHtml = applyRenderedListItemHighlights(
      listBlock.right?.html ?? "",
      renderedListItemHighlightsForSide({
        activeChangeIndex: 7,
        block: listBlock,
        changeIndexForItem: (itemIndex) => (itemIndex === 1 ? 7 : null),
        side: "right",
      }),
    );
    const leftHtml = applyRenderedListItemHighlights(
      listBlock.left?.html ?? "",
      renderedListItemHighlightsForSide({
        block: listBlock,
        changeIndexForItem: () => null,
        side: "left",
      }),
    );
    const rightDoc = parseHtmlBody(rightHtml);
    const leftDoc = parseHtmlBody(leftHtml);

    expect(
      rightDoc.querySelectorAll('[data-review-id="git-rendered-list-item-change"]'),
    ).toHaveLength(1);
    expect(
      rightDoc.querySelectorAll(".git-rendered-list-item-change.changed"),
    ).toHaveLength(1);
    expect(
      rightDoc.querySelectorAll('[data-change-index="7"]'),
    ).toHaveLength(1);
    expect(
      rightDoc.querySelector('[data-content-cursor-active="true"]'),
    ).toBeTruthy();
    expect(rightDoc.querySelector('[data-active-change="true"]')).toBeTruthy();
    expect(
      rightDoc.querySelectorAll("li:not(.git-rendered-list-item-change)"),
    ).toHaveLength(2);
    expect(
      leftDoc.querySelectorAll(".git-rendered-list-item-change.changed"),
    ).toHaveLength(1);
    expect(leftDoc.querySelector("[data-change-index]")).toBeNull();
    expect(leftDoc.querySelector("[data-active-change]")).toBeNull();
  });

  it("keeps list item highlight metadata through rendered block sanitizing", () => {
    const html = applyRenderedListItemHighlights(
      "<ul><li>Stable</li><li>Changed</li></ul>",
      [
        {
          active: true,
          changeIndex: 3,
          itemIndex: 1,
          kind: "changed",
        },
      ],
    );
    const sanitized = unwrapSafeHtml(
      sanitizeRenderedBlockHtml(html, { format: "markdown" }),
    );

    expect(sanitized).toContain("git-rendered-list-item-change");
    expect(sanitized).toContain('data-review-id="git-rendered-list-item-change"');
    expect(sanitized).toContain('data-change-index="3"');
    expect(sanitized).toContain('data-active-change="true"');
    expect(sanitized).toContain('data-content-cursor-active="true"');
  });
});
