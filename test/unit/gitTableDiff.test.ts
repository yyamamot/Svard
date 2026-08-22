import { describe, expect, it } from "vitest";

import {
  changedTableMarkers,
  compareRenderedTable,
  extractRenderedTablesFromHtml,
} from "../../src/ui/lib/gitTableDiff";
import type { GitDiffPreview } from "../../src/core/types";
import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";

describe("git table diff", () => {
  it("extracts rendered Markdown table matrices from HTML", () => {
    const tables = extractRenderedTablesFromHtml(`<h1>Sample</h1>
<table>
  <thead><tr><th>Name</th><th>Status</th></tr></thead>
  <tbody><tr><td>Basic</td><td><strong>Beta</strong></td></tr></tbody>
</table>`);

    expect(tables).toHaveLength(1);
    expect(tables[0]?.label).toBe("Table 1 · Sample");
    expect(tables[0]?.rows).toEqual([
      ["Name", "Status"],
      ["Basic", "Beta"],
    ]);
    expect(tables[0]?.complex).toBe(false);
  });

  it("does not retain renderer identity metadata in direct table extraction", () => {
    const rendered = renderMarkdownCore(
      "| Name | Status |\n| --- | --- |\n| Boundary | Safe |",
    );
    const tables = extractRenderedTablesFromHtml(rendered.html);

    expect(rendered.html).toContain("data-source-renderer-id");
    expect(JSON.stringify(tables)).not.toContain("svard-renderer-");
    expect(tables[0]?.rows[1]).toEqual(["Boundary", "Safe"]);
  });

  it("extracts rendered AsciiDoc table matrices from HTML", () => {
    const tables = extractRenderedTablesFromHtml(`<table class="tableblock">
  <caption>Table 1. Plans</caption>
  <tbody>
    <tr><td class="tableblock halign-left valign-top"><p>AsciiDoc</p></td><td>Rendered</td></tr>
  </tbody>
</table>`);

    expect(tables).toHaveLength(1);
    expect(tables[0]?.label).toBe("Table 1 · Table 1. Plans");
    expect(tables[0]?.rows).toEqual([["AsciiDoc", "Rendered"]]);
  });

  it("marks span and nested table output as complex fallback", () => {
    const [spanned, nested] = extractRenderedTablesFromHtml(`<table>
  <tr><td colspan="2">Wide</td></tr>
</table>
<table>
  <tr><td><table><tr><td>Nested</td></tr></table></td></tr>
</table>`);

    expect(spanned?.complex).toBe(true);
    expect(nested?.complex).toBe(true);
  });

  it("compares rendered table cells with row changes", () => {
    const diff = compareRenderedTable(
      [
        ["Name", "Status"],
        ["Basic", "Beta"],
      ],
      [
        ["Name", "Status"],
        ["Basic", "Stable"],
        ["Pro", "Stable"],
      ],
    );

    expect(diff.cells[0]?.[0]?.kind).toBe("unchanged");
    expect(diff.cells[1]?.[1]).toEqual({
      left: "Beta",
      right: "Stable",
      kind: "changed",
    });
    expect(diff.cells[2]?.[0]).toEqual({
      left: "",
      right: "Pro",
      kind: "added",
    });
    expect(diff.rowChanges).toEqual([
      { kind: "changed", rowIndex: 1, side: "both" },
      { kind: "added", rowIndex: 2, side: "right" },
    ]);
  });

  it("aligns large table row additions without changing following rows", () => {
    const leftRows = [
      ["Area", "Feature", "Status"],
      ["Documents", "Open files", "Stable"],
      ["Diagrams", "Fast diagram loading", "Stable"],
      ["Files", "File tree", "Stable"],
      ["Search", "Quick Open", "Stable"],
    ];
    const rightRows = [
      ["Area", "Feature", "Status"],
      ["Documents", "Open files", "Stable"],
      ["Diagrams", "Fast diagram loading", "Stable"],
      ["Diagrams", "Local PlantUML SVG cache", "Stable"],
      ["Files", "File tree", "Stable"],
      ["Search", "Quick Open", "Stable"],
    ];

    const diff = compareRenderedTable(leftRows, rightRows);

    expect(diff.fallbackReason).toBeUndefined();
    expect(diff.rowChanges).toEqual([
      { kind: "added", rowIndex: 3, side: "right" },
    ]);
    expect(diff.cells[4]).toEqual([
      { left: "Files", right: "Files", kind: "unchanged" },
      { left: "File tree", right: "File tree", kind: "unchanged" },
      { left: "Stable", right: "Stable", kind: "unchanged" },
    ]);
  });

  it("counts multiple changed cells in one row as one row change", () => {
    const diff = compareRenderedTable(
      [
        ["Name", "Status", "Owner"],
        ["Feature", "Draft", "Team A"],
      ],
      [
        ["Name", "Status", "Owner"],
        ["Feature", "Stable", "Team B"],
      ],
    );

    expect(diff.rowChanges).toEqual([
      { kind: "changed", rowIndex: 1, side: "both" },
    ]);
    expect(
      diff.cells[1]?.filter((cell) => cell.kind === "changed"),
    ).toHaveLength(2);
  });

  it("falls back for duplicate or reordered table rows", () => {
    expect(
      compareRenderedTable(
        [["Name"], ["Duplicate"], ["Duplicate"]],
        [["Name"], ["Duplicate"]],
      ).fallbackReason,
    ).toBe("ambiguous");
    expect(
      compareRenderedTable([["Name"], ["A"], ["B"]], [["Name"], ["B"], ["A"]])
        .fallbackReason,
    ).toBe("ambiguous");
  });

  it("marks changed Markdown and AsciiDoc source table blocks when hunks overlap", () => {
    const markdownPreview: GitDiffPreview = {
      repositoryRoot: null,
      relativePath: "docs/table.md",
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      leftText: "| A | B |\n| --- | --- |\n| old | B |",
      rightText: "| A | B |\n| --- | --- |\n| new | B |",
      message: null,
      hunks: [
        {
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          lines: [
            { kind: "context", oldLine: 1, newLine: 1, text: "| A | B |" },
            { kind: "context", oldLine: 2, newLine: 2, text: "| --- | --- |" },
            { kind: "removed", oldLine: 3, newLine: null, text: "| old | B |" },
            { kind: "added", oldLine: null, newLine: 3, text: "| new | B |" },
          ],
        },
      ],
    };
    const asciidocPreview: GitDiffPreview = {
      ...markdownPreview,
      relativePath: "docs/table.adoc",
      leftText: "|===\n|A |B\n|old\n|===",
      rightText: "|===\n|A |B\n|new\n|===",
      hunks: [
        {
          oldStart: 1,
          oldLines: 4,
          newStart: 1,
          newLines: 4,
          lines: [
            { kind: "context", oldLine: 1, newLine: 1, text: "|===" },
            { kind: "context", oldLine: 2, newLine: 2, text: "|A |B" },
            { kind: "removed", oldLine: 3, newLine: null, text: "|old" },
            { kind: "added", oldLine: null, newLine: 3, text: "|new" },
            { kind: "context", oldLine: 4, newLine: 4, text: "|===" },
          ],
        },
      ],
    };

    expect(changedTableMarkers(markdownPreview)).toEqual([
      { id: "left:0", side: "left", startLine: 1, endLine: 3 },
      { id: "right:0", side: "right", startLine: 1, endLine: 3 },
    ]);
    expect(changedTableMarkers(asciidocPreview)).toEqual([
      { id: "left:0", side: "left", startLine: 1, endLine: 4 },
      { id: "right:0", side: "right", startLine: 1, endLine: 4 },
    ]);
  });

  it("does not mark tables changed for context-only CRLF hunks", () => {
    const preview: GitDiffPreview = {
      repositoryRoot: null,
      relativePath: "docs/table.md",
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      leftText: "| A | B |\n| --- | --- |\n| same | B |\n",
      rightText: "| A | B |\r\n| --- | --- |\r\n| same | B |\r\n",
      message: null,
      hunks: [
        {
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          lines: [
            { kind: "context", oldLine: 1, newLine: 1, text: "| A | B |" },
            { kind: "context", oldLine: 2, newLine: 2, text: "| --- | --- |" },
            { kind: "context", oldLine: 3, newLine: 3, text: "| same | B |" },
          ],
        },
      ],
    };

    expect(changedTableMarkers(preview)).toEqual([]);
  });
});
