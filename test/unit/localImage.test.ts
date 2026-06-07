import { describe, expect, it } from "vitest";

import { resolveLocalImageSource } from "../../src/ui/lib/localImage";

describe("resolveLocalImageSource", () => {
  it("keeps relative local images as raw sources for backend resolution", () => {
    const result = resolveLocalImageSource("./assets/sample.svg", {
      allowLocalImages: true,
    });

    expect(result).toEqual({
      status: "local",
      source: "./assets/sample.svg",
    });
  });

  it("does not join Windows document-relative image paths in the frontend", () => {
    const result = resolveLocalImageSource("sample.png", {
      allowLocalImages: true,
    });

    expect(result).toEqual({
      status: "local",
      source: "sample.png",
    });
  });

  it("blocks remote images by default and preserves data URLs", () => {
    expect(
      resolveLocalImageSource("https://example.test/a.svg", {
        allowLocalImages: true,
      }),
    ).toEqual({
      status: "external-blocked",
    });
    expect(
      resolveLocalImageSource("data:image/svg+xml;base64,AA==", {
        allowLocalImages: true,
      }),
    ).toEqual({
      status: "passthrough",
      src: "data:image/svg+xml;base64,AA==",
    });
  });

  it("blocks oversized and unsupported data image sources", () => {
    expect(
      resolveLocalImageSource(
        `data:image/png;base64,${"A".repeat(256 * 1024)}`,
        {
          allowLocalImages: true,
        },
      ),
    ).toEqual({
      status: "blocked",
      placeholderText: "Data image blocked: image is too large",
    });
    expect(
      resolveLocalImageSource("data:text/html,<script>alert(1)</script>", {
        allowLocalImages: true,
      }),
    ).toEqual({
      status: "blocked",
      placeholderText: "Data image blocked: unsupported media type",
    });
  });

  it("does not pass script-like image URLs through as external images", () => {
    expect(
      resolveLocalImageSource("javascript:alert(1)", {
        allowLocalImages: false,
        showExternalImages: true,
      }),
    ).toEqual({
      status: "blocked",
      placeholderText: "Local image blocked: javascript:alert(1)",
    });
  });

  it("preserves remote images when external images are enabled", () => {
    expect(
      resolveLocalImageSource("https://example.test/a.svg", {
        allowLocalImages: true,
        showExternalImages: true,
      }),
    ).toEqual({
      status: "passthrough",
      src: "https://example.test/a.svg",
    });
  });

  it("passes document-provided asset and file URLs to the backend boundary", () => {
    expect(
      resolveLocalImageSource("asset://localhost/a.svg", {
        allowLocalImages: true,
      }),
    ).toEqual({
      status: "local",
      source: "asset://localhost/a.svg",
    });
    expect(
      resolveLocalImageSource("file:///Users/me/a.svg", {
        allowLocalImages: true,
      }),
    ).toEqual({
      status: "local",
      source: "file:///Users/me/a.svg",
    });
  });

  it("keeps browser fixture paths as backend-owned raw sources", () => {
    expect(
      resolveLocalImageSource("./assets/sample.svg", {
        allowLocalImages: true,
      }),
    ).toEqual({
      status: "local",
      source: "./assets/sample.svg",
    });
  });

  it("passes the comprehensive visual sample image fixture to the mock backend", () => {
    expect(
      resolveLocalImageSource("assets/svard-sample.svg", {
        allowLocalImages: true,
      }),
    ).toEqual({
      status: "local",
      source: "assets/svard-sample.svg",
    });
  });

  it("blocks local images when disabled", () => {
    expect(
      resolveLocalImageSource("./assets/sample.svg", {
        allowLocalImages: false,
      }),
    ).toEqual({
      status: "blocked",
      placeholderText: "Local image blocked: ./assets/sample.svg",
    });
  });
});
