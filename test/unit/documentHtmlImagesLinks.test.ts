import { describe, expect, it, vi } from "vitest";

import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import type { RenderResult } from "../../src/core/types";
import {
  hydrateResolvedLocalRasterPayloads,
  localRasterPayloadSlotAttribute,
} from "../../src/ui/lib/resolvedLocalRasterPayloads";
import { documentPayload } from "./helpers/documentHtml";

function rasterOwner(): RenderResult {
  return {
    html: "",
    headings: [],
    sourceBlocks: [],
    diagnostics: [],
    diagramSlots: [],
    mermaidDiagrams: [],
    plantUmlDiagrams: [],
    graphvizDiagrams: [],
    krokiDiagrams: [],
  };
}

describe("prepareDocumentHtml image and link hydration", () => {
  it("keeps resolved Markdown raster payloads outside SafeHtml until pane hydration", async () => {
    const owner = rasterOwner();
    const html = await prepareDocumentHtml(
      `<p><img src="./assets/sample.png" alt="Sample" ${localRasterPayloadSlotAttribute}="author-forged"></p>`,
      { ...documentPayload, format: "markdown" },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      owner,
      {
        localRasterPayloadOwner: owner,
        resolveLocalImage: async () => ({
          status: "resolved",
          mediaType: "image/png",
          encoding: "base64",
          content: "AA==",
        }),
      },
    );

    expect(html).not.toContain("data:image/png;base64");
    expect(html).not.toContain("author-forged");
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("img")?.hasAttribute("src")).toBe(false);
    expect(
      doc.querySelector("img")?.getAttribute(localRasterPayloadSlotAttribute),
    ).toBeTruthy();

    expect(hydrateResolvedLocalRasterPayloads(doc.body, owner)).toEqual({
      hydratedCount: 1,
      status: "applied",
    });
    expect(doc.querySelector("img")?.getAttribute("src")).toBe(
      "data:image/png;base64,AA==",
    );
    expect(
      doc.querySelector(`[${localRasterPayloadSlotAttribute}]`),
    ).toBeNull();
  });

  it("does not sidecar SVG or a raster with a non-base64 encoding", async () => {
    for (const resolved of [
      {
        mediaType: "image/svg+xml",
        encoding: "utf8" as const,
        content: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      },
      {
        mediaType: "image/png",
        encoding: "utf8" as const,
        content: "AA==",
      },
    ]) {
      const owner = rasterOwner();
      const html = await prepareDocumentHtml(
        '<p><img src="./assets/sample" alt="Sample"></p>',
        { ...documentPayload, format: "markdown" },
        { security: { allowLocalImages: true, confirmExternalLinks: true } },
        owner,
        {
          localRasterPayloadOwner: owner,
          resolveLocalImage: async () => ({
            status: "resolved",
            ...resolved,
          }),
        },
      );
      expect(html).toContain(`data:${resolved.mediaType}`);
      expect(html).not.toContain(localRasterPayloadSlotAttribute);
    }
  });
  it("neutralizes AsciiDoc form, image-map, and forged Kroki actions before resolvers", async () => {
    const resolveDocumentLink = vi.fn();
    const resolveLocalImage = vi.fn();
    const html = await prepareDocumentHtml(
      '<form action="https://example.test/submit"><label>Static label</label><input type="image" src="https://example.test/input.png"><button type="submit" formaction="http://127.0.0.1/action" data-kroki-confirm-key="spoof">Send</button></form><img alt="Map image" usemap="#routes" ismap><map name="routes"><area href="custom:escape"></map><span data-kroki-fallback-key="spoof" data-kroki-open-preferences="true">Fallback</span>',
      { ...documentPayload, format: "asciidoc" },
      {
        security: {
          allowLocalImages: true,
          showExternalImages: true,
          confirmExternalLinks: true,
        },
      },
      { headings: [], sourceBlocks: [] },
      { resolveDocumentLink, resolveLocalImage },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(
      doc.querySelector(
        "form,input,button,textarea,select,option,map,area,[action],[formaction],[usemap],[ismap],[data-kroki-confirm-key],[data-kroki-fallback-key],[data-kroki-open-preferences]",
      ),
    ).toBeNull();
    expect(doc.body.textContent).toContain("Static label");
    expect(doc.body.textContent).toContain("Send");
    expect(doc.body.textContent).toContain("Fallback");
    expect(resolveDocumentLink).not.toHaveBeenCalled();
    expect(resolveLocalImage).not.toHaveBeenCalled();
  });

  it("removes image-loading attributes from elements outside the image policy", async () => {
    const html = await prepareDocumentHtml(
      `<input type="image" src="https://example.test/input.png">
<video src="https://example.test/video.mp4" poster="https://example.test/poster.png"></video>
<object data="https://example.test/object.svg"></object>
<table background="https://example.test/background.png"><tbody><tr><td>Cell</td></tr></tbody></table>
<svg>
  <image href="https://example.test/svg.png"></image>
  <image xlink:href="https://example.test/xlink.png"></image>
  <feImage href="https://example.test/filter.png"></feImage>
</svg>`,
      documentPayload,
      {
        security: {
          allowLocalImages: true,
          showExternalImages: true,
          confirmExternalLinks: true,
        },
      },
      { headings: [], sourceBlocks: [] },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("input")).toBeNull();
    expect(doc.querySelector("video")?.hasAttribute("src")).toBe(false);
    expect(doc.querySelector("video")?.hasAttribute("poster")).toBe(false);
    expect(doc.querySelector("object")?.hasAttribute("data")).not.toBe(true);
    expect(doc.querySelector("table")?.hasAttribute("background")).toBe(false);
    expect(doc.querySelector("image")?.hasAttribute("href")).not.toBe(true);
    expect(doc.querySelector("image[xlink\\:href]")).toBeNull();
    expect(doc.querySelector("feImage")?.hasAttribute("href")).not.toBe(true);
    expect(html).not.toContain("https://example.test/");
  });

  it("hydrates local SVG images through the backend resolver as image data", async () => {
    const html = await prepareDocumentHtml(
      '<p><img src="./assets/sample.svg" alt="Sample"></p>',
      {
        ...documentPayload,
        path: "/workspace/svard/docs/example.adoc",
        basePath: "/workspace/svard/docs",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveLocalImage: async (path, documentPath) => {
          expect(path).toBe("./assets/sample.svg");
          expect(documentPath).toBe("/workspace/svard/docs/example.adoc");
          return {
            status: "resolved",
            mediaType: "image/svg+xml",
            encoding: "utf8",
            resolvedPath: "/workspace/svard/docs/assets/sample.svg",
            content:
              '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">Diagram&nbsp;text</div></foreignObject><text>Safe</text></svg>',
          };
        },
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const image = doc.querySelector("img");

    expect(image?.getAttribute("src")).toContain(
      "data:image/svg+xml;charset=utf-8,",
    );
    expect(decodeURIComponent(image?.getAttribute("src") ?? "")).toContain(
      "Safe",
    );
    expect(decodeURIComponent(image?.getAttribute("src") ?? "")).toContain(
      "foreignObject",
    );
    expect(decodeURIComponent(image?.getAttribute("src") ?? "")).toContain(
      "Diagram&#160;text",
    );
  });

  it("passes root-relative local image paths to the backend resolver unchanged", async () => {
    const html = await prepareDocumentHtml(
      '<p><img src="/images/article/root.svg" alt="Root"></p>',
      {
        ...documentPayload,
        path: "/workspace/svard/articles/post.md",
        basePath: "/workspace/svard/articles",
        format: "markdown",
        resourceContext: {
          workspaceRoot: "/workspace/svard",
          documentDir: "/workspace/svard/articles",
          resourceRoots: ["/workspace/svard", "/workspace/svard/articles"],
        },
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveLocalImage: async (path, documentPath, context) => {
          expect(path).toBe("/images/article/root.svg");
          expect(documentPath).toBe("/workspace/svard/articles/post.md");
          expect(context).toEqual({
            workspaceRoot: "/workspace/svard",
            documentDir: "/workspace/svard/articles",
            resourceRoots: ["/workspace/svard", "/workspace/svard/articles"],
          });
          return {
            status: "resolved",
            mediaType: "image/svg+xml",
            encoding: "utf8",
            resolvedPath: "/workspace/images/article/root.svg",
            content:
              '<svg xmlns="http://www.w3.org/2000/svg"><text>Root image</text></svg>',
          };
        },
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const image = doc.querySelector("img");

    expect(image?.getAttribute("data-image-path")).toBe(
      "/images/article/root.svg",
    );
    expect(image?.getAttribute("data-image-resolved-path")).toBe(
      "/workspace/images/article/root.svg",
    );
    expect(image?.getAttribute("src")).toContain(
      "data:image/svg+xml;charset=utf-8,",
    );
  });

  it("keeps AsciiDoc image placeholders visible when a later local image is missing", async () => {
    const html = await prepareDocumentHtml(
      `<div class="imageblock">
<div class="content">
<img src="assets/oversized-diagram.svg" alt="Oversized manual SVG">
</div>
<div class="title">Figure 3. Oversized SVG</div>
</div>
<div class="imageblock">
<div class="content">
<img src="assets/missing-manual-image.png" alt="Missing manual image">
</div>
<div class="title">Figure 4. Missing image placeholder</div>
</div>`,
      {
        ...documentPayload,
        format: "asciidoc",
        path: "/workspace/svard/docs/samples/manual/index.adoc",
        basePath: "/workspace/svard/docs/samples/manual",
        asciidocContext: {
          baseDir: "/workspace/svard",
          workspaceRoot: "/workspace/svard",
          documentDir: "/workspace/svard/docs/samples/manual",
          attributes: { imagesdir: "assets" },
          resourceRoots: [
            "/workspace/svard",
            "/workspace/svard/docs/samples/manual",
          ],
        },
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveLocalImage: async (path) =>
          path.endsWith("oversized-diagram.svg")
            ? {
                status: "resolved",
                mediaType: "image/svg+xml",
                encoding: "utf8",
                content:
                  '<svg xmlns="http://www.w3.org/2000/svg"><text>Oversized SVG</text></svg>',
              }
            : {
                status: "blocked",
                placeholderText: "Local image is not available.",
              },
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const imageBlocks = Array.from(doc.querySelectorAll(".imageblock"));

    expect(imageBlocks[0]?.querySelector("img")?.getAttribute("src")).toContain(
      "data:image/svg+xml;charset=utf-8,",
    );
    expect(imageBlocks[0]?.querySelector(".image-placeholder")).toBeNull();
    expect(imageBlocks[1]?.querySelector("img")).toBeNull();
    expect(
      imageBlocks[1]?.querySelector(".image-placeholder")?.textContent,
    ).toBe("Local image is not available.");
    expect(imageBlocks[1]?.querySelector(".title")?.textContent).toBe(
      "Figure 4. Missing image placeholder",
    );
  });

  it("hydrates Windows local image paths without converting the drive path to a URL path", async () => {
    await prepareDocumentHtml(
      '<p><img src="sample.png" alt="Sample"></p>',
      {
        ...documentPayload,
        path: "C:\\Users\\developer\\docs\\example.adoc",
        basePath: "C:\\Users\\developer\\docs",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveLocalImage: async (path, documentPath) => {
          expect(path).toBe("sample.png");
          expect(documentPath).toBe("C:\\Users\\developer\\docs\\example.adoc");
          return {
            status: "resolved",
            mediaType: "image/png",
            encoding: "base64",
            content: "AA==",
          };
        },
      },
    );
  });

  it("passes sibling workspace image paths to the backend resolver unchanged", async () => {
    await prepareDocumentHtml(
      '<p><img src="../images/test.svg" alt="Sibling"></p>',
      {
        ...documentPayload,
        path: "C:\\Users\\developer\\project\\docs\\index.adoc",
        basePath: "C:\\Users\\developer\\project\\docs",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveLocalImage: async (path, documentPath) => {
          expect(path).toBe("../images/test.svg");
          expect(documentPath).toBe(
            "C:\\Users\\developer\\project\\docs\\index.adoc",
          );
          return {
            status: "resolved",
            mediaType: "image/svg+xml",
            encoding: "utf8",
            content: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
          };
        },
      },
    );
  });

  it("hydrates local document links through the backend resolver", async () => {
    const html = await prepareDocumentHtml(
      '<p><a href="next.md#usage">Next</a></p>',
      {
        ...documentPayload,
        path: "C:\\Users\\developer\\docs\\example.adoc",
        basePath: "C:\\Users\\developer\\docs",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveDocumentLink: async (href, documentPath) => {
          expect(href).toBe("next.md#usage");
          expect(documentPath).toBe("C:\\Users\\developer\\docs\\example.adoc");
          return {
            status: "resolved",
            path: "C:\\Users\\developer\\docs\\next.md",
            hash: "usage",
          };
        },
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("a")?.getAttribute("href")).toBe(
      "./next.md#usage",
    );
    expect(doc.body.innerHTML).not.toContain("C:\\Users\\developer");
  });

  it("removes unavailable local document links without resolving paths in the frontend", async () => {
    const html = await prepareDocumentHtml(
      '<p><a href="../secret.md">Secret</a></p>',
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveDocumentLink: async (href, documentPath) => {
          expect(href).toBe("../secret.md");
          expect(documentPath).toBe("/workspace/docs/example.adoc");
          return {
            status: "blocked",
            message: "Document link is outside the current workspace.",
          };
        },
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("a")?.getAttribute("href")).toBeNull();
    expect(doc.querySelector("a")?.getAttribute("title")).toBeNull();
  });

  it("removes unclassified navigation and independent navigation attributes", async () => {
    const html = await prepareDocumentHtml(
      '<p><a href="mailto:user@example.test" target="_blank" download ping="https://example.test/ping">Mail</a><a href="//example.test/docs">Protocol relative</a><a href="javascript:alert(1)">Script</a></p>',
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
    );
    const links = Array.from(
      new DOMParser().parseFromString(html, "text/html").querySelectorAll("a"),
    );

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      null,
      null,
      null,
    ]);
    expect(
      links.some(
        (link) =>
          link.hasAttribute("target") ||
          link.hasAttribute("download") ||
          link.hasAttribute("ping"),
      ),
    ).toBe(false);
  });

  it("deactivates unresolved document links while retaining safe display text", async () => {
    const html = await prepareDocumentHtml(
      '<p><a href="next.md#usage">Next</a> <a href="#local">Local</a> <a href=" https://example.test/docs ">Web</a></p>',
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const links = Array.from(doc.querySelectorAll("a"));

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      null,
      "#local",
      "https://example.test/docs",
    ]);
    expect(doc.body.textContent).toContain("Next Local Web");
  });
});
