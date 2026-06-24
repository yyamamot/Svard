import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type RefObject,
} from "react";
import type {
  AppConfig,
  BookmarkEntry,
  DirectoryEntry,
  DocumentOrderResult,
  DocumentPayload,
  WorkspaceEnvironment,
} from "../../core/types";
import type { LeftSidebar } from "../components/LeftSidebar";
import type { OpenFileReloadState } from "../types";
import { useGitStatusHints } from "./useGitStatusHints";
import { buildLeftSidebarSourceControlProps } from "./useLeftSidebarSourceControlProps";

export type AppLeftSidebarProps = ComponentProps<typeof LeftSidebar>;
type SourceControlPropsInput = Omit<
  Parameters<typeof buildLeftSidebarSourceControlProps>[0],
  "config"
>;

interface UseAppSidebarWiringOptions {
  activePath?: string;
  bookmarks: BookmarkEntry[];
  childrenByDirectory: Record<string, DirectoryEntry[]>;
  config: AppConfig | null;
  directoryErrors: Record<string, string>;
  expandedDirectories: Set<string>;
  gitSourceControl: SourceControlPropsInput;
  hideOpenFiles: boolean;
  host: Parameters<typeof useGitStatusHints>[0]["host"];
  leftSidebarContentRef: RefObject<HTMLDivElement | null>;
  loadingDirectories: Set<string>;
  openFileReloadStates: Record<string, OpenFileReloadState>;
  openFilesCollapsed: boolean;
  openFilesFilter: string;
  openFilesFilterInputRef: RefObject<HTMLInputElement | null>;
  openFilesPaneRef: RefObject<HTMLElement | null>;
  openFilesSplitResizeState: unknown;
  orderedTabs: DocumentPayload[];
  pinnedTabs: string[];
  preferencesActive: boolean;
  preferencesTabOpen: boolean;
  rootDirectory: string;
  rootEntries: DirectoryEntry[];
  sidebarResizeState: AppLeftSidebarProps["sidebarResizeState"];
  tabs: DocumentPayload[];
  workspacePerformanceMode: WorkspaceEnvironment["performanceMode"];
  onActivatePreferences: AppLeftSidebarProps["onActivatePreferences"];
  onActivateTab: AppLeftSidebarProps["onActivateTab"];
  onAddActiveBookmark: () => void | Promise<void>;
  onAddRootBookmark: () => void | Promise<void>;
  onBeginOpenFilesSplitResize: AppLeftSidebarProps["onBeginOpenFilesSplitResize"];
  onBeginSidebarResize: AppLeftSidebarProps["onBeginSidebarResize"];
  onClosePreferences: AppLeftSidebarProps["onClosePreferences"];
  onCloseTab: AppLeftSidebarProps["onCloseTab"];
  onCollapseTree: () => void | Promise<void>;
  onOpenBookmark: (bookmark: BookmarkEntry) => void | Promise<void>;
  onOpenFile: (path: string) => void | Promise<void>;
  onPickDirectory: () => void | Promise<void>;
  onPickDocument: () => void | Promise<void>;
  onRefreshTree: () => void | Promise<void>;
  onRemoveBookmark: (path: string) => void | Promise<void>;
  onReorderBookmarks: (fromIndex: number, toIndex: number) => void | Promise<void>;
  onReorderOpenTabs: AppLeftSidebarProps["onReorderOpenTabs"];
  onResetOpenFilesSplitHeight: AppLeftSidebarProps["onResetOpenFilesSplitHeight"];
  onResetSidebarWidth: AppLeftSidebarProps["onResetSidebarWidth"];
  onSelectSidebarTab: (tab: AppConfig["workspace"]["sidebarTab"]) => void | Promise<void>;
  onSetOpenFilesFilter: AppLeftSidebarProps["onSetOpenFilesFilter"];
  onToggleDirectory: (path: string) => void | Promise<void>;
  onToggleOpenFilesCollapsed: AppLeftSidebarProps["onToggleOpenFilesCollapsed"];
  onTogglePinned: AppLeftSidebarProps["onTogglePinned"];
}

export function useAppSidebarWiring({
  activePath,
  bookmarks,
  childrenByDirectory,
  config,
  directoryErrors,
  expandedDirectories,
  gitSourceControl,
  hideOpenFiles,
  host,
  leftSidebarContentRef,
  loadingDirectories,
  openFileReloadStates,
  openFilesCollapsed,
  openFilesFilter,
  openFilesFilterInputRef,
  openFilesPaneRef,
  openFilesSplitResizeState,
  orderedTabs,
  pinnedTabs,
  preferencesActive,
  preferencesTabOpen,
  rootDirectory,
  rootEntries,
  sidebarResizeState,
  tabs,
  workspacePerformanceMode,
  onActivatePreferences,
  onActivateTab,
  onAddActiveBookmark,
  onAddRootBookmark,
  onBeginOpenFilesSplitResize,
  onBeginSidebarResize,
  onClosePreferences,
  onCloseTab,
  onCollapseTree,
  onOpenBookmark,
  onOpenFile,
  onPickDirectory,
  onPickDocument,
  onRefreshTree,
  onRemoveBookmark,
  onReorderBookmarks,
  onReorderOpenTabs,
  onResetOpenFilesSplitHeight,
  onResetSidebarWidth,
  onSelectSidebarTab,
  onSetOpenFilesFilter,
  onToggleDirectory,
  onToggleOpenFilesCollapsed,
  onTogglePinned,
}: UseAppSidebarWiringOptions): { leftSidebarProps: AppLeftSidebarProps } {
  const [documentOrder, setDocumentOrder] = useState<DocumentOrderResult>({
    source: "none",
    nodes: [],
  });
  const openDocumentPaths = useMemo(
    () => new Set(orderedTabs.map((tab) => tab.path)),
    [orderedTabs],
  );
  const gitStatusByPath = useGitStatusHints({
    bookmarks,
    childrenByDirectory,
    host,
    tabs,
    workspacePerformanceMode,
  });

  useEffect(() => {
    let cancelled = false;
    if (!rootDirectory) {
      setDocumentOrder({ source: "none", nodes: [] });
      return;
    }
    void host
      .loadDocumentOrder(rootDirectory)
      .then((result) => {
        if (!cancelled) {
          setDocumentOrder(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDocumentOrder({
            source: "none",
            nodes: [],
            message: "Document order could not be loaded.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [host, rootDirectory]);

  const leftSidebarProps: AppLeftSidebarProps = {
    activePath,
    preferencesTabOpen,
    preferencesActive,
    bookmarks,
    childrenByDirectory,
    directoryErrors,
    expandedDirectories,
    loadingDirectories,
    openFilesFilter,
    hideOpenFiles,
    openFilesCollapsed,
    openFilesFilterInputRef,
    openFilesPaneRef,
    openFilesSplitResizeState,
    orderedTabs,
    openDocumentPaths,
    documentOrder,
    pinnedTabs,
    rootDirectory,
    rootEntries,
    gitStatusByPath,
    openFileReloadStates,
    sidebarResizeState,
    sidebarTab: config?.workspace.sidebarTab ?? "files",
    leftSidebarContentRef,
    ...buildLeftSidebarSourceControlProps({
      ...gitSourceControl,
      config,
    }),
    onActivateTab,
    onActivatePreferences,
    onAddActiveBookmark: () => void onAddActiveBookmark(),
    onAddRootBookmark: () => void onAddRootBookmark(),
    onBeginOpenFilesSplitResize,
    onBeginSidebarResize,
    onCloseTab,
    onClosePreferences,
    onCollapseTree: () => void onCollapseTree(),
    onOpenBookmark: (bookmark) => void onOpenBookmark(bookmark),
    onOpenFile: (path) => void onOpenFile(path),
    onPickDirectory: () => void onPickDirectory(),
    onPickDocument: () => void onPickDocument(),
    onRefreshTree: () => void onRefreshTree(),
    onRemoveBookmark: (path) => void onRemoveBookmark(path),
    onReorderBookmarks: (fromIndex, toIndex) =>
      void onReorderBookmarks(fromIndex, toIndex),
    onReorderOpenTabs,
    onResetOpenFilesSplitHeight,
    onResetSidebarWidth,
    onSelectSidebarTab: (tab) => void onSelectSidebarTab(tab),
    onSetOpenFilesFilter,
    onToggleDirectory: (path) => void onToggleDirectory(path),
    onToggleOpenFilesCollapsed,
    onTogglePinned,
  };

  return {
    leftSidebarProps,
  };
}
