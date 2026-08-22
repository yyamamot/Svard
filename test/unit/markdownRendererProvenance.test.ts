import { describe, expect, it } from "vitest";

import type { MarkdownRendererProvenance } from "../../src/core/types";
import {
  MARKDOWN_RENDERER_ID_ATTRIBUTE,
  validateMarkdownRendererProvenance,
} from "../../src/ui/lib/markdownRendererProvenance";

const nonce = "11".repeat(16);
const rendererId = (sequence: number) =>
  `svard-renderer-${nonce}-${sequence.toString(36)}`;

function spanOf(source: string, value: string) {
  const startOffset = source.indexOf(value);
  return { startOffset, endOffset: startOffset + value.length };
}

function validationFixture() {
  const source = [
    "# Title",
    "",
    "Paragraph.",
    "",
    "```ts",
    "const value = 1;",
    "```",
  ].join("\r\n");
  const records: MarkdownRendererProvenance[] = [
    {
      id: rendererId(0),
      kind: "heading",
      tagName: "h1",
      sourceSpan: spanOf(source, "# Title"),
      headingId: "title",
      sourceSelectionBlockId: "selection-heading",
    },
    {
      id: rendererId(1),
      kind: "paragraph",
      tagName: "p",
      sourceSpan: spanOf(source, "Paragraph."),
      sourceTextBlockId: "text-paragraph",
      sourceSelectionBlockId: "selection-paragraph",
    },
    {
      id: rendererId(2),
      kind: "source",
      tagName: "pre",
      sourceSpan: spanOf(source, "```ts\r\nconst value = 1;\r\n```"),
      sourceBlockId: "source-code",
      sourceSelectionBlockId: "selection-code",
    },
  ];
  const html = `<h1 id="title" ${MARKDOWN_RENDERER_ID_ATTRIBUTE}="${rendererId(0)}">Title</h1><p ${MARKDOWN_RENDERER_ID_ATTRIBUTE}="${rendererId(1)}">Paragraph.</p><pre ${MARKDOWN_RENDERER_ID_ATTRIBUTE}="${rendererId(2)}"><code>const value = 1;</code></pre>`;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const metadata = {
    headings: [
      {
        id: "title",
        level: 1,
        text: "Title",
        sourceLocation: { line: 1 },
      },
    ],
    sourceBlocks: [
      {
        id: "source-code",
        language: "ts",
        sourceLocation: { line: 5 },
      },
    ],
    sourceTextBlocks: [
      {
        id: "text-paragraph",
        kind: "paragraph" as const,
        startLine: 3,
        endLine: 3,
      },
    ],
    sourceSelectionBlocks: [
      {
        id: "selection-heading",
        kind: "heading" as const,
        startLine: 1,
        endLine: 1,
      },
      {
        id: "selection-paragraph",
        kind: "paragraph" as const,
        startLine: 3,
        endLine: 3,
      },
      {
        id: "selection-code",
        kind: "code" as const,
        startLine: 5,
        endLine: 7,
      },
    ],
  };
  return { doc, metadata, records, source };
}

describe("validateMarkdownRendererProvenance", () => {
  it("validates exact renderer identity, UTF-16 span, tag, and typed metadata without mutating DOM", () => {
    const fixture = validationFixture();
    const result = validateMarkdownRendererProvenance(
      fixture.doc.body,
      fixture.source,
      fixture.records,
      fixture.metadata,
    );

    expect(result.status).toBe("valid");
    expect(result.entries).toHaveLength(3);
    expect(
      fixture.doc.body.querySelectorAll(`[${MARKDOWN_RENDERER_ID_ATTRIBUTE}]`),
    ).toHaveLength(3);
  });

  it.each([
    {
      name: "missing DOM identity",
      mutate: ({ doc }: ReturnType<typeof validationFixture>) =>
        doc.body
          .querySelector("p")
          ?.removeAttribute(MARKDOWN_RENDERER_ID_ATTRIBUTE),
    },
    {
      name: "duplicate DOM identity",
      mutate: ({ doc }: ReturnType<typeof validationFixture>) =>
        doc.body
          .querySelector("p")
          ?.setAttribute(MARKDOWN_RENDERER_ID_ATTRIBUTE, rendererId(0)),
    },
    {
      name: "tag mismatch",
      mutate: ({ records }: ReturnType<typeof validationFixture>) => {
        records[1] = { ...records[1], tagName: "div" };
      },
    },
    {
      name: "unknown prototype-named kind",
      mutate: ({ records }: ReturnType<typeof validationFixture>) => {
        (records[1] as unknown as { kind: string }).kind = "__proto__";
      },
    },
    {
      name: "source order mismatch",
      mutate: ({ records }: ReturnType<typeof validationFixture>) => {
        records[1] = { ...records[1], sourceSpan: records[2].sourceSpan };
      },
    },
    {
      name: "typed metadata mismatch",
      mutate: ({ records }: ReturnType<typeof validationFixture>) => {
        const paragraph = records[1];
        if (paragraph.kind === "paragraph") {
          records[1] = {
            ...paragraph,
            sourceSelectionBlockId: "selection-heading",
          };
        }
      },
    },
    {
      name: "renderer nonce replayed by source",
      mutate: (fixture: ReturnType<typeof validationFixture>) => {
        fixture.source += `\nsvard-renderer-${nonce}-author`;
      },
    },
  ])("rejects the whole provenance document for $name", ({ mutate }) => {
    const fixture = validationFixture();
    mutate(fixture);
    const result = validateMarkdownRendererProvenance(
      fixture.doc.body,
      fixture.source,
      fixture.records,
      fixture.metadata,
    );

    expect(result).toEqual({ status: "rejected", entries: [] });
  });

  it("rejects a source span that splits an emoji surrogate pair", () => {
    const source = "😀 text";
    const id = rendererId(0);
    const doc = new DOMParser().parseFromString(
      `<p ${MARKDOWN_RENDERER_ID_ATTRIBUTE}="${id}">text</p>`,
      "text/html",
    );
    const result = validateMarkdownRendererProvenance(
      doc.body,
      source,
      [
        {
          id,
          kind: "paragraph",
          tagName: "p",
          sourceSpan: { startOffset: 1, endOffset: source.length },
          sourceTextBlockId: "text-1",
        },
      ],
      {
        headings: [],
        sourceBlocks: [],
        sourceTextBlocks: [
          {
            id: "text-1",
            kind: "paragraph",
            startLine: 1,
            endLine: 1,
          },
        ],
      },
    );

    expect(result.status).toBe("rejected");
  });

  it("validates the footnote namespace and rejects heading collisions or broken backrefs", () => {
    const source = "Text[^one].\n\n[^one]: Note";
    const id = rendererId(0);
    const record: MarkdownRendererProvenance = {
      id,
      kind: "paragraph",
      tagName: "p",
      sourceSpan: spanOf(source, "Text[^one]."),
      sourceTextBlockId: "text-1",
    };
    const html = `<p ${MARKDOWN_RENDERER_ID_ATTRIBUTE}="${id}">Text<sup class="footnote-ref"><a href="#svard-footnote-item-1" id="svard-footnote-ref-1">[1]</a></sup>.</p><ol><li id="svard-footnote-item-1" class="footnote-item">Note <a href="#svard-footnote-ref-1" class="footnote-backref">back</a></li></ol>`;
    const metadata = {
      headings: [],
      sourceBlocks: [],
      sourceTextBlocks: [
        {
          id: "text-1",
          kind: "paragraph" as const,
          startLine: 1,
          endLine: 1,
        },
      ],
    };
    const validDoc = new DOMParser().parseFromString(html, "text/html");
    expect(
      validateMarkdownRendererProvenance(
        validDoc.body,
        source,
        [record],
        metadata,
      ).status,
    ).toBe("valid");

    const brokenDoc = new DOMParser().parseFromString(
      `${html}<h2 id="svard-footnote-item-2">collision</h2>`,
      "text/html",
    );
    expect(
      validateMarkdownRendererProvenance(
        brokenDoc.body,
        source,
        [record],
        metadata,
      ).status,
    ).toBe("rejected");
  });
});
