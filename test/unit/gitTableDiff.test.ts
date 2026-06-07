import { describe, expect, it } from "vitest";

import {
  changedTableMarkers,
  compareRenderedTable,
  extractRenderedTablesFromHtml,
} from "../../src/ui/lib/gitTableDiff";
import type { GitDiffPreview } from "../../src/core/types";

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

  it("compares rendered table cells by row and column index", () => {
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

    expect(diff[0]?.[0]?.kind).toBe("unchanged");
    expect(diff[1]?.[1]).toEqual({
      left: "Beta",
      right: "Stable",
      kind: "changed",
    });
    expect(diff[2]?.[0]).toEqual({
      left: "",
      right: "Pro",
      kind: "added",
    });
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
