import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileTreePanel } from "../../src/ui/components/FileTreePanel";

describe("FileTreePanel path display", () => {
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
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-view-toggle"]',
        )
        ?.click();
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(`[data-review-id="${reviewId}"]`)
        ?.click();
    });
  }

  it("shows a basename for a Windows root directory", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="C:\\Users\\me\\project"
          rootEntries={[]}
          childrenByDirectory={{}}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
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

    const rootLabel = container.querySelector('[data-review-id="tree-root"]');
    expect(rootLabel?.textContent).toContain("project");
    expect(rootLabel?.textContent).not.toContain("C:\\Users");
  });

  it("keeps the root label and pane actions in a single toolbar header", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[]}
          childrenByDirectory={{}}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
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

    const toolbar = container.querySelector('[data-review-id="file-toolbar"]');
    const rootLabel = container.querySelector('[data-review-id="tree-root"]');
    const actions = container.querySelector(".file-toolbar-actions");
    expect(toolbar).not.toBeNull();
    expect(rootLabel?.parentElement).toBe(toolbar);
    expect(actions?.parentElement).toBe(toolbar);
    expect(rootLabel?.tagName).toBe("DIV");
    expect(rootLabel?.textContent).toContain("workspace");
  });

  it("opens document and directory pickers from the grouped open menu", async () => {
    const onPickDocument = vi.fn();
    const onPickDirectory = vi.fn();

    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[]}
          childrenByDirectory={{}}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          onOpenFile={vi.fn()}
          onOpenGitDiff={vi.fn()}
          onToggleDirectory={vi.fn()}
          onPickDocument={onPickDocument}
          onPickDirectory={onPickDirectory}
          onRefresh={vi.fn()}
          onCollapse={vi.fn()}
        />,
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-review-id="file-tree-open-menu-trigger"]',
    );
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      trigger?.click();
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(
      container.querySelector('[data-review-id="file-tree-open-menu"]'),
    ).not.toBeNull();
    const fileItem = container.querySelector<HTMLButtonElement>(
      '[data-review-id="file-open-control"]',
    );
    const folderItem = container.querySelector<HTMLButtonElement>(
      '[data-review-id="directory-open-control"]',
    );
    expect(fileItem?.textContent).toContain("Open File...");
    expect(folderItem?.textContent).toContain("Open Folder...");

    await act(async () => {
      fileItem?.click();
    });

    expect(onPickDocument).toHaveBeenCalledTimes(1);
    expect(onPickDirectory).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-review-id="file-tree-open-menu"]'),
    ).toBeNull();

    await act(async () => {
      trigger?.click();
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="directory-open-control"]',
        )
        ?.click();
    });

    expect(onPickDirectory).toHaveBeenCalledTimes(1);
  });

  it("closes the grouped open menu with Escape and outside pointer", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[]}
          childrenByDirectory={{}}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
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

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-review-id="file-tree-open-menu-trigger"]',
    );

    await act(async () => {
      trigger?.click();
    });
    expect(
      container.querySelector('[data-review-id="file-tree-open-menu"]'),
    ).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(
      container.querySelector('[data-review-id="file-tree-open-menu"]'),
    ).toBeNull();

    await act(async () => {
      trigger?.click();
    });
    expect(
      container.querySelector('[data-review-id="file-tree-open-menu"]'),
    ).not.toBeNull();

    await act(async () => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(
      container.querySelector('[data-review-id="file-tree-open-menu"]'),
    ).toBeNull();
  });

  it("keeps refresh and collapse callbacks as direct toolbar actions", async () => {
    const onRefresh = vi.fn();
    const onCollapse = vi.fn();

    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[]}
          childrenByDirectory={{}}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          onOpenFile={vi.fn()}
          onOpenGitDiff={vi.fn()}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={onRefresh}
          onCollapse={onCollapse}
        />,
      );
    });

    const refresh = container.querySelector<HTMLButtonElement>(
      '[data-review-id="tree-refresh"]',
    );
    const collapse = container.querySelector<HTMLButtonElement>(
      '[data-review-id="tree-collapse-all"]',
    );
    expect(refresh?.getAttribute("aria-label")).toBe("Refresh file tree");
    expect(collapse?.getAttribute("aria-label")).toBe("Collapse all folders");

    await act(async () => {
      refresh?.click();
      collapse?.click();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("shows changed document counts on parent directory rows", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { kind: "directory", name: "docs", path: "/workspace/docs" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { kind: "directory", name: "docs", path: "/workspace/docs" },
            ],
            "/workspace/docs": [
              {
                kind: "file",
                name: "git-modified.md",
                path: "/workspace/docs/git-modified.md",
              },
              {
                kind: "file",
                name: "git-untracked.md",
                path: "/workspace/docs/git-untracked.md",
              },
            ],
          }}
          expandedDirectories={new Set(["/workspace/docs"])}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{
            "/workspace/docs/git-modified.md": "modified",
            "/workspace/docs/git-untracked.md": "untracked",
          }}
          gitChanges={null}
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

    const directory = container.querySelector(
      '[data-review-id="tree-folder-toggle"][data-path="/workspace/docs"]',
    );
    expect(directory?.getAttribute("data-git-status-summary")).toBe("modified");
    expect(directory?.getAttribute("data-git-status-count")).toBe("2");
    expect(directory?.getAttribute("data-git-status-modified-count")).toBe("1");
    expect(directory?.getAttribute("data-git-status-untracked-count")).toBe(
      "1",
    );
    expect(directory?.getAttribute("title")).toBe(
      "/workspace/docs · 2 changed documents: 1 modified, 1 untracked",
    );
    expect(directory?.getAttribute("data-git-status-label")).toBe(
      "2 changed documents under docs: 1 modified, 1 untracked",
    );
    const directoryBadge = directory?.querySelector(
      '[data-review-id="git-status-badge"]',
    );
    expect(directoryBadge?.getAttribute("title")).toBe(
      "2 changed documents under docs: 1 modified, 1 untracked",
    );
    expect(directoryBadge?.getAttribute("aria-label")).toBe(
      "2 changed documents under docs: 1 modified, 1 untracked",
    );
    expect(directory?.textContent).toContain("docs");
    expect(directory?.textContent).toContain("2");
  });

  it("uses cached Source Control changes for collapsed directory badges", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { kind: "directory", name: "docs", path: "/workspace/docs" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { kind: "directory", name: "docs", path: "/workspace/docs" },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={{
            status: "ok",
            repositoryRoot: "/workspace",
            currentBranch: "main",
            headCommit: null,
            message: null,
            items: [
              {
                path: "docs/nested/changed.md",
                documentPath: "/workspace/docs/nested/changed.md",
                status: "modified",
              },
              {
                path: "assets/logo.png",
                documentPath: null,
                status: "binary",
              },
            ],
          }}
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

    const directory = container.querySelector(
      '[data-review-id="tree-folder-toggle"][data-path="/workspace/docs"]',
    );
    expect(directory?.getAttribute("data-git-status-summary")).toBe("modified");
    expect(directory?.getAttribute("data-git-status-count")).toBe("1");
    expect(directory?.getAttribute("data-git-status-modified-count")).toBe("1");
    expect(directory?.getAttribute("data-git-status-added-count")).toBe("0");
    expect(directory?.getAttribute("title")).toBe(
      "/workspace/docs · 1 changed document: 1 modified",
    );
    expect(directory?.getAttribute("data-git-status-label")).toBe(
      "1 changed document under docs: 1 modified",
    );
  });

  it("opens diff from a changed file badge without opening the file", async () => {
    const onOpenFile = vi.fn();
    const onOpenGitDiff = vi.fn();

    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { kind: "directory", name: "docs", path: "/workspace/docs" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { kind: "directory", name: "docs", path: "/workspace/docs" },
            ],
            "/workspace/docs": [
              {
                kind: "file",
                name: "git-modified.md",
                path: "/workspace/docs/git-modified.md",
              },
            ],
          }}
          expandedDirectories={new Set(["/workspace/docs"])}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{
            "/workspace/docs/git-modified.md": "modified",
          }}
          gitChanges={null}
          onOpenFile={onOpenFile}
          onOpenGitDiff={onOpenGitDiff}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={vi.fn()}
          onCollapse={vi.fn()}
        />,
      );
    });

    const diffButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="git-status-diff-button"]',
    );
    expect(diffButton?.textContent).toContain("M");
    expect(diffButton?.getAttribute("title")).toBe(
      "Modified in Git. Open rendered diff for git-modified.md",
    );
    expect(diffButton?.getAttribute("aria-label")).toBe(
      "Modified in Git. Open rendered diff for git-modified.md",
    );
    expect(diffButton?.getAttribute("data-git-status-label")).toBe(
      "Modified in Git. Open rendered diff for git-modified.md",
    );

    await act(async () => {
      diffButton?.click();
    });

    expect(onOpenGitDiff).toHaveBeenCalledWith(
      "/workspace/docs/git-modified.md",
    );
    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it("marks open documents in the regular File Tree", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "README.md", path: "/workspace/README.md", kind: "file" },
            { name: "docs", path: "/workspace/docs", kind: "directory" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "README.md", path: "/workspace/README.md", kind: "file" },
              { name: "docs", path: "/workspace/docs", kind: "directory" },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          openDocumentPaths={new Set(["/workspace/README.md"])}
          activePath="/workspace/README.md"
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

    const readmeRow = container.querySelector(
      '[data-review-id="tree-file"][data-path="/workspace/README.md"]',
    );
    expect(readmeRow?.getAttribute("data-document-open")).toBe("true");
    expect(readmeRow?.textContent).toContain("open");
    const docsRow = container.querySelector(
      '[data-review-id="tree-folder-toggle"][data-path="/workspace/docs"]',
    );
    expect(docsRow?.getAttribute("data-document-open")).toBeNull();
    expect(docsRow?.textContent).not.toContain("open");
  });

  it("keeps directory count badges non-clickable", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { kind: "directory", name: "docs", path: "/workspace/docs" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { kind: "directory", name: "docs", path: "/workspace/docs" },
            ],
            "/workspace/docs": [
              {
                kind: "file",
                name: "git-modified.md",
                path: "/workspace/docs/git-modified.md",
              },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{
            "/workspace/docs/git-modified.md": "modified",
          }}
          gitChanges={null}
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

    const directory = container.querySelector(
      '[data-review-id="tree-folder-toggle"][data-path="/workspace/docs"]',
    );
    expect(
      directory?.querySelector('[data-review-id="git-status-badge"]'),
    ).not.toBeNull();
    expect(
      directory?.querySelector('[data-review-id="git-status-diff-button"]'),
    ).toBeNull();
  });

  it("defaults to Tree view and toggles to supported documents only", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "docs", path: "/workspace/docs", kind: "directory" },
            { name: "README.md", path: "/workspace/README.md", kind: "file" },
            { name: "notes.txt", path: "/workspace/notes.txt", kind: "file" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "docs", path: "/workspace/docs", kind: "directory" },
              {
                name: "README.md",
                path: "/workspace/README.md",
                kind: "file",
              },
              {
                name: "notes.txt",
                path: "/workspace/notes.txt",
                kind: "file",
              },
            ],
            "/workspace/docs": [
              {
                name: "guide.adoc",
                path: "/workspace/docs/guide.adoc",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set(["/workspace/docs"])}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          openDocumentPaths={new Set(["/workspace/README.md"])}
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

    expect(container.querySelector('[data-review-id="file-tree"]')).not.toBeNull();
    expect(
      container.querySelector('[data-review-id="documents-view"]'),
    ).toBeNull();
    expect(
      container
        .querySelector('[data-review-id="documents-view-toggle"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("false");

    await chooseFileViewMode("documents-view-mode-path");

    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(container.querySelector('[data-review-id="file-tree"]')).toBeNull();
    expect(
      container
        .querySelector('[data-review-id="documents-view-toggle"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      container
        .querySelector('[data-review-id="documents-view-toggle"]')
        ?.classList.contains("active"),
    ).toBe(true);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("guide.adoc"),
      expect.stringContaining("README.md"),
    ]);
    expect(container.textContent).toContain("README.md");
    expect(container.textContent).toContain("docs/guide.adoc");
    expect(container.textContent).not.toContain("notes.txt");
    expect(
      container.querySelector('[data-review-id="documents-source-filter"]'),
    ).not.toBeNull();
    expect(
      container
        .querySelector('[data-review-id="documents-source-filter-all"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    const readmeRow = rows.find((row) => row.textContent?.includes("README.md"));
    expect(readmeRow?.getAttribute("data-document-open")).toBe("true");
    expect(readmeRow?.textContent).toContain("open");
  });

  it("lists Antora last in the Documents view mode menu", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[]}
          childrenByDirectory={{}}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          documentOrder={{
            orders: [
              { source: "mkdocs", nodes: [] },
              { source: "vitepress", nodes: [] },
              { source: "docusaurus", nodes: [] },
              { source: "antora", nodes: [] },
            ],
          }}
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

    const menuItems = [
      ...container.querySelectorAll<HTMLElement>(".file-tree-open-menu-item"),
    ].map((item) => item.textContent);
    expect(menuItems).toEqual([
      "File tree",
      "Docs: Path",
      "Docs: MkDocs",
      "Docs: Antora",
    ]);
  });

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
      container.querySelector('[data-review-id="documents-mkdocs-section"]')
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

  it("filters Documents view to changed loaded documents", async () => {
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
                name: "modified.md",
                path: "/workspace/docs/modified.md",
                kind: "file",
              },
              {
                name: "added.adoc",
                path: "/workspace/docs/added.adoc",
                kind: "file",
              },
              {
                name: "deleted.md",
                path: "/workspace/docs/deleted.md",
                kind: "file",
              },
              {
                name: "renamed.md",
                path: "/workspace/docs/renamed.md",
                kind: "file",
              },
              {
                name: "binary.md",
                path: "/workspace/docs/binary.md",
                kind: "file",
              },
              {
                name: "untracked.md",
                path: "/workspace/docs/untracked.md",
                kind: "file",
              },
              {
                name: "clean.md",
                path: "/workspace/docs/clean.md",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set(["/workspace/docs"])}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{
            "/workspace/docs/modified.md": "modified",
            "/workspace/docs/added.adoc": "added",
            "/workspace/docs/deleted.md": "deleted",
            "/workspace/docs/renamed.md": "renamed",
            "/workspace/docs/binary.md": "binary",
            "/workspace/docs/untracked.md": "untracked",
            "/workspace/docs/clean.md": "clean",
          }}
          gitChanges={null}
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

    await chooseFileViewMode("documents-view-mode-path");
    expect(
      container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ).toHaveLength(7);

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-source-filter-changed"]',
        )
        ?.click();
    });

    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("deleted.md"),
      expect.stringContaining("renamed.md"),
      expect.stringContaining("modified.md"),
      expect.stringContaining("added.adoc"),
      expect.stringContaining("untracked.md"),
      expect.stringContaining("binary.md"),
    ]);
    expect(container.textContent).toContain("modified.md");
    expect(container.textContent).toContain("added.adoc");
    expect(container.textContent).toContain("deleted.md");
    expect(container.textContent).toContain("renamed.md");
    expect(container.textContent).toContain("binary.md");
    expect(container.textContent).toContain("untracked.md");
    expect(container.textContent).not.toContain("clean.md");
  });

  it("uses cached Source Control changes for loaded Documents rows only", async () => {
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
                name: "cached.md",
                path: "/workspace/docs/cached.md",
                kind: "file",
              },
              {
                name: "plain.md",
                path: "/workspace/docs/plain.md",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set(["/workspace/docs"])}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={{
            status: "ok",
            repositoryRoot: "/workspace",
            currentBranch: "main",
            headCommit: null,
            message: null,
            items: [
              {
                path: "docs/cached.md",
                documentPath: "/workspace/docs/cached.md",
                status: "modified",
              },
              {
                path: "docs/unloaded.md",
                documentPath: "/workspace/docs/unloaded.md",
                status: "modified",
              },
            ],
          }}
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

    await chooseFileViewMode("documents-view-mode-path");
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-source-filter-changed"]',
        )
        ?.click();
    });

    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("cached.md");
    expect(rows[0]?.getAttribute("data-git-status")).toBe("modified");
    expect(rows[0]?.getAttribute("data-git-status-label")).toBe(
      "Modified in Git. Open rendered diff for cached.md",
    );
    expect(container.textContent).not.toContain("unloaded.md");
    expect(container.textContent).not.toContain("plain.md");
  });

  it("opens diff from a changed Documents badge without opening the file", async () => {
    const onOpenFile = vi.fn();
    const onOpenGitDiff = vi.fn();

    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "README.md", path: "/workspace/README.md", kind: "file" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              {
                name: "README.md",
                path: "/workspace/README.md",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{
            "/workspace/README.md": "modified",
          }}
          gitChanges={null}
          onOpenFile={onOpenFile}
          onOpenGitDiff={onOpenGitDiff}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={vi.fn()}
          onCollapse={vi.fn()}
        />,
      );
    });

    await chooseFileViewMode("documents-view-mode-path");

    const diffButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="documents-view-row"] [data-review-id="git-status-diff-button"]',
    );
    expect(diffButton?.textContent).toContain("M");
    expect(diffButton?.getAttribute("title")).toBe(
      "Modified in Git. Open rendered diff for README.md",
    );

    await act(async () => {
      diffButton?.click();
    });

    expect(onOpenGitDiff).toHaveBeenCalledWith("/workspace/README.md");
    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it("shows a changed Documents empty state when no loaded document changed", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "README.md", path: "/workspace/README.md", kind: "file" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              {
                name: "README.md",
                path: "/workspace/README.md",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
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

    await chooseFileViewMode("documents-view-mode-path");
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-source-filter-changed"]',
        )
        ?.click();
    });

    expect(
      container.querySelector('[data-review-id="documents-view-empty"]')
        ?.textContent,
    ).toContain("No changed loaded documents");
  });

  it("opens active document rows from Documents view", async () => {
    const onOpenFile = vi.fn();

    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "README.md", path: "/workspace/README.md", kind: "file" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              {
                name: "README.md",
                path: "/workspace/README.md",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set()}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          activePath="/workspace/README.md"
          gitStatusByPath={{}}
          gitChanges={null}
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

    await chooseFileViewMode("documents-view-mode-path");

    const row = container.querySelector('[data-review-id="documents-view-row"]');
    expect(row?.classList.contains("active")).toBe(true);

    await act(async () => {
      row?.querySelector<HTMLButtonElement>(".documents-view-row-main")?.click();
    });

    expect(onOpenFile).toHaveBeenCalledWith("/workspace/README.md");
  });

  it("shows a Documents empty state when no loaded documents exist", async () => {
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
          gitStatusByPath={{}}
          gitChanges={null}
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

    await chooseFileViewMode("documents-view-mode-path");

    expect(
      container.querySelector('[data-review-id="documents-view-empty"]')
        ?.textContent,
    ).toContain("No loaded documents");
  });
});
