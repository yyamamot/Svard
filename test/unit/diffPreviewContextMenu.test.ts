import { describe, expect, it, vi } from "vitest";

import type { DocumentDiffPreview } from "../../src/core/types";
import {
  diffPreviewContextMenuItems,
  diffPreviewDocumentPath,
  openDiffLinkElement,
} from "../../src/ui/components/gitDiffPreview/contextMenu";

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

describe("diff preview context menu", () => {
  it("uses rendered source block actions from the viewer menu", () => {
    expect(
      menuLabelsFor(
        `<div class="source-block-frame" data-source-reference="/workspace/docs/guide.md:5">
          <pre>const value = 1;</pre>
        </div>`,
        { selector: "pre" },
      ),
    ).toEqual(["Copy Source", "Copy Source Reference"]);
  });

  it("uses source actions for extracted rendered diff pre blocks", () => {
    expect(
      menuLabelsFor(
        `<pre data-source-reference="/workspace/docs/guide.md:5">const value = 1;</pre>`,
        { selector: "pre" },
      ),
    ).toEqual(["Copy Source", "Copy Source Reference"]);
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
    ).toEqual(["Copy Heading Link", "Copy Source Reference"]);
  });

  it("offers image preview actions in rendered panes", () => {
    expect(
      menuLabelsFor(
        `<img src="data:image/svg+xml;charset=utf-8,%3Csvg%3E%3Ctext%3ELabel%3C%2Ftext%3E%3C%2Fsvg%3E" data-image-path="assets/sample.svg" data-image-reference="docs/guide.md:4" alt="Sample SVG">`,
        { selector: "img" },
      ),
    ).toEqual(["Open Preview", "Copy Image Reference", "Copy Path"]);
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
    expect(items.map((item) => item.label)).toEqual(["Copy Selection"]);
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
