import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileTreePanel } from "../../src/ui/components/FileTreePanel";
describe("FileTreePanel tree rows", () => {
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
});
