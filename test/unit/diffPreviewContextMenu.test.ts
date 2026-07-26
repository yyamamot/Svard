import { describe, expect, it, vi } from "vitest";

import type { DocumentDiffPreview } from "../../src/core/types";
import {
  diffPreviewContextMenuItems,
  diffPreviewDocumentPath,
  openDiffLinkElement,
} from "../../src/ui/components/gitDiffPreview/contextMenu";
import type { DiagramPreviewState } from "../../src/ui/types";

const basePreview: DocumentDiffPreview = {
  repositoryRoot: "/workspace",
  relativePath: "docs/guide.md",
  leftPath: null,
  rightPath: "/workspace/docs/guide.md",
  status: "modified",
  leftLabel: "HEAD",
  rightLabel: "Working Tree",
  hunks: [],
};

function menuLabelsFor(
  html: string,
  options: {
    side?: "left" | "right";
    surface?: "rendered" | "source" | "table";
    preview?: DocumentDiffPreview;
    selector?: string;
  } = {},
) {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const target = options.selector
    ? (container.querySelector<HTMLElement>(options.selector) ?? container)
    : container;
  const items = diffPreviewContextMenuItems({
    container,
    event: { clientX: 0, clientY: 0 },
    target,
    side: options.side ?? "right",
    surface: options.surface ?? "rendered",
    preview: options.preview ?? basePreview,
    copyText: vi.fn(),
    openDocument: vi.fn(),
    openPathInEditor: vi.fn(),
    resolveDocumentLink: vi.fn().mockResolvedValue({
      status: "resolved",
      path: "/workspace/docs/target.md",
      hash: null,
    }),
    confirmExternalLink: vi.fn().mockResolvedValue(true),
    openExternalUrl: vi.fn(),
    onOpenDiagramPreview: vi.fn(),
    showInlineNotice: vi.fn(),
  });
  container.remove();
  return items.map((item) => item.label);
}

function menuItemsFor(
  html: string,
  options: {
    side?: "left" | "right";
    surface?: "rendered" | "source" | "table";
    preview?: DocumentDiffPreview;
    selector?: string;
    onOpenDiagramPreview?: (preview: DiagramPreviewState) => void;
    resolveAgentMediaDiagram?: () =>
      | { type: string; source: string }
      | undefined;
    onAddAgentMedia?: () => void;
  } = {},
) {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const target = options.selector
    ? (container.querySelector<HTMLElement>(options.selector) ?? container)
    : container;
  const onOpenDiagramPreview: (preview: DiagramPreviewState) => void =
    options.onOpenDiagramPreview ?? vi.fn();
  const items = diffPreviewContextMenuItems({
    container,
    event: { clientX: 0, clientY: 0 },
    target,
    side: options.side ?? "right",
    surface: options.surface ?? "rendered",
    preview: options.preview ?? basePreview,
    copyText: vi.fn(),
    openDocument: vi.fn(),
    openPathInEditor: vi.fn(),
    resolveDocumentLink: vi.fn().mockResolvedValue({
      status: "resolved",
      path: "/workspace/docs/target.md",
      hash: null,
    }),
    confirmExternalLink: vi.fn().mockResolvedValue(true),
    openExternalUrl: vi.fn(),
    onOpenDiagramPreview,
    onAddAgentMedia: options.onAddAgentMedia,
    resolveAgentMediaDiagram: options.resolveAgentMediaDiagram,
    showInlineNotice: vi.fn(),
  });
  return {
    cleanup: () => container.remove(),
    items,
    onOpenDiagramPreview,
  };
}

describe("diff preview context menu", () => {
  it("prepares the exact rendered selection before opening its Ask AI action", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>Selected rendered text</p>";
    document.body.append(container);
    const text = container.querySelector("p")?.firstChild;
    expect(text).toBeInstanceOf(Text);
    const range = document.createRange();
    range.selectNodeContents(text as Text);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    Object.defineProperty(range, "getClientRects", {
      configurable: true,
      value: () =>
        [
          {
            bottom: 20,
            height: 20,
            left: 0,
            right: 200,
            top: 0,
            width: 200,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          } as DOMRect,
        ] as unknown as DOMRectList,
    });
    const runPreparedAsk = vi.fn();
    const prepareAgentSelection = vi.fn().mockReturnValue(runPreparedAsk);

    const items = diffPreviewContextMenuItems({
      container,
      event: { clientX: 10, clientY: 10 },
      target: container.querySelector<HTMLElement>("p") ?? container,
      side: "right",
      surface: "rendered",
      preview: basePreview,
      copyText: vi.fn(),
      openDocument: vi.fn(),
      openPathInEditor: vi.fn(),
      resolveDocumentLink: vi.fn(),
      confirmExternalLink: vi.fn(),
      openExternalUrl: vi.fn(),
      onOpenDiagramPreview: vi.fn(),
      onPrepareAgentSelection: prepareAgentSelection,
      showInlineNotice: vi.fn(),
    });

    expect(prepareAgentSelection).toHaveBeenCalledOnce();
    expect(prepareAgentSelection.mock.calls[0]?.[0].toString()).toBe(
      "Selected rendered text",
    );
    items.find((item) => item.label === "Ask AI about selection")?.onSelect();
    expect(runPreparedAsk).toHaveBeenCalledOnce();
    container.remove();
  });

  it("uses rendered source block actions from the viewer menu", () => {
    expect(
      menuLabelsFor(
        `<div class="source-block-frame" data-source-reference="/workspace/docs/guide.md:5">
          <pre>const value = 1;</pre>
        </div>`,
        { selector: "pre" },
      ),
    ).toEqual(["Copy Source", "Copy Source Reference", "Copy Text Reference"]);
  });

  it("uses source actions for extracted rendered diff pre blocks", () => {
    expect(
      menuLabelsFor(
        `<pre data-source-reference="/workspace/docs/guide.md:5">const value = 1;</pre>`,
        { selector: "pre" },
      ),
    ).toEqual(["Copy Source", "Copy Source Reference", "Copy Text Reference"]);
  });

  it("uses rendered table copy actions from the viewer menu", () => {
    expect(
      menuLabelsFor(
        `<table><tbody><tr><td>Plan</td><td>Status</td></tr></tbody></table>`,
        { selector: "td" },
      ),
    ).toEqual(["Copy as TSV", "Copy as CSV", "Copy as Markdown Table"]);
  });

  it("uses heading copy actions from the viewer menu", () => {
    expect(
      menuLabelsFor(
        `<h2 id="overview" data-source-reference="/workspace/docs/guide.md:1#overview">Overview</h2>`,
        { selector: "h2" },
      ),
    ).toEqual([
      "Copy Heading Link",
      "Copy Source Reference",
      "Copy Text Reference",
    ]);
  });

  it("offers image preview actions in rendered panes", () => {
    expect(
      menuLabelsFor(
        `<p data-source-selection-start="4" data-source-selection-end="4"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%3E%3Ctext%3ELabel%3C%2Ftext%3E%3C%2Fsvg%3E" data-image-path="assets/sample.svg" data-image-resolved-path="/workspace/assets/sample.svg" data-image-reference="/workspace/docs/guide.md" alt="Sample SVG"></p>`,
        { selector: "img" },
      ),
    ).toEqual([
      "Open Preview",
      "Copy Image",
      "Copy Image with Reference",
      "Copy Image Path",
    ]);
  });

  it("resolves rendered diagram source while building its Ask AI action", () => {
    const resolveAgentMediaDiagram = vi.fn().mockReturnValue({
      type: "mermaid",
      source: "flowchart LR\nA --> B",
    });
    const { cleanup, items } = menuItemsFor(
      `<div class="diagram-inline-image"><svg></svg></div>`,
      {
        selector: "svg",
        resolveAgentMediaDiagram,
        onAddAgentMedia: vi.fn(),
      },
    );

    expect(items.map((item) => item.label)).toContain("Ask AI");
    expect(resolveAgentMediaDiagram).toHaveBeenCalledWith(
      expect.any(SVGElement),
      "right",
    );
    cleanup();
  });

  it("uses URL terminology for displayed external images", () => {
    expect(
      menuLabelsFor(
        `<img src="https://example.test/image.png" data-image-path="https://example.test/image.png" data-image-url="https://example.test/image.png" data-image-reference="/workspace/docs/guide.md" alt="Remote image">`,
        { selector: "img" },
      ),
    ).toEqual([
      "Open Preview",
      "Copy Image",
      "Copy Image with Reference",
      "Copy Image URL",
    ]);
  });

  it("does not offer a path or URL action for inline data images", () => {
    expect(
      menuLabelsFor(
        `<img src="data:image/png;base64,AA==" data-image-reference="/workspace/docs/guide.md" alt="Inline image">`,
        { selector: "img" },
      ),
    ).toEqual(["Open Preview", "Copy Image", "Copy Image with Reference"]);
  });

  it("opens a before/after diagram comparison for matched rendered diagram blocks", () => {
    const onOpenDiagramPreview = vi.fn();
    const { cleanup, items } = menuItemsFor(
      `<div class="git-rendered-diff-body">
        <article class="git-rendered-block left-side" data-sync-index="2">
          <div data-review-id="mermaid-render">
            <div data-review-id="diagram-inline-image" class="diagram-inline-image" data-source-reference="/workspace/docs/guide.md:4">
              <svg viewBox="0 0 100 50"><text>Before diagram</text></svg>
            </div>
          </div>
        </article>
        <article class="git-rendered-block right-side" data-sync-index="2">
          <div data-review-id="mermaid-render">
            <div data-review-id="diagram-inline-image" class="diagram-inline-image" data-source-reference="/workspace/docs/guide.md:8">
              <svg viewBox="0 0 100 50"><text>After diagram</text></svg>
            </div>
          </div>
        </article>
      </div>`,
      {
        selector: ".right-side svg",
        onOpenDiagramPreview,
      },
    );

    const openPreview = items.find((item) => item.label === "Open Preview");
    cleanup();
    openPreview?.onSelect();

    expect(onOpenDiagramPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "diagram-comparison",
        before: expect.objectContaining({
          title: "HEAD",
          svg: expect.stringContaining("Before diagram"),
          sourceReference: "/workspace/docs/guide.md:4",
        }),
        after: expect.objectContaining({
          title: "Working Tree",
          svg: expect.stringContaining("After diagram"),
          sourceReference: "/workspace/docs/guide.md:8",
        }),
      }),
    );
  });

  it("does not create a comparison pair from Kroki-rendered diagrams", () => {
    const onOpenDiagramPreview = vi.fn();
    const { cleanup, items } = menuItemsFor(
      `<div class="git-rendered-diff-body">
        <article class="git-rendered-block left-side" data-sync-index="2">
          <div data-review-id="kroki-render">
            <div data-review-id="diagram-inline-image" class="diagram-inline-image">
              <svg viewBox="0 0 100 50"><text>Before diagram</text></svg>
            </div>
          </div>
        </article>
        <article class="git-rendered-block right-side" data-sync-index="2">
          <div data-review-id="kroki-render">
            <div data-review-id="diagram-inline-image" class="diagram-inline-image">
              <svg viewBox="0 0 100 50"><text>After diagram</text></svg>
            </div>
          </div>
        </article>
      </div>`,
      {
        selector: ".right-side svg",
        onOpenDiagramPreview,
      },
    );

    items.find((item) => item.label === "Open Preview")?.onSelect?.();
    cleanup();

    expect(onOpenDiagramPreview).toHaveBeenCalledWith(
      expect.not.objectContaining({ kind: "diagram-comparison" }),
    );
    expect(onOpenDiagramPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        svg: expect.stringContaining("After diagram"),
      }),
    );
  });

  it("shows document path actions only for concrete diff sides", () => {
    expect(menuLabelsFor(`<p>Background</p>`, { selector: "p" })).toEqual([
      "Open in Editor",
      "Copy Document Path",
    ]);
    expect(
      menuLabelsFor(`<p>Background</p>`, {
        side: "left",
        selector: "p",
      }),
    ).toEqual(["Copy Pane Text"]);
  });

  it("adds Capture Area after rendered diff pane actions", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>Background</p>";
    document.body.append(container);
    const beginCaptureArea = vi.fn();
    const items = diffPreviewContextMenuItems({
      container,
      event: { clientX: 0, clientY: 0 },
      target: container.querySelector<HTMLElement>("p") ?? container,
      side: "right",
      surface: "rendered",
      preview: basePreview,
      copyText: vi.fn(),
      openDocument: vi.fn(),
      openPathInEditor: vi.fn(),
      resolveDocumentLink: vi.fn(),
      confirmExternalLink: vi.fn(),
      openExternalUrl: vi.fn(),
      onOpenDiagramPreview: vi.fn(),
      onBeginCaptureArea: beginCaptureArea,
      showInlineNotice: vi.fn(),
    });

    expect(items.map((item) => item.label)).toEqual([
      "Open in Editor",
      "Copy Document Path",
      "Capture Area…",
      "Capture Area with Reference…",
    ]);
    items.at(-2)?.onSelect();
    expect(beginCaptureArea).toHaveBeenCalledWith(container, "plain");
    items.at(-1)?.onSelect();
    expect(beginCaptureArea).toHaveBeenCalledWith(container, "reference");
    container.remove();
  });

  it("keeps Source view context menu limited to selection and path actions", () => {
    const container = document.createElement("div");
    container.textContent = "selected source";
    document.body.append(container);
    const range = document.createRange();
    range.selectNodeContents(container);
    range.getClientRects = () =>
      [
        {
          left: 0,
          right: 20,
          top: 0,
          bottom: 20,
        } as DOMRect,
      ] as unknown as DOMRectList;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const items = diffPreviewContextMenuItems({
      container,
      event: { clientX: 10, clientY: 10 },
      target: container,
      side: "right",
      surface: "source",
      preview: basePreview,
      copyText: vi.fn(),
      openDocument: vi.fn(),
      openPathInEditor: vi.fn(),
      resolveDocumentLink: vi.fn(),
      confirmExternalLink: vi.fn().mockResolvedValue(true),
      openExternalUrl: vi.fn(),
      onOpenDiagramPreview: vi.fn(),
      showInlineNotice: vi.fn(),
    });

    selection?.removeAllRanges();
    container.remove();
    expect(items.map((item) => item.label)).toEqual([]);
  });

  it("copies a rendered selection with its concrete diff side and revision", async () => {
    const container = document.createElement("div");
    container.innerHTML = `<h2 id="overview" data-source-reference="/workspace/docs/guide.md:3#overview">Overview</h2><p>Selected sentence.</p>`;
    document.body.append(container);
    const paragraph = container.querySelector("p")!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.getClientRects = () =>
      [
        {
          left: 0,
          right: 200,
          top: 0,
          bottom: 20,
        } as DOMRect,
      ] as unknown as DOMRectList;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const copyText = vi.fn();

    const items = diffPreviewContextMenuItems({
      container,
      event: { clientX: 10, clientY: 10 },
      target: paragraph,
      side: "right",
      surface: "rendered",
      preview: basePreview,
      copyText,
      openDocument: vi.fn(),
      openPathInEditor: vi.fn(),
      resolveDocumentLink: vi.fn(),
      confirmExternalLink: vi.fn().mockResolvedValue(true),
      openExternalUrl: vi.fn(),
      onOpenDiagramPreview: vi.fn(),
      showInlineNotice: vi.fn(),
    });

    await items.find((item) => item.id === "copy-text-reference")?.onSelect();
    selection?.removeAllRanges();
    container.remove();
    expect(copyText).toHaveBeenCalledWith(
      "Text reference",
      expect.stringContaining("Revision: Working Tree (right)"),
    );
    expect(copyText).toHaveBeenCalledWith(
      "Text reference",
      expect.stringContaining("File: docs/guide.md"),
    );
  });

  it("copies a paired diff reference from the selected concrete side", async () => {
    const container = document.createElement("div");
    container.className = "git-diff-body-with-ruler";
    container.innerHTML = `<article class="git-rendered-block left-side" data-sync-index="1" data-change-index="0"><p data-source-selection-start="1" data-source-selection-end="1">Selected sentence.</p></article><article class="git-rendered-block right-side" data-sync-index="1" data-change-index="0"><p data-source-selection-start="1" data-source-selection-end="1">Selected sentence.</p></article>`;
    document.body.append(container);
    const paragraph = container.querySelector("p")!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.getClientRects = () =>
      [
        { left: 0, right: 200, top: 0, bottom: 20 } as DOMRect,
      ] as unknown as DOMRectList;
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const copyText = vi.fn();
    const items = diffPreviewContextMenuItems({
      container,
      event: { clientX: 10, clientY: 10 },
      target: paragraph,
      side: "right",
      surface: "rendered",
      preview: {
        ...basePreview,
        leftText: "Selected sentence.\n",
        rightText: "Selected sentence.\n",
      },
      copyText,
      openDocument: vi.fn(),
      openPathInEditor: vi.fn(),
      resolveDocumentLink: vi.fn(),
      confirmExternalLink: vi.fn().mockResolvedValue(true),
      openExternalUrl: vi.fn(),
      onOpenDiagramPreview: vi.fn(),
      showInlineNotice: vi.fn(),
    });

    expect(items.map((item) => item.label)).toEqual([
      "Copy Text Reference",
      "Copy Diff Reference",
      "Copy Original Text Reference",
    ]);
    await items.find((item) => item.id === "copy-diff-reference")?.onSelect();
    window.getSelection()?.removeAllRanges();
    container.remove();
    expect(copyText).toHaveBeenCalledWith(
      "Diff reference",
      expect.stringContaining("Before (HEAD):\nFile: docs/guide.md:1-1"),
    );
  });

  it("offers a diff reference from a changed block without selection", () => {
    const { cleanup, items } = menuItemsFor(
      `<div class="git-diff-body-with-ruler"><article class="git-rendered-block left-side" data-sync-index="1" data-change-index="0"><p data-source-selection-start="1" data-source-selection-end="1">Before.</p></article><article class="git-rendered-block right-side" data-sync-index="1" data-change-index="0"><p data-source-selection-start="1" data-source-selection-end="1">After.</p></article></div>`,
      {
        selector: ".right-side p",
        preview: {
          ...basePreview,
          leftText: "Before.\n",
          rightText: "After.\n",
        },
      },
    );
    expect(items.map((item) => item.label)).toContain("Copy Diff Reference");
    cleanup();
  });

  it("offers only text and original references for an unchanged selected block", async () => {
    const container = document.createElement("div");
    container.className = "git-diff-body-with-ruler";
    container.innerHTML = `<article class="git-rendered-block left-side" data-sync-index="1"><p data-source-selection-start="1" data-source-selection-end="1">Unchanged sentence.</p></article><article class="git-rendered-block right-side" data-sync-index="1"><p data-source-selection-start="1" data-source-selection-end="1">Unchanged sentence.</p></article>`;
    document.body.append(container);
    const paragraph = container.querySelector<HTMLElement>(".right-side p")!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.getClientRects = () =>
      [
        { left: 0, right: 200, top: 0, bottom: 20 } as DOMRect,
      ] as unknown as DOMRectList;
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const copyText = vi.fn();

    const items = diffPreviewContextMenuItems({
      container,
      event: { clientX: 10, clientY: 10 },
      target: paragraph,
      side: "right",
      surface: "rendered",
      preview: {
        ...basePreview,
        leftText: "Unchanged sentence.\n",
        rightText: "Unchanged sentence.\n",
      },
      copyText,
      openDocument: vi.fn(),
      openPathInEditor: vi.fn(),
      resolveDocumentLink: vi.fn(),
      confirmExternalLink: vi.fn().mockResolvedValue(true),
      openExternalUrl: vi.fn(),
      onOpenDiagramPreview: vi.fn(),
      showInlineNotice: vi.fn(),
    });

    expect(items.map((item) => item.label)).toEqual([
      "Copy Text Reference",
      "Copy Original Text Reference",
    ]);
    await items
      .find((item) => item.id === "copy-original-text-reference")
      ?.onSelect();
    expect(copyText).toHaveBeenCalledWith(
      "Original text reference",
      expect.stringContaining(
        "Revision: Working Tree (right)\nOriginal text:\nUnchanged sentence.",
      ),
    );
    window.getSelection()?.removeAllRanges();
    container.remove();
  });

  it("does not offer a location reference for a virtual diff side", () => {
    const container = document.createElement("div");
    container.innerHTML = `<h2 id="overview">Overview</h2><p>Selected sentence.</p>`;
    document.body.append(container);
    const paragraph = container.querySelector("p")!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.getClientRects = () =>
      [
        {
          left: 0,
          right: 200,
          top: 0,
          bottom: 20,
        } as DOMRect,
      ] as unknown as DOMRectList;
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const items = diffPreviewContextMenuItems({
      container,
      event: { clientX: 10, clientY: 10 },
      target: paragraph,
      side: "left",
      surface: "rendered",
      preview: basePreview,
      copyText: vi.fn(),
      openDocument: vi.fn(),
      openPathInEditor: vi.fn(),
      resolveDocumentLink: vi.fn(),
      confirmExternalLink: vi.fn().mockResolvedValue(true),
      openExternalUrl: vi.fn(),
      onOpenDiagramPreview: vi.fn(),
      showInlineNotice: vi.fn(),
    });

    window.getSelection()?.removeAllRanges();
    container.remove();
    expect(items.map((item) => item.label)).toEqual([]);
  });

  it("uses path or pane text fallback for Source view background", () => {
    expect(
      menuLabelsFor(`<div><code>source line</code></div>`, {
        surface: "source",
        selector: "code",
      }),
    ).toEqual(["Open in Editor", "Copy Document Path"]);
    expect(
      menuLabelsFor(`<div><code>source line</code></div>`, {
        side: "left",
        surface: "source",
        selector: "code",
      }),
    ).toEqual(["Copy Pane Text"]);
  });

  it("uses table copy actions or fallback for Table view", () => {
    expect(
      menuLabelsFor(
        `<table><tbody><tr><td>Plan</td><td>Status</td></tr></tbody></table>`,
        { surface: "table", selector: "td" },
      ),
    ).toEqual(["Copy as TSV", "Copy as CSV", "Copy as Markdown Table"]);
    expect(
      menuLabelsFor(`<div><p>table pane background</p></div>`, {
        side: "left",
        surface: "table",
        selector: "p",
      }),
    ).toEqual(["Copy Pane Text"]);
  });

  it("resolves right relative paths through the repository root", () => {
    expect(
      diffPreviewDocumentPath(
        {
          ...basePreview,
          rightPath: null,
          repositoryRoot: "/workspace",
          relativePath: "docs/guide.md",
        },
        "right",
      ),
    ).toBe("/workspace/docs/guide.md");
  });

  it("confirms external links before opening them", async () => {
    const link = document.createElement("a");
    link.href = "https://example.test/docs";
    link.setAttribute("href", "https://example.test/docs");
    const confirmExternalLink = vi.fn().mockResolvedValue(false);
    const openExternalUrl = vi.fn();

    await openDiffLinkElement({
      link,
      documentPath: "/workspace/docs/guide.md",
      confirmExternalLink,
      openDocument: vi.fn(),
      openExternalUrl,
      resolveDocumentLink: vi.fn(),
      showInlineNotice: vi.fn(),
    });

    expect(confirmExternalLink).toHaveBeenCalledWith(
      "https://example.test/docs",
    );
    expect(openExternalUrl).not.toHaveBeenCalled();
  });
});
