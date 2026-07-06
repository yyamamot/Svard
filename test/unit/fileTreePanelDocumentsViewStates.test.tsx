import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileTreePanel } from "../../src/ui/components/FileTreePanel";
import { chooseFileViewModeIn } from "./helpers/fileTreePanel";

describe("FileTreePanel Documents view states", () => {
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

    const row = container.querySelector(
      '[data-review-id="documents-view-row"]',
    );
    expect(row?.classList.contains("active")).toBe(true);

    await act(async () => {
      row
        ?.querySelector<HTMLButtonElement>(".documents-view-row-main")
        ?.click();
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
