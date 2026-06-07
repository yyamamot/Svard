import { describe, expect, it, vi } from "vitest";

import type { DocumentPayload, Heading } from "../../src/core/types";
import { addHeadingItems } from "../../src/ui/hooks/documentLinks/contextMenuItems";
import { sectionSourceForHeading } from "../../src/ui/lib/sectionCopy";
import type { ContextMenuItem } from "../../src/ui/types";

function documentPayload(source: string): DocumentPayload {
  return {
    path: "/workspace/docs/guide.md",
    basePath: "/workspace/docs",
    format: "markdown",
    source,
    updatedAt: "2026-06-03T00:00:00.000Z",
  };
}

const headings: Heading[] = [
  { id: "intro", level: 1, text: "Intro", sourceLocation: { line: 1 } },
  { id: "detail", level: 2, text: "Detail", sourceLocation: { line: 3 } },
  { id: "next", level: 1, text: "Next", sourceLocation: { line: 7 } },
];

describe("section copy helpers", () => {
  it("extracts a section until the next same-or-higher heading", () => {
    expect(
      sectionSourceForHeading({
        documentPayload: documentPayload(`# Intro
Intro text
## Detail
Detail text
### Nested
Nested text
# Next
Next text`),
        headingId: "intro",
        headings,
      }),
    ).toBe(`# Intro
Intro text
## Detail
Detail text
### Nested
Nested text`);
  });

  it("uses EOF as the section boundary when no later heading matches", () => {
    expect(
      sectionSourceForHeading({
        documentPayload: documentPayload(`# Intro
Intro text
## Detail
Detail text`),
        headingId: "detail",
        headings,
      }),
    ).toBe(`## Detail
Detail text`);
  });

  it("does not expose included source paths through source copy", () => {
    expect(
      sectionSourceForHeading({
        documentPayload: documentPayload(`# Intro
include::partial.md[]`),
        headingId: "included",
        headings: [
          {
            id: "included",
            level: 2,
            text: "Included",
            sourceLocation: {
              line: 1,
              sourcePath: "/workspace/docs/partial.md",
            },
          },
        ],
      }),
    ).toBeNull();
  });

  it("returns null when source location is missing", () => {
    expect(
      sectionSourceForHeading({
        documentPayload: documentPayload("# Intro"),
        headingId: "intro",
        headings: [{ id: "intro", level: 1, text: "Intro" }],
      }),
    ).toBeNull();
  });
});

describe("heading context menu section copy", () => {
  it("adds section copy actions for normal viewer headings", () => {
    document.body.innerHTML = `<article data-review-id="document-body">
      <h1 id="intro" data-source-reference="/workspace/docs/guide.md:1#intro">Intro</h1>
      <p>Intro text</p>
    </article>`;
    const items: ContextMenuItem[] = [];

    addHeadingItems(
      items,
      document.querySelector<HTMLElement>("h1")!,
      documentPayload(`# Intro
Intro text`),
      vi.fn(),
      {
        includeSectionCopy: true,
        renderResult: {
          html: "",
          headings,
          sourceBlocks: [],
          diagnostics: [],
          diagramSlots: [],
          mermaidDiagrams: [],
          plantUmlDiagrams: [],
          graphvizDiagrams: [],
          krokiDiagrams: [],
        },
      },
    );

    expect(items.map((item) => item.label)).toEqual([
      "Copy Heading Link",
      "Copy Source Reference",
      "Copy Section",
      "Copy Section Reference",
    ]);
    expect(items[2]?.separatorBefore).toBe(true);
  });

  it("keeps section source copy hidden for included headings", () => {
    document.body.innerHTML = `<article data-review-id="document-body">
      <h2 id="included" data-source-reference="/workspace/docs/partial.md:1#included">Included</h2>
      <p>Included text</p>
    </article>`;
    const items: ContextMenuItem[] = [];

    addHeadingItems(
      items,
      document.querySelector<HTMLElement>("h2")!,
      documentPayload(`# Intro
include::partial.md[]`),
      vi.fn(),
      {
        includeSectionCopy: true,
        renderResult: {
          html: "",
          headings: [
            {
              id: "included",
              level: 2,
              text: "Included",
              sourceLocation: {
                line: 1,
                sourcePath: "/workspace/docs/partial.md",
              },
            },
          ],
          sourceBlocks: [],
          diagnostics: [],
          diagramSlots: [],
          mermaidDiagrams: [],
          plantUmlDiagrams: [],
          graphvizDiagrams: [],
          krokiDiagrams: [],
        },
      },
    );

    expect(items.map((item) => item.label)).toEqual([
      "Copy Heading Link",
      "Copy Source Reference",
      "Copy Section Reference",
    ]);
  });
});
