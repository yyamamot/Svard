import { afterEach, describe, expect, it, vi } from "vitest";

import { extractMarkdownCompatibility } from "../../src/core/markdown/compat";
import { extractMarkdownDetails } from "../../src/core/markdown/details";
import { markdown } from "../../src/core/markdown/markdownIt";
import {
  attachMarkdownPlaceholderRegistry,
  bindMarkdownPlaceholderTokens,
  MARKDOWN_PLACEHOLDER_INTEGRITY_ERROR,
  MARKDOWN_RENDER_BUDGET_ERROR,
  markdownFinalHtmlBudgetForSourceBytes,
  markdownPlaceholderTokenType,
  markdownReplacementBudgetForSourceBytes,
  MAX_MARKDOWN_FINAL_HTML_BYTES,
  MAX_MARKDOWN_PLACEHOLDER_ID_ATTEMPTS,
  MAX_MARKDOWN_PLACEHOLDERS,
  MAX_MARKDOWN_REPLACEMENT_HTML_BYTES,
  MIN_MARKDOWN_FINAL_HTML_BYTES,
  MIN_MARKDOWN_REPLACEMENT_HTML_BYTES,
  MarkdownPlaceholderRegistry,
  renderMarkdownTokensWithinBudget,
  utf8ByteLength,
  Utf8ChunkWriter,
} from "../../src/core/markdown/placeholders";

const mebibyte = 1_024 * 1_024;

function rendererMarker(identityByte: number): string {
  const identity = identityByte.toString(16).padStart(2, "0").repeat(16);
  return `SVARD_RENDERER_PLACEHOLDER_${identity}`;
}

function stubCryptoIdentityBytes(nextByte: () => number): () => number {
  let calls = 0;
  vi.stubGlobal("crypto", {
    getRandomValues<T extends ArrayBufferView>(array: T): T {
      const bytes = new Uint8Array(
        array.buffer,
        array.byteOffset,
        array.byteLength,
      );
      bytes.fill(nextByte());
      calls += 1;
      return array;
    },
  });
  return () => calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderRegisteredMarkers(
  registry: MarkdownPlaceholderRegistry,
  markers: string[],
  finalBudgetBytes = MAX_MARKDOWN_FINAL_HTML_BYTES,
): { html: string; tokens: ReturnType<typeof markdown.parse> } {
  const source = markers.join("\n\n");
  const env = {};
  const tokens = markdown.parse(source, env);
  bindMarkdownPlaceholderTokens(tokens, source, registry);
  attachMarkdownPlaceholderRegistry(env, registry);
  const html = renderMarkdownTokensWithinBudget(
    tokens,
    markdown.options,
    env,
    markdown.renderer,
    finalBudgetBytes,
  );
  registry.assertAllRendered();
  return { html, tokens };
}

function renderExtractedPlaceholders(source: string): {
  compatibilityCount: number;
  detailsCount: number;
  html: string;
} {
  const sourceBytes = utf8ByteLength(source);
  const registry = new MarkdownPlaceholderRegistry(
    source,
    markdownReplacementBudgetForSourceBytes(sourceBytes),
  );
  const details = extractMarkdownDetails(source, registry);
  const compatibility = extractMarkdownCompatibility(details.source, registry);
  const env = {};
  const tokens = markdown.parse(compatibility.source, env);
  bindMarkdownPlaceholderTokens(tokens, compatibility.source, registry);
  attachMarkdownPlaceholderRegistry(env, registry);
  const html = renderMarkdownTokensWithinBudget(
    tokens,
    markdown.options,
    env,
    markdown.renderer,
    markdownFinalHtmlBudgetForSourceBytes(sourceBytes),
  );
  registry.assertAllRendered();
  return {
    compatibilityCount: compatibility.count,
    detailsCount: details.count,
    html,
  };
}

function expectFixedError(run: () => unknown, message: string): void {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toBe(message);
}

describe("Markdown placeholder registry", () => {
  it("regenerates a renderer identity that collides with original source", () => {
    let identityByte = 0;
    const calls = stubCryptoIdentityBytes(() => identityByte++);
    const firstCandidate = rendererMarker(0);
    const registry = new MarkdownPlaceholderRegistry(
      `Author text: ${firstCandidate}`,
      1 * mebibyte,
    );

    const marker = registry.add(0, (writer) => writer.append("replacement"));

    expect(marker).toBe(rendererMarker(1));
    expect(calls()).toBe(2);
  });

  it("fails closed after all renderer identity candidates collide", () => {
    let identityByte = 0;
    const calls = stubCryptoIdentityBytes(() => identityByte++);
    const source = Array.from(
      { length: MAX_MARKDOWN_PLACEHOLDER_ID_ATTEMPTS },
      (_, index) => rendererMarker(index),
    ).join("\n");
    const registry = new MarkdownPlaceholderRegistry(source, 1 * mebibyte);

    expectFixedError(
      () => registry.add(0, (writer) => writer.append("replacement")),
      MARKDOWN_PLACEHOLDER_INTEGRITY_ERROR,
    );
    expect(calls()).toBe(MAX_MARKDOWN_PLACEHOLDER_ID_ATTEMPTS);
  });

  it("uses a distinct 128-bit identity for every placeholder record", () => {
    let identityByte = 1;
    const calls = stubCryptoIdentityBytes(() => identityByte++);
    const registry = new MarkdownPlaceholderRegistry("", 1 * mebibyte);

    const markers = [0, 2, 4].map((line) =>
      registry.add(line, (writer) => writer.append(`replacement-${line}`)),
    );
    const identities = markers.map((marker) => {
      const match = marker.match(/^SVARD_RENDERER_PLACEHOLDER_([0-9a-f]{32})$/);
      expect(match).not.toBeNull();
      return match?.[1];
    });

    expect(new Set(identities).size).toBe(markers.length);
    expect(calls()).toBe(markers.length);
  });

  it("regenerates an identity that repeats within the same render job", () => {
    const identityBytes = [1, 1, 2];
    const calls = stubCryptoIdentityBytes(() => identityBytes.shift() ?? 3);
    const registry = new MarkdownPlaceholderRegistry("", 1 * mebibyte);

    const first = registry.add(0, (writer) => writer.append("first"));
    const second = registry.add(2, (writer) => writer.append("second"));

    expect(first).toBe(rendererMarker(1));
    expect(second).toBe(rendererMarker(2));
    expect(calls()).toBe(3);
  });

  it.each([
    {
      name: "crypto unavailable",
      crypto: {},
    },
    {
      name: "crypto failure",
      crypto: {
        getRandomValues(): never {
          throw new Error("private entropy provider failure");
        },
      },
    },
  ])("fails closed with a fixed error when $name", ({ crypto }) => {
    vi.stubGlobal("crypto", crypto);
    const registry = new MarkdownPlaceholderRegistry("", 1 * mebibyte);

    expectFixedError(
      () => registry.add(0, (writer) => writer.append("replacement")),
      MARKDOWN_PLACEHOLDER_INTEGRITY_ERROR,
    );
  });

  it("renders details, compatibility tables, and mixed source order once", () => {
    const result = renderExtractedPlaceholders(`Before.

<details><summary>First **details**</summary>

Details body.
</details>

| --- | --- |
| Compatibility | **table** |

<details open><summary>Second details</summary>

After body.
</details>
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(result.detailsCount).toBe(2);
    expect(result.compatibilityCount).toBe(1);
    expect(doc.querySelectorAll(".markdown-details")).toHaveLength(2);
    expect(doc.querySelectorAll("table")).toHaveLength(1);
    expect(result.html.indexOf("First <strong>details</strong>")).toBeLessThan(
      result.html.indexOf("Compatibility"),
    );
    expect(result.html.indexOf("Compatibility")).toBeLessThan(
      result.html.indexOf("Second details"),
    );
  });

  it("does not rescan replacement text containing two future markers", () => {
    const measurements = [5, 10, 15].map((depth) => {
      const registry = new MarkdownPlaceholderRegistry("", 1 * mebibyte);
      const markers: string[] = [];
      for (let index = 0; index < depth; index += 1) {
        markers.push(
          registry.add(index * 2, (writer) => {
            const futureMarker = markers[index + 1] ?? "chain leaf";
            writer.append(
              `<section data-level="${index}">${futureMarker}${futureMarker}</section>`,
            );
          }),
        );
      }

      const { html } = renderRegisteredMarkers(registry, markers);
      const doc = new DOMParser().parseFromString(html, "text/html");
      expect(doc.querySelectorAll("section")).toHaveLength(depth);
      expect(html.match(/SVARD_RENDERER_PLACEHOLDER/g)).toHaveLength(
        (depth - 1) * 2,
      );
      return utf8ByteLength(html);
    });

    const firstGrowth = measurements[1] - measurements[0];
    const secondGrowth = measurements[2] - measurements[1];
    expect(secondGrowth).toBeLessThanOrEqual(firstGrowth + 128);
    expect(measurements[2]).toBeLessThan(measurements[0] * 4);
  });

  it.each([
    {
      name: "missing marker",
      prepare: (_registry: MarkdownPlaceholderRegistry, _marker: string) => ({
        source: "plain text",
        tokens: markdown.parse("plain text", {}),
      }),
    },
    {
      name: "duplicate marker",
      prepare: (_registry: MarkdownPlaceholderRegistry, marker: string) => {
        const source = `${marker}\n\n${marker}`;
        return { source, tokens: markdown.parse(source, {}) };
      },
    },
    {
      name: "paragraph shape mismatch",
      prepare: (_registry: MarkdownPlaceholderRegistry, marker: string) => {
        const source = `before ${marker}`;
        return { source, tokens: markdown.parse(source, {}) };
      },
    },
    {
      name: "source line mismatch",
      prepare: (_registry: MarkdownPlaceholderRegistry, marker: string) => ({
        source: `\n${marker}`,
        tokens: markdown.parse(marker, {}),
      }),
    },
    {
      name: "pre-bound custom token",
      prepare: (_registry: MarkdownPlaceholderRegistry, marker: string) => {
        const tokens = markdown.parse(marker, {});
        tokens[0].type = markdownPlaceholderTokenType;
        return { source: marker, tokens };
      },
    },
  ])("rejects a $name with the fixed integrity error", ({ prepare }) => {
    const registry = new MarkdownPlaceholderRegistry("", 1 * mebibyte);
    const marker = registry.add(0, (writer) => writer.append("replacement"));
    const { source, tokens } = prepare(registry, marker);

    expectFixedError(
      () => bindMarkdownPlaceholderTokens(tokens, source, registry),
      MARKDOWN_PLACEHOLDER_INTEGRITY_ERROR,
    );
  });

  it("rejects an unresolved placeholder identity", () => {
    const registry = new MarkdownPlaceholderRegistry("", 1 * mebibyte);
    const marker = registry.add(0, (writer) => writer.append("replacement"));
    const source = marker;
    const env = {};
    const tokens = markdown.parse(source, env);
    bindMarkdownPlaceholderTokens(tokens, source, registry);
    attachMarkdownPlaceholderRegistry(env, registry);
    tokens[0].meta = { placeholderId: "unknown" };

    expectFixedError(
      () =>
        renderMarkdownTokensWithinBudget(
          tokens,
          markdown.options,
          env,
          markdown.renderer,
          1 * mebibyte,
        ),
      MARKDOWN_PLACEHOLDER_INTEGRITY_ERROR,
    );
  });

  it("rejects duplicate replay of one resolved placeholder", () => {
    const registry = new MarkdownPlaceholderRegistry("", 1 * mebibyte);
    const marker = registry.add(0, (writer) => writer.append("replacement"));
    const source = marker;
    const env = {};
    const tokens = markdown.parse(source, env);
    bindMarkdownPlaceholderTokens(tokens, source, registry);
    attachMarkdownPlaceholderRegistry(env, registry);
    tokens.push(tokens[0]);

    expectFixedError(
      () =>
        renderMarkdownTokensWithinBudget(
          tokens,
          markdown.options,
          env,
          markdown.renderer,
          1 * mebibyte,
        ),
      MARKDOWN_PLACEHOLDER_INTEGRITY_ERROR,
    );
  });

  it("rejects a registered placeholder omitted from final rendering", () => {
    const registry = new MarkdownPlaceholderRegistry("", 1 * mebibyte);
    const marker = registry.add(0, (writer) => writer.append("replacement"));
    const source = marker;
    const tokens = markdown.parse(source, {});
    bindMarkdownPlaceholderTokens(tokens, source, registry);
    tokens.splice(0);

    expectFixedError(
      () => registry.assertAllRendered(),
      MARKDOWN_PLACEHOLDER_INTEGRITY_ERROR,
    );
  });
});

describe("Markdown render budgets", () => {
  it("uses the fixed count, floor, multiplier, and cap values", () => {
    expect(MAX_MARKDOWN_PLACEHOLDERS).toBe(4_096);
    expect(MIN_MARKDOWN_REPLACEMENT_HTML_BYTES).toBe(1 * mebibyte);
    expect(MAX_MARKDOWN_REPLACEMENT_HTML_BYTES).toBe(32 * mebibyte);
    expect(MIN_MARKDOWN_FINAL_HTML_BYTES).toBe(2 * mebibyte);
    expect(MAX_MARKDOWN_FINAL_HTML_BYTES).toBe(64 * mebibyte);

    expect(markdownReplacementBudgetForSourceBytes(0)).toBe(1 * mebibyte);
    expect(markdownReplacementBudgetForSourceBytes(8_192)).toBe(1 * mebibyte);
    expect(markdownReplacementBudgetForSourceBytes(8_193)).toBe(8_193 * 128);
    expect(markdownReplacementBudgetForSourceBytes(262_144)).toBe(
      32 * mebibyte,
    );
    expect(
      markdownReplacementBudgetForSourceBytes(Number.POSITIVE_INFINITY),
    ).toBe(32 * mebibyte);

    expect(markdownFinalHtmlBudgetForSourceBytes(0)).toBe(2 * mebibyte);
    expect(markdownFinalHtmlBudgetForSourceBytes(16_384)).toBe(2 * mebibyte);
    expect(markdownFinalHtmlBudgetForSourceBytes(16_385)).toBe(16_385 * 128);
    expect(markdownFinalHtmlBudgetForSourceBytes(524_288)).toBe(64 * mebibyte);
    expect(markdownFinalHtmlBudgetForSourceBytes(Number.NaN)).toBe(
      64 * mebibyte,
    );
  });

  it("accepts placeholder count B-1 and B, then rejects B+1", () => {
    for (const count of [
      MAX_MARKDOWN_PLACEHOLDERS - 1,
      MAX_MARKDOWN_PLACEHOLDERS,
    ]) {
      const registry = new MarkdownPlaceholderRegistry("", 1 * mebibyte);
      for (let index = 0; index < count; index += 1) {
        registry.add(index, () => {});
      }
      expect(registry.size).toBe(count);
    }

    const registry = new MarkdownPlaceholderRegistry("", 1 * mebibyte);
    for (let index = 0; index < MAX_MARKDOWN_PLACEHOLDERS; index += 1) {
      registry.add(index, () => {});
    }
    expectFixedError(
      () => registry.add(MAX_MARKDOWN_PLACEHOLDERS, () => {}),
      MARKDOWN_RENDER_BUDGET_ERROR,
    );
  });

  it.each([
    { bytes: 7, name: "B-1", succeeds: true },
    { bytes: 8, name: "B", succeeds: true },
    { bytes: 9, name: "B+1", succeeds: false },
  ])(
    "enforces the aggregate replacement byte budget at $name",
    ({ bytes, succeeds }) => {
      const registry = new MarkdownPlaceholderRegistry("", 8);
      const markers = [
        registry.add(0, (writer) => writer.append("a".repeat(4))),
        registry.add(2, (writer) => writer.append("b".repeat(bytes - 4))),
      ];
      const run = () => renderRegisteredMarkers(registry, markers, 32);

      if (succeeds) {
        expect(utf8ByteLength(run().html)).toBe(bytes);
      } else {
        expectFixedError(run, MARKDOWN_RENDER_BUDGET_ERROR);
      }
    },
  );

  it.each([
    { bytes: 7, name: "B-1", succeeds: true },
    { bytes: 8, name: "B", succeeds: true },
    { bytes: 9, name: "B+1", succeeds: false },
  ])("enforces the final HTML byte budget at $name", ({ bytes, succeeds }) => {
    const registry = new MarkdownPlaceholderRegistry("", 16);
    const marker = registry.add(0, (writer) =>
      writer.append("x".repeat(bytes)),
    );
    const run = () => renderRegisteredMarkers(registry, [marker], 8);

    if (succeeds) {
      expect(utf8ByteLength(run().html)).toBe(bytes);
    } else {
      expectFixedError(run, MARKDOWN_RENDER_BUDGET_ERROR);
    }
  });

  it.each([
    "ASCII",
    "日本語",
    "😀",
    "\r\n",
    "\ud800",
    "\udc00",
    "A😀\r\n\ud800Z",
  ])("counts UTF-8 bytes like TextEncoder for %j", (value) => {
    expect(utf8ByteLength(value)).toBe(
      new TextEncoder().encode(value).byteLength,
    );
  });

  it("counts emoji, CRLF, and unpaired surrogates at an inclusive boundary", () => {
    const value = "A😀\r\n\ud800Z";
    const bytes = new TextEncoder().encode(value).byteLength;
    const exact = new Utf8ChunkWriter(bytes);

    exact.append("A");
    exact.append("😀");
    exact.append("\r\n");
    exact.append("\ud800");
    exact.append("Z");
    expect(exact.byteLength).toBe(bytes);
    expect(exact.toString()).toBe(value);

    const over = new Utf8ChunkWriter(bytes - 1);
    expectFixedError(() => over.append(value), MARKDOWN_RENDER_BUDGET_ERROR);
  });

  it("counts a surrogate pair split across chunks as one UTF-8 code point", () => {
    const exact = new Utf8ChunkWriter(4);

    exact.append("\ud83d");
    exact.append("");
    exact.append("\ude00");

    expect(exact.toString()).toBe("😀");
    expect(exact.byteLength).toBe(new TextEncoder().encode("😀").byteLength);

    const over = new Utf8ChunkWriter(3);
    over.append("\ud83d");
    expectFixedError(() => over.append("\ude00"), MARKDOWN_RENDER_BUDGET_ERROR);
  });
});
