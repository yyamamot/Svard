import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiagramPreviewPanel } from "../../src/ui/components/DiagramPreviewPanel";

describe("DiagramPreviewPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("zooms by resizing the SVG viewport instead of scaling a rasterized layer", async () => {
    await act(async () => {
      root.render(
        <DiagramPreviewPanel
          preview={{
            title: "Heavy diagram",
            svg: '<svg viewBox="0 0 3747 2344" width="3747" height="2344"><text x="20" y="20">Service 1</text></svg>',
            width: 3747,
            height: 2344,
          }}
          onClose={vi.fn()}
        />,
      );
    });

    const content = container.querySelector<HTMLElement>(
      '[data-review-id="diagram-preview-canvas"] .diagram-preview-content',
    );
    const panel = container.querySelector<HTMLElement>(
      '[data-review-id="diagram-preview-panel"]',
    );
    const svg = content?.querySelector<SVGElement>("svg");
    const initialWidth = Number.parseFloat(content?.style.width ?? "0");

    expect(panel?.classList.contains("expanded")).toBe(true);

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="diagram-preview-zoom-in"]',
        )
        ?.click();
    });

    expect(Number.parseFloat(content?.style.width ?? "0")).toBeGreaterThan(
      initialWidth,
    );
    expect(
      container.querySelector('[data-review-id="diagram-svg-preview-content"]')
        ?.className,
    ).toContain("diagram-preview-svg-frame");
    expect(content?.style.transform).not.toContain("scale");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 3747 2344");
    expect(svg?.getAttribute("width")).toBe("3747");
    expect(svg?.getAttribute("height")).toBe("2344");
  });

  it("sanitizes preview SVG content before insertion", async () => {
    await act(async () => {
      root.render(
        <DiagramPreviewPanel
          preview={{
            title: "Unsafe diagram",
            svg: '<svg viewBox="0 0 100 50" onclick="alert(1)"><foreignObject><script>alert(1)</script></foreignObject><text>Safe</text></svg>',
            width: 100,
            height: 50,
          }}
          onClose={vi.fn()}
        />,
      );
    });

    const content = container.querySelector<HTMLElement>(
      '[data-review-id="diagram-preview-canvas"] .diagram-preview-content',
    );

    expect(content?.querySelector("svg")?.textContent).toContain("Safe");
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.querySelector("foreignObject")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("renders before and after SVGs in comparison mode", async () => {
    await act(async () => {
      root.render(
        <DiagramPreviewPanel
          preview={{
            kind: "diagram-comparison",
            title: "Diagram comparison",
            before: {
              title: "HEAD",
              svg: '<svg viewBox="0 0 100 50"><text>Before state</text></svg>',
              width: 100,
              height: 50,
            },
            after: {
              title: "Working Tree",
              svg: '<svg viewBox="0 0 100 50"><text>After state</text></svg>',
              width: 100,
              height: 50,
            },
          }}
          onClose={vi.fn()}
        />,
      );
    });

    expect(
      container.querySelector('[data-review-id="diagram-preview-comparison"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-review-id="diagram-preview-comparison-before"]',
      )?.textContent,
    ).toContain("Before state");
    expect(
      container.querySelector(
        '[data-review-id="diagram-preview-comparison-after"]',
      )?.textContent,
    ).toContain("After state");
    expect(container.textContent).toContain("HEAD");
    expect(container.textContent).toContain("Working Tree");
  });

  it("sanitizes comparison SVGs before insertion", async () => {
    await act(async () => {
      root.render(
        <DiagramPreviewPanel
          preview={{
            kind: "diagram-comparison",
            title: "Diagram comparison",
            before: {
              title: "Before",
              svg: '<svg viewBox="0 0 100 50" onclick="alert(1)"><image href="https://example.test/pixel.png" /><foreignObject><script>alert(1)</script></foreignObject><text>Before</text></svg>',
            },
            after: {
              title: "After",
              svg: '<svg viewBox="0 0 100 50"><text>After</text></svg>',
            },
          }}
          onClose={vi.fn()}
        />,
      );
    });

    const before = container.querySelector<HTMLElement>(
      '[data-review-id="diagram-preview-comparison-before"]',
    );

    expect(before?.querySelector("svg")?.textContent).toContain("Before");
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.querySelector("foreignObject")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(before?.querySelector("image")).toBeNull();
  });

  it("renders local SVG image previews as selectable sanitized inline SVG", async () => {
    await act(async () => {
      root.render(
        <DiagramPreviewPanel
          preview={{
            kind: "image-svg",
            title: "Local SVG image",
            svg: '<svg viewBox="0 0 100 50"><image href="https://example.test/pixel.png" /><text x="10" y="20">Selectable label</text></svg>',
            width: 100,
            height: 50,
          }}
          onClose={vi.fn()}
        />,
      );
    });

    const content = container.querySelector<HTMLElement>(
      '[data-review-id="image-svg-preview-content"]',
    );
    const text = content?.querySelector("text");

    expect(text?.textContent).toBe("Selectable label");
    expect(content?.querySelector("image")).toBeNull();
    expect(
      container.querySelector(".diagram-preview-content")?.className,
    ).toContain("selectable-svg");
  });

  it("renders raster image previews as images", async () => {
    await act(async () => {
      root.render(
        <DiagramPreviewPanel
          preview={{
            kind: "image-raster",
            title: "Raster image",
            imageSrc: "data:image/png;base64,AA==",
            width: 10,
            height: 10,
          }}
          onClose={vi.fn()}
        />,
      );
    });

    const image = container.querySelector<HTMLImageElement>(
      '[data-review-id="image-preview-content"]',
    );

    expect(image?.getAttribute("src")).toBe("data:image/png;base64,AA==");
    expect(
      container.querySelector(
        '[data-review-id="diagram-preview-canvas"] .diagram-preview-content svg',
      ),
    ).toBeNull();
  });

  it("consumes Escape so only the topmost diagram preview closes", async () => {
    const onClose = vi.fn();
    const documentKeydown = vi.fn();
    document.addEventListener("keydown", documentKeydown);

    await act(async () => {
      root.render(
        <DiagramPreviewPanel
          preview={{
            title: "Esc diagram",
            svg: '<svg viewBox="0 0 100 50"><text>Safe</text></svg>',
            width: 100,
            height: 50,
          }}
          onClose={onClose}
        />,
      );
    });

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(documentKeydown).not.toHaveBeenCalled();
    document.removeEventListener("keydown", documentKeydown);
  });
});
