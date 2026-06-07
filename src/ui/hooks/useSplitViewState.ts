import { useEffect, useState } from "react";
import { createEmptyPaneSnapshot } from "../lib/split";
import type {
  NavigationLocation,
  PaneId,
  SearchHitSummary,
  ViewerPaneSnapshot,
} from "../types";
import type { DocumentPayload, RenderResult } from "../../core/types";
import type { SafeHtml } from "../lib/safeHtml";

export function useSplitViewState({
  activeHeadingId,
  documentHtml,
  documentPayload,
  navigationBackStack,
  navigationForwardStack,
  query,
  renderResult,
  searchHits,
  searchIndex,
  searchQueryForPath,
  setActiveHeadingId,
  setDocumentHtml,
  setDocumentPayload,
  setNavigationBackStack,
  setNavigationForwardStack,
  setQuery,
  setRenderResult,
  setSearchHits,
  setSearchIndex,
}: {
  activeHeadingId: string | null;
  documentHtml: SafeHtml;
  documentPayload: DocumentPayload | null;
  navigationBackStack: NavigationLocation[];
  navigationForwardStack: NavigationLocation[];
  query: string;
  renderResult: RenderResult | null;
  searchHits: SearchHitSummary[];
  searchIndex: number;
  searchQueryForPath(path: string, fallbackQuery?: string): string;
  setActiveHeadingId(value: string | null): void;
  setDocumentHtml(value: SafeHtml): void;
  setDocumentPayload(value: DocumentPayload | null): void;
  setNavigationBackStack(value: NavigationLocation[]): void;
  setNavigationForwardStack(value: NavigationLocation[]): void;
  setQuery(value: string): void;
  setRenderResult(value: RenderResult | null): void;
  setSearchHits(value: SearchHitSummary[]): void;
  setSearchIndex(value: number): void;
}) {
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [focusedPaneId, setFocusedPaneId] = useState<PaneId>("left");
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [paneSnapshots, setPaneSnapshots] = useState<
    Record<PaneId, ViewerPaneSnapshot>
  >({
    left: createEmptyPaneSnapshot("left"),
    right: createEmptyPaneSnapshot("right"),
  });
  const [pendingNavigationLocation, setPendingNavigationLocation] =
    useState<NavigationLocation | null>(null);

  function currentPaneSnapshot(id: PaneId = focusedPaneId): ViewerPaneSnapshot {
    return {
      id,
      documentPayload,
      renderResult,
      documentHtml,
      query,
      searchIndex,
      searchHits,
      activeHeadingId,
      navigationBackStack,
      navigationForwardStack,
    };
  }

  function loadPaneSnapshot(snapshot: ViewerPaneSnapshot) {
    setDocumentPayload(snapshot.documentPayload);
    setRenderResult(snapshot.renderResult);
    setDocumentHtml(snapshot.documentHtml);
    setQuery(
      snapshot.documentPayload
        ? searchQueryForPath(snapshot.documentPayload.path, snapshot.query)
        : snapshot.query,
    );
    setSearchIndex(snapshot.searchIndex);
    setSearchHits(snapshot.searchHits);
    setActiveHeadingId(snapshot.activeHeadingId);
    setNavigationBackStack(snapshot.navigationBackStack);
    setNavigationForwardStack(snapshot.navigationForwardStack);
    setPendingNavigationLocation(null);
  }

  function focusPane(paneId: PaneId) {
    if (!splitEnabled || paneId === focusedPaneId) {
      return;
    }

    const currentSnapshot = currentPaneSnapshot(focusedPaneId);
    const targetSnapshot = paneSnapshots[paneId];
    setPaneSnapshots((current) => ({
      ...current,
      [focusedPaneId]: currentSnapshot,
    }));
    setFocusedPaneId(paneId);
    loadPaneSnapshot(targetSnapshot);
  }

  function snapshotForPath(path: string): PaneId | null {
    if (!splitEnabled) {
      return null;
    }
    if (documentPayload?.path === path) {
      return focusedPaneId;
    }
    const otherPaneId: PaneId = focusedPaneId === "left" ? "right" : "left";
    return paneSnapshots[otherPaneId].documentPayload?.path === path
      ? otherPaneId
      : null;
  }

  function openSplitRight() {
    if (!documentPayload) {
      return;
    }
    const leftSnapshot =
      focusedPaneId === "left"
        ? currentPaneSnapshot("left")
        : paneSnapshots.left;
    const rightSnapshot =
      focusedPaneId === "right"
        ? currentPaneSnapshot("right")
        : {
            ...currentPaneSnapshot("right"),
            id: "right" as const,
          };
    setPaneSnapshots({
      left: leftSnapshot,
      right: rightSnapshot,
    });
    setSplitEnabled(true);
    setFocusedPaneId("right");
    loadPaneSnapshot(rightSnapshot);
  }

  function closeSplitView() {
    if (!splitEnabled) {
      return;
    }
    const remainingPaneId: PaneId = focusedPaneId === "left" ? "right" : "left";
    const remainingSnapshot =
      remainingPaneId === focusedPaneId
        ? currentPaneSnapshot("left")
        : paneSnapshots[remainingPaneId];
    setSplitEnabled(false);
    setFocusedPaneId("left");
    setPaneSnapshots({
      left: { ...remainingSnapshot, id: "left" },
      right: createEmptyPaneSnapshot("right"),
    });
    loadPaneSnapshot({ ...remainingSnapshot, id: "left" });
  }

  function resetSplitToEmpty() {
    setSplitEnabled(false);
    setFocusedPaneId("left");
    setSplitRatio(0.5);
    setPaneSnapshots({
      left: createEmptyPaneSnapshot("left"),
      right: createEmptyPaneSnapshot("right"),
    });
  }

  function resetSplitToDocument(
    nextDocument: DocumentPayload,
    nextQuery: string,
  ) {
    setSplitEnabled(false);
    setFocusedPaneId("left");
    setPaneSnapshots({
      left: {
        ...createEmptyPaneSnapshot("left"),
        documentPayload: nextDocument,
        query: nextQuery,
      },
      right: createEmptyPaneSnapshot("right"),
    });
  }

  function replaceClosedDocumentInPaneSnapshots(
    closedPath: string,
    nextDocument: DocumentPayload | null,
    nextQuery: string,
  ) {
    setPaneSnapshots((current) => {
      const next = { ...current };
      for (const paneId of ["left", "right"] as const) {
        if (next[paneId].documentPayload?.path === closedPath) {
          next[paneId] = {
            ...createEmptyPaneSnapshot(paneId),
            documentPayload: nextDocument,
            query: nextQuery,
          };
        }
      }
      return next;
    });
  }

  useEffect(() => {
    setPaneSnapshots((current) => ({
      ...current,
      [focusedPaneId]: {
        id: focusedPaneId,
        documentPayload,
        renderResult,
        documentHtml,
        query,
        searchIndex,
        searchHits,
        activeHeadingId,
        navigationBackStack,
        navigationForwardStack,
      },
    }));
  }, [
    activeHeadingId,
    documentHtml,
    documentPayload,
    focusedPaneId,
    navigationBackStack,
    navigationForwardStack,
    query,
    renderResult,
    searchHits,
    searchIndex,
  ]);

  return {
    closeSplitView,
    currentPaneSnapshot,
    focusedPaneId,
    focusPane,
    loadPaneSnapshot,
    openSplitRight,
    paneSnapshots,
    pendingNavigationLocation,
    replaceClosedDocumentInPaneSnapshots,
    resetSplitToDocument,
    resetSplitToEmpty,
    setFocusedPaneId,
    setPaneSnapshots,
    setPendingNavigationLocation,
    setSplitEnabled,
    setSplitRatio,
    snapshotForPath,
    splitEnabled,
    splitRatio,
  };
}
