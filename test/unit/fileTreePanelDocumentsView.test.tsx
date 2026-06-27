import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileTreePanel } from "../../src/ui/components/FileTreePanel";
import { chooseFileViewModeIn } from "./helpers/fileTreePanel";

describe("FileTreePanel Documents only view", () => {
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
          orderedTabs={[
            {
              path: "/workspace/README.md",
              basePath: "/workspace",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              path: "/Users/yusuke/tools/rdma/rdma-part-1.md",
              basePath: "/Users/yusuke/tools/rdma",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
          openDocumentPaths={
            new Set([
              "/workspace/README.md",
              "/Users/yusuke/tools/rdma/rdma-part-1.md",
            ])
          }
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
    expect(rows).toHaveLength(1);
    expect(container.textContent).toContain("README.md");
    expect(container.textContent).not.toContain("docs/guide.adoc");
    expect(container.textContent).not.toContain("rdma-part-1.md");
    expect(container.textContent).not.toContain("Users");
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
    expect(readmeRow?.textContent).not.toContain("open");
  });


  it("collapses and expands open document directory groups", async () => {
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
              {
                name: "unopened.md",
                path: "/workspace/unopened.md",
                kind: "file",
              },
            ],
            "/workspace/docs": [
              {
                name: "guide.md",
                path: "/workspace/docs/guide.md",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set(["/workspace/docs"])}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          activePath="/workspace/docs/guide.md"
          gitStatusByPath={{}}
          gitChanges={null}
          orderedTabs={[
            {
              path: "/workspace/docs/guide.md",
              basePath: "/workspace/docs",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
          openDocumentPaths={new Set(["/workspace/docs/guide.md"])}
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

    const section = container.querySelector(
      '[data-review-id="documents-loaded-section"]',
    );
    expect(section?.getAttribute("data-document-order-section-state")).toBe(
      "expanded",
    );
    expect(container.textContent).toContain("guide.md");
    expect(container.textContent).not.toContain("unopened.md");

    await act(async () => {
      section
        ?.querySelector<HTMLButtonElement>(
          '[data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
    });

    expect(section?.getAttribute("data-document-order-section-state")).toBe(
      "collapsed",
    );
    expect(container.textContent).not.toContain("guide.md");
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
          orderedTabs={[
            {
              path: "/workspace/docs/modified.md",
              basePath: "/workspace/docs",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              path: "/workspace/docs/added.adoc",
              basePath: "/workspace/docs",
              format: "asciidoc",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              path: "/workspace/docs/deleted.md",
              basePath: "/workspace/docs",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              path: "/workspace/docs/renamed.md",
              basePath: "/workspace/docs",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              path: "/workspace/docs/binary.md",
              basePath: "/workspace/docs",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              path: "/workspace/docs/untracked.md",
              basePath: "/workspace/docs",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              path: "/workspace/docs/clean.md",
              basePath: "/workspace/docs",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
          openDocumentPaths={
            new Set([
              "/workspace/docs/modified.md",
              "/workspace/docs/added.adoc",
              "/workspace/docs/deleted.md",
              "/workspace/docs/renamed.md",
              "/workspace/docs/binary.md",
              "/workspace/docs/untracked.md",
              "/workspace/docs/clean.md",
            ])
          }
          activePath="/workspace/docs/modified.md"
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
      expect.stringContaining("added.adoc"),
      expect.stringContaining("binary.md"),
      expect.stringContaining("deleted.md"),
      expect.stringContaining("modified.md"),
      expect.stringContaining("renamed.md"),
      expect.stringContaining("untracked.md"),
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
          orderedTabs={[
            {
              path: "/workspace/docs/cached.md",
              basePath: "/workspace/docs",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              path: "/workspace/docs/plain.md",
              basePath: "/workspace/docs",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
          openDocumentPaths={
            new Set(["/workspace/docs/cached.md", "/workspace/docs/plain.md"])
          }
          activePath="/workspace/docs/cached.md"
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
          orderedTabs={[
            {
              path: "/workspace/README.md",
              basePath: "/workspace",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
          openDocumentPaths={new Set(["/workspace/README.md"])}
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
          orderedTabs={[
            {
              path: "/workspace/README.md",
              basePath: "/workspace",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
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
    ).toContain("No changed open documents");
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
          orderedTabs={[
            {
              path: "/workspace/README.md",
              basePath: "/workspace",
              format: "markdown",
              source: "",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
          openDocumentPaths={new Set(["/workspace/README.md"])}
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
    ).toContain("No open documents");
  });
});
