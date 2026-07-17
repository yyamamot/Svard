import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAppSidebarWiring } from "../../src/ui/hooks/useAppSidebarWiring";
import type { DocumentOrderCatalog, HostAdapter } from "../../src/core/types";

describe("useAppSidebarWiring document order refresh", () => {
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

  it("reloads the document order catalog when the file tree reports a workspace change", async () => {
    const firstCatalog: DocumentOrderCatalog = {
      orders: [
        {
          source: "mkdocs",
          nodes: [],
        },
      ],
    };
    const secondCatalog: DocumentOrderCatalog = {
      orders: [
        {
          source: "mkdocs",
          nodes: [
            {
              kind: "document",
              title: "New Page",
              path: "/workspace/docs/new.md",
              displayPath: "docs/new.md",
              depth: 0,
              status: "resolved",
            },
          ],
        },
      ],
    };
    const host = {
      loadDocumentOrder: vi
        .fn<HostAdapter["loadDocumentOrder"]>()
        .mockResolvedValueOnce(firstCatalog)
        .mockResolvedValueOnce(secondCatalog),
      getGitStatusSummary: vi.fn(async () => []),
      watchGitStatus: vi.fn(async () => ({ dispose: vi.fn() })),
    } as unknown as HostAdapter;
    const emptyBookmarks: never[] = [];
    const emptyChildrenByDirectory = {};
    const emptyDirectoryErrors = {};
    const emptyExpandedDirectories = new Set<string>();
    const emptyLoadingDirectories = new Set<string>();
    const emptyOpenFileReloadStates = {};
    const emptyOrderedTabs: never[] = [];
    const emptyPinnedTabs: string[] = [];
    const emptyRootEntries: never[] = [];
    const emptyTabs: never[] = [];
    const noop = vi.fn();
    const gitSourceControl = {
      gitChanges: null,
    } as never;

    function Harness({
      documentOrderRefreshRevision,
    }: {
      documentOrderRefreshRevision: number;
    }) {
      const leftSidebarContentRef = useRef<HTMLDivElement | null>(null);
      const openFilesFilterInputRef = useRef<HTMLInputElement | null>(null);
      const openFilesPaneRef = useRef<HTMLElement | null>(null);
      useAppSidebarWiring({
        activePath: undefined,
        antoraContextSelectorOpenSignal: 0,
        bookmarks: emptyBookmarks,
        childrenByDirectory: emptyChildrenByDirectory,
        config: null,
        directoryErrors: emptyDirectoryErrors,
        documentOrderRefreshRevision,
        expandedDirectories: emptyExpandedDirectories,
        gitSourceControl,
        hideOpenFiles: false,
        host,
        leftSidebarContentRef,
        loadingDirectories: emptyLoadingDirectories,
        openFileReloadStates: emptyOpenFileReloadStates,
        openFilesCollapsed: false,
        openFilesFilter: "",
        openFilesFilterInputRef,
        openFilesPaneRef,
        openFilesSplitResizeState: null,
        orderedTabs: emptyOrderedTabs,
        pinnedTabs: emptyPinnedTabs,
        preferencesActive: false,
        preferencesTabOpen: false,
        rootDirectory: "/workspace",
        rootEntries: emptyRootEntries,
        sidebarResizeState: null,
        selectedAntoraContextId: null,
        tabs: emptyTabs,
        workspacePerformanceMode: "normal",
        onActivatePreferences: noop,
        onActivateTab: noop,
        onAddActiveBookmark: noop,
        onAddRootBookmark: noop,
        onAntoraContextsChange: noop,
        onSelectAntoraContext: noop,
        onBeginOpenFilesSplitResize: noop,
        onBeginSidebarResize: noop,
        onClosePreferences: noop,
        onCloseTab: noop,
        onCollapseTree: noop,
        onOpenBookmark: noop,
        onOpenFile: noop,
        onPickDirectory: noop,
        onPickDocument: noop,
        onRefreshTree: noop,
        onRemoveBookmark: noop,
        onReorderBookmarks: noop,
        onReorderOpenTabs: noop,
        onResetOpenFilesSplitHeight: noop,
        onResetSidebarWidth: noop,
        onSelectSidebarTab: noop,
        onSetOpenFilesFilter: noop,
        onToggleDirectory: noop,
        onToggleOpenFilesCollapsed: noop,
        onTogglePinned: noop,
      });
      return null;
    }

    await act(async () => {
      root.render(<Harness documentOrderRefreshRevision={0} />);
    });
    expect(host.loadDocumentOrder).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(<Harness documentOrderRefreshRevision={1} />);
    });
    expect(host.loadDocumentOrder).toHaveBeenCalledTimes(2);
  });
});
