import { describe, expect, it } from "vitest";

import {
  documentFormatForPath,
  isSupportedDocumentPath,
} from "../../src/core/documentFormat";

describe("document format", () => {
  it("detects AsciiDoc and Markdown paths", () => {
    expect(documentFormatForPath("/workspace/docs/guide.adoc")).toBe(
      "asciidoc",
    );
    expect(documentFormatForPath("/workspace/docs/guide.md")).toBe("markdown");
    expect(documentFormatForPath("/workspace/docs/guide.markdown#intro")).toBe(
      "markdown",
    );
  });

  it("recognizes supported document extensions", () => {
    expect(isSupportedDocumentPath("guide.asciidoc")).toBe(true);
    expect(isSupportedDocumentPath("guide.asc#section")).toBe(true);
    expect(isSupportedDocumentPath("guide.md")).toBe(true);
    expect(isSupportedDocumentPath("guide.markdown")).toBe(true);
    expect(isSupportedDocumentPath("guide.txt")).toBe(false);
  });
});
