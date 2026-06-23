import { describe, expect, it } from "vitest";

import { extractAsciiDocDocumentAttributes } from "../../src/core/asciidocAttributes";

describe("AsciiDoc document attributes", () => {
  it("renders root header attributes as a collapsed metadata table", () => {
    const result = extractAsciiDocDocumentAttributes(`= Guide
:toc:
:icons: font
:imagesdir: assets
:sectnums:
:empty:
:feature!:
:!legacy:

Body.
`);

    expect(result.parsed).toBe(true);
    expect(result.rows).toEqual([
      { name: "toc", value: "", kind: "empty" },
      { name: "icons", value: "font", kind: "set" },
      { name: "imagesdir", value: "assets", kind: "set" },
      { name: "sectnums", value: "", kind: "empty" },
      { name: "empty", value: "", kind: "empty" },
      { name: "feature", value: "", kind: "unset" },
      { name: "legacy", value: "", kind: "unset" },
    ]);
    expect(result.htmlPrefix).toContain(
      'class="markdown-frontmatter asciidoc-document-attributes"',
    );
    expect(result.htmlPrefix).toContain("Document Attributes");
    expect(result.htmlPrefix).toContain("7 items");
    expect(result.htmlPrefix).toContain("<th>icons</th><td>font</td>");
    expect(result.htmlPrefix).toContain(
      '<th>feature</th><td><span class="frontmatter-null">unset</span></td>',
    );
  });

  it("ignores attribute-like source lines outside the root document header", () => {
    const result = extractAsciiDocDocumentAttributes(`= Guide
:toc:

[source]
----
:secret: not metadata
----
`);

    expect(result.rows.map((row) => row.name)).toEqual(["toc"]);
    expect(result.htmlPrefix).not.toContain("secret");
  });

  it("does not render backend-only attributes when the document has none", () => {
    const result = extractAsciiDocDocumentAttributes(`= Guide

Body.
`);

    expect(result.htmlPrefix).toBe("");
    expect(result.rows).toEqual([]);
  });

  it("escapes unsafe attribute names and values", () => {
    const result = extractAsciiDocDocumentAttributes(`= Guide
:safe-name: <script>alert(1)</script>
:bad<name: value

Body.
`);

    expect(result.htmlPrefix).toContain(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(result.htmlPrefix).toContain("bad&lt;name");
    expect(result.htmlPrefix).not.toContain("<script>");
  });
});
