import { describe, expect, it } from "vitest";

import {
  applyRenderedStructuredChildHighlights,
  buildRenderedDiffPresentation,
  compareRenderedBlocks,
  renderedDiffContentCursorTargets,
  renderedDiffStructuredChildChangeIndex,
  renderedStructuredChildHighlightsForSide,
} from "../../src/ui/lib/gitRenderedDiff";
import {
  sanitizeRenderedBlockHtml,
  unwrapSafeHtml,
} from "../../src/ui/lib/sanitizeHtml";
import {
  blocksFromHtml,
  parseHtmlBody,
} from "./helpers/gitRenderedDiffFixtures";

describe("git rendered diff structured blocks", () => {
  it("extracts privacy-safe definition list item snapshots", () => {
    const [block] = blocksFromHtml(
      `<dl><dt>Secret Term</dt><dd>Draft private description</dd></dl>`,
    );

    expect(block).toMatchObject({
      kind: "definition-list",
      structuredChildren: [
        expect.objectContaining({
          index: 0,
          role: "definition-item",
        }),
      ],
    });
    expect(JSON.stringify(block?.structuredChildren)).not.toContain("Secret");
    expect(JSON.stringify(block?.structuredChildren)).not.toContain("private");
  });

  it("adds structured changes for high-confidence definition descriptions", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<dl><dt>Mode</dt><dd>Status Draft review window</dd></dl>`,
      ),
      blocksFromHtml(
        `<dl><dt>Mode</dt><dd>Status Done review window</dd></dl>`,
      ),
    );

    expect(block).toMatchObject({
      kind: "changed",
      blockKind: "definition-list",
      structuredChanges: [
        {
          kind: "changed",
          side: "both",
          confidence: "high",
          role: "definition-item",
          leftIndex: 0,
          rightIndex: 0,
        },
      ],
    });
    expect(block?.structuredChangeFallback).toBeUndefined();
  });

  it("uses structured children as rendered navigation targets", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<dl><dt>Mode</dt><dd>Status Draft review window</dd></dl>`,
      ),
      blocksFromHtml(
        `<dl><dt>Mode</dt><dd>Status Done review window</dd></dl>`,
      ),
    );
    const structuredBlock = block as NonNullable<typeof block>;
    const presentation = buildRenderedDiffPresentation([structuredBlock]);
    const entry = presentation.entries[0];

    expect(presentation.navigationTargets).toEqual([
      expect.objectContaining({
        index: 0,
        entryId: entry?.id,
        primarySide: "right",
        side: "right",
        targetKind: "structured-child",
        block: structuredBlock,
        structuredChildIndex: 0,
        structuredChildRole: "definition-item",
      }),
    ]);
    expect(
      presentation.entryChangeIndexes.get(entry?.id ?? ""),
    ).toBeUndefined();
    expect(
      entry
        ? renderedDiffStructuredChildChangeIndex(
            presentation,
            entry,
            "right",
            0,
          )
        : null,
    ).toBe(0);
    expect(renderedDiffContentCursorTargets(presentation)).toEqual([
      {
        entryId: entry?.id,
        side: "right",
        changeIndex: 0,
        structuredChildIndex: 0,
      },
    ]);
  });

  it("adds structured targets for added and removed definition items", () => {
    const [addedBlock] = compareRenderedBlocks(
      blocksFromHtml(`<dl><dt>Stable</dt><dd>Stable description</dd></dl>`),
      blocksFromHtml(
        `<dl><dt>Stable</dt><dd>Stable description</dd><dt>New</dt><dd>Ready description</dd></dl>`,
      ),
    );
    const [removedBlock] = compareRenderedBlocks(
      blocksFromHtml(
        `<dl><dt>Stable</dt><dd>Stable description</dd><dt>Old</dt><dd>Legacy description</dd></dl>`,
      ),
      blocksFromHtml(`<dl><dt>Stable</dt><dd>Stable description</dd></dl>`),
    );

    expect(addedBlock?.structuredChanges).toEqual([
      expect.objectContaining({
        kind: "added",
        side: "right",
        rightIndex: 1,
      }),
    ]);
    expect(removedBlock?.structuredChanges).toEqual([
      expect.objectContaining({
        kind: "removed",
        side: "left",
        leftIndex: 1,
      }),
    ]);
  });

  it("falls back for ambiguous definition lists", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<dl><dt>Status</dt><dd>First description</dd><dt>Status</dt><dd>Second description</dd></dl>`,
      ),
      blocksFromHtml(
        `<dl><dt>Status</dt><dd>Changed first description</dd><dt>Status</dt><dd>Second description</dd></dl>`,
      ),
    );

    expect(block?.structuredChanges).toBeUndefined();
    expect(block?.structuredChangeFallback).toEqual({ reason: "ambiguous" });
  });

  it("targets admonition content without targeting the icon cell", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<div class="admonitionblock note"><table><tr><td class="icon"><i class="icon-note">N</i></td><td class="content">Status Draft review window</td></tr></table></div>`,
      ),
      blocksFromHtml(
        `<div class="admonitionblock note"><table><tr><td class="icon"><i class="icon-note">N</i></td><td class="content">Status Done review window</td></tr></table></div>`,
      ),
    );
    const structuredBlock = block as NonNullable<typeof block>;
    const html = applyRenderedStructuredChildHighlights(
      structuredBlock.right?.html ?? "",
      renderedStructuredChildHighlightsForSide({
        activeChangeIndex: 2,
        block: structuredBlock,
        changeIndexForChild: () => 2,
        contentCursorActiveForChild: () => true,
        side: "right",
      }),
    );
    const body = parseHtmlBody(html);

    expect(block).toMatchObject({
      structuredChanges: [
        expect.objectContaining({
          kind: "changed",
          role: "admonition-content",
        }),
      ],
    });
    expect(
      body.querySelector("td.content")?.getAttribute("data-change-index"),
    ).toBe("2");
    expect(body.querySelector("td.content")?.className).toContain(
      "git-rendered-structured-child-change",
    );
    expect(
      body.querySelector("td.icon")?.getAttribute("data-change-index"),
    ).toBeNull();
  });

  it("falls back when admonition type changes", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<div class="admonitionblock note"><table><tr><td class="content">Stable review window</td></tr></table></div>`,
      ),
      blocksFromHtml(
        `<div class="admonitionblock warning"><table><tr><td class="content">Stable review window</td></tr></table></div>`,
      ),
    );

    expect(block?.structuredChanges).toBeUndefined();
    expect(block?.structuredChangeFallback).toEqual({ reason: "low-overlap" });
  });

  it("keeps structured metadata through rendered block sanitizing", () => {
    const html = applyRenderedStructuredChildHighlights(
      `<dl><dt>Mode</dt><dd>Status Done review window</dd></dl>`,
      [
        {
          active: true,
          changeIndex: 4,
          childIndex: 0,
          contentCursorActive: true,
          kind: "changed",
          role: "definition-item",
        },
      ],
    );
    const sanitized = unwrapSafeHtml(
      sanitizeRenderedBlockHtml(html, { format: "markdown" }),
    );

    expect(sanitized).toContain("git-rendered-structured-child-change");
    expect(sanitized).toContain(
      'data-review-id="git-rendered-structured-child-change"',
    );
    expect(sanitized).toContain('data-change-index="4"');
    expect(sanitized).toContain('data-active-change="true"');
    expect(sanitized).toContain('data-content-cursor-active="true"');
    expect(JSON.stringify(sanitized)).not.toContain("/Users/");
  });
});
