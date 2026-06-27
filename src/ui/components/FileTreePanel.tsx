import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildGitDirectoryStatusSummary,
  mergeGitStatusWithChanges,
} from "../lib/gitDirectoryStatusSummary";
import {
  buildFileTreeDocumentRows,
  buildOpenDocumentTree,
  filterVisibleDocumentRows,
} from "../lib/fileTreeDocuments";
import { DocumentsView } from "./fileTreePanel/DocumentsView";
import { FileTreeRows } from "./fileTreePanel/FileTreeRows";
import { FileTreeToolbar } from "./fileTreePanel/FileTreeToolbar";
import type {
  ActiveDocumentOrder,
  DocumentsFilter,
  DocumentsPanelCommands,
  FilesViewMode,
  SuggestedDocumentsMode,
} from "./fileTreePanel/types";
import type {
  DirectoryEntry,
  DocumentPayload,
  DocumentOrderCatalog,
  GitChanges,
  GitDiffStatus,
} from "../../core/types";

const EMPTY_OPEN_DOCUMENT_PATHS: ReadonlySet<string> = new Set();
const EMPTY_DOCUMENT_SECTION_KEYS: ReadonlySet<string> = new Set();
const ENABLE_EXPERIMENTAL_STATIC_SITE_ORDER_SOURCES: boolean = false;

interface FileTreePanelProps {
  rootDirectory: string;
  rootEntries: DirectoryEntry[];
  documentOrder?: DocumentOrderCatalog;
  childrenByDirectory: Record<string, DirectoryEntry[]>;
  expandedDirectories: Set<string>;
  loadingDirectories: Set<string>;
  directoryErrors: Record<string, string>;
  activePath?: string;
  gitStatusByPath: Record<string, GitDiffStatus>;
  gitChanges: GitChanges | null;
  orderedTabs?: DocumentPayload[];
  openDocumentPaths?: ReadonlySet<string>;
  filesViewMode?: FilesViewMode;
  suggestedDocumentsMode?: SuggestedDocumentsMode;
  antoraContextSelectorOpenSignal?: number;
  activeDocumentOrderSectionKeys?: ReadonlySet<string>;
  onOpenFile: (path: string) => void;
  onOpenGitDiff: (path: string) => void;
  onFilesViewModeChange?: (mode: FilesViewMode) => void;
  onSelectAntoraContext?: (contextId: string) => void;
  onToggleDirectory: (path: string) => void;
  onPickDocument: () => void;
  onPickDirectory: () => void;
  onRefresh: () => void;
  onCollapse: () => void;
}

export function FileTreePanel({
  rootDirectory,
  rootEntries,
  documentOrder = { orders: [] },
  childrenByDirectory,
  expandedDirectories,
  loadingDirectories,
  directoryErrors,
  activePath,
  gitStatusByPath,
  gitChanges,
  orderedTabs = [],
  openDocumentPaths = EMPTY_OPEN_DOCUMENT_PATHS,
  filesViewMode,
  suggestedDocumentsMode,
  antoraContextSelectorOpenSignal = 0,
  activeDocumentOrderSectionKeys,
  onOpenFile,
  onOpenGitDiff,
  onFilesViewModeChange,
  onSelectAntoraContext,
  onToggleDirectory,
  onPickDocument,
  onPickDirectory,
  onRefresh,
  onCollapse,
}: FileTreePanelProps) {
  const [localViewMode, setLocalViewMode] = useState<FilesViewMode>("tree");
  const [documentsFilter, setDocumentsFilter] =
    useState<DocumentsFilter>("all");
  const documentsPanelCommandsRef = useRef<DocumentsPanelCommands | null>(null);
  const viewMode = filesViewMode ?? localViewMode;
  const fileTreeGitStatusByPath = useMemo(
    () => mergeGitStatusWithChanges(gitStatusByPath, gitChanges),
    [gitChanges, gitStatusByPath],
  );
  const directoryGitStatusByPath = useMemo(
    () => buildGitDirectoryStatusSummary(fileTreeGitStatusByPath),
    [fileTreeGitStatusByPath],
  );
  const documentRows = useMemo(
    () =>
      buildFileTreeDocumentRows({
        activePath,
        childrenByDirectory,
        gitStatusByPath: fileTreeGitStatusByPath,
        openDocumentPaths,
        rootDirectory,
      }),
    [
      activePath,
      childrenByDirectory,
      fileTreeGitStatusByPath,
      openDocumentPaths,
      rootDirectory,
    ],
  );
  const documentRowsByPath = useMemo(
    () => new Map(documentRows.map((row) => [row.entry.path, row])),
    [documentRows],
  );
  const visibleDocumentRows = useMemo(
    () =>
      filterVisibleDocumentRows(
        documentRows,
        documentsFilter,
        viewMode,
        ENABLE_EXPERIMENTAL_STATIC_SITE_ORDER_SOURCES,
      ),
    [documentRows, documentsFilter, viewMode],
  );
  const openDocumentTree = useMemo(
    () =>
      buildOpenDocumentTree({
        activePath,
        gitStatusByPath: fileTreeGitStatusByPath,
        orderedTabs,
        rootDirectory,
      }),
    [activePath, fileTreeGitStatusByPath, orderedTabs, rootDirectory],
  );
  const autoExpandSectionKeys =
    viewMode === "documents-path"
      ? openDocumentTree.activeSectionKeys
      : (activeDocumentOrderSectionKeys ?? EMPTY_DOCUMENT_SECTION_KEYS);

  const mkdocsOrder = documentOrder.orders.find(
    (order) => order.source === "mkdocs",
  );
  const zensicalOrder = documentOrder.orders.find(
    (order) => order.source === "zensical",
  );
  const antoraOrder = documentOrder.orders.find(
    (order) => order.source === "antora",
  );
  const vitepressOrder = documentOrder.orders.find(
    (order) => order.source === "vitepress",
  );
  const docusaurusOrder = documentOrder.orders.find(
    (order) => order.source === "docusaurus",
  );

  useEffect(() => {
    if (viewMode === "documents-mkdocs" && !mkdocsOrder) {
      changeViewMode("documents-path");
    }
    if (viewMode === "documents-zensical" && !zensicalOrder) {
      changeViewMode("documents-path");
    }
    if (viewMode === "documents-antora" && !antoraOrder) {
      changeViewMode("documents-path");
    }
    if (
      viewMode === "documents-vitepress" &&
      (!ENABLE_EXPERIMENTAL_STATIC_SITE_ORDER_SOURCES || !vitepressOrder)
    ) {
      changeViewMode("documents-path");
    }
    if (
      viewMode === "documents-docusaurus" &&
      (!ENABLE_EXPERIMENTAL_STATIC_SITE_ORDER_SOURCES || !docusaurusOrder)
    ) {
      changeViewMode("documents-path");
    }
  }, [
    antoraOrder,
    docusaurusOrder,
    mkdocsOrder,
    vitepressOrder,
    viewMode,
    zensicalOrder,
  ]);

  function changeViewMode(nextMode: FilesViewMode) {
    if (filesViewMode === undefined) {
      setLocalViewMode(nextMode);
    }
    onFilesViewModeChange?.(nextMode);
  }

  const registerDocumentsPanelCommands = useCallback(
    (commands: DocumentsPanelCommands | null) => {
      documentsPanelCommandsRef.current = commands;
    },
    [],
  );

  function collapseCurrentView() {
    if (viewMode === "tree") {
      onCollapse();
      return;
    }
    documentsPanelCommandsRef.current?.collapseAllDocumentSections();
  }

  function activeDocumentOrder(): ActiveDocumentOrder {
    if (viewMode === "documents-mkdocs" && mkdocsOrder) {
      return {
        order: mkdocsOrder,
        options: {
          sectionReviewId: "documents-mkdocs-section",
          notInNavReviewId: "documents-mkdocs-not-in-nav",
          notInNavLabel: "Not in mkdocs.yml",
        },
      };
    }
    if (viewMode === "documents-antora" && antoraOrder) {
      return {
        order: antoraOrder,
        options: {
          sectionReviewId: "documents-antora-section",
          notInNavReviewId: "documents-antora-not-in-nav",
          notInNavLabel: "Not in antora.yml nav",
        },
      };
    }
    if (viewMode === "documents-zensical" && zensicalOrder) {
      return {
        order: zensicalOrder,
        options: {
          sectionReviewId: "documents-zensical-section",
          notInNavReviewId: "documents-zensical-not-in-nav",
          notInNavLabel: "Not in zensical.toml",
        },
      };
    }
    if (
      ENABLE_EXPERIMENTAL_STATIC_SITE_ORDER_SOURCES &&
      viewMode === "documents-vitepress" &&
      vitepressOrder
    ) {
      return {
        order: vitepressOrder,
        options: {
          sectionReviewId: "documents-vitepress-section",
          notInNavReviewId: "documents-vitepress-not-in-nav",
          notInNavLabel: "Not in VitePress sidebar",
        },
      };
    }
    if (
      ENABLE_EXPERIMENTAL_STATIC_SITE_ORDER_SOURCES &&
      viewMode === "documents-docusaurus" &&
      docusaurusOrder
    ) {
      return {
        order: docusaurusOrder,
        options: {
          sectionReviewId: "documents-docusaurus-section",
          notInNavReviewId: "documents-docusaurus-not-in-nav",
          notInNavLabel: "Not in Docusaurus sidebars",
        },
      };
    }
    return null;
  }

  return (
    <>
      <FileTreeToolbar
        rootDirectory={rootDirectory}
        viewMode={viewMode}
        hasMkdocsOrder={Boolean(mkdocsOrder)}
        hasZensicalOrder={Boolean(zensicalOrder)}
        hasAntoraOrder={Boolean(antoraOrder)}
        hasVitepressOrder={Boolean(vitepressOrder)}
        hasDocusaurusOrder={Boolean(docusaurusOrder)}
        showExperimentalStaticSiteOrderSources={
          ENABLE_EXPERIMENTAL_STATIC_SITE_ORDER_SOURCES
        }
        suggestedDocumentsMode={suggestedDocumentsMode}
        antoraContextSelectorOpenSignal={antoraContextSelectorOpenSignal}
        onPickDocument={onPickDocument}
        onPickDirectory={onPickDirectory}
        onRefresh={onRefresh}
        collapseLabel={
          viewMode === "tree"
            ? "Collapse all folders"
            : "Collapse all document sections"
        }
        onCollapse={collapseCurrentView}
        onViewModeChange={changeViewMode}
        onSelectAntoraContext={onSelectAntoraContext}
      />
      {viewMode === "tree" ? (
        <div className="file-tree" data-review-id="file-tree">
          {rootEntries.length > 0 ? (
            <FileTreeRows
              rootDirectory={rootDirectory}
              childrenByDirectory={childrenByDirectory}
              expandedDirectories={expandedDirectories}
              loadingDirectories={loadingDirectories}
              directoryErrors={directoryErrors}
              activePath={activePath}
              directoryGitStatusByPath={directoryGitStatusByPath}
              fileTreeGitStatusByPath={fileTreeGitStatusByPath}
              openDocumentPaths={openDocumentPaths}
              onOpenFile={onOpenFile}
              onOpenGitDiff={onOpenGitDiff}
              onToggleDirectory={onToggleDirectory}
            />
          ) : (
            <button
              type="button"
              className="tree-row"
              data-review-id="tree-empty"
              onClick={onRefresh}
            >
              No markup files
            </button>
          )}
        </div>
      ) : (
        <DocumentsView
          activeDocumentOrder={activeDocumentOrder()}
          activePath={activePath}
          autoExpandSectionKeys={autoExpandSectionKeys}
          documentRows={documentRows}
          documentRowsByPath={documentRowsByPath}
          documentsFilter={documentsFilter}
          fileTreeGitStatusByPath={fileTreeGitStatusByPath}
          openDocumentPaths={openDocumentPaths}
          openDocumentTree={openDocumentTree}
          rootDirectory={rootDirectory}
          viewMode={viewMode}
          visibleDocumentRows={visibleDocumentRows}
          onDocumentsFilterChange={setDocumentsFilter}
          onOpenFile={onOpenFile}
          onOpenGitDiff={onOpenGitDiff}
          onRegisterDocumentsPanelCommands={registerDocumentsPanelCommands}
        />
      )}
    </>
  );
}
