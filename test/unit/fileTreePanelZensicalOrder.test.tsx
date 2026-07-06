import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileTreePanel } from "../../src/ui/components/FileTreePanel";
import { chooseFileViewModeIn } from "./helpers/fileTreePanel";

describe("FileTreePanel Zensical document order", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function chooseFileViewMode(reviewId: string) {
    await chooseFileViewModeIn(container, reviewId);
  }

  it("orders Documents view by Zensical nav when selected", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "docs", path: "/workspace/docs", kind: "directory" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "docs", path: "/workspace/docs", kind: "directory" },
            ],
            "/workspace/docs": [
              {
                name: "reference.md",
                path: "/workspace/docs/reference.md",
                kind: "file",
              },
              {
                name: "index.md",
                path: "/workspace/docs/index.md",
                kind: "file",
              },
              {
                name: "extra.md",
                path: "/workspace/docs/extra.md",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set(["/workspace/docs"])}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          documentOrder={{
            orders: [
              {
                source: "zensical",
                nodes: [
                  {
                    kind: "document",
                    title: "Home",
                    path: "/workspace/docs/index.md",
                    displayPath: "index.md",
                    depth: 0,
                    status: "resolved",
                  },
                  {
                    kind: "section",
                    title: "Reference",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "API",
                        path: "/workspace/docs/reference.md",
                        displayPath: "reference.md",
                        depth: 1,
                        status: "resolved",
                      },
                    ],
                  },
                ],
              },
            ],
          }}
          openDocumentPaths={new Set()}
          activePath="/workspace/docs/index.md"
          onOpenFile={vi.fn()}
          onOpenGitDiff={vi.fn()}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={vi.fn()}
          onCollapse={vi.fn()}
        />,
      );
    });

    await chooseFileViewMode("documents-view-mode-zensical");
    expect(
      container.querySelector(".documents-view-heading")?.textContent,
    ).toBe("Docs: Zensical");
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-zensical-section"] [data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-zensical-not-in-nav"] [data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
    });

    expect(
      container.querySelector('[data-review-id="documents-zensical-section"]')
        ?.textContent,
    ).toContain("Reference");
    expect(
      container.querySelector(
        '[data-review-id="documents-zensical-not-in-nav"]',
      )?.textContent,
    ).toContain("Not in zensical.toml");
    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Home"),
      expect.stringContaining("API"),
      expect.stringContaining("extra.md"),
    ]);
  });

  it("shows changed Zensical section and not-in-nav rows without manual expansion", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "docs", path: "/workspace/docs", kind: "directory" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "docs", path: "/workspace/docs", kind: "directory" },
            ],
            "/workspace/docs": [
              {
                name: "index.md",
                path: "/workspace/docs/index.md",
                kind: "file",
              },
              {
                name: "reference.md",
                path: "/workspace/docs/reference.md",
                kind: "file",
              },
              {
                name: "extra.md",
                path: "/workspace/docs/extra.md",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set(["/workspace/docs"])}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{
            "/workspace/docs/reference.md": "modified",
            "/workspace/docs/extra.md": "untracked",
          }}
          gitChanges={null}
          documentOrder={{
            orders: [
              {
                source: "zensical",
                nodes: [
                  {
                    kind: "document",
                    title: "Home",
                    path: "/workspace/docs/index.md",
                    displayPath: "index.md",
                    depth: 0,
                    status: "resolved",
                  },
                  {
                    kind: "section",
                    title: "Reference",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "API",
                        path: "/workspace/docs/reference.md",
                        displayPath: "reference.md",
                        depth: 1,
                        status: "resolved",
                      },
                    ],
                  },
                ],
              },
            ],
          }}
          openDocumentPaths={new Set()}
          activePath="/workspace/docs/index.md"
          onOpenFile={vi.fn()}
          onOpenGitDiff={vi.fn()}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={vi.fn()}
          onCollapse={vi.fn()}
        />,
      );
    });

    await chooseFileViewMode("documents-view-mode-zensical");
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-source-filter-changed"]',
        )
        ?.click();
    });

    expect(
      container.querySelector(
        '[data-review-id="documents-source-filter-changed"]',
      )?.textContent,
    ).toBe("Changed 2");
    expect(
      container
        .querySelector('[data-review-id="documents-zensical-section"]')
        ?.getAttribute("data-document-order-section-state"),
    ).toBe("expanded");
    expect(
      container
        .querySelector('[data-review-id="documents-zensical-section"]')
        ?.querySelector(".documents-change-count-badge")?.textContent,
    ).toBe("1");
    expect(
      container
        .querySelector('[data-review-id="documents-zensical-not-in-nav"]')
        ?.getAttribute("data-document-order-section-state"),
    ).toBe("expanded");
    expect(
      container
        .querySelector('[data-review-id="documents-zensical-not-in-nav"]')
        ?.querySelector(".documents-change-count-badge")?.textContent,
    ).toBe("1");
    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("API"),
      expect.stringContaining("extra.md"),
    ]);
    expect(rows.map((row) => row.textContent).join("\n")).not.toContain("Home");
  });

  it("hides not-in-nav for nav-less Zensical fallback orders", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "docs", path: "/workspace/docs", kind: "directory" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "docs", path: "/workspace/docs", kind: "directory" },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{
            "/workspace/docs/guide/overview.md": "modified",
          }}
          gitChanges={null}
          documentOrder={{
            orders: [
              {
                source: "zensical",
                orderKind: "docs-dir-fallback",
                nodes: [
                  {
                    kind: "section",
                    title: "guide",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "overview",
                        path: "/workspace/docs/guide/overview.md",
                        displayPath: "guide/overview.md",
                        depth: 1,
                        status: "resolved",
                      },
                    ],
                  },
                ],
              },
            ],
          }}
          openDocumentPaths={new Set()}
          activePath="/workspace/docs/extra.md"
          onOpenFile={vi.fn()}
          onOpenGitDiff={vi.fn()}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={vi.fn()}
          onCollapse={vi.fn()}
        />,
      );
    });

    await chooseFileViewMode("documents-view-mode-zensical");

    expect(
      container.querySelector(
        '[data-review-id="documents-zensical-not-in-nav"]',
      ),
    ).toBeNull();
    expect(
      container.querySelector('[data-review-id="documents-zensical-section"]')
        ?.textContent,
    ).toContain("guide");

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-zensical-section"] [data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
    });

    const row = container.querySelector(
      '[data-review-id="documents-view-row"]',
    );
    expect(row?.querySelector(".documents-view-row-path")?.textContent).toBe(
      "guide/overview.md",
    );
    expect(
      row?.querySelector('[data-review-id="git-status-diff-button"]')
        ?.textContent,
    ).toBe("M");
  });
});
