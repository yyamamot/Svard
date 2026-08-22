import { describe, expect, it } from "vitest";

import {
  applyPathlessMarkdownAuthorResourcePolicyInPlace,
  classifyMarkdownAuthorLinkCandidate,
  semanticizeMarkdownAuthorResourcesInPlace,
} from "../../src/ui/lib/markdownAuthorResources";

function body(html: string) {
  return new DOMParser().parseFromString(html, "text/html").body;
}

describe("Markdown author resource consumers", () => {
  it("only classifies relative document candidates for author links", () => {
    expect(classifyMarkdownAuthorLinkCandidate("./guide.md")).toEqual({
      kind: "document",
      href: "./guide.md",
    });
    expect(classifyMarkdownAuthorLinkCandidate("/private/guide.md").kind).toBe(
      "blocked",
    );
    expect(
      classifyMarkdownAuthorLinkCandidate("C:\\private\\guide.md").kind,
    ).toBe("blocked");
    expect(
      classifyMarkdownAuthorLinkCandidate("java\tscript:guide.md"),
    ).toEqual({ kind: "blocked", reason: "malformed" });
    expect(classifyMarkdownAuthorLinkCandidate("guide\u0000.md")).toEqual({
      kind: "blocked",
      reason: "malformed",
    });
  });
  it("keeps only pathless-safe canonical destinations", () => {
    const root = body(
      '<a id="fragment">Fragment</a><a id="document">Document</a><a id="external">External</a><img id="local" alt="Local"><img id="remote" alt="Remote">',
    );
    const candidates = new Map<
      Element,
      { kind: "link" | "image"; value: string }
    >([
      [root.querySelector("#fragment")!, { kind: "link", value: "#target" }],
      [root.querySelector("#document")!, { kind: "link", value: "./guide.md" }],
      [
        root.querySelector("#external")!,
        { kind: "link", value: "https://EXAMPLE.test:443/a/../b" },
      ],
      [root.querySelector("#local")!, { kind: "image", value: "./logo.svg" }],
      [
        root.querySelector("#remote")!,
        { kind: "image", value: "https://EXAMPLE.test:443/a/../logo.svg" },
      ],
    ]);

    applyPathlessMarkdownAuthorResourcePolicyInPlace(candidates, {
      showExternalImages: true,
    });

    expect(root.querySelector("#fragment")?.getAttribute("href")).toBe(
      "#target",
    );
    expect(root.querySelector("#document")).toBeNull();
    expect(root.textContent).toContain("Document");
    expect(root.querySelector("#external")?.getAttribute("href")).toBe(
      "https://example.test/b",
    );
    expect(root.querySelector("#local")).toBeNull();
    expect(root.querySelector("#remote")?.getAttribute("src")).toBe(
      "https://example.test/logo.svg",
    );
  });

  it("reduces semantic-only consumers to labels and alt without URLs", () => {
    const root = body('<a id="link">Guide<img id="image" alt="Logo"></a>');
    const candidates = new Map<
      Element,
      { kind: "link" | "image"; value: string }
    >([
      [
        root.querySelector("#link")!,
        { kind: "link", value: "https://example.test/private" },
      ],
      [
        root.querySelector("#image")!,
        { kind: "image", value: "./private.svg" },
      ],
    ]);

    semanticizeMarkdownAuthorResourcesInPlace(candidates);

    expect(root.querySelector("a,img")).toBeNull();
    expect(root.textContent).toBe("GuideImage: Logo");
    expect(root.innerHTML).not.toMatch(/example\.test|private\.svg/u);
  });

  it("does not retain an external image destination when pathless policy is off", () => {
    const root = body('<img id="remote" alt="Remote">');
    const candidates = new Map<
      Element,
      { kind: "link" | "image"; value: string }
    >([
      [
        root.querySelector("#remote")!,
        { kind: "image", value: "https://example.test/private.png" },
      ],
    ]);

    applyPathlessMarkdownAuthorResourcePolicyInPlace(candidates, {
      showExternalImages: false,
    });

    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toBe("Image: Remote");
    expect(root.innerHTML).not.toContain("example.test");
  });
});
