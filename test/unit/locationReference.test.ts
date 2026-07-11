import { describe, expect, it } from "vitest";

import type { DocumentPayload, Heading } from "../../src/core/types";
import {
  buildLocationReference,
  locationReferenceForSelection,
} from "../../src/ui/lib/locationReference";

const documentPayload: DocumentPayload = {
  path: "/workspace/docs/guide.md",
  basePath: "/workspace/docs",
  format: "markdown",
  source: "",
  updatedAt: "2026-07-10T00:00:00.000Z",
  resourceContext: {
    workspaceRoot: "/workspace",
    documentDir: "/workspace/docs",
    resourceRoots: ["/workspace"],
  },
};

const headings: Heading[] = [
  { id: "guide", level: 1, text: "Guide" },
  {
    id: "overview",
    level: 2,
    text: "Overview",
    sourceLocation: {
      sourcePath: "/workspace/includes/overview.md",
      line: 12,
      column: 3,
    },
  },
];

describe("location reference", () => {
  it("uses the include origin line as the compact file reference", () => {
    expect(
      buildLocationReference({
        article: null,
        document: documentPayload,
        heading: headings[1],
        sourceReference: "/workspace/includes/overview.md:12:3",
        renderResult: { headings },
        text: "A selected sentence.",
      }),
    ).toBe(`File: /workspace/includes/overview.md:12
Section: Guide > Overview
Text:
A selected sentence.`);
  });

  it("does not invent a source line for a normal paragraph", () => {
    const article = document.createElement("article");
    article.innerHTML = `<h2 id="overview">Overview</h2><p>A selected sentence.</p>`;
    const paragraph = article.querySelector("p")!;
    document.body.append(article);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const value = locationReferenceForSelection({
      article,
      document: documentPayload,
      renderResult: { headings },
      selection: "A selected sentence.",
    });

    window.getSelection()?.removeAllRanges();
    article.remove();
    expect(value).toContain("File: /workspace/docs/guide.md");
    expect(value).toContain("Section: Guide > Overview");
    expect(value).not.toContain(":12");
    expect(value).toContain("Text:\nA selected sentence.");
  });

  it("omits source location for a selection that spans multiple source blocks", () => {
    const article = document.createElement("article");
    article.innerHTML = `<h2 id="overview">Overview</h2><p data-source-reference="/workspace/docs/guide.md:4">First.</p><p data-source-reference="/workspace/docs/guide.md:5">Second.</p>`;
    const paragraphs = article.querySelectorAll("p");
    document.body.append(article);
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild!, 0);
    range.setEnd(paragraphs[1].firstChild!, 7);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const value = locationReferenceForSelection({
      article,
      document: documentPayload,
      renderResult: { headings },
      selection: "First.Second.",
    });

    window.getSelection()?.removeAllRanges();
    article.remove();
    expect(value).toContain("File: /workspace/docs/guide.md");
    expect(value).not.toContain(":4");
    expect(value).toContain("Section: Guide > Overview");
  });

  it("omits the section when a selection crosses headings", () => {
    const article = document.createElement("article");
    article.innerHTML = `<h1 id="guide">Guide</h1><p>First.</p><h2 id="overview">Overview</h2><p>Second.</p>`;
    const paragraphs = article.querySelectorAll("p");
    document.body.append(article);
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild!, 0);
    range.setEnd(paragraphs[1].firstChild!, 7);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const value = locationReferenceForSelection({
      article,
      document: documentPayload,
      renderResult: { headings },
      selection: "First.Second.",
    });

    window.getSelection()?.removeAllRanges();
    article.remove();
    expect(value).not.toContain("Section:");
  });
});
