import { describe, expect, it } from "vitest";

import {
  imagePreviewReference,
  imagePreviewTitle,
  svgSourceFromImageSrc,
} from "../../src/ui/lib/imagePreview";

describe("image preview helpers", () => {
  it("decodes URL encoded SVG data image sources", () => {
    expect(
      svgSourceFromImageSrc(
        "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3Ctext%3ELabel%3C%2Ftext%3E%3C%2Fsvg%3E",
      ),
    ).toBe("<svg><text>Label</text></svg>");
  });

  it("decodes base64 SVG data image sources", () => {
    expect(
      svgSourceFromImageSrc("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="),
    ).toBe("<svg></svg>");
  });

  it("returns null for non-SVG image sources", () => {
    expect(svgSourceFromImageSrc("data:image/png;base64,AA==")).toBeNull();
  });

  it("derives preview title and source reference without raw image content", () => {
    document.body.innerHTML = `<img alt="System map" data-image-reference="docs/guide.md:8" data-image-path="assets/map.svg">`;
    const image = document.querySelector("img")!;

    expect(imagePreviewTitle(image)).toBe("System map");
    expect(imagePreviewReference(image)).toBe("docs/guide.md:8");
  });
});
