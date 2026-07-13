import { describe, expect, it } from "vitest";
import { imageReferenceForElement } from "../../src/ui/lib/imageReference";

describe("image reference", () => {
  it("combines the resolved image path with mapped source and revision", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p data-source-selection-start="42" data-source-selection-end="44" data-source-selection-source-path="/workspace/docs/include.md">
      <img data-image-resolved-path="/workspace/assets/image.png" data-image-reference="/workspace/docs/guide.md">
    </p>`;
    const image = root.querySelector("img")!;

    expect(
      imageReferenceForElement(image, {
        documentPath: "/workspace/docs/guide.md",
        revision: { label: "HEAD", side: "left" },
      }),
    ).toBe(
      "Image: /workspace/assets/image.png\nFile: /workspace/docs/include.md:42\nRevision: HEAD (left)",
    );
  });

  it("falls back to the document path for an inline data image", () => {
    const image = document.createElement("img");
    expect(
      imageReferenceForElement(image, {
        documentPath: "/workspace/docs/guide.md",
      }),
    ).toBe("File: /workspace/docs/guide.md");
  });

  it("uses the external URL as the image location", () => {
    const image = document.createElement("img");
    image.dataset.imageUrl = "https://example.test/image.png";
    image.dataset.imageReference = "/workspace/docs/guide.md";
    expect(imageReferenceForElement(image)).toBe(
      "Image: https://example.test/image.png\nFile: /workspace/docs/guide.md",
    );
  });
});
