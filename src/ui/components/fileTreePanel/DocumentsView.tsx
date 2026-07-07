import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DocumentOrderNode,
  DocumentOrderResult,
  GitDiffStatus,
} from "../../../core/types";
import {
  prepareFileCompareDragData,
  scheduleClearFileCompareDragData,
  writeFileCompareDragData,
} from "../../lib/fileCompareDrag";
import { fileGitStatusBadgeLabel } from "../../lib/gitStatusBadgeLabels";
import { gitStatusDisplay } from "../../lib/gitStatusDisplay";
import type { DocumentReviewSessionControls } from "../../lib/documentReviewSession";
import {
  summarizeDocumentReviewSession,
  uniqueDocumentReviewPaths,
} from "../../lib/documentReviewSession";
import {
  buildDocumentOrderChangeCounts,
  collectDocumentOrderPaths,
  documentOrderSectionKey,
  sectionHeaderDocument,
  type DocumentOrderChangeCounts,
  type FileTreeDocumentRow,
  type OpenDocumentTreeModel,
  type OpenDocumentTreeNode,
} from "../../lib/fileTreeDocuments";
import { registerDocumentsPanelCommandBridge } from "../../lib/documentsPanelCommandBridge";
import { fileName } from "../../lib/path";
import {
  DocumentReviewRowControls,
  DocumentsChangeCountBadge,
  DocumentsSourceFilterHeader,
} from "./DocumentsViewLeaf";
import type {
  ActiveDocumentOrder,
  DocumentOrderSectionOptions,
  DocumentsPanelCommands,
  DocumentsFilter,
  FilesViewMode,
} from "./types";

interface DocumentsViewProps {
  activeDocumentOrder: ActiveDocumentOrder;
  activePath?: string;
  autoExpandSectionKeys: ReadonlySet<string>;
  documentRows: FileTreeDocumentRow[];
  documentRowsByPath: Map<string, FileTreeDocumentRow>;
  documentReviewSession: DocumentReviewSessionControls;
  documentsFilter: DocumentsFilter;
  fileTreeGitStatusByPath: Record<string, GitDiffStatus>;
  openDocumentPaths: ReadonlySet<string>;
  openDocumentTree: OpenDocumentTreeModel;
  rootDirectory: string;
  viewMode: FilesViewMode;
  visibleDocumentRows: FileTreeDocumentRow[];
  onDocumentsFilterChange: (filter: DocumentsFilter) => void;
  onOpenFile: (path: string) => void;
  onOpenGitDiff: (path: string) => void;
  onRegisterDocumentsPanelCommands?: (
    commands: DocumentsPanelCommands | null,
  ) => void;
}

export function DocumentsView({
  activeDocumentOrder,
  activePath,
  autoExpandSectionKeys,
  documentRows,
  documentRowsByPath,
  documentReviewSession,
  documentsFilter,
  fileTreeGitStatusByPath,
  openDocumentPaths,
  openDocumentTree,
  rootDirectory,
  viewMode,
  visibleDocumentRows,
  onDocumentsFilterChange,
  onOpenFile,
  onOpenGitDiff,
  onRegisterDocumentsPanelCommands,
}: DocumentsViewProps) {
  const [expandedDocumentOrderSections, setExpandedDocumentOrderSections] =
    useState<Set<string>>(() => new Set());
  const lastAutoExpandedContextRef = useRef<string | undefined>(undefined);
  const documentsViewRef = useRef<HTMLDivElement | null>(null);
  const autoExpandContext = useMemo(
    () =>
      activePath && autoExpandSectionKeys.size
        ? `${viewMode}:${activePath}:${[...autoExpandSectionKeys].join("|")}`
        : undefined,
    [activePath, autoExpandSectionKeys, viewMode],
  );
  const activeDocumentOrderChangeCounts = useMemo(
    () =>
      activeDocumentOrder
        ? buildDocumentOrderChangeCounts({
            gitStatusByPath: fileTreeGitStatusByPath,
            nodes: activeDocumentOrder.order.nodes,
            source: activeDocumentOrder.order.source,
          })
        : null,
    [activeDocumentOrder, fileTreeGitStatusByPath],
  );
  const documentsChangedCount = useMemo(() => {
    if (viewMode === "documents-path") {
      return openDocumentTree.changedCount;
    }
    if (activeDocumentOrder && activeDocumentOrderChangeCounts) {
      const navPaths = collectDocumentOrderPaths(
        activeDocumentOrder.order.nodes,
      );
      const notInNavChangedCount = documentRows.filter(
        (row) => row.isChanged && !navPaths.has(row.entry.path),
      ).length;
      return activeDocumentOrderChangeCounts.totalCount + notInNavChangedCount;
    }
    return documentRows.filter((row) => row.isChanged).length;
  }, [
    activeDocumentOrder,
    activeDocumentOrderChangeCounts,
    documentRows,
    openDocumentTree.changedCount,
    viewMode,
  ]);
  const reviewTargetPaths = useMemo(() => {
    const documentRowPaths = documentRows
      .filter((row) => row.isChanged)
      .map((row) => row.entry.path);
    if (!activeDocumentOrder) {
      return uniqueDocumentReviewPaths(documentRowPaths);
    }
    const navPaths = [
      ...collectDocumentOrderPaths(activeDocumentOrder.order.nodes),
    ].filter((path) => gitStatusDisplay(fileTreeGitStatusByPath[path]));
    const navPathSet = new Set(navPaths);
    const notInNavPaths = documentRowPaths.filter(
      (path) => !navPathSet.has(path),
    );
    return uniqueDocumentReviewPaths([...navPaths, ...notInNavPaths]);
  }, [activeDocumentOrder, documentRows, fileTreeGitStatusByPath]);
  const [reviewCursorPath, setReviewCursorPath] = useState<string | null>(null);
  useEffect(() => {
    setReviewCursorPath((current) =>
      current && reviewTargetPaths.includes(current) ? current : null,
    );
  }, [reviewTargetPaths]);
  const currentReviewPath =
    reviewCursorPath && reviewTargetPaths.includes(reviewCursorPath)
      ? reviewCursorPath
      : activePath && reviewTargetPaths.includes(activePath)
        ? activePath
        : null;
  const reviewSummary = useMemo(
    () =>
      summarizeDocumentReviewSession({
        stateByPath: documentReviewSession.stateByPath,
        targetPaths: reviewTargetPaths,
      }),
    [documentReviewSession.stateByPath, reviewTargetPaths],
  );

  function openReviewDiff(path: string): void {
    setReviewCursorPath(path);
    onOpenGitDiff(path);
  }

  const scrollActiveDocumentIntoView = useCallback(() => {
    window.requestAnimationFrame(() => {
      const activeElement =
        documentsViewRef.current?.querySelector<HTMLElement>(
          '[data-document-order-active="true"]',
        );
      activeElement?.scrollIntoView?.({ block: "nearest" });
    });
  }, []);

  const expandAndScrollCurrentDocument = useCallback(() => {
    if (!autoExpandContext || !autoExpandSectionKeys.size) {
      return false;
    }
    lastAutoExpandedContextRef.current = autoExpandContext;
    setExpandedDocumentOrderSections((current) => {
      const next = new Set(current);
      for (const key of autoExpandSectionKeys) {
        next.add(key);
      }
      return next;
    });
    scrollActiveDocumentIntoView();
    return true;
  }, [autoExpandContext, autoExpandSectionKeys, scrollActiveDocumentIntoView]);

  const revealCurrentDocument = useCallback(
    () => (activeDocumentOrder ? expandAndScrollCurrentDocument() : false),
    [activeDocumentOrder, expandAndScrollCurrentDocument],
  );

  const collapseAllDocumentSections = useCallback(() => {
    setExpandedDocumentOrderSections(new Set());
  }, []);

  useEffect(() => {
    if (
      !autoExpandContext ||
      lastAutoExpandedContextRef.current === autoExpandContext
    ) {
      return;
    }
    expandAndScrollCurrentDocument();
  }, [autoExpandContext, expandAndScrollCurrentDocument]);

  useEffect(() => {
    const commands: DocumentsPanelCommands = {
      collapseAllDocumentSections,
      revealCurrentDocument,
      canRevealCurrentDocument: () =>
        Boolean(activeDocumentOrder && autoExpandContext),
    };
    onRegisterDocumentsPanelCommands?.(commands);
    registerDocumentsPanelCommandBridge(commands);
    return () => {
      onRegisterDocumentsPanelCommands?.(null);
      registerDocumentsPanelCommandBridge(null);
    };
  }, [
    activeDocumentOrder,
    autoExpandContext,
    collapseAllDocumentSections,
    onRegisterDocumentsPanelCommands,
    revealCurrentDocument,
  ]);

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

  function renderDocumentEntries(): React.ReactNode {
    if (!rootDirectory) {
      return (
        <div
          className="documents-view-empty"
          data-review-id="documents-view-empty"
        >
          Open a folder to list documents
        </div>
      );
    }

    if (viewMode === "documents-path") {
      return renderOpenDocumentTreeEntries();
    }

    if (documentRows.length === 0) {
      if (activeDocumentOrder) {
        if (documentsFilter === "changed" && documentsChangedCount === 0) {
          return renderNoChangedDocuments("No changed documents");
        }
        return (
          <>
            {renderDocumentsSourceFilter()}
            {renderOrderedDocumentEntries(
              activeDocumentOrder.order,
              activeDocumentOrder.options,
            )}
          </>
        );
      }
      return (
        <div
          className="documents-view-empty"
          data-review-id="documents-view-empty"
        >
          <strong>No loaded documents</strong>
          <span>Expand folders in Tree to include their documents.</span>
        </div>
      );
    }

    if (visibleDocumentRows.length === 0) {
      if (activeDocumentOrder) {
        if (documentsFilter === "changed" && documentsChangedCount === 0) {
          return renderNoChangedDocuments("No changed documents");
        }
        return (
          <>
            {renderDocumentsSourceFilter()}
            {renderOrderedDocumentEntries(
              activeDocumentOrder.order,
              activeDocumentOrder.options,
            )}
          </>
        );
      }
      return renderNoChangedDocuments("No changed open documents");
    }

    return (
      <>
        {renderDocumentsSourceFilter()}
        {activeDocumentOrder
          ? renderOrderedDocumentEntries(
              activeDocumentOrder.order,
              activeDocumentOrder.options,
            )
          : visibleDocumentRows.map((row) => renderDocumentRow(row))}
      </>
    );
  }

  function renderNoChangedDocuments(message: string): React.ReactNode {
    return (
      <>
        {renderDocumentsSourceFilter()}
        <div
          className="documents-view-empty"
          data-review-id="documents-view-empty"
        >
          {message}
        </div>
      </>
    );
  }

  function renderOpenDocumentTreeEntries(): React.ReactNode {
    if (openDocumentTree.documentCount === 0) {
      return (
        <div
          className="documents-view-empty"
          data-review-id="documents-view-empty"
        >
          <strong>No open documents</strong>
          <span>Open documents to build a temporary reading tree.</span>
        </div>
      );
    }

    if (documentsFilter === "changed" && openDocumentTree.changedCount === 0) {
      return (
        <>
          {renderDocumentsSourceFilter()}
          <div
            className="documents-view-empty"
            data-review-id="documents-view-empty"
          >
            No changed open documents
          </div>
        </>
      );
    }

    return (
      <>
        {renderDocumentsSourceFilter()}
        {renderOpenDocumentTreeNodes(openDocumentTree.nodes, 0)}
      </>
    );
  }

  function renderOrderedDocumentEntries(
    order: DocumentOrderResult,
    options: DocumentOrderSectionOptions,
  ): React.ReactNode {
    const visibleRowsByPath = new Map(
      visibleDocumentRows.map((row) => [row.entry.path, row]),
    );
    const navPaths = collectDocumentOrderPaths(order.nodes);
    const orderedNodes = renderDocumentOrderNodes(
      order.nodes,
      activeDocumentOrderChangeCounts,
      visibleRowsByPath,
      order.source,
      options,
      [],
    );
    const showNotInNav = options.showNotInNav ?? true;
    const notInNavRows = showNotInNav
      ? visibleDocumentRows.filter((row) => !navPaths.has(row.entry.path))
      : [];
    const notInNavSectionKey = documentOrderSectionKey(
      order.source,
      ["not-in-nav"],
      options.notInNavLabel,
      0,
    );
    const notInNavExpanded =
      documentsFilter === "changed" ||
      expandedDocumentOrderSections.has(notInNavSectionKey);

    return (
      <>
        {orderedNodes}
        {notInNavRows.length > 0
          ? renderDocumentOrderSectionHeader({
              key: notInNavSectionKey,
              title: options.notInNavLabel,
              depth: 0,
              reviewId: options.notInNavReviewId,
              collapsed: !notInNavExpanded,
              changeCount: notInNavRows.filter((row) => row.isChanged).length,
            })
          : null}
        {notInNavExpanded
          ? notInNavRows.map((row) => renderDocumentRow(row))
          : null}
      </>
    );
  }

  function renderDocumentOrderNodes(
    nodes: DocumentOrderNode[],
    changeCounts: DocumentOrderChangeCounts | null,
    visibleRowsByPath: Map<string, FileTreeDocumentRow>,
    source: DocumentOrderResult["source"],
    options: DocumentOrderSectionOptions,
    ancestry: string[],
  ): React.ReactNode[] {
    const result: React.ReactNode[] = [];
    nodes.forEach((node, index) => {
      if (node.kind === "section") {
        const sectionAncestry = [...ancestry, String(index)];
        const sectionDocument = sectionHeaderDocument(node);
        const childNodes = sectionDocument
          ? node.children.slice(1)
          : node.children;
        const children = renderDocumentOrderNodes(
          childNodes,
          changeCounts,
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
          const expanded =
            documentsFilter === "changed" ||
            expandedDocumentOrderSections.has(sectionKey);
          result.push(
            renderDocumentOrderSectionHeader({
              key: sectionKey,
              title: node.title,
              depth: node.depth,
              reviewId: options.sectionReviewId,
              collapsed: !expanded,
              document: sectionDocument,
              changeCount: changeCounts?.sectionCounts.get(sectionKey) ?? 0,
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
          result.push(renderOrderDocumentRow(node, index, row));
        } else if (documentsFilter !== "changed") {
          result.push(renderOrderDocumentRow(node, index));
        } else if (gitStatusDisplay(fileTreeGitStatusByPath[node.path])) {
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

  function renderOpenDocumentTreeNodes(
    nodes: OpenDocumentTreeNode[],
    depth: number,
  ): React.ReactNode[] {
    const result: React.ReactNode[] = [];
    nodes.forEach((node) => {
      if (node.kind === "document") {
        if (documentsFilter === "changed" && !node.row.isChanged) {
          return;
        }
        result.push(renderDocumentRow(node.row, undefined, depth, false));
        return;
      }

      if (documentsFilter === "changed" && !node.hasChanged) {
        return;
      }
      const expanded = expandedDocumentOrderSections.has(node.key);
      result.push(
        renderOpenDocumentTreeDirectory({
          key: node.key,
          title: node.name,
          depth,
          collapsed: !expanded,
        }),
      );
      if (expanded) {
        result.push(...renderOpenDocumentTreeNodes(node.children, depth + 1));
      }
    });
    return result;
  }

  function renderOpenDocumentTreeDirectory({
    key,
    title,
    depth,
    collapsed,
  }: {
    key: string;
    title: string;
    depth: number;
    collapsed: boolean;
  }): React.ReactNode {
    return (
      <div
        key={key}
        className="documents-order-section documents-loaded-section"
        data-review-id="documents-loaded-section"
        data-document-order-section-state={collapsed ? "collapsed" : "expanded"}
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
        <span className="documents-order-section-label">{title}</span>
      </div>
    );
  }

  function renderDocumentOrderSectionHeader({
    key,
    title,
    depth,
    reviewId,
    collapsed,
    changeCount,
    document,
  }: {
    key: string;
    title: string;
    depth: number;
    reviewId: string;
    collapsed: boolean;
    changeCount?: number;
    document?: Extract<DocumentOrderNode, { kind: "document" }>;
  }): React.ReactNode {
    const documentRow =
      document?.status === "resolved"
        ? documentRowsByPath.get(document.path)
        : undefined;
    const documentPath = documentRow?.entry.path ?? document?.path;
    const documentOpen = documentPath
      ? openDocumentPaths.has(documentPath)
      : false;
    const documentActive = activePath === documentPath;
    const documentDisplayPath =
      document?.displayPath ?? documentRow?.relativePath;
    const sectionTitle = (
      <>
        <span className="documents-view-row-title">
          <span className="tree-label">{title}</span>
          <DocumentsChangeCountBadge count={changeCount} />
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
          <span className="documents-order-section-label">
            <span className="tree-label">{title}</span>
            <DocumentsChangeCountBadge count={changeCount} />
          </span>
        )}
      </div>
    );
  }

  function renderDocumentRow(
    row: FileTreeDocumentRow,
    titleOverride?: string,
    depth = 0,
    showOpenIndicator = true,
  ): React.ReactNode {
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
        data-document-review-target={row.isChanged ? "true" : undefined}
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
              {showOpenIndicator && row.isOpen ? (
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
              openReviewDiff(entry.path);
            }}
          >
            {row.gitStatus.shortLabel}
          </button>
        ) : null}
        {documentsFilter === "changed" && row.isChanged ? (
          <DocumentReviewRowControls
            path={entry.path}
            documentReviewSession={documentReviewSession}
          />
        ) : null}
      </div>
    );
  }

  function renderOrderDocumentRow(
    node: Extract<DocumentOrderNode, { kind: "document" }>,
    index: number,
    row?: FileTreeDocumentRow,
  ): React.ReactNode {
    const isOpen = row?.isOpen ?? openDocumentPaths.has(node.path);
    const isActive = row?.isActive ?? activePath === node.path;
    const rawGitStatus = fileTreeGitStatusByPath[node.path];
    const gitStatus = row?.gitStatus ?? gitStatusDisplay(rawGitStatus);
    const gitStatusLabel =
      row?.gitStatusLabel ??
      (gitStatus
        ? fileGitStatusBadgeLabel(gitStatus, fileName(node.path))
        : undefined);
    return (
      <div
        key={`order-${node.depth}-${index}-${node.path}`}
        className={`tree-row file documents-view-row documents-view-row-order ${isActive ? "active" : ""} ${gitStatus?.className ?? ""}`}
        data-review-id="documents-view-row"
        data-context-menu-kind="file-tree"
        data-path={node.path}
        data-entry-kind="file"
        data-git-status={gitStatus ? rawGitStatus : undefined}
        data-git-status-label={gitStatusLabel}
        data-document-review-target={gitStatus ? "true" : undefined}
        data-document-status="resolved"
        data-document-open={isOpen ? "true" : undefined}
        data-document-order-active={isActive ? "true" : undefined}
        title={gitStatus ? `${node.path} · ${gitStatus.label}` : node.path}
        aria-label={
          gitStatus
            ? `${node.title}, ${gitStatus.label}`
            : `${node.title}${isOpen ? ", open" : ""}`
        }
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
        {gitStatus ? (
          <button
            type="button"
            className={`git-status-badge git-status-diff-button ${gitStatus.className}`}
            data-review-id="git-status-diff-button"
            data-git-status-label={gitStatusLabel}
            aria-label={gitStatusLabel}
            title={gitStatusLabel}
            onClick={(event) => {
              event.stopPropagation();
              openReviewDiff(node.path);
            }}
          >
            {gitStatus.shortLabel}
          </button>
        ) : null}
        {documentsFilter === "changed" && gitStatus ? (
          <DocumentReviewRowControls
            path={node.path}
            documentReviewSession={documentReviewSession}
          />
        ) : null}
      </div>
    );
  }

  function renderMissingDocumentRow(
    node: Extract<DocumentOrderNode, { kind: "document" }>,
    index: number,
  ): React.ReactNode {
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

  function renderDocumentsSourceFilter(): React.ReactNode {
    return (
      <DocumentsSourceFilterHeader
        currentReviewPath={currentReviewPath}
        documentReviewSession={documentReviewSession}
        documentsChangedCount={documentsChangedCount}
        documentsFilter={documentsFilter}
        reviewSummary={reviewSummary}
        reviewTargetPaths={reviewTargetPaths}
        viewMode={viewMode}
        onDocumentsFilterChange={onDocumentsFilterChange}
        onOpenReviewDiff={openReviewDiff}
      />
    );
  }

  return (
    <div
      ref={documentsViewRef}
      className="documents-view"
      data-review-id="documents-view"
    >
      {renderDocumentEntries()}
    </div>
  );
}
