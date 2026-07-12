import { useMemo } from "react";
import type {
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentLinkResolution,
} from "../../../core/types";
import type { CopyText } from "../../hooks/documentLinks/types";
import { useMouseGestures } from "../../hooks/useMouseGestures";
import type { CaptureAreaVariant } from "../../lib/captureArea";
import type {
  ContextMenuItem,
  DiagramPreviewState,
  MouseGestureAutomation,
} from "../../types";
import { createDiffPreviewContextMenuHandler } from "./contextMenu";
import {
  handleDiffPanelClick,
  handleDiffPanelContextMenu,
  hasRenderedDiffSelectionAtPoint,
  shouldIgnoreDiffMouseGestureTarget,
  shouldOpenDeferredSourceContextMenuImmediately,
} from "./diffPreviewInteractionEvents";
import { dispatchDiffPreviewMouseGestureCommand } from "./mouseGestures";
import type { DiffView } from "./types";
import { useDiffPreviewGestureScroll } from "./useDiffPreviewGestureScroll";

interface UseDiffPreviewInteractionsOptions {
  changeCount: number;
  config: AppConfig | null;
  confirmExternalLink: (url: string) => Promise<boolean>;
  copyText: CopyText;
  leftRef: RefObject<HTMLDivElement | null>;
  moveChange: (offset: number) => void;
  onClearRenderedContentCursor: () => void;
  onClose: () => void;
  onOpenDiagramPreview: (preview: DiagramPreviewState) => void;
  onBeginCaptureArea?: (
    container: HTMLElement,
    variant?: CaptureAreaVariant,
  ) => void;
  openContextMenu: (
    event: MouseEvent<HTMLElement>,
    items: ContextMenuItem[],
    sourceReviewId?: string,
  ) => boolean;
  openDocument: (path: string) => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  openPathInEditor: (path: string) => Promise<void>;
  panelRef: RefObject<HTMLElement | null>;
  preview: DocumentDiffPreview;
  renderedLeftRef: RefObject<HTMLDivElement | null>;
  renderedRightRef: RefObject<HTMLDivElement | null>;
  resolveDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  rightRef: RefObject<HTMLDivElement | null>;
  setLastMouseGesture?: (gesture: MouseGestureAutomation | null) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
  view: DiffView;
}

export function useDiffPreviewInteractions({
  changeCount,
  config,
  confirmExternalLink,
  copyText,
  leftRef,
  moveChange,
  onClearRenderedContentCursor,
  onClose,
  onOpenDiagramPreview,
  onBeginCaptureArea,
  openContextMenu,
  openDocument,
  openExternalUrl,
  openPathInEditor,
  panelRef,
  preview,
  renderedLeftRef,
  renderedRightRef,
  resolveDocumentLink,
  rightRef,
  setLastMouseGesture,
  showInlineNotice,
  view,
}: UseDiffPreviewInteractionsOptions) {
  const { scrollDiffPreviewGesturePane, setMouseGestureScrollTarget } =
    useDiffPreviewGestureScroll({
      leftRef,
      panelRef,
      renderedLeftRef,
      renderedRightRef,
      rightRef,
      view,
    });
  const handleDiffContextMenu = useMemo(
    () =>
      createDiffPreviewContextMenuHandler({
        preview,
        copyText,
        openContextMenu,
        openDocument,
        openPathInEditor,
        resolveDocumentLink,
        confirmExternalLink,
        openExternalUrl,
        onOpenDiagramPreview,
        onBeginCaptureArea,
        showInlineNotice,
      }),
    [
      confirmExternalLink,
      copyText,
      onOpenDiagramPreview,
      onBeginCaptureArea,
      openContextMenu,
      openDocument,
      openExternalUrl,
      openPathInEditor,
      preview,
      resolveDocumentLink,
      showInlineNotice,
    ],
  );
  const {
    mouseGestureTrail,
    consumePendingMouseGestureContextMenu,
    handleMouseGestureContextMenu,
    handleMouseGesturePointerCancel,
    handleMouseGesturePointerDown,
    handleMouseGesturePointerMove,
    handleMouseGesturePointerUp,
  } = useMouseGestures({
    config,
    preferencesOpen: false,
    quickOpenOpen: false,
    dispatchCommand: async (commandId) =>
      dispatchDiffPreviewMouseGestureCommand({
        commandId,
        changeCount,
        moveChange,
        scrollPane: scrollDiffPreviewGesturePane,
        closePreview: onClose,
      }),
    setLastMouseGesture: setLastMouseGesture ?? (() => undefined),
  });

  function scheduleDeferredDiffContextMenu(currentTarget: HTMLElement) {
    window.setTimeout(() => {
      const pendingEvent = consumePendingMouseGestureContextMenu();
      if (
        pendingEvent?.target instanceof Node &&
        currentTarget.contains(pendingEvent.target)
      ) {
        handlePanelContextMenu(pendingEvent, true);
      }
    }, 500);
  }

  function handlePanelContextMenu(
    event: MouseEvent<HTMLElement>,
    allowPreventedEvent = false,
  ) {
    handleDiffPanelContextMenu({
      event,
      allowPreventedEvent,
      handleDiffContextMenu,
    });
  }

  function handlePanelClick(event: MouseEvent<HTMLElement>) {
    handleDiffPanelClick({
      event,
      preview,
      confirmExternalLink,
      openDocument,
      openExternalUrl,
      resolveDocumentLink,
      showInlineNotice,
    });
  }

  function handleDiffMouseGesturePointerDown(
    event: ReactPointerEvent<HTMLElement>,
  ) {
    if (shouldIgnoreDiffMouseGestureTarget(event.target)) {
      return;
    }
    setMouseGestureScrollTarget(event.target);
    handleMouseGesturePointerDown(event);
  }

  function handleDiffMouseGesturePointerUp(
    event: ReactPointerEvent<HTMLElement>,
  ) {
    const currentTarget = event.currentTarget;
    void Promise.resolve(handleMouseGesturePointerUp(event)).then((result) => {
      if (result.status !== "plain-right-click" || !result.contextMenuEvent) {
        return;
      }
      if (
        result.contextMenuEvent.target instanceof Node &&
        currentTarget.contains(result.contextMenuEvent.target)
      ) {
        handlePanelContextMenu(result.contextMenuEvent, true);
      }
    });
  }

  function handleDiffMouseGestureContextMenu(event: MouseEvent<HTMLElement>) {
    if (shouldIgnoreDiffMouseGestureTarget(event.target)) {
      return;
    }
    const target = event.target as HTMLElement;
    if (hasRenderedDiffSelectionAtPoint(target, event.clientX, event.clientY)) {
      handlePanelContextMenu(event, true);
      return;
    }
    const result = handleMouseGestureContextMenu(event);
    if (result === "ignored" || result === "plain-right-click") {
      handlePanelContextMenu(event);
    } else if (result === "deferred") {
      if (shouldOpenDeferredSourceContextMenuImmediately(event.target)) {
        handlePanelContextMenu(event, true);
      } else {
        scheduleDeferredDiffContextMenu(event.currentTarget);
      }
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button === 0) {
      onClearRenderedContentCursor();
    }
    handleDiffMouseGesturePointerDown(event);
  }

  function handleContextMenuCapture(event: MouseEvent<HTMLElement>) {
    handleDiffMouseGestureContextMenu(event);
    if (!event.defaultPrevented) {
      handlePanelContextMenu(event);
    }
  }

  return {
    handleContextMenuCapture,
    handleMouseGesturePointerCancel,
    handleMouseGesturePointerMove,
    handlePanelClick,
    handlePointerDown,
    handlePointerUp: handleDiffMouseGesturePointerUp,
    mouseGestureTrail,
  };
}
