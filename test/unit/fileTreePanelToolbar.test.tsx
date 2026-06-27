import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileTreePanel } from "../../src/ui/components/FileTreePanel";
import { chooseFileViewModeIn } from "./helpers/fileTreePanel";
describe("FileTreePanel toolbar and view menu", () => {
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

  it("shows a MkDocs suggestion badge and switches to MkDocs order", async () => {
    const onFilesViewModeChange = vi.fn();

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
          documentOrder={{ orders: [{ source: "mkdocs", nodes: [] }] }}
          suggestedDocumentsMode={{
            mode: "documents-mkdocs",
            label: "Docs: MkDocs detected",
          }}
          onOpenFile={vi.fn()}
          onOpenGitDiff={vi.fn()}
          onFilesViewModeChange={onFilesViewModeChange}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={vi.fn()}
          onCollapse={vi.fn()}
        />,
      );
    });

    const suggestion = container.querySelector<HTMLButtonElement>(
      '[data-review-id="documents-mode-suggestion"]',
    );
    expect(suggestion?.textContent).toBe("Docs: MkDocs detected");
    expect(suggestion?.getAttribute("title")).toBe("Docs: MkDocs detected");

    await act(async () => {
      suggestion?.click();
    });

    expect(onFilesViewModeChange).toHaveBeenCalledWith("documents-mkdocs");
  });

  it("shows Zensical and Antora suggestion labels", async () => {
    const renderSuggestion = async (
      mode: "documents-zensical" | "documents-antora",
      label: string,
      source: "zensical" | "antora",
    ) => {
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
            documentOrder={{ orders: [{ source, nodes: [] }] }}
            suggestedDocumentsMode={{ mode, label }}
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
      expect(
        container.querySelector('[data-review-id="documents-mode-suggestion"]')
          ?.textContent,
      ).toBe(label);
    };

    await renderSuggestion(
      "documents-zensical",
      "Docs: Zensical detected",
      "zensical",
    );
    await renderSuggestion(
      "documents-antora",
      "Docs: Antora detected",
      "antora",
    );
  });

  it("hides the suggestion badge when that Docs mode is already selected", async () => {
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
          documentOrder={{ orders: [{ source: "mkdocs", nodes: [] }] }}
          suggestedDocumentsMode={{
            mode: "documents-mkdocs",
            label: "Docs: MkDocs detected",
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

    await chooseFileViewModeIn(container, "documents-view-mode-mkdocs");

    expect(
      container.querySelector('[data-review-id="documents-mode-suggestion"]'),
    ).toBeNull();
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
              { source: "zensical", nodes: [] },
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
      "Docs: Loaded",
      "Docs: MkDocs",
      "Docs: Zensical",
      "Docs: Antora",
    ]);
  });
});
