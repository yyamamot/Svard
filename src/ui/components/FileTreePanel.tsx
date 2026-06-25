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
import { fileName } from "../lib/path";
import {
  directoryGitStatusBadgeLabel,
  fileGitStatusBadgeLabel,
} from "../lib/gitStatusBadgeLabels";
import { gitStatusDisplay } from "../lib/gitStatusDisplay";
import {
  buildGitDirectoryStatusSummary,
  mergeGitStatusWithChanges,
} from "../lib/gitDirectoryStatusSummary";
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
type FilesViewMode =
  | "tree"
  | "documents-path"
  | "documents-mkdocs"
  | "documents-antora"
  | "documents-vitepress"
  | "documents-docusaurus";
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
  onOpenFile: (path: string) => void;
  onOpenGitDiff: (path: string) => void;
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
  onOpenFile,
  onOpenGitDiff,
  onToggleDirectory,
  onPickDocument,
  onPickDirectory,
  onRefresh,
  onCollapse,
}: FileTreePanelProps) {
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<FilesViewMode>("tree");
  const [documentsFilter, setDocumentsFilter] = useState<"all" | "changed">(
    "all",
  );
  const [viewModeMenuOpen, setViewModeMenuOpen] = useState(false);
  const [expandedDocumentOrderSections, setExpandedDocumentOrderSections] =
    useState<Set<string>>(() => new Set());
  const openMenuRef = useRef<HTMLDivElement | null>(null);
  const viewModeMenuRef = useRef<HTMLDivElement | null>(null);
  const fileTreeGitStatusByPath = useMemo(
    () => mergeGitStatusWithChanges(gitStatusByPath, gitChanges),
    [gitChanges, gitStatusByPath],
  );
  const directoryGitStatusByPath = useMemo(
    () => buildGitDirectoryStatusSummary(fileTreeGitStatusByPath),
    [fileTreeGitStatusByPath],
  );
  const documentRows = useMemo(() => {
    const byPath = new Map<string, DirectoryEntry>();
    for (const entries of Object.values(childrenByDirectory)) {
      for (const entry of entries) {
        if (entry.kind === "file" && isSupportedDocumentPath(entry.path)) {
          byPath.set(entry.path, entry);
        }
      }
    }
    return [...byPath.values()]
      .sort((left, right) =>
        relativeDocumentPath(left.path, rootDirectory).localeCompare(
          relativeDocumentPath(right.path, rootDirectory),
        ),
      )
      .map((entry) => {
        const rawGitStatus = fileTreeGitStatusByPath[entry.path];
        const gitStatus = gitStatusDisplay(rawGitStatus);
        const gitStatusLabel = gitStatus
          ? fileGitStatusBadgeLabel(gitStatus, entry.name)
          : undefined;
        return {
          entry,
          relativePath: relativeDocumentPath(entry.path, rootDirectory),
          gitStatus,
          gitStatusLabel,
          isChanged: Boolean(gitStatus),
          isActive: activePath === entry.path,
          isOpen: openDocumentPaths.has(entry.path),
          sortStatusRank: changedDocumentStatusRank(rawGitStatus),
        };
      });
  }, [
    activePath,
    childrenByDirectory,
    fileTreeGitStatusByPath,
    openDocumentPaths,
    rootDirectory,
  ]);
  const documentRowsByPath = useMemo(
    () => new Map(documentRows.map((row) => [row.entry.path, row])),
    [documentRows],
  );
  const visibleDocumentRows = useMemo(() => {
    if (documentsFilter !== "changed") {
      return documentRows;
    }
    if (isOrderedDocumentsMode(viewMode)) {
      return documentRows.filter((row) => row.isChanged);
    }
    return [...documentRows.filter((row) => row.isChanged)].sort(
      (left, right) =>
        left.sortStatusRank - right.sortStatusRank ||
        left.relativePath.localeCompare(right.relativePath),
    );
  }, [documentRows, documentsFilter, viewMode]);

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
      setViewMode("documents-path");
    }
    if (viewMode === "documents-antora" && !antoraOrder) {
      setViewMode("documents-path");
    }
    if (viewMode === "documents-vitepress" && !vitepressOrder) {
      setViewMode("documents-path");
    }
    if (viewMode === "documents-docusaurus" && !docusaurusOrder) {
      setViewMode("documents-path");
    }
  }, [antoraOrder, docusaurusOrder, mkdocsOrder, vitepressOrder, viewMode]);

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
    setViewMode(nextMode);
    setViewModeMenuOpen(false);
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
    if (viewMode === "documents-vitepress" && vitepressOrder) {
      return {
        order: vitepressOrder,
        options: {
          sectionReviewId: "documents-vitepress-section",
          notInNavReviewId: "documents-vitepress-not-in-nav",
          notInNavLabel: "Not in VitePress sidebar",
        },
      };
    }
    if (viewMode === "documents-docusaurus" && docusaurusOrder) {
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
    visibleRowsByPath: Map<string, (typeof documentRows)[number]>,
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
    row: (typeof documentRows)[number],
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
    return (
      <div
        key={`order-${node.depth}-${index}-${node.path}`}
        className="tree-row file documents-view-row documents-view-row-order"
        data-review-id="documents-view-row"
        data-context-menu-kind="file-tree"
        data-path={node.path}
        data-entry-kind="file"
        data-document-status="resolved"
        data-document-open={isOpen ? "true" : undefined}
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
        <div className="documents-view" data-review-id="documents-view">
          {renderDocumentEntries()}
        </div>
      )}
    </>
  );
}

function relativeDocumentPath(path: string, rootDirectory: string): string {
  if (!rootDirectory) {
    return path;
  }
  const normalizedRoot = rootDirectory.replace(/[/\\]+$/, "");
  if (path === normalizedRoot) {
    return fileName(path);
  }
  if (path.startsWith(`${normalizedRoot}/`) || path.startsWith(`${normalizedRoot}\\`)) {
    return path.slice(normalizedRoot.length + 1);
  }
  return path;
}

function changedDocumentStatusRank(status?: GitDiffStatus) {
  switch (status) {
    case "deleted":
      return 0;
    case "renamed":
      return 1;
    case "modified":
      return 2;
    case "added":
      return 3;
    case "untracked":
      return 4;
    case "binary":
      return 5;
    default:
      return 99;
  }
}

function isOrderedDocumentsMode(viewMode: FilesViewMode): boolean {
  return (
    viewMode === "documents-mkdocs" ||
    viewMode === "documents-antora" ||
    viewMode === "documents-vitepress" ||
    viewMode === "documents-docusaurus"
  );
}

function documentOrderSectionKey(
  source: DocumentOrderResult["source"],
  ancestry: string[],
  title: string,
  depth: number,
): string {
  return `${source}:${ancestry.join(".")}:${depth}:${title}`;
}

function sectionHeaderDocument(
  node: Extract<DocumentOrderNode, { kind: "section" }>,
): Extract<DocumentOrderNode, { kind: "document" }> | undefined {
  const firstChild = node.children[0];
  if (
    firstChild?.kind === "document" &&
    firstChild.status === "resolved" &&
    firstChild.title === node.title
  ) {
    return firstChild;
  }
  return undefined;
}

function collectDocumentOrderPaths(nodes: DocumentOrderNode[]): Set<string> {
  const paths = new Set<string>();
  for (const node of nodes) {
    if (node.kind === "section") {
      for (const path of collectDocumentOrderPaths(node.children)) {
        paths.add(path);
      }
    } else if (node.status === "resolved") {
      paths.add(node.path);
    }
  }
  return paths;
}
