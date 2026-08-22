import { describe, expect, it } from "vitest";

import type { AsciiDocIncludeFile } from "../../src/core/types";
import {
  renderAsciiDocContract,
  renderMarkdownContract,
  svgImageResult,
} from "./renderContractTestUtils";

const documentPath = "/workspace/docs/source-map.adoc";

describe("source map render contract", () => {
  it("does not map unsupported or typed Markdown author HTML onto source actions", async () => {
    const source = `<pre data-source-reference="/private/source.md:1">author pre</pre>

<table data-source-line="1"><tr><td>author table</td></tr></table>`;
    const { doc, renderResult } = await renderMarkdownContract({ source });

    expect(renderResult.markdownAuthorHtmlFragments).toEqual([
      expect.objectContaining({ kind: "block" }),
    ]);
    expect(renderResult.sourceBlocks).toEqual([]);
    expect(doc.querySelector("pre, .source-block-frame")).toBeNull();
    expect(doc.querySelector("table.markdown-safe-html-block")).not.toBeNull();
    expect(
      doc.querySelector(
        "[data-source-reference],[data-source-line],[data-copy-source-button]",
      ),
    ).toBeNull();
    expect(doc.body.textContent).toContain('<pre data-source-reference="');
    expect(doc.body.textContent).toContain("author table");
  });

  it("keeps heading, include, source block, table, and image source metadata stable", async () => {
    const includeFiles: AsciiDocIncludeFile[] = [
      {
        path: "/workspace/docs/partials/included.adoc",
        source: `== Included Heading

[source,js]
----
const included = true;
----

Included paragraph.`,
      },
    ];
    const { doc, renderResult } = await renderAsciiDocContract({
      source: `= Source Map Contract

== Root Heading

include::partials/included.adoc[leveloffset=+1]

== Table Heading

.Source Map Table
|===
|Name |Value

|Root
|Table
|===

== Image Heading

image::images/root.svg[Root Source Image]`,
      documentPath,
      documentDir: "/workspace/docs",
      includeFiles,
      resolveLocalImage: () => svgImageResult("root image"),
    });

    expect(renderResult).not.toHaveProperty("markdownAuthorHtmlFragments");
    const rootHeading = renderResult.headings.find(
      (heading) => heading.text === "Root Heading",
    );
    const includedHeading = renderResult.headings.find(
      (heading) => heading.text === "Included Heading",
    );
    expect(rootHeading?.sourceLocation?.sourcePath).toBe(documentPath);
    expect(includedHeading?.sourceLocation).toMatchObject({
      line: 3,
      sourcePath: documentPath,
    });
    expect(renderResult.sourceBlocks[0]).toMatchObject({
      language: "js",
      sourceLocation: {
        line: 3,
        sourcePath: "/workspace/docs/partials/included.adoc",
      },
    });

    const includedDomHeading = Array.from(
      doc.querySelectorAll("h2, h3, h4"),
    ).find((heading) => heading.textContent?.trim() === "Included Heading");
    expect(includedDomHeading).toBeTruthy();
    expect(
      doc
        .querySelector(".source-block-frame")
        ?.getAttribute("data-source-reference"),
    ).toBe("/workspace/docs/partials/included.adoc:3");

    const table = doc.querySelector("table.tableblock");
    expect(table?.getAttribute("data-review-id")).toBe("rendered-table");
    expect(table?.getAttribute("data-source-line")).toBe("22");
    expect(table?.getAttribute("data-source-reference")).toBe(
      "/workspace/docs/source-map.adoc:22",
    );
    expect(table?.querySelector("caption.title")?.textContent).toContain(
      "Source Map Table",
    );

    const image = doc.querySelector('img[alt="Root Source Image"]');
    expect(image?.getAttribute("data-image-path")).toBe("images/root.svg");
    expect(image?.getAttribute("data-image-reference")).toBe(documentPath);
  });
});
