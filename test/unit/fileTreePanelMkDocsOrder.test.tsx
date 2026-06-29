import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileTreePanel } from "../../src/ui/components/FileTreePanel";
import { documentOrderSectionKey } from "../../src/ui/lib/fileTreeDocuments";
import {
  getDocumentsPanelCommands,
  registerDocumentsPanelCommandBridge,
} from "../../src/ui/lib/documentsPanelCommandBridge";
import { chooseFileViewModeIn } from "./helpers/fileTreePanel";

describe("FileTreePanel MkDocs document order", () => {
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
    registerDocumentsPanelCommandBridge(null);
    container.remove();
  });

  async function chooseFileViewMode(reviewId: string) {
    await chooseFileViewModeIn(container, reviewId);
  }

  it("orders Documents view by MkDocs nav when selected", async () => {
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
                name: "z-last.md",
                path: "/workspace/docs/z-last.md",
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
                source: "mkdocs",
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
                    title: "Guide",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "Last",
                        path: "/workspace/docs/z-last.md",
                        displayPath: "z-last.md",
                        depth: 1,
                        status: "resolved",
                      },
                      {
                        kind: "document",
                        title: "Missing",
                        path: "",
                        displayPath: "missing.md",
                        depth: 1,
                        status: "missing",
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

    await chooseFileViewMode("documents-view-mode-mkdocs");

    expect(
      container.querySelector('[data-review-id="documents-mkdocs-section"]')
        ?.textContent,
    ).toContain("Guide");
    expect(
      container.querySelector('[data-review-id="documents-mkdocs-not-in-nav"]')
        ?.textContent,
    ).toContain("Not in mkdocs.yml");
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-mkdocs-section"] [data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-mkdocs-not-in-nav"] [data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
    });
    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Home"),
      expect.stringContaining("Last"),
      expect.stringContaining("Missing"),
      expect.stringContaining("extra.md"),
    ]);
  });

  it("renders nav-less MkDocs fallback as a directory tree without not-in-nav", async () => {
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
                name: "extra.md",
                path: "/workspace/docs/extra.md",
                kind: "file",
              },
              {
                name: "overview.md",
                path: "/workspace/docs/03_kv_cache_systems/overview.md",
                kind: "file",
              },
              {
                name: "overview.md",
                path: "/workspace/docs/03_kv_cache_systems/engines/overview.md",
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
                source: "mkdocs",
                orderKind: "docs-dir-fallback",
                nodes: [
                  {
                    kind: "section",
                    title: "03_kv_cache_systems",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "overview",
                        path: "/workspace/docs/03_kv_cache_systems/overview.md",
                        displayPath: "03_kv_cache_systems/overview.md",
                        depth: 1,
                        status: "resolved",
                      },
                      {
                        kind: "section",
                        title: "engines",
                        depth: 1,
                        children: [
                          {
                            kind: "document",
                            title: "overview",
                            path: "/workspace/docs/03_kv_cache_systems/engines/overview.md",
                            displayPath:
                              "03_kv_cache_systems/engines/overview.md",
                            depth: 2,
                            status: "resolved",
                          },
                        ],
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

    await chooseFileViewMode("documents-view-mode-mkdocs");
    expect(
      container.querySelector('[data-review-id="documents-mkdocs-not-in-nav"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-review-id="documents-mkdocs-section"]')
        ?.textContent,
    ).toContain("03_kv_cache_systems");

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-mkdocs-section"] [data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
    });
    await act(async () => {
      [
        ...container.querySelectorAll<HTMLButtonElement>(
          '[data-review-id="documents-mkdocs-section"] [data-review-id="documents-order-section-toggle"]',
        ),
      ]
        .find((button) =>
          button.closest("div")?.textContent?.includes("engines"),
        )
        ?.click();
    });

    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("03_kv_cache_systems/overview.md"),
      expect.stringContaining("03_kv_cache_systems/engines/overview.md"),
    ]);
  });

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
            "/workspace/docs": [
              {
                name: "extra.md",
                path: "/workspace/docs/extra.md",
                kind: "file",
              },
              {
                name: "overview.md",
                path: "/workspace/docs/guide/overview.md",
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
  });

  it("collapses MkDocs order sections and not-in-nav groups", async () => {
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
                name: "extra.md",
                path: "/workspace/docs/extra.md",
                kind: "file",
              },
              {
                name: "index.md",
                path: "/workspace/docs/index.md",
                kind: "file",
              },
              {
                name: "last.md",
                path: "/workspace/docs/last.md",
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
                source: "mkdocs",
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
                    title: "Guide",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "Last",
                        path: "/workspace/docs/last.md",
                        displayPath: "last.md",
                        depth: 1,
                        status: "resolved",
                      },
                      {
                        kind: "document",
                        title: "Missing",
                        path: "",
                        displayPath: "missing.md",
                        depth: 1,
                        status: "missing",
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

    await chooseFileViewMode("documents-view-mode-mkdocs");

    const guideToggle = container.querySelector<HTMLButtonElement>(
      '[data-review-id="documents-mkdocs-section"] [data-review-id="documents-order-section-toggle"]',
    );
    expect(guideToggle?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      guideToggle?.click();
    });
    expect(guideToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(
      container
        .querySelector('[data-review-id="documents-mkdocs-section"]')
        ?.getAttribute("data-document-order-section-state"),
    ).toBe("expanded");

    let rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Home"),
      expect.stringContaining("Last"),
      expect.stringContaining("Missing"),
    ]);

    const notInNavToggle = container.querySelector<HTMLButtonElement>(
      '[data-review-id="documents-mkdocs-not-in-nav"] [data-review-id="documents-order-section-toggle"]',
    );
    expect(notInNavToggle?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      notInNavToggle?.click();
    });
    rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Home"),
      expect.stringContaining("Last"),
      expect.stringContaining("Missing"),
      expect.stringContaining("extra.md"),
    ]);
  });

  it("auto-expands and reveals the active MkDocs document section", async () => {
    const guideSectionKey = documentOrderSectionKey(
      "mkdocs",
      ["1"],
      "Guide",
      0,
    );
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      window.setTimeout(() => callback(0), 0);
      return 1;
    }) as typeof window.requestAnimationFrame;

    try {
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
                  name: "last.md",
                  path: "/workspace/docs/last.md",
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
                  source: "mkdocs",
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
                      title: "Guide",
                      depth: 0,
                      children: [
                        {
                          kind: "document",
                          title: "Last",
                          path: "/workspace/docs/last.md",
                          displayPath: "last.md",
                          depth: 1,
                          status: "resolved",
                        },
                      ],
                    },
                  ],
                },
              ],
            }}
            openDocumentPaths={new Set(["/workspace/docs/last.md"])}
            activePath="/workspace/docs/last.md"
            filesViewMode="documents-mkdocs"
            activeDocumentOrderSectionKeys={new Set([guideSectionKey])}
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
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });

      const guideToggle = container.querySelector<HTMLButtonElement>(
        '[data-review-id="documents-mkdocs-section"] [data-review-id="documents-order-section-toggle"]',
      );
      expect(guideToggle?.getAttribute("aria-expanded")).toBe("true");
      expect(
        container.querySelector(
          '[data-review-id="documents-view-row"][data-document-order-active="true"]',
        )?.textContent,
      ).toContain("Last");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });

      await act(async () => {
        guideToggle?.click();
      });
      expect(guideToggle?.getAttribute("aria-expanded")).toBe("false");

      await act(async () => {
        expect(getDocumentsPanelCommands()?.revealCurrentDocument()).toBe(true);
      });
      expect(guideToggle?.getAttribute("aria-expanded")).toBe("true");
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it("uses the toolbar collapse action for document sections in Docs order mode", async () => {
    const onCollapse = vi.fn();
    const guideSectionKey = documentOrderSectionKey(
      "mkdocs",
      ["0"],
      "Guide",
      0,
    );

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
                name: "last.md",
                path: "/workspace/docs/last.md",
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
                source: "mkdocs",
                nodes: [
                  {
                    kind: "section",
                    title: "Guide",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "Last",
                        path: "/workspace/docs/last.md",
                        displayPath: "last.md",
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
          activePath="/workspace/docs/last.md"
          filesViewMode="documents-mkdocs"
          activeDocumentOrderSectionKeys={new Set([guideSectionKey])}
          onOpenFile={vi.fn()}
          onOpenGitDiff={vi.fn()}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={vi.fn()}
          onCollapse={onCollapse}
        />,
      );
    });

    const collapse = container.querySelector<HTMLButtonElement>(
      '[data-review-id="tree-collapse-all"]',
    );
    const guideToggle = container.querySelector<HTMLButtonElement>(
      '[data-review-id="documents-mkdocs-section"] [data-review-id="documents-order-section-toggle"]',
    );
    expect(collapse?.getAttribute("aria-label")).toBe(
      "Collapse all document sections",
    );
    expect(guideToggle?.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      collapse?.click();
    });

    expect(onCollapse).not.toHaveBeenCalled();
    expect(guideToggle?.getAttribute("aria-expanded")).toBe("false");
  });
});
