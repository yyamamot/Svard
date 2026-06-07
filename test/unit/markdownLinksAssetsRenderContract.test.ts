import { describe, expect, it } from "vitest";

import {
  blockedImageResult,
  renderMarkdownContract,
  svgImageResult,
} from "./renderContractTestUtils";

describe("Markdown links and assets render contract", () => {
  it("keeps reference links, encoded paths, local images, and blocked external images stable", async () => {
    const imageRequests: string[] = [];
    const linkRequests: string[] = [];
    const { doc } = await renderMarkdownContract({
      source: `# Markdown Links Assets

[Relative Doc](./Guide%20File.md#Intro)
[Japanese Doc](./%E6%97%A5%E6%9C%AC%E8%AA%9E%20%E3%82%AC%E3%82%A4%E3%83%89.md)
[External](https://example.com/path)
[Reference Link][ref-doc]

![Reference Image][ref-image]
![Missing Local](assets/missing%20image.svg)
![External Logo](https://example.com/logo.svg)

[ref-doc]: ./reference%20target.md#Details
[ref-image]: assets/%E6%97%A5%E6%9C%AC%E8%AA%9E%20image.svg`,
      resolveLocalImage: (source) => {
        imageRequests.push(source);
        if (source.includes("missing")) {
          return blockedImageResult("Local image is not available.");
        }
        return svgImageResult(`markdown:${source}`);
      },
      resolveDocumentLink: async (href: string) => {
        linkRequests.push(href);
        return {
          status: "resolved",
          path: `/workspace/docs/${href.split("#")[0]}`,
          hash: href.split("#")[1] ?? null,
        };
      },
    });

    expect(linkRequests).toEqual([
      "./Guide%20File.md#Intro",
      "./%E6%97%A5%E6%9C%AC%E8%AA%9E%20%E3%82%AC%E3%82%A4%E3%83%89.md",
      "./reference%20target.md#Details",
    ]);
    expect(imageRequests).toEqual([
      "assets/%E6%97%A5%E6%9C%AC%E8%AA%9E%20image.svg",
      "assets/missing%20image.svg",
    ]);
    expect(
      doc.querySelector('a[href="/workspace/docs/./Guide%20File.md#Intro"]')
        ?.textContent,
    ).toBe("Relative Doc");
    expect(
      doc.querySelector(
        'a[href="/workspace/docs/./%E6%97%A5%E6%9C%AC%E8%AA%9E%20%E3%82%AC%E3%82%A4%E3%83%89.md"]',
      )?.textContent,
    ).toBe("Japanese Doc");
    expect(
      doc.querySelector(
        'a[href="/workspace/docs/./reference%20target.md#Details"]',
      )?.textContent,
    ).toBe("Reference Link");
    expect(
      doc.querySelector('a[href="https://example.com/path"]'),
    ).toBeTruthy();
    expect(
      doc.querySelector(
        'img[alt="Reference Image"][src^="data:image/svg+xml"]',
      ),
    ).toBeTruthy();
    expect(
      doc.querySelector(
        'img[alt="Reference Image"][data-image-path="assets/%E6%97%A5%E6%9C%AC%E8%AA%9E%20image.svg"]',
      ),
    ).toBeTruthy();
    expect(
      Array.from(doc.querySelectorAll(".image-placeholder")).some(
        (placeholder) =>
          placeholder.textContent === "Local image is not available.",
      ),
    ).toBe(true);
    expect(
      Array.from(doc.querySelectorAll(".image-placeholder")).some(
        (placeholder) =>
          placeholder.textContent === "External image blocked: External Logo",
      ),
    ).toBe(true);
  });
});
