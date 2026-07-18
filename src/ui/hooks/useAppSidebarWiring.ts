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
  DocumentOrderCatalog,
  DocumentPayload,
  WorkspaceEnvironment,
} from "../../core/types";
import {
  buildDocumentOrderNavigation,
  collectResolvedDocumentOrderPaths,
  type DocumentOrderNavigationState,
  type DocumentsViewMode,
} from "../lib/fileTreeDocuments";
import type { DocumentReviewSessionControls } from "../lib/documentReviewSession";
import { emptyDocumentReviewSessionControls } from "../lib/documentReviewSession";
import type { LeftSidebar } from "../components/LeftSidebar";
import type { SuggestedDocumentsMode } from "../components/fileTreePanel/types";
import type { OpenFileReloadState } from "../types";
import { useGitStatusHints } from "./useGitStatusHints";
import { buildLeftSidebarSourceControlProps } from "./useLeftSidebarSourceControlProps";

export type AppLeftSidebarProps = ComponentProps<typeof LeftSidebar>;
type SourceControlPropsInput = Omit<
  Parameters<typeof buildLeftSidebarSourceControlProps>[0],
  "config"
>;

interface SuggestedDocumentsModeInput {
  documentOrder: DocumentOrderCatalog;
  filesViewMode: DocumentsViewMode;
  rootDirectory: string;
  selectedAntoraContextId?: string | null;
}

interface UseAppSidebarWiringOptions {
  activePath?: string;
  antoraContextSelectorOpenSignal: number;
  bookmarks: BookmarkEntry[];
  childrenByDirectory: Record<string, DirectoryEntry[]>;
  config: AppConfig | null;
  directoryErrors: Record<string, string>;
  documentReviewSession?: DocumentReviewSessionControls;
  documentOrderRefreshRevision?: number;
  expandedDirectories: Set<string>;
  gitSourceControl: SourceControlPropsInput;
  gitStatusEnabled?: boolean;
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
  selectedAntoraContextId: string | null;
  tabs: DocumentPayload[];
  workspacePerformanceMode: WorkspaceEnvironment["performanceMode"];
  onActivatePreferences: AppLeftSidebarProps["onActivatePreferences"];
  onActivateTab: AppLeftSidebarProps["onActivateTab"];
  onAddActiveBookmark: () => void | Promise<void>;
  onAddRootBookmark: () => void | Promise<void>;
  onAntoraContextsChange: (count: number) => void | Promise<void>;
  onSelectAntoraContext: (contextId: string) => void | Promise<void>;
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
  onReorderBookmarks: (
    fromIndex: number,
    toIndex: number,
  ) => void | Promise<void>;
  onReorderOpenTabs: AppLeftSidebarProps["onReorderOpenTabs"];
  onResetOpenFilesSplitHeight: AppLeftSidebarProps["onResetOpenFilesSplitHeight"];
  onResetSidebarWidth: AppLeftSidebarProps["onResetSidebarWidth"];
  onSelectSidebarTab: (
    tab: AppConfig["workspace"]["sidebarTab"],
  ) => void | Promise<void>;
  onSetOpenFilesFilter: AppLeftSidebarProps["onSetOpenFilesFilter"];
  onToggleDirectory: (path: string) => void | Promise<void>;
  onToggleOpenFilesCollapsed: AppLeftSidebarProps["onToggleOpenFilesCollapsed"];
  onTogglePinned: AppLeftSidebarProps["onTogglePinned"];
}

export function suggestedDocumentsModeForCatalog({
  documentOrder,
  filesViewMode,
  rootDirectory,
  selectedAntoraContextId,
}: SuggestedDocumentsModeInput): SuggestedDocumentsMode | undefined {
  if (!rootDirectory) {
    return undefined;
  }
  const antoraContexts = documentOrder.antoraContexts ?? [];
  if (
    antoraContexts.length > 1 &&
    documentOrder.orders.some((order) => order.source === "antora")
  ) {
    const selectedContext =
      antoraContexts.find(
        (context) => context.contextId === selectedAntoraContextId,
      ) ??
      documentOrder.selectedAntoraContext ??
      antoraContexts[0];
    return {
      mode: "documents-antora",
      label:
        filesViewMode === "documents-antora"
          ? "Antora: selected"
          : `Antora: ${antoraContexts.length} playbooks`,
      antoraContexts,
      selectedAntoraContextId: selectedContext.contextId,
    };
  }
  const suggestions: SuggestedDocumentsMode[] = [
    { mode: "documents-mkdocs", label: "Docs: MkDocs" },
    { mode: "documents-zensical", label: "Docs: Zensical" },
    { mode: "documents-antora", label: "Docs: Antora" },
  ];
  const detectedSuggestion = suggestions.find((suggestion) =>
    documentOrder.orders.some(
      (order) => order.source === suggestion.mode.replace("documents-", ""),
    ),
  );
  return detectedSuggestion?.mode === filesViewMode
    ? undefined
    : detectedSuggestion;
}

export function workspaceSearchOrderedPathsForCatalog({
  documentOrder,
  filesViewMode,
}: {
  documentOrder: DocumentOrderCatalog;
  filesViewMode: DocumentsViewMode;
}): string[] | undefined {
  const selectedOrder =
    filesViewMode === "documents-mkdocs"
      ? documentOrder.orders.find((order) => order.source === "mkdocs")
      : filesViewMode === "documents-zensical"
        ? documentOrder.orders.find((order) => order.source === "zensical")
        : filesViewMode === "documents-antora"
          ? documentOrder.orders.find((order) => order.source === "antora")
          : undefined;
  if (!selectedOrder) {
    return undefined;
  }
  return collectResolvedDocumentOrderPaths(selectedOrder.nodes);
}

export function useAppSidebarWiring({
  activePath,
  antoraContextSelectorOpenSignal,
  bookmarks,
  childrenByDirectory,
  config,
  directoryErrors,
  documentReviewSession = emptyDocumentReviewSessionControls,
  documentOrderRefreshRevision = 0,
  expandedDirectories,
  gitSourceControl,
  gitStatusEnabled = true,
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
  selectedAntoraContextId,
  tabs,
  workspacePerformanceMode,
  onActivatePreferences,
  onActivateTab,
  onAddActiveBookmark,
  onAddRootBookmark,
  onAntoraContextsChange,
  onSelectAntoraContext,
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
}: UseAppSidebarWiringOptions): {
  leftSidebarProps: AppLeftSidebarProps;
  documentOrderNavigation: DocumentOrderNavigationState | null;
  workspaceSearchOrderedPaths?: string[];
} {
  const [documentOrder, setDocumentOrder] = useState<DocumentOrderCatalog>({
    orders: [],
  });
  const [filesViewMode, setFilesViewMode] = useState<DocumentsViewMode>("tree");
  const openDocumentPaths = useMemo(
    () => new Set(orderedTabs.map((tab) => tab.path)),
    [orderedTabs],
  );
  const gitStatusByPath = useGitStatusHints({
    bookmarks,
    childrenByDirectory,
    enabled: gitStatusEnabled,
    host,
    tabs,
    workspacePerformanceMode,
  });
  const documentOrderNavigation = useMemo(() => {
    const selectedOrder =
      filesViewMode === "documents-mkdocs"
        ? documentOrder.orders.find((order) => order.source === "mkdocs")
        : filesViewMode === "documents-zensical"
          ? documentOrder.orders.find((order) => order.source === "zensical")
          : filesViewMode === "documents-antora"
            ? documentOrder.orders.find((order) => order.source === "antora")
            : undefined;
    if (!selectedOrder) {
      return null;
    }
    return buildDocumentOrderNavigation({
      activePath,
      order: selectedOrder,
    });
  }, [activePath, documentOrder.orders, filesViewMode]);
  const workspaceSearchOrderedPaths = useMemo(
    () =>
      workspaceSearchOrderedPathsForCatalog({ documentOrder, filesViewMode }),
    [documentOrder, filesViewMode],
  );
  const suggestedDocumentsMode = useMemo(
    () =>
      suggestedDocumentsModeForCatalog({
        documentOrder,
        filesViewMode,
        rootDirectory,
        selectedAntoraContextId,
      }),
    [documentOrder, filesViewMode, rootDirectory, selectedAntoraContextId],
  );

  useEffect(() => {
    let cancelled = false;
    if (!rootDirectory) {
      setDocumentOrder({ orders: [] });
      return;
    }
    void host
      .loadDocumentOrder(rootDirectory, {
        antoraContextId: selectedAntoraContextId,
      })
      .then((result) => {
        if (!cancelled) {
          setDocumentOrder(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDocumentOrder({
            orders: [],
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    host,
    rootDirectory,
    selectedAntoraContextId,
    documentOrderRefreshRevision,
  ]);

  useEffect(() => {
    void onAntoraContextsChange(documentOrder.antoraContexts?.length ?? 0);
  }, [documentOrder.antoraContexts, onAntoraContextsChange]);

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
    filesViewMode,
    suggestedDocumentsMode,
    antoraContextSelectorOpenSignal,
    activeDocumentOrderSectionKeys:
      documentOrderNavigation?.activeSectionKeys ?? new Set(),
    pinnedTabs,
    rootDirectory,
    rootEntries,
    gitStatusByPath,
    documentReviewSession,
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
    onSelectAntoraContext: (contextId) => void onSelectAntoraContext(contextId),
    onBeginOpenFilesSplitResize,
    onBeginSidebarResize,
    onCloseTab,
    onClosePreferences,
    onCollapseTree: () => void onCollapseTree(),
    onOpenBookmark: (bookmark) => void onOpenBookmark(bookmark),
    onOpenFile: (path) => void onOpenFile(path),
    onPickDirectory: () => void onPickDirectory(),
    onPickDocument: () => void onPickDocument(),
    onFilesViewModeChange: setFilesViewMode,
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
    documentOrderNavigation,
    workspaceSearchOrderedPaths,
  };
}
