import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { CommandId } from "../../../core/commands";
import type { DocumentDiffStreamPreview } from "../../../core/types";
import type { ContentCursorCommandHandler } from "../../lib/contentCursor";
import type { DocumentDiffStreamCommandBridge } from "../../lib/documentDiffStreamCommands";
import type { CaptureAreaVariant } from "../../lib/captureArea";
import {
  allDiffsUiPerformanceNow,
  useAllDiffsUiPerformance,
} from "../../lib/allDiffsUiPerformance";
import { buildRenderedDiffPresentation } from "../../lib/gitRenderedDiff";
import type { DiffPreviewMouseGestureScrollAction } from "../gitDiffPreview/mouseGestures";
import type {
  DiffStreamLoadReason,
  DiffStreamTarget,
  SectionLoadState,
} from "./types";
import { diffStreamSection, scrollStreamTargetIntoView } from "./streamTargets";

export function useDocumentDiffStreamNavigation({
  contentCursorCommandRef,
  ensureSectionLoaded,
  expandSection,
  loadStates,
  loadStatesRef,
  onClose,
  panelRef,
  preview,
  streamBodyRef,
  streamCommandRef,
  beginCaptureArea,
  canCaptureArea,
}: {
  contentCursorCommandRef?: RefObject<ContentCursorCommandHandler | null>;
  ensureSectionLoaded: (key: string, reason: DiffStreamLoadReason) => boolean;
  expandSection: (key: string) => void;
  loadStates: Record<string, SectionLoadState>;
  loadStatesRef: RefObject<Record<string, SectionLoadState>>;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
  preview: DocumentDiffStreamPreview;
  streamBodyRef: RefObject<HTMLDivElement | null>;
  streamCommandRef?: RefObject<DocumentDiffStreamCommandBridge | null>;
  beginCaptureArea: (variant: CaptureAreaVariant) => boolean;
  canCaptureArea: () => boolean;
}) {
  const measurement = useAllDiffsUiPerformance();
  const [activeTarget, setActiveTarget] = useState<{
    fileIndex: number;
    changeIndex: number;
  } | null>(null);
  const pendingNavigationRef = useRef<{
    fileIndex: number;
    direction: 1 | -1;
  } | null>(null);

  const loadedTargets = useMemo(() => {
    const startedAt = measurement.enabled ? allDiffsUiPerformanceNow() : 0;
    let readyItemCount = 0;
    const targets = preview.items.flatMap((item, fileIndex) => {
      const key = item.documentPath ?? item.path;
      const state = loadStates[key];
      if (state?.status !== "ready") {
        return [];
      }
      readyItemCount += 1;
      const presentation = buildRenderedDiffPresentation(state.summary.blocks);
      return presentation.navigationTargets.map((target) => ({
        fileIndex,
        changeIndex: target.index,
        key,
        primarySide: target.primarySide,
        targetKind: target.targetKind,
      }));
    });
    if (measurement.enabled) {
      measurement.record({
        type: "presentation-rebuild",
        durationMs: allDiffsUiPerformanceNow() - startedAt,
        itemCount: preview.items.length,
        readyItemCount,
        targetCount: targets.length,
      });
    }
    return targets;
  }, [loadStates, measurement, preview.items]);

  useEffect(() => {
    if (loadedTargets.length === 0) {
      if (activeTarget) {
        setActiveTarget(null);
      }
      return;
    }
    const activeStillExists =
      activeTarget &&
      loadedTargets.some(
        (target) =>
          target.fileIndex === activeTarget.fileIndex &&
          target.changeIndex === activeTarget.changeIndex,
      );
    if (!activeStillExists) {
      setActiveTarget({
        fileIndex: loadedTargets[0].fileIndex,
        changeIndex: loadedTargets[0].changeIndex,
      });
    }
  }, [activeTarget, loadedTargets]);

  const selectTarget = useCallback(
    (target: DiffStreamTarget) => {
      setActiveTarget(target);
      scrollStreamTargetIntoView(panelRef.current, target);
    },
    [panelRef],
  );

  const moveToUnloadedDocument = useCallback(
    (direction: 1 | -1) => {
      const startIndex =
        activeTarget?.fileIndex ??
        (direction === 1 ? -1 : preview.items.length);
      for (
        let index = startIndex + direction;
        index >= 0 && index < preview.items.length;
        index += direction
      ) {
        const item = preview.items[index];
        const key = item.documentPath ?? item.path;
        const state = loadStatesRef.current[key];
        if (item.kind !== "document" || !item.documentPath) {
          continue;
        }
        if (state?.status === "ready") {
          continue;
        }
        if (state?.status === "blocked" && state.reason === "too-complex") {
          const pending = pendingNavigationRef.current;
          if (pending?.fileIndex === index) {
            pendingNavigationRef.current = null;
          }
          continue;
        }
        expandSection(key);
        const waitingForLoad =
          state?.status === "loading" || ensureSectionLoaded(key, "navigation");
        if (!waitingForLoad) {
          pendingNavigationRef.current = null;
          continue;
        }
        pendingNavigationRef.current = { fileIndex: index, direction };
        const section = diffStreamSection(panelRef.current, index);
        if (typeof section?.scrollIntoView === "function") {
          section.scrollIntoView({ block: "center" });
        }
        return true;
      }
      return false;
    },
    [
      activeTarget?.fileIndex,
      ensureSectionLoaded,
      expandSection,
      loadStatesRef,
      panelRef,
      preview.items,
    ],
  );

  const moveTarget = useCallback(
    (offset: number) => {
      const direction: 1 | -1 = offset >= 0 ? 1 : -1;
      if (loadedTargets.length === 0) {
        return moveToUnloadedDocument(direction);
      }
      const currentIndex = activeTarget
        ? loadedTargets.findIndex(
            (target) =>
              target.fileIndex === activeTarget.fileIndex &&
              target.changeIndex === activeTarget.changeIndex,
          )
        : -1;
      const candidateIndex = currentIndex + offset;
      if (candidateIndex < 0 || candidateIndex >= loadedTargets.length) {
        return moveToUnloadedDocument(direction);
      }
      selectTarget(loadedTargets[candidateIndex]);
      return true;
    },
    [activeTarget, loadedTargets, moveToUnloadedDocument, selectTarget],
  );

  useEffect(() => {
    const pending = pendingNavigationRef.current;
    if (!pending) {
      return;
    }
    const pendingItem = preview.items[pending.fileIndex];
    const pendingKey = pendingItem
      ? (pendingItem.documentPath ?? pendingItem.path)
      : null;
    const pendingState = pendingKey ? loadStates[pendingKey] : null;
    if (
      pendingState?.status === "blocked" &&
      pendingState.reason === "too-complex"
    ) {
      pendingNavigationRef.current = null;
      moveToUnloadedDocument(pending.direction);
      return;
    }
    const matchingTargets = loadedTargets.filter(
      (target) => target.fileIndex === pending.fileIndex,
    );
    if (matchingTargets.length === 0) {
      return;
    }
    pendingNavigationRef.current = null;
    selectTarget(
      pending.direction === 1
        ? matchingTargets[0]
        : matchingTargets[matchingTargets.length - 1],
    );
  }, [
    loadStates,
    loadedTargets,
    moveToUnloadedDocument,
    preview.items,
    selectTarget,
  ]);

  const scrollStream = useCallback(
    (action: DiffPreviewMouseGestureScrollAction) => {
      const pane = streamBodyRef.current;
      if (!pane) {
        return false;
      }
      const maxScrollTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
      const pageStep = Math.max(1, Math.floor(pane.clientHeight * 0.85));
      const lineStep = 96;
      const nextScrollTop =
        action === "top"
          ? 0
          : action === "bottom"
            ? maxScrollTop
            : action === "pageUp"
              ? pane.scrollTop - pageStep
              : action === "pageDown"
                ? pane.scrollTop + pageStep
                : action === "lineUp"
                  ? pane.scrollTop - lineStep
                  : pane.scrollTop + lineStep;
      pane.scrollTop = Math.max(0, Math.min(nextScrollTop, maxScrollTop));
      return true;
    },
    [streamBodyRef],
  );

  const dispatchStreamCommand = useCallback(
    (commandId: CommandId) => {
      switch (commandId) {
        case "tab.close":
        case "preferences.close":
          onClose();
          return true;
        case "viewer.contentCursor.next":
          return moveTarget(1);
        case "viewer.contentCursor.previous":
          return moveTarget(-1);
        case "viewer.scrollDown":
          return scrollStream("lineDown");
        case "viewer.scrollUp":
          return scrollStream("lineUp");
        case "viewer.pageDown":
          return scrollStream("pageDown");
        case "viewer.pageUp":
          return scrollStream("pageUp");
        case "viewer.top":
          return scrollStream("top");
        case "viewer.bottom":
          return scrollStream("bottom");
        case "viewer.captureArea":
          return beginCaptureArea("plain");
        case "viewer.captureAreaWithReference":
          return beginCaptureArea("reference");
        default:
          return false;
      }
    },
    [beginCaptureArea, moveTarget, onClose, scrollStream],
  );

  const isStreamCommandEnabled = useCallback(
    (commandId: CommandId) =>
      commandId === "viewer.captureArea" ||
      commandId === "viewer.captureAreaWithReference"
        ? canCaptureArea()
        : true,
    [canCaptureArea],
  );

  useEffect(() => {
    if (contentCursorCommandRef) {
      contentCursorCommandRef.current = (direction) =>
        moveTarget(direction === "next" ? 1 : -1);
    }
    if (streamCommandRef) {
      streamCommandRef.current = {
        dispatch: dispatchStreamCommand,
        isEnabled: isStreamCommandEnabled,
      };
    }
    return () => {
      if (contentCursorCommandRef) {
        contentCursorCommandRef.current = null;
      }
      if (streamCommandRef) {
        streamCommandRef.current = null;
      }
    };
  }, [
    contentCursorCommandRef,
    dispatchStreamCommand,
    isStreamCommandEnabled,
    moveTarget,
    streamCommandRef,
  ]);

  return {
    activeTarget,
    loadedTargets,
    moveTarget,
    scrollStream,
    selectTarget,
  };
}
