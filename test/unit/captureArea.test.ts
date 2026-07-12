import { describe, expect, it } from "vitest";
import {
  captureAreaBackground,
  captureAreaCompositeLayout,
  captureAreaFailureNotice,
  captureAreaImageSize,
  captureAreaReferenceForRect,
  clampCaptureArea,
  createCaptureAreaReferenceFooter,
  minimumCaptureAreaSize,
  visibleCaptureBounds,
} from "../../src/ui/lib/captureArea";

describe("capture area geometry", () => {
  const bounds = { left: 100, top: 80, width: 400, height: 300 };

  it("normalizes a drag in either direction and clamps it to the visible document", () => {
    expect(clampCaptureArea(460, 330, 140, 120, bounds)).toEqual({
      left: 140,
      top: 120,
      width: 320,
      height: 210,
    });
    expect(clampCaptureArea(20, 40, 700, 600, bounds)).toEqual(bounds);
  });

  it("does not create a capture for a tiny drag", () => {
    expect(
      clampCaptureArea(
        100,
        80,
        100 + minimumCaptureAreaSize - 1,
        80 + minimumCaptureAreaSize - 1,
        bounds,
      ),
    ).toBeNull();
  });

  it("uses only the document area visible in the viewer pane", () => {
    expect(
      visibleCaptureBounds(
        new DOMRect(40, 60, 600, 500),
        new DOMRect(100, 80, 400, 300),
      ),
    ).toEqual(bounds);
  });

  it("uses device pixels while preserving the 4096px image limit", () => {
    expect(captureAreaImageSize({ width: 1000, height: 500 }, 2)).toEqual({
      width: 2000,
      height: 1000,
    });
    expect(captureAreaImageSize({ width: 3000, height: 1500 }, 2)).toEqual({
      width: 4096,
      height: 2048,
    });
  });

  it("keeps content and reference footer proportions in the composed PNG", () => {
    expect(
      captureAreaCompositeLayout({ width: 1000, height: 500 }, 100, 2),
    ).toEqual({
      width: 2000,
      height: 1200,
      contentHeight: 1000,
      footerHeight: 200,
    });
    expect(
      captureAreaCompositeLayout({ width: 3000, height: 1500 }, 300, 2),
    ).toEqual({
      width: 4096,
      height: 2458,
      contentHeight: 2048,
      footerHeight: 410,
    });
  });

  it("states that a failed capture leaves the previous clipboard unchanged", () => {
    expect(captureAreaFailureNotice).toContain("clipboard was not changed");
  });

  it("uses the nearest opaque reader surface as the PNG background", () => {
    const outer = document.createElement("div");
    outer.style.backgroundColor = "rgb(247, 248, 249)";
    const inner = document.createElement("div");
    inner.style.backgroundColor = "transparent";
    outer.append(inner);
    document.body.append(outer);

    expect(captureAreaBackground(inner)).toBe("rgb(247, 248, 249)");
    outer.remove();
  });

  it("resolves intersecting source blocks and removes nested duplicates", () => {
    const pane = captureRoot("/workspace/docs/guide.md", rect(0, 0, 500, 400));
    const first = mappedBlock("paragraph-1", 10, 12, rect(20, 20, 300, 40));
    const code = mappedBlock("code-1", 14, 20, rect(20, 80, 300, 100));
    const nested = mappedBlock("code-1", 14, 20, rect(30, 90, 280, 80));
    code.append(nested);
    pane.append(first, code);
    document.body.append(pane);

    expect(
      captureAreaReferenceForRect(pane, {
        left: 10,
        top: 10,
        width: 350,
        height: 190,
      }),
    ).toBe("File: /workspace/docs/guide.md:10-20");
    pane.remove();
  });

  it("keeps include origin fragments in document order", () => {
    const pane = captureRoot("/workspace/docs/root.md", rect(0, 0, 500, 400));
    pane.append(
      mappedBlock("root-1", 4, 5, rect(20, 20, 300, 30)),
      mappedBlock(
        "include-1",
        8,
        11,
        rect(20, 60, 300, 50),
        "/workspace/docs/include.md",
      ),
      mappedBlock("root-2", 7, 9, rect(20, 120, 300, 50)),
    );
    document.body.append(pane);

    expect(
      captureAreaReferenceForRect(pane, {
        left: 10,
        top: 10,
        width: 350,
        height: 180,
      }),
    ).toBe(
      [
        "File: /workspace/docs/root.md:4-5",
        "File: /workspace/docs/include.md:8-11",
        "File: /workspace/docs/root.md:7-9",
      ].join("\n\n"),
    );
    pane.remove();
  });

  it("uses available root and revision information without source mapping", () => {
    const surface = document.createElement("div");
    const left = captureRoot("/workspace/docs/guide.md", rect(0, 0, 240, 300));
    left.classList.add("git-rendered-pane");
    left.dataset.captureRevisionLabel = "HEAD";
    left.dataset.captureSide = "left";
    const right = captureRoot(
      "/workspace/docs/guide.md",
      rect(260, 0, 240, 300),
    );
    right.classList.add("git-rendered-pane");
    right.dataset.captureRevisionLabel = "Working Tree";
    right.dataset.captureSide = "right";
    surface.append(left, right);
    document.body.append(surface);

    expect(
      captureAreaReferenceForRect(surface, {
        left: 0,
        top: 0,
        width: 500,
        height: 200,
      }),
    ).toBe(
      [
        "File: /workspace/docs/guide.md\nRevision: HEAD (left)",
        "File: /workspace/docs/guide.md\nRevision: Working Tree (right)",
      ].join("\n\n"),
    );
    surface.remove();
  });

  it("creates an opaque monospace footer below the captured content", () => {
    const article = document.createElement("div");
    article.style.backgroundColor = "rgb(20, 24, 28)";
    article.style.color = "rgb(240, 242, 244)";
    document.body.append(article);

    const footer = createCaptureAreaReferenceFooter(
      article,
      "File: /workspace/docs/guide.md:10-20",
      640,
    );
    expect(footer.dataset.captureReferenceFooter).toBe("true");
    expect(footer.style.width).toBe("640px");
    expect(footer.style.background).toBe("rgb(20, 24, 28)");
    expect(footer.style.fontFamily).toContain("ui-monospace");
    expect(footer.textContent).toContain("guide.md:10-20");
    article.remove();
  });
});

function rect(left: number, top: number, width: number, height: number) {
  return new DOMRect(left, top, width, height);
}

function captureRoot(path: string, bounds: DOMRect) {
  const root = document.createElement("section");
  root.className = "viewer-pane";
  root.dataset.captureDocumentPath = path;
  root.getBoundingClientRect = () => bounds;
  return root;
}

function mappedBlock(
  id: string,
  start: number,
  end: number,
  bounds: DOMRect,
  sourcePath?: string,
) {
  const block = document.createElement("div");
  block.dataset.sourceSelectionBlockId = id;
  block.dataset.sourceSelectionStart = String(start);
  block.dataset.sourceSelectionEnd = String(end);
  if (sourcePath) block.dataset.sourceSelectionSourcePath = sourcePath;
  block.getBoundingClientRect = () => bounds;
  return block;
}
