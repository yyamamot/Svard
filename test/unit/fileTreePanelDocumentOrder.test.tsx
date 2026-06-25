import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileTreePanel } from "../../src/ui/components/FileTreePanel";
import { chooseFileViewModeIn } from "./helpers/fileTreePanel";

describe("FileTreePanel Antora and experimental document order", () => {
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

  it("orders Documents view by Antora nav when selected", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "modules", path: "/workspace/modules", kind: "directory" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "modules", path: "/workspace/modules", kind: "directory" },
            ],
            "/workspace/modules/ROOT/pages": [
              {
                name: "extra.adoc",
                path: "/workspace/modules/ROOT/pages/extra.adoc",
                kind: "file",
              },
              {
                name: "index.adoc",
                path: "/workspace/modules/ROOT/pages/index.adoc",
                kind: "file",
              },
            ],
            "/workspace/modules/admin/pages": [
              {
                name: "users.adoc",
                path: "/workspace/modules/admin/pages/users.adoc",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          documentOrder={{
            orders: [
              {
                source: "antora",
                nodes: [
                  {
                    kind: "section",
                    title: "Product",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "Home",
                        path: "/workspace/modules/ROOT/pages/index.adoc",
                        displayPath: "index.adoc",
                        depth: 0,
                        status: "resolved",
                      },
                      {
                        kind: "document",
                        title: "Users",
                        path: "/workspace/modules/admin/pages/users.adoc",
                        displayPath: "admin:users.adoc",
                        depth: 1,
                        status: "resolved",
                      },
                      {
                        kind: "document",
                        title: "Missing",
                        path: "",
                        displayPath: "missing.adoc",
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
          activePath="/workspace/modules/ROOT/pages/index.adoc"
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

    await chooseFileViewMode("documents-view-mode-antora");

    expect(
      container.querySelector('[data-review-id="documents-antora-section"]')
        ?.textContent,
    ).toContain("Product");
    expect(
      container.querySelector('[data-review-id="documents-antora-not-in-nav"]')
        ?.textContent,
    ).toContain("Not in antora.yml nav");
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-antora-section"] [data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-antora-not-in-nav"] [data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
    });
    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Home"),
      expect.stringContaining("Users"),
      expect.stringContaining("Missing"),
      expect.stringContaining("extra.adoc"),
    ]);
  });



  it("keeps experimental VitePress and Docusaurus order sources hidden by default", async () => {
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
            ],
            "/workspace/docs/guide": [
              {
                name: "intro.md",
                path: "/workspace/docs/guide/intro.md",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          documentOrder={{
            orders: [
              {
                source: "vitepress",
                nodes: [
                  {
                    kind: "section",
                    title: "Guide",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "Home",
                        path: "/workspace/docs/index.md",
                        displayPath: "/",
                        depth: 1,
                        status: "resolved",
                      },
                      {
                        kind: "document",
                        title: "Intro",
                        path: "/workspace/docs/guide/intro.md",
                        displayPath: "/guide/intro",
                        depth: 1,
                        status: "resolved",
                      },
                      {
                        kind: "document",
                        title: "Missing",
                        path: "",
                        displayPath: "/guide/missing",
                        depth: 1,
                        status: "missing",
                      },
                    ],
                  },
                ],
              },
              {
                source: "docusaurus",
                nodes: [
                  {
                    kind: "section",
                    title: "docs",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "Intro",
                        path: "/workspace/docs/intro.md",
                        displayPath: "intro",
                        depth: 1,
                        status: "resolved",
                      },
                      {
                        kind: "section",
                        title: "Tutorial",
                        depth: 1,
                        children: [
                          {
                            kind: "document",
                            title: "Setup",
                            path: "/workspace/docs/tutorial/setup.mdx",
                            displayPath: "tutorial/setup",
                            depth: 2,
                            status: "resolved",
                          },
                          {
                            kind: "document",
                            title: "Missing",
                            path: "",
                            displayPath: "tutorial/missing",
                            depth: 2,
                            status: "missing",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          }}
          openDocumentPaths={new Set(["/workspace/docs/index.md"])}
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

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-view-toggle"]',
        )
        ?.click();
    });

    expect(
      container.querySelector('[data-review-id="documents-view-mode-vitepress"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-review-id="documents-view-mode-docusaurus"]'),
    ).toBeNull();
  });



  it("collapses Antora order sections with the shared section toggle", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "modules", path: "/workspace/modules", kind: "directory" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "modules", path: "/workspace/modules", kind: "directory" },
            ],
            "/workspace/modules/ROOT/pages": [
              {
                name: "extra.adoc",
                path: "/workspace/modules/ROOT/pages/extra.adoc",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          documentOrder={{
            orders: [
              {
                source: "antora",
                nodes: [
                  {
                    kind: "section",
                    title: "Product",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "Home",
                        path: "/workspace/modules/ROOT/pages/index.adoc",
                        displayPath: "index.adoc",
                        depth: 0,
                        status: "resolved",
                      },
                      {
                        kind: "document",
                        title: "Missing",
                        path: "",
                        displayPath: "missing.adoc",
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
          activePath="/workspace/modules/ROOT/pages/index.adoc"
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

    await chooseFileViewMode("documents-view-mode-antora");

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-review-id="documents-antora-section"] [data-review-id="documents-order-section-toggle"]',
    );
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      toggle?.click();
    });

    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(
      container.querySelector('[data-review-id="documents-antora-section"]')
        ?.getAttribute("data-document-order-section-state"),
    ).toBe("expanded");
    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Home"),
      expect.stringContaining("Missing"),
    ]);
  });



  it("renders Antora parent xref as a collapsible document section without duplicate row", async () => {
    const onOpenFile = vi.fn();
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "modules", path: "/workspace/modules", kind: "directory" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "modules", path: "/workspace/modules", kind: "directory" },
            ],
            "/workspace/modules/ROOT/pages": [
              {
                name: "extra.adoc",
                path: "/workspace/modules/ROOT/pages/extra.adoc",
                kind: "file",
              },
              {
                name: "index.adoc",
                path: "/workspace/modules/ROOT/pages/index.adoc",
                kind: "file",
              },
              {
                name: "users.adoc",
                path: "/workspace/modules/ROOT/pages/users.adoc",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          documentOrder={{
            orders: [
              {
                source: "antora",
                nodes: [
                  {
                    kind: "section",
                    title: "Product",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "Product",
                        path: "/workspace/modules/ROOT/pages/index.adoc",
                        displayPath: "index.adoc",
                        depth: 1,
                        status: "resolved",
                      },
                      {
                        kind: "document",
                        title: "Users",
                        path: "/workspace/modules/ROOT/pages/users.adoc",
                        displayPath: "users.adoc",
                        depth: 1,
                        status: "resolved",
                      },
                    ],
                  },
                ],
              },
            ],
          }}
          openDocumentPaths={
            new Set(["/workspace/modules/ROOT/pages/index.adoc"])
          }
          activePath="/workspace/modules/ROOT/pages/index.adoc"
          onOpenFile={onOpenFile}
          onOpenGitDiff={vi.fn()}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={vi.fn()}
          onCollapse={vi.fn()}
        />,
      );
    });

    await chooseFileViewMode("documents-view-mode-antora");

    const section = container.querySelector(
      '[data-review-id="documents-antora-section"]',
    );
    expect(section?.textContent).toContain("Product");
    expect(section?.getAttribute("data-document-order-section-document")).toBe(
      "true",
    );
    expect(section?.className).toContain("active");
    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows).toHaveLength(0);

    await act(async () => {
      section
        ?.querySelector<HTMLButtonElement>(
          '[data-review-id="documents-order-section-open"]',
        )
        ?.click();
    });
    expect(onOpenFile).toHaveBeenCalledWith(
      "/workspace/modules/ROOT/pages/index.adoc",
    );

    await act(async () => {
      section
        ?.querySelector<HTMLButtonElement>(
          '[data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
    });
    const expandedRows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(expandedRows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Users"),
    ]);
  });



  it("shows Antora order documents before their file tree directories are expanded", async () => {
    const onOpenFile = vi.fn();
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "modules", path: "/workspace/modules", kind: "directory" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "modules", path: "/workspace/modules", kind: "directory" },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          documentOrder={{
            orders: [
              {
                source: "antora",
                nodes: [
                  {
                    kind: "section",
                    title: "Product",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "Home",
                        path: "/workspace/modules/ROOT/pages/index.adoc",
                        displayPath: "index.adoc",
                        depth: 0,
                        status: "resolved",
                      },
                    ],
                  },
                ],
              },
            ],
          }}
          openDocumentPaths={new Set()}
          activePath="/workspace/modules/ROOT/pages/index.adoc"
          onOpenFile={onOpenFile}
          onOpenGitDiff={vi.fn()}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={vi.fn()}
          onCollapse={vi.fn()}
        />,
      );
    });

    await chooseFileViewMode("documents-view-mode-antora");

    expect(container.textContent).not.toContain("No loaded documents");
    expect(
      container.querySelector('[data-review-id="documents-antora-section"]')
        ?.textContent,
    ).toContain("Product");
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-antora-section"] [data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
    });
    const row = container.querySelector('[data-review-id="documents-view-row"]');
    expect(row?.textContent).toContain("Home");

    await act(async () => {
      row?.querySelector<HTMLButtonElement>(".documents-view-row-main")?.click();
    });
    expect(onOpenFile).toHaveBeenCalledWith(
      "/workspace/modules/ROOT/pages/index.adoc",
    );
  });



  it("marks open ordered documents when their directories are not loaded", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "modules", path: "/workspace/modules", kind: "directory" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "modules", path: "/workspace/modules", kind: "directory" },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          documentOrder={{
            orders: [
              {
                source: "antora",
                nodes: [
                  {
                    kind: "document",
                    title: "Home",
                    path: "/workspace/modules/ROOT/pages/index.adoc",
                    displayPath: "index.adoc",
                    depth: 0,
                    status: "resolved",
                  },
                ],
              },
            ],
          }}
          openDocumentPaths={
            new Set(["/workspace/modules/ROOT/pages/index.adoc"])
          }
          activePath="/workspace/modules/ROOT/pages/index.adoc"
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

    await chooseFileViewMode("documents-view-mode-antora");

    const row = container.querySelector('[data-review-id="documents-view-row"]');
    expect(row?.getAttribute("data-document-open")).toBe("true");
    expect(row?.textContent).toContain("open");
    expect(
      row?.querySelector(".documents-view-row-title")?.textContent,
    ).toContain("open");
    expect(row?.querySelector(".documents-view-row-path")?.textContent).toBe(
      "index.adoc",
    );
  });

});
