import { describe, expect, it, vi } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import { unwrapSafeHtml } from "../../src/ui/lib/sanitizeHtml";

const document = (source: string) => ({
  path: "/workspace/docs/contract.md",
  basePath: "/workspace/docs",
  format: "markdown" as const,
  source,
  updatedAt: "2026-08-20T00:00:00.000Z",
  resourceContext: {
    workspaceRoot: "/workspace",
    documentDir: "/workspace/docs",
    resourceRoots: ["/workspace", "/workspace/docs"],
  },
});

async function renderPrepared(
  source: string,
  options: {
    showExternalImages?: boolean;
    resolveDocumentLink?: NonNullable<
      Parameters<typeof prepareDocumentHtml>[4]
    >["resolveDocumentLink"];
    resolveLocalImage?: NonNullable<
      Parameters<typeof prepareDocumentHtml>[4]
    >["resolveLocalImage"];
  } = {},
) {
  const result = renderMarkdownCore(source);
  const html = await prepareDocumentHtml(
    result.html,
    document(source),
    {
      security: {
        allowLocalImages: true,
        confirmExternalLinks: true,
        showExternalImages: options.showExternalImages ?? false,
      },
    },
    result,
    {
      resolveDocumentLink: options.resolveDocumentLink,
      resolveLocalImage: options.resolveLocalImage,
    },
  );
  return new DOMParser().parseFromString(unwrapSafeHtml(html), "text/html");
}

describe("Markdown Safe HTML resource policy", () => {
  it("hydrates authorized document links and local images without retaining private paths", async () => {
    const resolveDocumentLink = vi.fn(async () => ({
      status: "resolved" as const,
      path: "/workspace/docs/guide.md",
      hash: null,
    }));
    const resolveLocalImage = vi.fn(async () => ({
      status: "resolved" as const,
      resolvedPath: "/private/workspace/docs/logo.svg",
      mediaType: "image/svg+xml",
      encoding: "utf8" as const,
      content:
        '<svg xmlns="http://www.w3.org/2000/svg"><text>Logo</text></svg>',
    }));
    const source =
      '<a href="./guide.md" title="Guide"><img src="./logo.svg" alt="Logo" width="64" align="center"></a>';
    const doc = await renderPrepared(source, {
      resolveDocumentLink,
      resolveLocalImage,
    });
    const link = doc.querySelector("a");
    const image = doc.querySelector("img");

    expect(resolveDocumentLink).toHaveBeenCalledWith(
      "./guide.md",
      "/workspace/docs/contract.md",
    );
    expect(resolveLocalImage).toHaveBeenCalledWith(
      "./logo.svg",
      "/workspace/docs/contract.md",
      expect.objectContaining({ workspaceRoot: "/workspace" }),
    );
    expect(link?.getAttribute("href")).toBe("./guide.md");
    expect(image?.getAttribute("src")).toContain("data:image/svg+xml");
    expect(image?.getAttribute("data-image-resolved-path")).toBe("./logo.svg");
    expect(image?.className).toBe("markdown-safe-html-image-align-center");
    expect(doc.body.innerHTML).not.toContain("/private/workspace");
    expect(doc.body.innerHTML).not.toContain("svard-markdown-author-html");
  });

  it("normalizes px dimensions and drops optional sizing fallbacks", async () => {
    const resolveLocalImage = vi.fn(async () => ({
      status: "resolved" as const,
      resolvedPath: "/private/workspace/docs/gemma4-kv-sharing.webp",
      mediaType: "image/webp",
      encoding: "base64" as const,
      content: "UklGRg==",
    }));
    const source =
      '<img src="gemma4-kv-sharing.webp" alt="Cross-layer KV sharing" width="800px" height="auto" style="width:100%" onerror="blocked">';
    const doc = await renderPrepared(source, { resolveLocalImage });
    const image = doc.querySelector('img[alt="Cross-layer KV sharing"]');

    expect(resolveLocalImage).toHaveBeenCalledWith(
      "gemma4-kv-sharing.webp",
      "/workspace/docs/contract.md",
      expect.objectContaining({ workspaceRoot: "/workspace" }),
    );
    expect(image?.getAttribute("src")).toBe("data:image/webp;base64,UklGRg==");
    expect(image?.getAttribute("width")).toBe("800");
    expect(image?.hasAttribute("height")).toBe(false);
    expect(image?.hasAttribute("style")).toBe(false);
    expect(image?.hasAttribute("onerror")).toBe(false);
    expect(image?.hasAttribute("data-source-reference")).toBe(false);
  });

  it("canonicalizes external resources only after policy approval", async () => {
    const source =
      '<a href=" https://EXAMPLE.test:443/a/../b ">External</a> <img src="https://EXAMPLE.test:443/a/../logo.svg" alt="Logo">';
    const blocked = await renderPrepared(source);
    const approved = await renderPrepared(source, { showExternalImages: true });

    expect(blocked.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.test/b",
    );
    expect(blocked.querySelector("img")).toBeNull();
    expect(blocked.querySelector(".image-placeholder")?.textContent).toBe(
      "Image: Logo",
    );
    expect(approved.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.test/logo.svg",
    );
  });

  it("keeps visible heading text and collapse while omitting source actions", async () => {
    const source =
      '# <a href="https://example.test/guide">Guide <img src="https://example.test/logo.svg" alt="Logo"></a>';
    const doc = await renderPrepared(source, { showExternalImages: true });
    const heading = doc.querySelector("h1");

    expect(heading?.textContent).toContain("Guide");
    expect(heading?.querySelector('img[alt="Logo"]')).toBeTruthy();
    expect(heading?.id).toBe("guide-logo");
    expect(
      heading?.querySelector("[data-section-collapse-toggle]"),
    ).toBeTruthy();
    expect(
      heading?.querySelector(
        "[data-source-reference],[data-source-selection-block-id]",
      ),
    ).toBeNull();
  });

  it("supports resources in details and typed table inline positions", async () => {
    const source = `<details open>
<summary><a href="#target">Jump</a></summary>
Body <img src="https://example.test/logo.svg" alt="Logo">
</details>

<table><tbody><tr><td><a href="https://example.test/table">Table link</a></td></tr></tbody></table>

## Target`;
    const doc = await renderPrepared(source, { showExternalImages: false });

    expect(doc.querySelector("details[open] summary a")?.textContent).toBe(
      "Jump",
    );
    expect(doc.querySelector("details img")).toBeNull();
    expect(doc.querySelector("details .image-placeholder")?.textContent).toBe(
      "Image: Logo",
    );
    expect(doc.querySelector("table a")?.getAttribute("href")).toBe(
      "https://example.test/table",
    );
    expect(doc.querySelector("table [data-source-reference]")).toBeNull();
  });

  it.each([
    '<a href="javascript:alert(1)">Blocked link</a>',
    '<a href="//example.test/path">Blocked link</a>',
    '<a href="mailto:user@example.test">Blocked link</a>',
    '<a href="./bad%ZZ.md">Blocked link</a>',
    '<a href="/private/secret.md">Blocked link</a>',
    '<a href="C:\\private\\secret.md">Blocked link</a>',
  ])(
    "unwraps blocked links without invoking the document resolver: %s",
    async (source) => {
      const resolveDocumentLink = vi.fn();
      const doc = await renderPrepared(source, { resolveDocumentLink });

      expect(doc.querySelector("a")).toBeNull();
      expect(doc.body.textContent).toContain("Blocked link");
      expect(doc.body.innerHTML).not.toContain(
        source.match(/href="([^"]+)/u)?.[1] ?? "never",
      );
      expect(resolveDocumentLink).not.toHaveBeenCalled();
    },
  );

  it.each([
    '<img src="javascript:alert(1)" alt="Blocked">',
    '<img src="//example.test/x.png" alt="Blocked">',
    '<img src="file:///private/x.png" alt="Blocked">',
    '<img src="C:\\private\\x.png" alt="Blocked">',
    '<img src="./bad%ZZ.png" alt="Blocked">',
  ])(
    "replaces blocked images without invoking the image resolver: %s",
    async (source) => {
      const resolveLocalImage = vi.fn();
      const doc = await renderPrepared(source, { resolveLocalImage });

      expect(doc.querySelector("img")).toBeNull();
      expect(doc.querySelector(".image-placeholder")?.textContent).toBe(
        "Image: Blocked",
      );
      expect(resolveLocalImage).not.toHaveBeenCalled();
    },
  );
});
