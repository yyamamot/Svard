import { afterEach, describe, expect, it, vi } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";

const legacyDetailsMarkerPrefix = "SVARD_MARKDOWN_DETAILS_PLACEHOLDER";
const legacyCompatibilityMarkerPrefix = "SVARD_MARKDOWN_COMPAT_PLACEHOLDER";

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

function legacyFutureMarkerChain(
  kind: "compatibility" | "details",
  depth: number,
): string {
  return Array.from({ length: depth }, (_, index) => {
    const nextMarker =
      index + 1 < depth
        ? `${kind === "details" ? legacyDetailsMarkerPrefix : legacyCompatibilityMarkerPrefix}_${index + 1}`
        : "chain leaf";
    if (kind === "details") {
      return `<details><summary>Level ${index}</summary>\n\n${nextMarker}\n\n${nextMarker}\n</details>`;
    }
    return `| --- | --- |\n| Level ${index} | ${nextMarker} ${nextMarker} |`;
  }).join("\n\n");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderMarkdownCore", () => {
  it("keeps renderer placeholder line identity after titled admonition expansion", () => {
    const result = renderMarkdownCore(`!!! note "Expanded title"
    Admonition body.

<details><summary>Details after admonition</summary>

Details body.
</details>

| --- | --- |
| Compatibility | after admonition |
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(doc.querySelectorAll(".markdown-alert-note")).toHaveLength(1);
    expect(doc.querySelectorAll(".markdown-details")).toHaveLength(1);
    expect(doc.querySelectorAll("table")).toHaveLength(1);
  });

  it("keeps author-provided legacy placeholder markers literal", () => {
    const result = renderMarkdownCore(`${legacyDetailsMarkerPrefix}_0

${legacyCompatibilityMarkerPrefix}_0

<details><summary>Actual details</summary>

Details body.
</details>

| --- | --- |
| Actual | compatibility table |
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(doc.querySelectorAll(".markdown-details")).toHaveLength(1);
    expect(doc.querySelectorAll("table")).toHaveLength(1);
    expect(doc.body.textContent).toContain(`${legacyDetailsMarkerPrefix}_0`);
    expect(doc.body.textContent).toContain(
      `${legacyCompatibilityMarkerPrefix}_0`,
    );
  });

  it("regenerates a renderer identity that collides with author source", () => {
    const firstIdentity = "00".repeat(16);
    const collidingMarker = `SVARD_RENDERER_PLACEHOLDER_${firstIdentity}`;
    let calls = 0;
    vi.stubGlobal("crypto", {
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        const bytes = new Uint8Array(
          array.buffer,
          array.byteOffset,
          array.byteLength,
        );
        bytes.fill(calls === 0 ? 0 : 1);
        calls += 1;
        return array;
      },
    });

    const result = renderMarkdownCore(`${collidingMarker}

<details><summary>Actual details</summary>

Body.
</details>
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(calls).toBe(2);
    expect(doc.querySelectorAll(".markdown-details")).toHaveLength(1);
    expect(doc.body.textContent).toContain(collidingMarker);
  });

  it("does not restore compatibility placeholders inserted by a details replacement", () => {
    const marker = `${legacyCompatibilityMarkerPrefix}_0`;
    const result = renderMarkdownCore(`<details><summary>Mixed chain</summary>

${marker}

${marker}
</details>

| --- | --- |
| Actual | compatibility table |
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(doc.querySelectorAll(".markdown-details")).toHaveLength(1);
    expect(doc.querySelectorAll("table")).toHaveLength(1);
    expect(countOccurrences(doc.body.textContent ?? "", marker)).toBe(2);
  });

  it.each(["details", "compatibility"] as const)(
    "keeps 5/10/15-level %s future-marker chains linear",
    (kind) => {
      const measurements = [5, 10, 15].map((depth) => {
        const result = renderMarkdownCore(legacyFutureMarkerChain(kind, depth));
        const doc = new DOMParser().parseFromString(result.html, "text/html");
        const markerPrefix =
          kind === "details"
            ? legacyDetailsMarkerPrefix
            : legacyCompatibilityMarkerPrefix;

        expect(
          doc.querySelectorAll(
            kind === "details" ? ".markdown-details" : "table",
          ),
        ).toHaveLength(depth);
        expect(countOccurrences(doc.body.textContent ?? "", markerPrefix)).toBe(
          (depth - 1) * 2,
        );

        return new TextEncoder().encode(result.html).byteLength;
      });

      const firstGrowth = measurements[1] - measurements[0];
      const secondGrowth = measurements[2] - measurements[1];
      expect(secondGrowth).toBeLessThanOrEqual(firstGrowth + 512);
      expect(measurements[2]).toBeLessThan(measurements[0] * 4);
    },
  );

  it("does not expose renderer placeholder paragraphs as source text blocks", () => {
    const result = renderMarkdownCore(`Before.

<details><summary>Details</summary>

Body.
</details>

| --- | --- |
| Compatibility | table |

After.
`);

    expect(result.sourceTextBlocks).toEqual([
      { id: "text-1", kind: "paragraph", startLine: 1, endLine: 1 },
      { id: "text-2", kind: "paragraph", startLine: 11, endLine: 11 },
    ]);
    expect(result.html).not.toContain("data-source-text-block-id");
    const paragraphProvenance =
      result.markdownRendererProvenance?.filter(
        (record) => record.kind === "paragraph",
      ) ?? [];
    expect(
      paragraphProvenance.map((record) => record.sourceTextBlockId),
    ).toEqual(["text-1", "text-2"]);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    expect(
      Array.from(
        doc.querySelectorAll<HTMLElement>("p[data-source-renderer-id]"),
        (paragraph) => paragraph.dataset.sourceRendererId,
      ),
    ).toEqual(paragraphProvenance.map((record) => record.id));
  });

  it("fails closed with a fixed privacy-safe error when a placeholder is not an independent paragraph", () => {
    const privateSource = `private /workspace/secret.md
<details><summary>Malformed placeholder shape</summary>

private-token-123
</details>`;
    let thrown: unknown;

    try {
      renderMarkdownCore(privateSource);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      "Markdown rendering stopped because renderer placeholder integrity validation failed.",
    );
    expect((thrown as Error).message).not.toContain("/workspace/secret.md");
    expect((thrown as Error).message).not.toContain("private-token-123");
  });
});
