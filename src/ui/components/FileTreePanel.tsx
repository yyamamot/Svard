import {
  ChevronDown,
  ChevronRight,
  ChevronsUp,
  FileText,
  FolderOpen,
  ListFilter,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  directoryGitStatusBadgeLabel,
  fileGitStatusBadgeLabel,
} from "../lib/gitStatusBadgeLabels";
import { gitStatusDisplay } from "../lib/gitStatusDisplay";
import { fileName } from "../lib/path";
import {
  buildGitDirectoryStatusSummary,
  mergeGitStatusWithChanges,
} from "../lib/gitDirectoryStatusSummary";
import {
  buildFileTreeDocumentRows,
  collectDocumentOrderPaths,
  documentOrderSectionKey,
  filterVisibleDocumentRows,
  sectionHeaderDocument,
  type DocumentsViewMode,
  type FileTreeDocumentRow,
} from "../lib/fileTreeDocuments";
import {
  prepareFileCompareDragData,
  scheduleClearFileCompareDragData,
  writeFileCompareDragData,
} from "../lib/fileCompareDrag";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  DirectoryEntry,
  DocumentOrderCatalog,
  DocumentOrderNode,
  DocumentOrderResult,
  GitChanges,
  GitDiffStatus,
} from "../../core/types";

const EMPTY_OPEN_DOCUMENT_PATHS: ReadonlySet<string> = new Set();
const ENABLE_EXPERIMENTAL_STATIC_SITE_ORDER_SOURCES: boolean = false;
type FilesViewMode =
  DocumentsViewMode;
type DocumentOrderSectionOptions = {
  sectionReviewId: string;
  notInNavReviewId: string;
  notInNavLabel: string;
};

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
  openDocumentPaths?: ReadonlySet<string>;
  filesViewMode?: FilesViewMode;
  activeDocumentOrderSectionKeys?: ReadonlySet<string>;
  onOpenFile: (path: string) => void;
  onOpenGitDiff: (path: string) => void;
  onFilesViewModeChange?: (mode: FilesViewMode) => void;
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
  openDocumentPaths = EMPTY_OPEN_DOCUMENT_PATHS,
  filesViewMode,
  activeDocumentOrderSectionKeys,
  onOpenFile,
  onOpenGitDiff,
  onFilesViewModeChange,
  onToggleDirectory,
  onPickDocument,
  onPickDirectory,
  onRefresh,
  onCollapse,
}: FileTreePanelProps) {
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const [localViewMode, setLocalViewMode] = useState<FilesViewMode>("tree");
  const [documentsFilter, setDocumentsFilter] = useState<"all" | "changed">(
    "all",
  );
  const [viewModeMenuOpen, setViewModeMenuOpen] = useState(false);
  const [expandedDocumentOrderSections, setExpandedDocumentOrderSections] =
    useState<Set<string>>(() => new Set());
  const lastAutoExpandedContextRef = useRef<string | undefined>(undefined);
  const openMenuRef = useRef<HTMLDivElement | null>(null);
  const viewModeMenuRef = useRef<HTMLDivElement | null>(null);
  const documentsViewRef = useRef<HTMLDivElement | null>(null);
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

  const mkdocsOrder = documentOrder.orders.find(
    (order) => order.source === "mkdocs",
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
  }, [antoraOrder, docusaurusOrder, mkdocsOrder, vitepressOrder, viewMode]);

  useEffect(() => {
    if (
      !activePath ||
      !activeDocumentOrderSectionKeys?.size ||
      lastAutoExpandedContextRef.current ===
        `${activePath}:${[...activeDocumentOrderSectionKeys].join("|")}`
    ) {
      return;
    }
    lastAutoExpandedContextRef.current = `${activePath}:${[
      ...activeDocumentOrderSectionKeys,
    ].join("|")}`;
    setExpandedDocumentOrderSections((current) => {
      const next = new Set(current);
      for (const key of activeDocumentOrderSectionKeys) {
        next.add(key);
      }
      return next;
    });
    window.requestAnimationFrame(() => {
      const activeElement = documentsViewRef.current?.querySelector<HTMLElement>(
        '[data-document-order-active="true"]',
      );
      activeElement?.scrollIntoView?.({ block: "nearest" });
    });
  }, [activeDocumentOrderSectionKeys, activePath]);

  useEffect(() => {
    if (!openMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!openMenuRef.current?.contains(event.target as Node | null)) {
        setOpenMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [openMenuOpen]);

  useEffect(() => {
    if (!viewModeMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!viewModeMenuRef.current?.contains(event.target as Node | null)) {
        setViewModeMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setViewModeMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [viewModeMenuOpen]);

  function pickFromOpenMenu(callback: () => void) {
    callback();
    setOpenMenuOpen(false);
  }

  function pickViewMode(nextMode: FilesViewMode) {
    changeViewMode(nextMode);
    setViewModeMenuOpen(false);
  }

  function changeViewMode(nextMode: FilesViewMode) {
    if (filesViewMode === undefined) {
      setLocalViewMode(nextMode);
    }
    onFilesViewModeChange?.(nextMode);
  }

  function toggleDocumentOrderSection(sectionKey: string) {
    setExpandedDocumentOrderSections((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  }

  function renderTreeEntries(parentPath: string, depth: number): ReactNode {
    const entries = childrenByDirectory[parentPath] ?? [];

    return entries.map((entry) => {
      const isDirectory = entry.kind === "directory";
      const isExpanded = expandedDirectories.has(entry.path);
      const isActive = activePath === entry.path;
      const children = childrenByDirectory[entry.path] ?? [];
      const isLoading = loadingDirectories.has(entry.path);
      const directoryError = directoryErrors[entry.path];
      const directoryGitStatus = isDirectory
        ? directoryGitStatusByPath[entry.path]
        : null;
      const fileGitStatus = !isDirectory
        ? gitStatusDisplay(fileTreeGitStatusByPath[entry.path])
        : null;
      const gitStatus = isDirectory ? directoryGitStatus : fileGitStatus;
      const gitStatusBadgeText = directoryGitStatus
        ? String(directoryGitStatus.count)
        : fileGitStatus?.shortLabel;
      const gitStatusBadgeLabel = directoryGitStatus
        ? directoryGitStatusBadgeLabel(directoryGitStatus, entry.name)
        : fileGitStatus
          ? fileGitStatusBadgeLabel(fileGitStatus, entry.name)
          : undefined;
      const canDragCompare =
        !isDirectory && isSupportedDocumentPath(entry.path);
      const isOpenDocument = !isDirectory && openDocumentPaths.has(entry.path);
      const openLabel = isDirectory
        ? `${entry.name}, ${isExpanded ? "expanded" : "collapsed"}`
        : `${entry.name}${isOpenDocument ? ", open" : ""}`;

      return (
        <div key={entry.path} className="tree-node" data-review-id="tree-node">
          <div
            className={`tree-row ${isDirectory ? "folder" : "file"} ${isActive ? "active" : ""} ${gitStatus?.className ?? ""}`}
            data-review-id={isDirectory ? "tree-folder-toggle" : "tree-file"}
            data-context-menu-kind="file-tree"
            data-path={entry.path}
            data-entry-kind={entry.kind}
            data-git-status={
              !isDirectory && gitStatus
                ? fileTreeGitStatusByPath[entry.path]
                : undefined
            }
            data-git-status-summary={
              directoryGitStatus ? directoryGitStatus.status : undefined
            }
            data-git-status-count={
              directoryGitStatus ? directoryGitStatus.count : undefined
            }
            data-git-status-modified-count={
              directoryGitStatus ? directoryGitStatus.modifiedCount : undefined
            }
            data-git-status-added-count={
              directoryGitStatus ? directoryGitStatus.addedCount : undefined
            }
            data-git-status-deleted-count={
              directoryGitStatus ? directoryGitStatus.deletedCount : undefined
            }
            data-git-status-untracked-count={
              directoryGitStatus ? directoryGitStatus.untrackedCount : undefined
            }
            data-git-status-label={gitStatusBadgeLabel}
            data-document-open={isOpenDocument ? "true" : undefined}
            title={gitStatus ? `${entry.path} · ${gitStatus.label}` : undefined}
            aria-label={
              gitStatus ? `${entry.name}, ${gitStatus.label}` : undefined
            }
            draggable={canDragCompare}
            onPointerDown={() => {
              if (canDragCompare) {
                prepareFileCompareDragData(entry.path);
              }
            }}
            onDragStart={(event) => {
              if (canDragCompare) {
                writeFileCompareDragData(event.dataTransfer, entry.path);
              }
            }}
            onDragEnd={() => scheduleClearFileCompareDragData()}
          >
            <button
              type="button"
              className="tree-row-main"
              style={{ paddingLeft: `${8 + depth * 14}px` }}
              aria-label={openLabel}
              aria-expanded={isDirectory ? isExpanded : undefined}
              draggable={canDragCompare}
              onPointerDown={() => {
                if (canDragCompare) {
                  prepareFileCompareDragData(entry.path);
                }
              }}
              onDragStart={(event) => {
                if (canDragCompare) {
                  writeFileCompareDragData(event.dataTransfer, entry.path);
                }
              }}
              onDragEnd={() => scheduleClearFileCompareDragData()}
              onClick={() =>
                isDirectory
                  ? onToggleDirectory(entry.path)
                  : onOpenFile(entry.path)
              }
            >
              {isDirectory ? (
                isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )
              ) : (
                <span className="tree-spacer" />
              )}
              {isDirectory ? <FolderOpen size={15} /> : <FileText size={15} />}
              <span className="tree-label">{entry.name}</span>
              {isOpenDocument ? (
                <span className="documents-view-open-indicator">open</span>
              ) : null}
            </button>
            {fileGitStatus ? (
              <button
                type="button"
                className={`git-status-badge git-status-diff-button ${fileGitStatus.className}`}
                data-review-id="git-status-diff-button"
                data-git-status-label={gitStatusBadgeLabel}
                aria-label={gitStatusBadgeLabel}
                title={gitStatusBadgeLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenGitDiff(entry.path);
                }}
              >
                {gitStatusBadgeText}
              </button>
            ) : directoryGitStatus ? (
              <span
                className="git-status-badge"
                data-review-id="git-status-badge"
                data-git-status-label={gitStatusBadgeLabel}
                aria-label={gitStatusBadgeLabel}
                title={gitStatusBadgeLabel}
              >
                {gitStatusBadgeText}
              </span>
            ) : null}
          </div>
          {isDirectory && isLoading && (
            <div
              className="tree-state"
              style={{ paddingLeft: `${30 + depth * 14}px` }}
            >
              Loading
            </div>
          )}
          {isDirectory && directoryError && (
            <div
              className="tree-state error"
              style={{ paddingLeft: `${30 + depth * 14}px` }}
            >
              {directoryError}
            </div>
          )}
          {isDirectory && isExpanded && children.length > 0
            ? renderTreeEntries(entry.path, depth + 1)
            : null}
        </div>
      );
    });
  }

  function renderDocumentEntries(): ReactNode {
    if (!rootDirectory) {
      return (
        <div className="documents-view-empty" data-review-id="documents-view-empty">
          Open a folder to list documents
        </div>
      );
    }

    const activeOrder = activeDocumentOrder();
    if (documentRows.length === 0) {
      if (activeOrder && documentsFilter !== "changed") {
        return (
          <>
            {renderDocumentsSourceFilter()}
            {renderOrderedDocumentEntries(activeOrder.order, activeOrder.options)}
          </>
        );
      }
      return (
        <div className="documents-view-empty" data-review-id="documents-view-empty">
          <strong>No loaded documents</strong>
          <span>Expand folders in Tree to include their documents.</span>
        </div>
      );
    }

    if (visibleDocumentRows.length === 0) {
      return (
        <>
          {renderDocumentsSourceFilter()}
          <div className="documents-view-empty" data-review-id="documents-view-empty">
            No changed loaded documents
          </div>
        </>
      );
    }

    return (
      <>
        {renderDocumentsSourceFilter()}
        {activeOrder
          ? renderOrderedDocumentEntries(activeOrder.order, activeOrder.options)
          : visibleDocumentRows.map((row) => renderDocumentRow(row))}
      </>
    );
  }

  function activeDocumentOrder():
    | {
        order: DocumentOrderResult;
        options: DocumentOrderSectionOptions;
      }
    | null {
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

  function renderOrderedDocumentEntries(
    order: DocumentOrderResult,
    options: DocumentOrderSectionOptions,
  ): ReactNode {
    const visibleRowsByPath = new Map(
      visibleDocumentRows.map((row) => [row.entry.path, row]),
    );
    const navPaths = collectDocumentOrderPaths(order.nodes);
    const orderedNodes = renderDocumentOrderNodes(
      order.nodes,
      visibleRowsByPath,
      order.source,
      options,
      [],
    );
    const notInNavRows = visibleDocumentRows.filter(
      (row) => !navPaths.has(row.entry.path),
    );
    const notInNavSectionKey = documentOrderSectionKey(
      order.source,
      ["not-in-nav"],
      options.notInNavLabel,
      0,
    );
    const notInNavExpanded =
      expandedDocumentOrderSections.has(notInNavSectionKey);

    return (
      <>
        {orderedNodes}
        {notInNavRows.length > 0 ? (
          renderDocumentOrderSectionHeader({
            key: notInNavSectionKey,
            title: options.notInNavLabel,
            depth: 0,
            reviewId: options.notInNavReviewId,
            collapsed: !notInNavExpanded,
          })
        ) : null}
        {notInNavExpanded
          ? notInNavRows.map((row) => renderDocumentRow(row))
          : null}
      </>
    );
  }

  function renderDocumentOrderNodes(
    nodes: DocumentOrderNode[],
    visibleRowsByPath: Map<string, FileTreeDocumentRow>,
    source: DocumentOrderResult["source"],
    options: DocumentOrderSectionOptions,
    ancestry: string[],
  ): ReactNode[] {
    const result: ReactNode[] = [];
    nodes.forEach((node, index) => {
      if (node.kind === "section") {
        const sectionAncestry = [...ancestry, String(index)];
        const sectionDocument = sectionHeaderDocument(node);
        const childNodes = sectionDocument
          ? node.children.slice(1)
          : node.children;
        const children = renderDocumentOrderNodes(
          childNodes,
          visibleRowsByPath,
          source,
          options,
          sectionAncestry,
        );
        if (children.length > 0 || sectionDocument) {
          const sectionKey = documentOrderSectionKey(
            source,
            sectionAncestry,
            node.title,
            node.depth,
          );
          const expanded = expandedDocumentOrderSections.has(sectionKey);
          result.push(
            renderDocumentOrderSectionHeader({
              key: sectionKey,
              title: node.title,
              depth: node.depth,
              reviewId: options.sectionReviewId,
              collapsed: !expanded,
              document: sectionDocument,
            }),
          );
          if (expanded) {
            result.push(...children);
          }
        }
        return;
      }

      if (node.status === "resolved") {
        const row = visibleRowsByPath.get(node.path);
        if (row) {
          result.push(renderDocumentRow(row, node.title, node.depth));
        } else if (documentsFilter !== "changed") {
          result.push(renderOrderDocumentRow(node, index));
        }
        return;
      }

      if (documentsFilter === "changed") {
        return;
      }
      if (node.status === "missing") {
        result.push(renderMissingDocumentRow(node, index));
      }
    });
    return result;
  }

  function renderDocumentOrderSectionHeader({
    key,
    title,
    depth,
    reviewId,
    collapsed,
    document,
  }: {
    key: string;
    title: string;
    depth: number;
    reviewId: string;
    collapsed: boolean;
    document?: Extract<DocumentOrderNode, { kind: "document" }>;
  }): ReactNode {
    const documentRow =
      document?.status === "resolved"
        ? documentRowsByPath.get(document.path)
        : undefined;
    const documentPath = documentRow?.entry.path ?? document?.path;
    const documentOpen = documentPath ? openDocumentPaths.has(documentPath) : false;
    const documentActive = activePath === documentPath;
    const documentDisplayPath = documentRow?.relativePath ?? document?.displayPath;
    const sectionTitle = (
      <>
        <span className="documents-view-row-title">
          <span className="tree-label">{title}</span>
          {documentOpen ? (
            <span className="documents-view-open-indicator">open</span>
          ) : null}
        </span>
        {documentDisplayPath ? (
          <span className="documents-view-row-path">{documentDisplayPath}</span>
        ) : null}
      </>
    );
    return (
      <div
        key={key}
        className={`documents-order-section ${document ? "documents-order-document-section" : ""} ${documentActive ? "active" : ""}`}
        data-review-id={reviewId}
        data-document-order-section-state={collapsed ? "collapsed" : "expanded"}
        data-document-order-section-document={document ? "true" : undefined}
        data-document-order-active={documentActive ? "true" : undefined}
        data-path={documentPath}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <button
          type="button"
          className="documents-order-section-toggle"
          data-review-id="documents-order-section-toggle"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`}
          onClick={() => toggleDocumentOrderSection(key)}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
        {documentPath ? (
          <button
            type="button"
            className="documents-order-section-main"
            data-review-id="documents-order-section-open"
            aria-label={`Open ${title}`}
            title={`Open ${title}`}
            onClick={() => onOpenFile(documentPath)}
          >
            <FileText size={15} />
            <span className="documents-view-row-text">{sectionTitle}</span>
          </button>
        ) : (
          <span className="documents-order-section-label">{title}</span>
        )}
      </div>
    );
  }

  function renderDocumentRow(
    row: FileTreeDocumentRow,
    titleOverride?: string,
    depth = 0,
  ): ReactNode {
    const entry = row.entry;
    return (
      <div
        key={entry.path}
        className={`tree-row file documents-view-row ${row.isActive ? "active" : ""} ${row.gitStatus?.className ?? ""}`}
        data-review-id="documents-view-row"
        data-context-menu-kind="file-tree"
        data-path={entry.path}
        data-entry-kind="file"
        data-git-status={
          row.gitStatus ? fileTreeGitStatusByPath[entry.path] : undefined
        }
        data-git-status-label={row.gitStatusLabel}
        data-document-open={row.isOpen ? "true" : undefined}
        data-document-order-active={row.isActive ? "true" : undefined}
        title={
          row.gitStatus ? `${entry.path} · ${row.gitStatus.label}` : entry.path
        }
        aria-label={
          row.gitStatus ? `${entry.name}, ${row.gitStatus.label}` : entry.name
        }
        draggable
        onPointerDown={() => {
          prepareFileCompareDragData(entry.path);
        }}
        onDragStart={(event) => {
          writeFileCompareDragData(event.dataTransfer, entry.path);
        }}
        onDragEnd={() => scheduleClearFileCompareDragData()}
      >
        <button
          type="button"
          className="tree-row-main documents-view-row-main"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          aria-label={entry.name}
          draggable
          onPointerDown={() => {
            prepareFileCompareDragData(entry.path);
          }}
          onDragStart={(event) => {
            writeFileCompareDragData(event.dataTransfer, entry.path);
          }}
          onDragEnd={() => scheduleClearFileCompareDragData()}
          onClick={() => onOpenFile(entry.path)}
        >
          <FileText size={15} />
          <span className="documents-view-row-text">
            <span className="documents-view-row-title">
              <span className="tree-label">{titleOverride ?? entry.name}</span>
              {row.isOpen ? (
                <span className="documents-view-open-indicator">open</span>
              ) : null}
            </span>
            <span className="documents-view-row-path">{row.relativePath}</span>
          </span>
        </button>
        {row.gitStatus ? (
          <button
            type="button"
            className={`git-status-badge git-status-diff-button ${row.gitStatus.className}`}
            data-review-id="git-status-diff-button"
            data-git-status-label={row.gitStatusLabel}
            aria-label={row.gitStatusLabel}
            title={row.gitStatusLabel}
            onClick={(event) => {
              event.stopPropagation();
              onOpenGitDiff(entry.path);
            }}
          >
            {row.gitStatus.shortLabel}
          </button>
        ) : null}
      </div>
    );
  }

  function renderOrderDocumentRow(
    node: Extract<DocumentOrderNode, { kind: "document" }>,
    index: number,
  ): ReactNode {
    const isOpen = openDocumentPaths.has(node.path);
    const isActive = activePath === node.path;
    return (
      <div
        key={`order-${node.depth}-${index}-${node.path}`}
        className={`tree-row file documents-view-row documents-view-row-order ${isActive ? "active" : ""}`}
        data-review-id="documents-view-row"
        data-context-menu-kind="file-tree"
        data-path={node.path}
        data-entry-kind="file"
        data-document-status="resolved"
        data-document-open={isOpen ? "true" : undefined}
        data-document-order-active={isActive ? "true" : undefined}
        title={node.path}
        aria-label={`${node.title}${isOpen ? ", open" : ""}`}
        draggable
        onPointerDown={() => {
          prepareFileCompareDragData(node.path);
        }}
        onDragStart={(event) => {
          writeFileCompareDragData(event.dataTransfer, node.path);
        }}
        onDragEnd={() => scheduleClearFileCompareDragData()}
      >
        <button
          type="button"
          className="tree-row-main documents-view-row-main"
          style={{ paddingLeft: `${8 + node.depth * 12}px` }}
          aria-label={node.title}
          draggable
          onPointerDown={() => {
            prepareFileCompareDragData(node.path);
          }}
          onDragStart={(event) => {
            writeFileCompareDragData(event.dataTransfer, node.path);
          }}
          onDragEnd={() => scheduleClearFileCompareDragData()}
          onClick={() => onOpenFile(node.path)}
        >
          <FileText size={15} />
          <span className="documents-view-row-text">
            <span className="documents-view-row-title">
              <span className="tree-label">{node.title}</span>
              {isOpen ? (
                <span className="documents-view-open-indicator">open</span>
              ) : null}
            </span>
            <span className="documents-view-row-path">{node.displayPath}</span>
          </span>
        </button>
      </div>
    );
  }

  function renderMissingDocumentRow(
    node: Extract<DocumentOrderNode, { kind: "document" }>,
    index: number,
  ): ReactNode {
    return (
      <div
        key={`missing-${node.depth}-${index}-${node.displayPath}`}
        className="tree-row file documents-view-row documents-view-row-missing"
        data-review-id="documents-view-row"
        data-entry-kind="file"
        data-document-status="missing"
      >
        <span
          className="tree-row-main documents-view-row-main"
          style={{ paddingLeft: `${8 + node.depth * 12}px` }}
        >
          <FileText size={15} />
          <span className="documents-view-row-text">
            <span className="tree-label">{node.title}</span>
            <span className="documents-view-row-path">
              {node.displayPath}
              <span className="documents-view-open-indicator">missing</span>
            </span>
          </span>
        </span>
      </div>
    );
  }

  function renderDocumentsSourceFilter(): ReactNode {
    return (
      <div
        className="documents-view-header"
        data-review-id="documents-view-header"
      >
        <span className="documents-view-heading">Documents only</span>
        <div
          className="documents-source-filter"
          data-review-id="documents-source-filter"
          aria-label="Documents source filter"
        >
          <button
            type="button"
            className={documentsFilter === "all" ? "active" : ""}
            data-review-id="documents-source-filter-all"
            aria-pressed={documentsFilter === "all"}
            onClick={() => setDocumentsFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={documentsFilter === "changed" ? "active" : ""}
            data-review-id="documents-source-filter-changed"
            aria-pressed={documentsFilter === "changed"}
            onClick={() => setDocumentsFilter("changed")}
          >
            Changed
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="file-toolbar" data-review-id="file-toolbar">
        <div
          className="tree-root"
          data-review-id="tree-root"
          title={rootDirectory}
        >
          <FolderOpen size={15} />
          <span>
            {rootDirectory
              ? fileName(rootDirectory) || rootDirectory
              : "No folder"}
          </span>
        </div>
        <div className="file-toolbar-actions" aria-label="File tree actions">
          <div className="file-tree-open-menu-wrap" ref={openMenuRef}>
            <button
              type="button"
              className="icon-button file-tree-open-menu-trigger"
              data-review-id="file-tree-open-menu-trigger"
              aria-label="Open file or folder"
              title="Open file or folder"
              aria-haspopup="menu"
              aria-expanded={openMenuOpen}
              onClick={() => setOpenMenuOpen((value) => !value)}
            >
              <FileText size={15} />
            </button>
            {openMenuOpen && (
              <div
                className="file-tree-open-menu"
                data-review-id="file-tree-open-menu"
                role="menu"
                aria-label="Open file or folder"
              >
                <button
                  type="button"
                  className="file-tree-open-menu-item"
                  data-review-id="file-open-control"
                  role="menuitem"
                  onClick={() => pickFromOpenMenu(onPickDocument)}
                >
                  <FileText size={15} />
                  <span>Open File...</span>
                </button>
                <button
                  type="button"
                  className="file-tree-open-menu-item"
                  data-review-id="directory-open-control"
                  role="menuitem"
                  onClick={() => pickFromOpenMenu(onPickDirectory)}
                >
                  <FolderOpen size={15} />
                  <span>Open Folder...</span>
                </button>
              </div>
            )}
          </div>
          <div className="file-tree-open-menu-wrap" ref={viewModeMenuRef}>
            <button
              type="button"
              className={`icon-button documents-view-toggle ${
                viewMode !== "tree" ? "active" : ""
              }`}
              data-review-id="documents-view-toggle"
              aria-label="Choose file view mode"
              title="Choose file view mode"
              aria-haspopup="menu"
              aria-expanded={viewModeMenuOpen}
              aria-pressed={viewMode !== "tree"}
              onClick={() => setViewModeMenuOpen((value) => !value)}
            >
              <ListFilter size={15} />
            </button>
            {viewModeMenuOpen && (
              <div
                className="file-tree-open-menu documents-view-mode-menu"
                data-review-id="documents-view-mode-menu"
                role="menu"
                aria-label="File view mode"
              >
                <button
                  type="button"
                  className={`file-tree-open-menu-item ${
                    viewMode === "tree" ? "active" : ""
                  }`}
                  data-review-id="documents-view-mode-tree"
                  role="menuitemradio"
                  aria-checked={viewMode === "tree"}
                  onClick={() => pickViewMode("tree")}
                >
                  <FolderOpen size={15} />
                  <span>File tree</span>
                </button>
                <button
                  type="button"
                  className={`file-tree-open-menu-item ${
                    viewMode === "documents-path" ? "active" : ""
                  }`}
                  data-review-id="documents-view-mode-path"
                  role="menuitemradio"
                  aria-checked={viewMode === "documents-path"}
                  aria-label="Documents only: Path"
                  title="Documents only: Path"
                  onClick={() => pickViewMode("documents-path")}
                >
                  <FileText size={15} />
                  <span>Docs: Path</span>
                </button>
                <button
                  type="button"
                  className={`file-tree-open-menu-item ${
                    viewMode === "documents-mkdocs" ? "active" : ""
                  }`}
                  data-review-id="documents-view-mode-mkdocs"
                  role="menuitemradio"
                  aria-checked={viewMode === "documents-mkdocs"}
                  aria-label="Documents only: MkDocs order"
                  title="Documents only: MkDocs order"
                  disabled={!mkdocsOrder}
                  onClick={() => pickViewMode("documents-mkdocs")}
                >
                  <FileText size={15} />
                  <span>Docs: MkDocs</span>
                </button>
                {ENABLE_EXPERIMENTAL_STATIC_SITE_ORDER_SOURCES ? (
                  <>
                    <button
                      type="button"
                      className={`file-tree-open-menu-item ${
                        viewMode === "documents-vitepress" ? "active" : ""
                      }`}
                      data-review-id="documents-view-mode-vitepress"
                      role="menuitemradio"
                      aria-checked={viewMode === "documents-vitepress"}
                      aria-label="Documents only: VitePress order"
                      title="Documents only: VitePress order"
                      disabled={!vitepressOrder}
                      onClick={() => pickViewMode("documents-vitepress")}
                    >
                      <FileText size={15} />
                      <span>Docs: VitePress</span>
                    </button>
                    <button
                      type="button"
                      className={`file-tree-open-menu-item ${
                        viewMode === "documents-docusaurus" ? "active" : ""
                      }`}
                      data-review-id="documents-view-mode-docusaurus"
                      role="menuitemradio"
                      aria-checked={viewMode === "documents-docusaurus"}
                      aria-label="Documents only: Docusaurus order"
                      title="Documents only: Docusaurus order"
                      disabled={!docusaurusOrder}
                      onClick={() => pickViewMode("documents-docusaurus")}
                    >
                      <FileText size={15} />
                      <span>Docs: Docusaurus</span>
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className={`file-tree-open-menu-item ${
                    viewMode === "documents-antora" ? "active" : ""
                  }`}
                  data-review-id="documents-view-mode-antora"
                  role="menuitemradio"
                  aria-checked={viewMode === "documents-antora"}
                  aria-label="Documents only: Antora order"
                  title="Documents only: Antora order"
                  disabled={!antoraOrder}
                  onClick={() => pickViewMode("documents-antora")}
                >
                  <FileText size={15} />
                  <span>Docs: Antora</span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            data-review-id="tree-refresh"
            aria-label="Refresh file tree"
            title="Refresh file tree"
            onClick={onRefresh}
          >
            <RefreshCw size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            data-review-id="tree-collapse-all"
            aria-label="Collapse all folders"
            title="Collapse all folders"
            onClick={onCollapse}
          >
            <ChevronsUp size={15} />
          </button>
        </div>
      </div>
      {viewMode === "tree" ? (
        <div className="file-tree" data-review-id="file-tree">
          {rootEntries.length > 0 ? (
            renderTreeEntries(rootDirectory, 0)
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
        <div
          ref={documentsViewRef}
          className="documents-view"
          data-review-id="documents-view"
        >
          {renderDocumentEntries()}
        </div>
      )}
    </>
  );
}
