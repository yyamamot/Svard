import { afterEach, describe, expect, it, vi } from "vitest";

import { renderMarkdownDocument } from "../../src/core/markdown/render";
import {
  MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR,
  MAX_MARKDOWN_RENDERER_PROVENANCE_NONCE_ATTEMPTS,
  MAX_MARKDOWN_RENDERER_PROVENANCE_RECORDS,
  MarkdownRendererProvenanceRegistry,
  type MarkdownRendererProvenanceInput,
} from "../../src/core/markdown/rendererProvenance";
import { originalLineRangeForTokenMap } from "../../src/core/markdown/sourceSpans";

function nonce(byte: number): string {
  return byte.toString(16).padStart(2, "0").repeat(16);
}

function stubCryptoBytes(nextByte: () => number): () => number {
  let calls = 0;
  vi.stubGlobal("crypto", {
    getRandomValues<T extends ArrayBufferView>(array: T): T {
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(
        nextByte(),
      );
      calls += 1;
      return array;
    },
  });
  return () => calls;
}

function expectFixedIntegrityError(run: () => unknown): void {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toBe(
    MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Markdown renderer provenance registry", () => {
  it("regenerates one per-render 128-bit nonce on a source collision", () => {
    let identityByte = 0;
    const calls = stubCryptoBytes(() => identityByte++);
    const source = `svard-renderer-${nonce(0)}-0\nfirst\nsecond`;
    const firstStart = source.indexOf("first");
    const secondStart = source.indexOf("second");
    const registry = new MarkdownRendererProvenanceRegistry(source);

    const firstId = registry.add({
      kind: "paragraph",
      sourceSpan: {
        startOffset: firstStart,
        endOffset: firstStart + "first".length,
      },
      sourceTextBlockId: "text-1",
      tagName: "p",
    });
    const secondId = registry.add({
      kind: "list",
      sourceSpan: {
        startOffset: secondStart,
        endOffset: secondStart + "second".length,
      },
      tagName: "ul",
    });

    expect(firstId).toBe(`svard-renderer-${nonce(1)}-0`);
    expect(secondId).toBe(`svard-renderer-${nonce(1)}-1`);
    expect(calls()).toBe(2);
    expect(registry.records().map((record) => record.id)).toEqual([
      firstId,
      secondId,
    ]);
  });

  it("fails with the fixed error after eight colliding nonces", () => {
    let identityByte = 0;
    const calls = stubCryptoBytes(() => identityByte++);
    const source = `${Array.from(
      { length: MAX_MARKDOWN_RENDERER_PROVENANCE_NONCE_ATTEMPTS },
      (_, index) => `svard-renderer-${nonce(index)}-0`,
    ).join(" ")} private-value`;
    const startOffset = source.indexOf("private-value");
    const registry = new MarkdownRendererProvenanceRegistry(source);

    expectFixedIntegrityError(() =>
      registry.add({
        kind: "paragraph",
        sourceSpan: {
          startOffset,
          endOffset: startOffset + "private-value".length,
        },
        sourceTextBlockId: "text-1",
        tagName: "p",
      }),
    );
    expect(calls()).toBe(MAX_MARKDOWN_RENDERER_PROVENANCE_NONCE_ATTEMPTS);
  });

  it("rejects unavailable crypto and invalid UTF-16 span boundaries", () => {
    vi.stubGlobal("crypto", {});
    const source = "😀 private-value";
    const registry = new MarkdownRendererProvenanceRegistry(source);

    expectFixedIntegrityError(() =>
      registry.add({
        kind: "paragraph",
        sourceSpan: { startOffset: 0, endOffset: source.length },
        sourceTextBlockId: "text-1",
        tagName: "p",
      }),
    );

    vi.stubGlobal("crypto", {
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        return array;
      },
    });
    const invalidSpanRegistry = new MarkdownRendererProvenanceRegistry(source);
    expectFixedIntegrityError(() =>
      invalidSpanRegistry.add({
        kind: "paragraph",
        sourceSpan: { startOffset: 1, endOffset: source.length },
        sourceTextBlockId: "text-1",
        tagName: "p",
      }),
    );
  });

  it("uses the fixed error when getRandomValues throws", () => {
    vi.stubGlobal("crypto", {
      getRandomValues(): never {
        throw new Error("private entropy provider failure");
      },
    });
    const registry = new MarkdownRendererProvenanceRegistry("private");

    expectFixedIntegrityError(() =>
      registry.add({
        kind: "paragraph",
        sourceSpan: { startOffset: 0, endOffset: 7 },
        sourceTextBlockId: "text-1",
        tagName: "p",
      }),
    );
  });

  it.each([
    { name: "empty", startOffset: 0, endOffset: 0 },
    { name: "reversed", startOffset: 4, endOffset: 2 },
    { name: "negative", startOffset: -1, endOffset: 2 },
    { name: "fractional", startOffset: 0.5, endOffset: 2 },
    { name: "out of range", startOffset: 0, endOffset: 99 },
    { name: "half surrogate", startOffset: 1, endOffset: 4 },
  ])("rejects a $name source span", ({ startOffset, endOffset }) => {
    const registry = new MarkdownRendererProvenanceRegistry("😀ab");
    expectFixedIntegrityError(() =>
      registry.add({
        kind: "paragraph",
        sourceSpan: { startOffset, endOffset },
        sourceTextBlockId: "text-1",
        tagName: "p",
      }),
    );
  });

  it.each([
    { kind: "heading", tagName: "p" },
    { kind: "paragraph", tagName: "div" },
    { kind: "list", tagName: "menu" },
    { kind: "source", tagName: "code" },
    { kind: "table", tagName: "div" },
    { kind: "diagram", tagName: "figure" },
    { kind: "frontmatter", tagName: "section" },
    { kind: "details", tagName: "div" },
  ])("rejects a $kind/$tagName mismatch", ({ kind, tagName }) => {
    const registry = new MarkdownRendererProvenanceRegistry("source");
    const input = {
      kind,
      sourceSpan: { startOffset: 0, endOffset: 6 },
      tagName,
      ...(kind === "heading"
        ? { headingId: "heading", sourceSelectionBlockId: "selection-1" }
        : {}),
      ...(kind === "paragraph" ? { sourceTextBlockId: "text-1" } : {}),
      ...(kind === "source"
        ? { sourceBlockId: "source-1", sourceSelectionBlockId: "selection-1" }
        : {}),
      ...(kind === "table" ? { tableKind: "standard" } : {}),
      ...(kind === "diagram"
        ? { diagramId: "mermaid-1", sourceSelectionBlockId: "selection-1" }
        : {}),
    } as MarkdownRendererProvenanceInput;

    expectFixedIntegrityError(() => registry.add(input));
  });

  it("rejects overlapping records and compatibility selection metadata", () => {
    stubCryptoBytes(() => 1);
    const registry = new MarkdownRendererProvenanceRegistry("first second");
    registry.add({
      kind: "paragraph",
      sourceSpan: { startOffset: 0, endOffset: 5 },
      sourceTextBlockId: "text-1",
      tagName: "p",
    });
    registry.add({
      kind: "list",
      sourceSpan: { startOffset: 4, endOffset: 12 },
      tagName: "ul",
    });
    expectFixedIntegrityError(() => registry.records());

    const compatibility = new MarkdownRendererProvenanceRegistry("table");
    expectFixedIntegrityError(() =>
      compatibility.add({
        kind: "table",
        sourceSelectionBlockId: "selection-table-1",
        sourceSpan: { startOffset: 0, endOffset: 5 },
        tableKind: "compatibility",
        tagName: "table",
      } as unknown as MarkdownRendererProvenanceInput),
    );
  });

  it("rejects duplicate or noncontiguous output-to-original line maps", () => {
    expect(originalLineRangeForTokenMap([0, 2], [0, 0], 0)).toBeNull();
    expect(originalLineRangeForTokenMap([0, 2], [0, 2], 0)).toBeNull();
    expect(originalLineRangeForTokenMap([0, 2], [2, 3], 4)).toEqual({
      startLine: 6,
      endLine: 8,
    });
  });
});

describe("Markdown renderer provenance production", () => {
  it("emits source-ordered exact CRLF spans for renderer-owned roots", () => {
    const source = [
      "---",
      "title: Test",
      "---",
      "# Heading",
      "",
      "Paragraph 😀.",
      "",
      "- item",
      "",
      "```ts",
      "const value = 1;",
      "```",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| A | B |",
      "",
      "```mermaid",
      "flowchart LR",
      "```",
      "",
      "<details><summary>More</summary>",
      "Body.",
      "</details>",
      "",
      "| --- | --- |",
      "| Compatibility | table |",
    ].join("\r\n");
    const result = renderMarkdownDocument(source);
    const records = result.markdownRendererProvenance ?? [];
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(records.map((record) => record.kind)).toEqual([
      "frontmatter",
      "heading",
      "paragraph",
      "list",
      "source",
      "table",
      "diagram",
      "details",
      "table",
    ]);
    expect(
      records.map((record) =>
        source.slice(
          record.sourceSpan.startOffset,
          record.sourceSpan.endOffset,
        ),
      ),
    ).toEqual([
      "---\r\ntitle: Test\r\n---",
      "# Heading",
      "Paragraph 😀.",
      "- item",
      "```ts\r\nconst value = 1;\r\n```",
      "| Name | Value |\r\n| --- | --- |\r\n| A | B |",
      "```mermaid\r\nflowchart LR\r\n```",
      "<details><summary>More</summary>\r\nBody.\r\n</details>",
      "| --- | --- |\r\n| Compatibility | table |",
    ]);
    expect(
      Array.from(
        doc.querySelectorAll<HTMLElement>("[data-source-renderer-id]"),
        (element) => ({
          id: element.dataset.sourceRendererId,
          tagName: element.localName,
        }),
      ),
    ).toEqual(
      records.map((record) => ({ id: record.id, tagName: record.tagName })),
    );
    const identityParts = records.map((record) =>
      /^svard-renderer-([0-9a-f]{32})-([0-9a-z]+)$/u.exec(record.id),
    );
    expect(identityParts.every(Boolean)).toBe(true);
    expect(new Set(identityParts.map((match) => match?.[1])).size).toBe(1);
    expect(new Set(records.map((record) => record.id)).size).toBe(
      records.length,
    );
    expect(result.html).not.toContain("data-source-text-block-id");
    expect(
      doc.querySelector(
        "details.markdown-details .markdown-details-body [data-source-renderer-id]",
      ),
    ).toBeNull();
    const compatibility = records.find(
      (record) =>
        record.kind === "table" && record.tableKind === "compatibility",
    );
    expect(compatibility).not.toHaveProperty("sourceSelectionBlockId");
  });

  it("places source provenance on pre without leaking it to code", () => {
    const result = renderMarkdownDocument(
      "```ts\nconst privateValue = true;\n```\n",
    );
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const pre = doc.querySelector("pre");
    const code = pre?.querySelector(":scope > code");

    expect(pre?.getAttribute("data-source-renderer-id")).toBe(
      result.markdownRendererProvenance?.[0]?.id,
    );
    expect(pre?.classList.contains("hljs")).toBe(true);
    expect(code?.classList.contains("language-ts")).toBe(true);
    expect(code?.hasAttribute("data-source-renderer-id")).toBe(false);
  });

  it("shields details internals without consuming provenance identities", () => {
    const source = [
      "<details><summary>Shield</summary>",
      "",
      "# Nested heading",
      "",
      "Nested paragraph.",
      "",
      "```ts",
      "const nested = true;",
      "```",
      "</details>",
      "",
      "After.",
    ].join("\n");
    const result = renderMarkdownDocument(source);
    const records = result.markdownRendererProvenance ?? [];
    const details = records.find((record) => record.kind === "details");
    const paragraph = records.find((record) => record.kind === "paragraph");
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(records).toHaveLength(2);
    expect(details?.id).toMatch(/-0$/u);
    expect(paragraph?.id).toMatch(/-1$/u);
    expect(
      doc.querySelector(".markdown-details-body [data-source-renderer-id]"),
    ).toBeNull();
  });

  it("uses reserved footnote IDs and keeps heading IDs outside that namespace", () => {
    const source = `# svard-footnote-item-1

First[^one] and again[^one].

[^one]: Footnote body.`;
    const result = renderMarkdownDocument(source);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(doc.querySelector("h1")?.id).toBe("heading-svard-footnote-item-1");
    expect(
      doc.querySelector("#svard-footnote-ref-1")?.getAttribute("href"),
    ).toBe("#svard-footnote-item-1");
    expect(
      doc.querySelector("#svard-footnote-ref-1-2")?.getAttribute("href"),
    ).toBe("#svard-footnote-item-1");
    expect(doc.querySelector("#svard-footnote-item-1")).toBeTruthy();
    expect(
      doc.querySelector(".footnotes [data-source-renderer-id]"),
    ).toBeNull();
    expect(
      Array.from(
        doc.querySelectorAll("#svard-footnote-item-1 .footnote-backref"),
        (anchor) => anchor.getAttribute("href"),
      ),
    ).toEqual(["#svard-footnote-ref-1", "#svard-footnote-ref-1-2"]);
  });

  it("keeps Setext heading selection and provenance parity", () => {
    const source = "Setext title\r\n============\r\n";
    const result = renderMarkdownDocument(source);
    const heading = result.headings[0];
    const selection = result.sourceSelectionBlocks?.find(
      (block) => block.kind === "heading",
    );
    const provenance = result.markdownRendererProvenance?.find(
      (record) => record.kind === "heading",
    );

    expect(selection).toMatchObject({ startLine: 1, endLine: 2 });
    expect(provenance).toMatchObject({
      headingId: heading.id,
      sourceSelectionBlockId: selection?.id,
    });
    expect(
      source.slice(
        provenance?.sourceSpan.startOffset,
        provenance?.sourceSpan.endOffset,
      ),
    ).toBe("Setext title\r\n============");
  });

  it("does not misclassify a list followed by a thematic break as Setext", () => {
    const result = renderMarkdownDocument("- item\n---\n");

    expect(result.sourceSelectionBlocks).not.toContainEqual(
      expect.objectContaining({ kind: "heading" }),
    );
    expect(result.markdownRendererProvenance).not.toContainEqual(
      expect.objectContaining({ kind: "heading" }),
    );
    expect(result.markdownRendererProvenance).toContainEqual(
      expect.objectContaining({ kind: "list" }),
    );
  });

  it("omits provenance for empty Markdown and non-exact transformed blocks", () => {
    expect(renderMarkdownDocument("")).not.toHaveProperty(
      "markdownRendererProvenance",
    );

    const source = `!!! note "Generated title"
    Body.

After.`;
    const result = renderMarkdownDocument(source);
    const records = result.markdownRendererProvenance ?? [];

    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe("paragraph");
    expect(
      source.slice(
        records[0].sourceSpan.startOffset,
        records[0].sourceSpan.endOffset,
      ),
    ).toBe("After.");
  });

  it("indexes source-selection ranges once within the provenance record budget", () => {
    const blockCount = MAX_MARKDOWN_RENDERER_PROVENANCE_RECORDS;
    const source = Array.from(
      { length: blockCount },
      (_, index) => `paragraph-${index}`,
    ).join("\n\n");
    const startedAt = performance.now();

    const result = renderMarkdownDocument(source);

    expect(result.markdownRendererProvenance).toHaveLength(blockCount);
    expect(performance.now() - startedAt).toBeLessThan(2_500);
  });

  it("accepts the provenance record limit and rejects the next block", () => {
    const withinBudget = Array.from(
      { length: MAX_MARKDOWN_RENDERER_PROVENANCE_RECORDS },
      (_, index) => `paragraph-${index}`,
    ).join("\n\n");
    const overBudget = `${withinBudget}\n\nover-budget`;

    expect(
      renderMarkdownDocument(withinBudget).markdownRendererProvenance,
    ).toHaveLength(MAX_MARKDOWN_RENDERER_PROVENANCE_RECORDS);
    expectFixedIntegrityError(() => renderMarkdownDocument(overBudget));
  });

  it("fails through the fixed privacy-safe path when crypto is unavailable", () => {
    vi.stubGlobal("crypto", {});
    const source = "private /workspace/secret.md token-123";
    let thrown: unknown;

    try {
      renderMarkdownDocument(source);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR,
    );
    expect((thrown as Error).message).not.toContain("/workspace/secret.md");
    expect((thrown as Error).message).not.toContain("token-123");

    stubCryptoBytes(() => 7);
    const recovered = renderMarkdownDocument("Recovered.");
    expect(recovered.markdownRendererProvenance).toHaveLength(1);
  });
});
