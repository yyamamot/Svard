import { describe, expect, it } from "vitest";

import {
  buildRenderedDiffPresentation,
  compareRenderedBlocks,
  nextRenderedDiffContentCursorTarget,
  renderedDiffContentCursorTargets,
} from "../../src/ui/lib/gitRenderedDiff";
import { blocksFromHtml } from "./helpers/gitRenderedDiffFixtures";

describe("git rendered diff presentation", () => {
  it("builds section outline from navigation targets", () => {
    const presentation = buildRenderedDiffPresentation([
      {
        id: "heading",
        kind: "changed",
        blockKind: "heading",
        left: {
          id: "heading-left",
          kind: "heading",
          tagName: "h2",
          text: "Overview",
          html: "<h2>Overview</h2>",
        },
        right: {
          id: "heading-right",
          kind: "heading",
          tagName: "h2",
          text: "Overview",
          html: "<h2>Overview</h2>",
        },
      },
      {
        id: "paragraph",
        kind: "changed",
        blockKind: "paragraph",
        left: {
          id: "paragraph-left",
          kind: "paragraph",
          tagName: "p",
          text: "Old text",
          html: "<p>Old text</p>",
        },
        right: {
          id: "paragraph-right",
          kind: "paragraph",
          tagName: "p",
          text: "New text",
          html: "<p>New text</p>",
        },
      },
    ]);

    expect(presentation.sectionOutline).toEqual([
      {
        id: presentation.sectionOutline[0]?.id,
        label: "Overview",
        level: 2,
        firstChangeIndex: 0,
        changeCount: 2,
      },
    ]);
  });

  it("keeps duplicate heading labels as separate outline sections", () => {
    const left = blocksFromHtml(`<h2>Repeated</h2>
<p>Old first</p>
<h2>Repeated</h2>
<p>Old second</p>`);
    const right = blocksFromHtml(`<h2>Repeated</h2>
<p>New first</p>
<h2>Repeated</h2>
<p>New second</p>`);

    const presentation = buildRenderedDiffPresentation(
      compareRenderedBlocks(left, right),
    );

    expect(
      presentation.sectionOutline.map(
        ({ label, level, firstChangeIndex, changeCount }) => ({
          label,
          level,
          firstChangeIndex,
          changeCount,
        }),
      ),
    ).toEqual([
      {
        label: "Repeated",
        level: 2,
        firstChangeIndex: 0,
        changeCount: 1,
      },
      {
        label: "Repeated",
        level: 2,
        firstChangeIndex: 1,
        changeCount: 1,
      },
    ]);
  });

  it("uses document start before the first heading", () => {
    const presentation = buildRenderedDiffPresentation([
      {
        id: "intro",
        kind: "changed",
        blockKind: "paragraph",
        left: {
          id: "intro-left",
          kind: "paragraph",
          tagName: "p",
          text: "Old intro",
          html: "<p>Old intro</p>",
        },
        right: {
          id: "intro-right",
          kind: "paragraph",
          tagName: "p",
          text: "New intro",
          html: "<p>New intro</p>",
        },
      },
    ]);

    expect(presentation.sectionOutline).toEqual([
      {
        id: "rendered-section:document-start",
        label: "Document start",
        level: 0,
        firstChangeIndex: 0,
        changeCount: 1,
      },
    ]);
  });

  it("counts list item and table row targets in their parent section", () => {
    const presentation = buildRenderedDiffPresentation([
      {
        id: "features-heading",
        kind: "unchanged",
        blockKind: "heading",
        left: {
          id: "features-heading-left",
          kind: "heading",
          tagName: "h2",
          text: "Features",
          html: "<h2>Features</h2>",
        },
        right: {
          id: "features-heading-right",
          kind: "heading",
          tagName: "h2",
          text: "Features",
          html: "<h2>Features</h2>",
        },
      },
      {
        id: "feature-list",
        kind: "changed",
        blockKind: "list",
        left: {
          id: "feature-list-left",
          kind: "list",
          tagName: "ul",
          text: "Old A Old B",
          html: "<ul><li>Old A</li><li>Old B</li></ul>",
        },
        right: {
          id: "feature-list-right",
          kind: "list",
          tagName: "ul",
          text: "New A New B",
          html: "<ul><li>New A</li><li>New B</li></ul>",
        },
        childChanges: [
          {
            kind: "changed",
            side: "both",
            confidence: "high",
            leftIndex: 0,
            rightIndex: 0,
          },
          {
            kind: "added",
            side: "right",
            confidence: "high",
            rightIndex: 1,
          },
        ],
      },
      {
        id: "feature-table",
        kind: "changed",
        blockKind: "table",
        left: {
          id: "feature-table-left",
          kind: "table",
          tagName: "table",
          text: "Old table",
          html: "<table><tr><td>Old</td></tr></table>",
        },
        right: {
          id: "feature-table-right",
          kind: "table",
          tagName: "table",
          text: "New table",
          html: "<table><tr><td>New</td></tr></table>",
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
            kind: "added",
            side: "right",
            confidence: "high",
            rightRowIndex: 1,
            rightCellIndex: 0,
          },
        ],
      },
    ]);

    expect(presentation.navigationTargets).toHaveLength(4);
    expect(presentation.sectionOutline).toEqual([
      {
        id: presentation.sectionOutline[0]?.id,
        label: "Features",
        level: 2,
        firstChangeIndex: 0,
        changeCount: 4,
      },
    ]);
  });

  it("keeps fallback list and table blocks as block-level targets with privacy-safe reasons", () => {
    const presentation = buildRenderedDiffPresentation([
      {
        id: "fallback-list",
        kind: "changed",
        blockKind: "list",
        left: {
          id: "fallback-list-left",
          kind: "list",
          tagName: "ul",
          text: "Secret Alpha Secret Beta",
          html: "<ul><li>Secret Alpha</li><li>Secret Beta</li></ul>",
        },
        right: {
          id: "fallback-list-right",
          kind: "list",
          tagName: "ul",
          text: "Secret Beta Secret Alpha",
          html: "<ul><li>Secret Beta</li><li>Secret Alpha</li></ul>",
        },
        childChangeFallback: { reason: "reorder" },
      },
      {
        id: "fallback-table",
        kind: "changed",
        blockKind: "table",
        left: {
          id: "fallback-table-left",
          kind: "table",
          tagName: "table",
          text: "Secret old table",
          html: "<table><tr><td colspan='2'>Secret old table</td></tr></table>",
        },
        right: {
          id: "fallback-table-right",
          kind: "table",
          tagName: "table",
          text: "Secret new table",
          html: "<table><tr><td colspan='2'>Secret new table</td></tr></table>",
        },
        tableChangeFallback: { reason: "complex" },
      },
    ]);

    expect(presentation.navigationTargets).toEqual([
      expect.objectContaining({
        block: expect.objectContaining({ id: "fallback-list" }),
        targetKind: "block",
      }),
      expect.objectContaining({
        block: expect.objectContaining({ id: "fallback-table" }),
        targetKind: "block",
      }),
    ]);
    expect(presentation.fallbackReasons).toEqual([
      {
        blockId: "fallback-list",
        entryId: presentation.entries[0]?.id,
        kind: "list",
        reason: "reorder",
      },
      {
        blockId: "fallback-table",
        entryId: presentation.entries[1]?.id,
        kind: "table",
        reason: "complex",
      },
    ]);
    expect(presentation.inlineDiagnostics).toEqual([
      {
        id: `inline-diagnostic:${presentation.entries[0]?.id}:list:reorder`,
        entryId: presentation.entries[0]?.id,
        blockId: "fallback-list",
        category: "fallback",
        label: "List fallback: reorder",
        detail:
          "Svard kept this change at block level because detailed matching was not reliable for this target.",
      },
      {
        id: `inline-diagnostic:${presentation.entries[1]?.id}:table:complex`,
        entryId: presentation.entries[1]?.id,
        blockId: "fallback-table",
        category: "fallback",
        label: "Table fallback: complex",
        detail:
          "Svard kept this change at block level because detailed matching was not reliable for this target.",
      },
    ]);
    expect(JSON.stringify(presentation.fallbackReasons)).not.toContain("Secret");
    expect(JSON.stringify(presentation.inlineDiagnostics)).not.toContain(
      "Secret",
    );
  });

  it("anchors blocked asset and unsupported diagram diagnostics without source details", () => {
    const presentation = buildRenderedDiffPresentation([
      {
        id: "blocked-image",
        kind: "changed",
        blockKind: "image",
        left: {
          id: "blocked-image-left",
          kind: "image",
          tagName: "p",
          text: "Secret asset",
          html: `<p><span class="git-rendered-placeholder">External image blocked: Secret asset</span></p>`,
        },
        right: {
          id: "blocked-image-right",
          kind: "image",
          tagName: "p",
          text: "Secret asset",
          html: `<p><span class="git-rendered-placeholder">External image blocked: Secret asset</span></p>`,
        },
      },
      {
        id: "unsupported-diagram",
        kind: "changed",
        blockKind: "diagram",
        left: {
          id: "unsupported-diagram-left",
          kind: "diagram",
          tagName: "div",
          text: "Secret diagram",
          html: `<div class="diagram-inline-diagnostic"><span>Secret diagram source failed</span></div>`,
        },
        right: {
          id: "unsupported-diagram-right",
          kind: "diagram",
          tagName: "div",
          text: "Secret diagram",
          html: `<div class="diagram-inline-diagnostic"><span>Secret diagram source failed</span></div>`,
        },
      },
    ]);

    expect(presentation.inlineDiagnostics).toEqual([
      {
        id: `inline-diagnostic:${presentation.entries[0]?.id}:blocked-asset`,
        entryId: presentation.entries[0]?.id,
        blockId: "blocked-image",
        category: "blocked-asset",
        label: "Blocked asset",
        detail:
          "Image output is hidden by the current security or render policy.",
      },
      {
        id: `inline-diagnostic:${presentation.entries[1]?.id}:unsupported-diagram`,
        entryId: presentation.entries[1]?.id,
        blockId: "unsupported-diagram",
        category: "unsupported",
        label: "Unsupported diagram",
        detail: "Diagram output is unavailable for this rendered diff target.",
      },
    ]);
    expect(JSON.stringify(presentation.inlineDiagnostics)).not.toContain(
      "Secret",
    );
    expect(JSON.stringify(presentation.inlineDiagnostics)).not.toContain(
      "/private",
    );
  });

  it("groups contiguous one-sided rendered changes for presentation", () => {
    const left = blocksFromHtml(`<h2>Old section</h2>
<p>Old paragraph</p>
<ul><li>Old item</li></ul>
<h2>Stable</h2>`);
    const right = blocksFromHtml(`<h2>Stable</h2>`);

    const presentation = buildRenderedDiffPresentation(
      compareRenderedBlocks(left, right),
    );

    expect(presentation.entries).toHaveLength(2);
    expect(presentation.entries[0]).toMatchObject({
      kind: "group",
      changeKind: "removed",
    });
    expect(
      presentation.entries[0]?.kind === "group"
        ? presentation.entries[0].blocks.length
        : 0,
    ).toBe(3);
    expect(presentation.navigationTargets).toHaveLength(1);
    expect(presentation.navigationTargets[0]).toMatchObject({
      index: 0,
      primarySide: "left",
      side: "left",
      targetKind: "block",
    });
    expect(
      presentation.entryChangeIndexes.get(presentation.entries[0]?.id ?? ""),
    ).toBe(0);
  });

  it("does not make empty rendered placeholders navigable", () => {
    const presentation = buildRenderedDiffPresentation([
      {
        id: "empty-added",
        kind: "added",
        blockKind: "paragraph",
        right: {
          id: "right-empty",
          kind: "paragraph",
          tagName: "p",
          text: "   ",
          html: "<p>   </p>",
        },
      },
      {
        id: "visible-added",
        kind: "added",
        blockKind: "paragraph",
        right: {
          id: "right-visible",
          kind: "paragraph",
          tagName: "p",
          text: "Visible change",
          html: "<p>Visible change</p>",
        },
      },
    ]);

    expect(presentation.navigationTargets).toHaveLength(1);
    expect(presentation.navigationTargets[0]?.block.id).toBe("visible-added");
    expect(presentation.navigationTargets[0]?.primarySide).toBe("right");
    expect(presentation.navigationTargets[0]?.side).toBe("right");
    expect(presentation.navigationTargets[0]?.targetKind).toBe("block");
  });

  it("keeps changed rendered blocks as individual navigation targets", () => {
    const left = blocksFromHtml(`<p>Old stable text</p>
<p>Second old stable text</p>`);
    const right = blocksFromHtml(`<p>New stable text</p>
<p>Second new stable text</p>`);

    const presentation = buildRenderedDiffPresentation(
      compareRenderedBlocks(left, right),
    );

    expect(presentation.entries).toHaveLength(2);
    expect(presentation.navigationTargets).toHaveLength(2);
    expect(presentation.navigationTargets.map((target) => target.side)).toEqual(
      ["both", "both"],
    );
    expect(
      presentation.navigationTargets.map((target) => target.primarySide),
    ).toEqual(["right", "right"]);
    expect(
      presentation.navigationTargets.map((target) => target.targetKind),
    ).toEqual(["block", "block"]);
  });

  it("derives content cursor targets from rendered diff navigation targets", () => {
    const presentation = buildRenderedDiffPresentation([
      {
        id: "stable",
        kind: "unchanged",
        blockKind: "heading",
        left: {
          id: "stable-left",
          kind: "heading",
          tagName: "h1",
          text: "Stable",
          html: "<h1>Stable</h1>",
        },
        right: {
          id: "stable-right",
          kind: "heading",
          tagName: "h1",
          text: "Stable",
          html: "<h1>Stable</h1>",
        },
      },
      {
        id: "removed",
        kind: "removed",
        blockKind: "paragraph",
        left: {
          id: "removed-left",
          kind: "paragraph",
          tagName: "p",
          text: "Removed paragraph",
          html: "<p>Removed paragraph</p>",
        },
      },
      {
        id: "changed",
        kind: "changed",
        blockKind: "paragraph",
        left: {
          id: "changed-left",
          kind: "paragraph",
          tagName: "p",
          text: "Changed before",
          html: "<p>Changed before</p>",
        },
        right: {
          id: "changed-right",
          kind: "paragraph",
          tagName: "p",
          text: "Changed after",
          html: "<p>Changed after</p>",
        },
      },
      {
        id: "added",
        kind: "added",
        blockKind: "paragraph",
        right: {
          id: "added-right",
          kind: "paragraph",
          tagName: "p",
          text: "Added paragraph",
          html: "<p>Added paragraph</p>",
        },
      },
    ]);

    expect(renderedDiffContentCursorTargets(presentation)).toEqual([
      {
        entryId: presentation.navigationTargets[0]?.entryId,
        side: "left",
        changeIndex: 0,
      },
      {
        entryId: presentation.navigationTargets[1]?.entryId,
        side: "right",
        changeIndex: 1,
      },
      {
        entryId: presentation.navigationTargets[2]?.entryId,
        side: "right",
        changeIndex: 2,
      },
    ]);
  });

  it("keeps grouped one-sided changes as one content cursor target", () => {
    const left = blocksFromHtml(`<h2>Stable</h2>`);
    const right = blocksFromHtml(`<p>Added one</p>
<p>Added two</p>
<h2>Stable</h2>`);

    const presentation = buildRenderedDiffPresentation(
      compareRenderedBlocks(left, right),
    );

    expect(presentation.entries[0]).toMatchObject({ kind: "group" });
    expect(renderedDiffContentCursorTargets(presentation)).toEqual([
      {
        entryId: presentation.entries[0]?.id,
        side: "right",
        changeIndex: 0,
      },
    ]);
  });

  it("wraps rendered diff content cursor navigation", () => {
    const targets = [
      { entryId: "first", side: "right" as const, changeIndex: 0 },
      { entryId: "second", side: "left" as const, changeIndex: 1 },
    ];

    expect(
      nextRenderedDiffContentCursorTarget({
        targets,
        activeTarget: null,
        activeChangeIndex: 0,
        direction: "next",
      }),
    ).toEqual(targets[0]);
    expect(
      nextRenderedDiffContentCursorTarget({
        targets,
        activeTarget: targets[0] ?? null,
        activeChangeIndex: 0,
        direction: "previous",
      }),
    ).toEqual(targets[1]);
    expect(
      nextRenderedDiffContentCursorTarget({
        targets,
        activeTarget: targets[1] ?? null,
        activeChangeIndex: 1,
        direction: "next",
      }),
    ).toEqual(targets[0]);
  });

});
