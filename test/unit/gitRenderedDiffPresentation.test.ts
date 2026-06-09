import { describe, expect, it } from "vitest";

import {
  buildRenderedDiffPresentation,
  compareRenderedBlocks,
  nextRenderedDiffContentCursorTarget,
  renderedDiffContentCursorTargets,
} from "../../src/ui/lib/gitRenderedDiff";
import { blocksFromHtml } from "./helpers/gitRenderedDiffFixtures";

describe("git rendered diff presentation", () => {
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
