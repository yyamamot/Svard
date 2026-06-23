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
      "Modified in Git. Open diff for git-modified.md",
    );
    expect(diffButton?.getAttribute("aria-label")).toBe(
      "Modified in Git. Open diff for git-modified.md",
    );
    expect(diffButton?.getAttribute("data-git-status-label")).toBe(
      "Modified in Git. Open diff for git-modified.md",
    );

    await act(async () => {
      diffButton?.click();
    });

    expect(onOpenGitDiff).toHaveBeenCalledWith(
      "/workspace/docs/git-modified.md",
    );
    expect(onOpenFile).not.toHaveBeenCalled();
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

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="files-view-toggle-documents"]',
        )
        ?.click();
    });

    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(container.querySelector('[data-review-id="file-tree"]')).toBeNull();
    expect(rows).toHaveLength(2);
    expect(container.textContent).toContain("README.md");
    expect(container.textContent).toContain("docs/guide.adoc");
    expect(container.textContent).not.toContain("notes.txt");
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

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="files-view-toggle-documents"]',
        )
        ?.click();
    });

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

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="files-view-toggle-documents"]',
        )
        ?.click();
    });

    expect(
      container.querySelector('[data-review-id="documents-view-empty"]')
        ?.textContent,
    ).toContain("No loaded documents");
  });
});
