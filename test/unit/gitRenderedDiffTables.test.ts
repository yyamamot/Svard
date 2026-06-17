import { describe, expect, it } from "vitest";

import {
  applyRenderedTableHighlights,
  buildRenderedDiffPresentation,
  compareRenderedBlocks,
  renderedDiffContentCursorTargets,
  renderedDiffTableRowChangeIndex,
  renderedTableHighlightsForSide,
} from "../../src/ui/lib/gitRenderedDiff";
import {
  sanitizeRenderedBlockHtml,
  unwrapSafeHtml,
} from "../../src/ui/lib/sanitizeHtml";
import { blocksFromHtml, parseHtmlBody } from "./helpers/gitRenderedDiffFixtures";

describe("git rendered diff tables", () => {
  it("extracts privacy-safe simple table row and cell snapshots", () => {
    const [block] = blocksFromHtml(
      `<table><tbody><tr><th>Secret Name</th><th>Status</th></tr><tr><td>Alpha</td><td>Draft</td></tr></tbody></table>`,
    );

    expect(block?.tableRows).toEqual([
      expect.objectContaining({
        index: 0,
        cellCount: 2,
        cells: [
          expect.objectContaining({ index: 0, header: true }),
          expect.objectContaining({ index: 1, header: true }),
        ],
      }),
      expect.objectContaining({
        index: 1,
        cellCount: 2,
        cells: [
          expect.objectContaining({ index: 0, header: false }),
          expect.objectContaining({ index: 1, header: false }),
        ],
      }),
    ]);
    expect(JSON.stringify(block?.tableRows)).not.toContain("Secret Name");
    expect(JSON.stringify(block?.tableRows)).not.toContain("Draft");
  });

  it("adds table changes for high-confidence changed cells", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<table><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Draft review</td></tr></tbody></table>`,
      ),
      blocksFromHtml(
        `<table><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Done review</td></tr></tbody></table>`,
      ),
    );

    expect(block).toMatchObject({
      kind: "changed",
      blockKind: "table",
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
    });
    expect(block?.tableChangeFallback).toBeUndefined();
  });

  it("uses changed table rows as rendered navigation targets", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<table><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Draft review</td></tr></tbody></table>`,
      ),
      blocksFromHtml(
        `<table><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Done review</td></tr></tbody></table>`,
      ),
    );
    expect(block).toBeDefined();
    const tableBlock = block as NonNullable<typeof block>;
    const presentation = buildRenderedDiffPresentation([tableBlock]);
    const entry = presentation.entries[0];

    expect(presentation.navigationTargets).toEqual([
      expect.objectContaining({
        index: 0,
        entryId: entry?.id,
        primarySide: "right",
        side: "right",
        targetKind: "table-row",
        block: tableBlock,
        tableRowIndex: 1,
      }),
    ]);
    expect(presentation.entryChangeIndexes.get(entry?.id ?? "")).toBeUndefined();
    expect(
      entry
        ? renderedDiffTableRowChangeIndex(presentation, entry, "right", 1)
        : null,
    ).toBe(0);
    expect(renderedDiffContentCursorTargets(presentation)).toEqual([
      {
        entryId: entry?.id,
        side: "right",
        changeIndex: 0,
        tableRowIndex: 1,
      },
    ]);
  });

  it("adds table row targets for added rows on the visible side", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<table><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Stable status</td></tr></tbody></table>`,
      ),
      blocksFromHtml(
        `<table><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Stable status</td></tr><tr><td>New item</td><td>Ready status</td></tr></tbody></table>`,
      ),
    );
    const presentation = buildRenderedDiffPresentation(block ? [block] : []);
    const entry = presentation.entries[0];

    expect(block?.tableChanges).toEqual([
      expect.objectContaining({
        kind: "added",
        side: "right",
        rightRowIndex: 2,
        rightCellIndex: 0,
      }),
      expect.objectContaining({
        kind: "added",
        side: "right",
        rightRowIndex: 2,
        rightCellIndex: 1,
      }),
    ]);
    expect(presentation.navigationTargets).toEqual([
      expect.objectContaining({
        targetKind: "table-row",
        side: "right",
        tableRowIndex: 2,
      }),
    ]);
    expect(
      entry
        ? renderedDiffTableRowChangeIndex(presentation, entry, "right", 2)
        : null,
    ).toBe(0);
  });

  it("applies row navigation metadata, cell highlight, and inline word highlights", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<table><caption>Release table</caption><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Draft review</td></tr></tbody></table>`,
      ),
      blocksFromHtml(
        `<table><caption>Release table</caption><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Done review</td></tr></tbody></table>`,
      ),
    );
    expect(block?.left?.html).toBeDefined();
    expect(block?.right?.html).toBeDefined();
    const highlights = renderedTableHighlightsForSide({
      activeChangeIndex: 4,
      block: block as NonNullable<typeof block>,
      changeIndexForRow: () => 4,
      side: "right",
    });
    const html = applyRenderedTableHighlights({
      highlights,
      html: block?.right?.html ?? "",
      leftHtml: block?.left?.html,
      rightHtml: block?.right?.html,
      side: "right",
    });
    const body = parseHtmlBody(html);

    expect(
      body.querySelector('[data-review-id="git-rendered-table-row-change"]'),
    ).toBeTruthy();
    expect(body.querySelector("tr[data-change-index='4']")).toBeTruthy();
    expect(
      body.querySelectorAll('[data-review-id="git-rendered-table-cell-change"]'),
    ).toHaveLength(1);
    expect(
      body.querySelectorAll('[data-review-id="git-rendered-table-header-context"]'),
    ).toHaveLength(1);
    expect(
      body.querySelector('[data-review-id="git-rendered-table-header-context"]')
        ?.textContent,
    ).toBe("Status");
    expect(
      body.querySelector('[data-review-id="git-rendered-table-caption-context"]'),
    ).toBeTruthy();
    expect(body.querySelector(".git-inline-word-highlight.added")).toBeTruthy();
    expect(body.querySelector('[data-active-change="true"]')).toBeTruthy();
    expect(body.querySelector('[data-content-cursor-active="true"]')).toBeNull();
  });

  it("focuses rendered table rows around table row changes", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<table><caption>Feature inventory</caption><tbody><tr><th>Area</th><th>Feature</th><th>Status</th></tr><tr><td>Documents</td><td>Open files</td><td>Stable</td></tr><tr><td>Diagrams</td><td>Fast diagram loading</td><td>Stable</td></tr><tr><td>Files</td><td>File tree</td><td>Stable</td></tr><tr><td>Search</td><td>Quick Open</td><td>Stable</td></tr></tbody></table>`,
      ),
      blocksFromHtml(
        `<table><caption>Feature inventory</caption><tbody><tr><th>Area</th><th>Feature</th><th>Status</th></tr><tr><td>Documents</td><td>Open files</td><td>Stable</td></tr><tr><td>Diagrams</td><td>Fast diagram loading</td><td>Stable</td></tr><tr><td>Diagrams</td><td>Local PlantUML SVG cache</td><td>Stable</td></tr><tr><td>Files</td><td>File tree</td><td>Stable</td></tr><tr><td>Search</td><td>Quick Open</td><td>Stable</td></tr></tbody></table>`,
      ),
    );
    const highlights = renderedTableHighlightsForSide({
      activeChangeIndex: 0,
      block: block as NonNullable<typeof block>,
      changeIndexForRow: () => 0,
      side: "right",
    });
    const html = applyRenderedTableHighlights({
      focusRows: true,
      highlights,
      html: block?.right?.html ?? "",
      leftHtml: block?.left?.html,
      rightHtml: block?.right?.html,
      side: "right",
    });
    const body = parseHtmlBody(html);
    const rows = Array.from(body.querySelectorAll("tr")).map((row) =>
      row.textContent?.replace(/\s+/g, " ").trim(),
    );

    expect(rows).toEqual([
      "AreaFeatureStatus",
      "DiagramsFast diagram loadingStable",
      "DiagramsLocal PlantUML SVG cacheStable",
      "FilesFile treeStable",
    ]);
    expect(
      body.querySelector('[data-review-id="git-rendered-table-row-change"]')
        ?.textContent,
    ).toContain("Local PlantUML SVG cache");
    expect(body.querySelector('[data-change-index="0"]')).toBeTruthy();
    expect(html).not.toContain("Documents");
    expect(html).not.toContain("Search");
  });

  it("marks table row content cursor only when the cursor row matches", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<table><caption>Release table</caption><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Draft review</td></tr></tbody></table>`,
      ),
      blocksFromHtml(
        `<table><caption>Release table</caption><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Done review</td></tr></tbody></table>`,
      ),
    );
    const highlights = renderedTableHighlightsForSide({
      activeChangeIndex: 4,
      block: block as NonNullable<typeof block>,
      changeIndexForRow: () => 4,
      contentCursorActiveForRow: (rowIndex) => rowIndex === 1,
      side: "right",
    });
    const html = applyRenderedTableHighlights({
      highlights,
      html: block?.right?.html ?? "",
      leftHtml: block?.left?.html,
      rightHtml: block?.right?.html,
      side: "right",
    });
    const body = parseHtmlBody(html);
    const activeRow = body.querySelector('[data-active-change="true"]');

    expect(activeRow).toBeTruthy();
    expect(activeRow?.getAttribute("data-content-cursor-active")).toBe("true");
  });

  it("does not apply table header or caption context for inactive row targets", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<table><caption>Release table</caption><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Draft review</td></tr></tbody></table>`,
      ),
      blocksFromHtml(
        `<table><caption>Release table</caption><tbody><tr><th>Name</th><th>Status</th></tr><tr><td>Feature</td><td>Status Done review</td></tr></tbody></table>`,
      ),
    );
    const highlights = renderedTableHighlightsForSide({
      activeChangeIndex: 9,
      block: block as NonNullable<typeof block>,
      changeIndexForRow: () => 4,
      side: "right",
    });
    const html = applyRenderedTableHighlights({
      highlights,
      html: block?.right?.html ?? "",
      leftHtml: block?.left?.html,
      rightHtml: block?.right?.html,
      side: "right",
    });
    const body = parseHtmlBody(html);

    expect(
      body.querySelector('[data-review-id="git-rendered-table-cell-change"]'),
    ).toBeTruthy();
    expect(
      body.querySelector('[data-review-id="git-rendered-table-header-context"]'),
    ).toBeNull();
    expect(
      body.querySelector('[data-review-id="git-rendered-table-caption-context"]'),
    ).toBeNull();
  });

  it("keeps complex table fallback and sanitized metadata privacy-safe", () => {
    const [block] = compareRenderedBlocks(
      blocksFromHtml(
        `<table><tbody><tr><td colspan="2">Secret merged old</td></tr></tbody></table>`,
      ),
      blocksFromHtml(
        `<table><tbody><tr><td colspan="2">Secret merged new</td></tr></tbody></table>`,
      ),
    );
    const serialized = JSON.stringify({
      fallback: block?.tableChangeFallback,
      leftRows: block?.left?.tableRows,
      rightRows: block?.right?.tableRows,
    });

    expect(block?.tableChanges).toBeUndefined();
    expect(block?.tableChangeFallback).toEqual({ reason: "complex" });
    expect(serialized).not.toContain("Secret merged old");
    expect(serialized).not.toContain("Secret merged new");
  });

  it("preserves table row and cell change metadata after sanitization", () => {
    const html = `<table><caption class="git-rendered-table-caption-context" data-review-id="git-rendered-table-caption-context">Release</caption><tbody><tr><th class="git-rendered-table-header-context" data-review-id="git-rendered-table-header-context">Status</th></tr><tr class="git-rendered-table-row-change changed" data-review-id="git-rendered-table-row-change" data-change-index="2" data-active-change="true"><td class="git-rendered-table-cell-change changed" data-review-id="git-rendered-table-cell-change"><span class="git-inline-word-highlight added" data-review-id="git-diff-word-highlight">Done</span></td></tr></tbody></table>`;
    const sanitized = unwrapSafeHtml(
      sanitizeRenderedBlockHtml(html, { format: "markdown" }),
    );

    expect(sanitized).toContain("git-rendered-table-row-change");
    expect(sanitized).toContain('data-review-id="git-rendered-table-row-change"');
    expect(sanitized).toContain("git-rendered-table-cell-change");
    expect(sanitized).toContain("git-rendered-table-header-context");
    expect(sanitized).toContain('data-review-id="git-rendered-table-header-context"');
    expect(sanitized).toContain("git-rendered-table-caption-context");
    expect(sanitized).toContain('data-review-id="git-rendered-table-caption-context"');
    expect(sanitized).toContain('data-change-index="2"');
    expect(sanitized).toContain('data-active-change="true"');
  });
});
