import { describe, expect, it, vi } from "vitest";

import type { DocumentPayload } from "../../src/core/types";
import { addLinkItems } from "../../src/ui/hooks/documentLinks/contextMenuItems";
import type { ContextMenuItem } from "../../src/ui/types";

const documentPayload: DocumentPayload = {
  path: "/workspace/docs/current.md",
  basePath: "/workspace/docs",
  format: "markdown",
  source: "",
  updatedAt: "2026-06-05T00:00:00.000Z",
};

function linkTarget(href: string): HTMLElement {
  document.body.innerHTML = `<a href="${href}"><span>target</span></a>`;
  return document.querySelector("span")!;
}

function buildLinkItems(href: string) {
  const items: ContextMenuItem[] = [];
  const openDocumentInNewWindow = vi.fn();
  addLinkItems(items, linkTarget(href), {
    copyText: vi.fn(),
    documentPayload,
    openDocumentInNewWindow,
    openLinkElement: vi.fn(),
    openPathInEditor: vi.fn(),
    resolveDocumentLink: vi.fn().mockResolvedValue({
      status: "resolved",
      path: "/workspace/docs/target.md",
    }),
    showInlineNotice: vi.fn(),
  });
  return { items, openDocumentInNewWindow };
}

describe("document link context menu", () => {
  it("adds Open Link in New Window for supported local document links", async () => {
    const { items, openDocumentInNewWindow } = buildLinkItems(
      "/workspace/docs/target.md",
    );

    expect(items.map((item) => item.label)).toEqual([
      "Open Document",
      "Open Link in New Window",
      "Open in Editor",
      "Copy Path",
    ]);

    await items
      .find((item) => item.id === "open-link-in-new-window")
      ?.onSelect();
    expect(openDocumentInNewWindow).toHaveBeenCalledWith(
      "/workspace/docs/target.md",
    );
  });

  it("does not add Open Link in New Window for external links", () => {
    const { items } = buildLinkItems("https://example.com/docs");

    expect(items.map((item) => item.label)).toEqual(["Open Link", "Copy Link"]);
  });

  it("does not add Open Link in New Window for same-document anchors", () => {
    const { items } = buildLinkItems("#section");

    expect(items).toEqual([]);
  });

  it("does not add Open Link in New Window for unsupported local files", () => {
    const { items } = buildLinkItems("/workspace/docs/image.png");

    expect(items).toEqual([]);
  });
});
