import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GitDiffStatus } from "../../../core/types";
import {
  summarizeDocumentReviewSession,
  uniqueDocumentReviewPaths,
  type DocumentReviewSessionControls,
} from "../../lib/documentReviewSession";
import {
  buildDocumentOrderChangeCounts,
  collectDocumentOrderPaths,
  type FileTreeDocumentRow,
  type OpenDocumentTreeModel,
} from "../../lib/fileTreeDocuments";
import { registerDocumentsPanelCommandBridge } from "../../lib/documentsPanelCommandBridge";
import { gitStatusDisplay } from "../../lib/gitStatusDisplay";
import type {
  ActiveDocumentOrder,
  DocumentsPanelCommands,
  FilesViewMode,
} from "./types";

export function useDocumentsViewController({
  activeDocumentOrder,
  activePath,
  autoExpandSectionKeys,
  documentReviewSession,
  documentRows,
  fileTreeGitStatusByPath,
  openDocumentTree,
  viewMode,
  onOpenGitDiff,
  onRegisterDocumentsPanelCommands,
}: {
  activeDocumentOrder: ActiveDocumentOrder;
  activePath?: string;
  autoExpandSectionKeys: ReadonlySet<string>;
  documentReviewSession: DocumentReviewSessionControls;
  documentRows: FileTreeDocumentRow[];
  fileTreeGitStatusByPath: Record<string, GitDiffStatus>;
  openDocumentTree: OpenDocumentTreeModel;
  viewMode: FilesViewMode;
  onOpenGitDiff: (path: string) => void;
  onRegisterDocumentsPanelCommands?: (
    commands: DocumentsPanelCommands | null,
  ) => void;
}) {
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

  const openReviewDiff = useCallback(
    (path: string) => {
      setReviewCursorPath(path);
      onOpenGitDiff(path);
    },
    [onOpenGitDiff],
  );
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
  const toggleDocumentOrderSection = useCallback((sectionKey: string) => {
    setExpandedDocumentOrderSections((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  }, []);

  return {
    activeDocumentOrderChangeCounts,
    currentReviewPath,
    documentsChangedCount,
    documentsViewRef,
    expandedDocumentOrderSections,
    openReviewDiff,
    reviewSummary,
    reviewTargetPaths,
    toggleDocumentOrderSection,
  };
}
