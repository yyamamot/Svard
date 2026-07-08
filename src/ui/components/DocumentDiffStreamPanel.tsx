import {
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import { RefreshCw, X } from "lucide-react";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentDiffStreamItem,
  DocumentDiffStreamPreview,
  DocumentLinkResolution,
  DocumentPayload,
  KrokiRequest,
  KrokiResult,
  LocalImageResolveContext,
  LocalImageResult,
} from "../../core/types";
import type { CommandId } from "../../core/commands";
import { documentFormatForPath } from "../../core/documentFormat";
import type { CopyText } from "../hooks/documentLinks/types";
import type { ContentCursorCommandHandler } from "../lib/contentCursor";
import type { DocumentDiffStreamCommandBridge } from "../lib/documentDiffStreamCommands";
import type { DocumentReviewSessionControls } from "../lib/documentReviewSession";
import {
  documentReviewStateLabel,
  emptyDocumentReviewSessionControls,
} from "../lib/documentReviewSession";
import {
  defaultMouseGestureConfig,
  resolveMouseGesture,
  type GesturePoint,
} from "../../core/mouseGestures";
import {
  buildRenderedDiffPresentation,
  deriveGitRenderedDiffSummary,
  isRenderedDiffPresentationChangeEntry,
} from "../lib/gitRenderedDiff";
import type {
  GitRenderedDiffSummary,
  RenderedDiffNavigationTarget,
} from "../lib/gitRenderedDiff";
import {
  RenderedDiffPane,
  renderedEntryChangeIndex,
  renderedListItemChangeIndex,
  renderedStructuredChildChangeIndex,
  renderedTableRowChangeIndex,
} from "./gitDiffPreview/renderedView";
import { MouseGestureTrail } from "./MouseGestureTrail";
import { createDiffPreviewContextMenuHandler } from "./gitDiffPreview/contextMenu";
import {
  changeRulerMarkerTopPercent,
  changeRulerTargetAnchorTop,
  type DiffChangeRulerMarkerKind,
} from "./gitDiffPreview/changeRuler";
import { resolveChangeTargetInPane } from "./gitDiffPreview/renderedChangeAnchor";
import { shouldIgnoreDiffMouseGestureTarget } from "./gitDiffPreview/diffPreviewInteractionEvents";
import { dispatchDiffPreviewMouseGestureCommand } from "./gitDiffPreview/mouseGestures";
import type {
  DiffPreviewMouseGestureScrollAction,
} from "./gitDiffPreview/mouseGestures";
import { isGestureBlockedTarget } from "../lib/path";
import type {
  ContextMenuItem,
  DiagramPreviewState,
  MouseGestureAutomation,
} from "../types";

type SectionLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      preview: DocumentDiffPreview;
      summary: GitRenderedDiffSummary;
    }
  | { status: "blocked"; message: string };

type DiffStreamViewMode = "full" | "changes";
type DiffStreamLoadReason =
  | "visible"
  | "navigation"
  | "manual-toggle"
  | "refresh";

interface DiffStreamMouseGestureSession {
  hasDragIntent: boolean;
  points: GesturePoint[];
}

type DiffStreamTarget = Pick<
  RenderedDiffNavigationTarget,
  "primarySide" | "targetKind"
> & {
  changeIndex: number;
  fileIndex: number;
  key: string;
};

interface DocumentDiffStreamPanelProps {
  config: AppConfig | null;
  preview: DocumentDiffStreamPreview;
  documentReviewSession?: DocumentReviewSessionControls;
  confirmedRemoteDiagramKeys?: ReadonlySet<string>;
  krokiFallbackDiagramKeys?: ReadonlySet<string>;
  getGitDiffPreview: (path: string) => Promise<DocumentDiffPreview>;
  copyText: CopyText;
  openContextMenu: (
    event: MouseEvent<HTMLElement>,
    items: ContextMenuItem[],
    sourceReviewId?: string,
  ) => boolean;
  openDocument: (path: string) => Promise<void>;
  openPathInEditor: (path: string) => Promise<void>;
  resolveDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  confirmExternalLink: (url: string) => Promise<boolean>;
  openExternalUrl: (url: string) => Promise<void>;
  onOpenDiagramPreview: (preview: DiagramPreviewState | null) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
  loadDocumentContext?: (
    documentPath: string,
  ) => Promise<Pick<
    DocumentPayload,
    "includeFiles" | "resourceContext" | "asciidocContext"
  > | null>;
  renderDiagram?: (request: KrokiRequest) => Promise<KrokiResult>;
  resolveLocalImage?: (
    source: string,
    documentPath: string,
    context: LocalImageResolveContext | null | undefined,
  ) => Promise<LocalImageResult>;
  setLastMouseGesture?: (gesture: MouseGestureAutomation | null) => void;
  contentCursorCommandRef?: RefObject<ContentCursorCommandHandler | null>;
  streamCommandRef?: RefObject<DocumentDiffStreamCommandBridge | null>;
  onClose: () => void;
  onRefresh?: () => void;
}

export function DocumentDiffStreamPanel({
  config,
  preview,
  documentReviewSession = emptyDocumentReviewSessionControls,
  confirmedRemoteDiagramKeys,
  krokiFallbackDiagramKeys,
  getGitDiffPreview,
  copyText,
  openContextMenu,
  openDocument,
  openPathInEditor,
  resolveDocumentLink,
  confirmExternalLink,
  openExternalUrl,
  onOpenDiagramPreview,
  showInlineNotice,
  loadDocumentContext,
  renderDiagram,
  resolveLocalImage,
  setLastMouseGesture,
  contentCursorCommandRef,
  streamCommandRef,
  onClose,
  onRefresh,
}: DocumentDiffStreamPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const streamBodyRef = useRef<HTMLDivElement | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () =>
      new Set(
        preview.items
          .filter((item) => item.kind === "document")
          .map((item) => item.documentPath ?? item.path),
      ),
  );
  const [loadStates, setLoadStates] = useState<Record<string, SectionLoadState>>(
    {},
  );
  const [activeTarget, setActiveTarget] = useState<{
    fileIndex: number;
    changeIndex: number;
  } | null>(null);
  const [viewMode, setViewMode] = useState<DiffStreamViewMode>("full");
  const [mouseGestureTrail, setMouseGestureTrail] = useState<GesturePoint[]>([]);
  const requestIds = useRef<Record<string, number>>({});
  const mouseGestureSessionRef =
    useRef<DiffStreamMouseGestureSession | null>(null);
  const suppressNextContextMenuRef = useRef(false);
  const loadQueueRef = useRef<string[]>([]);
  const inFlightLoadsRef = useRef<Set<string>>(new Set());
  const loadStatesRef = useRef<Record<string, SectionLoadState>>({});
  const pendingNavigationRef = useRef<{
    fileIndex: number;
    direction: 1 | -1;
  } | null>(null);

  useEffect(() => {
    loadStatesRef.current = loadStates;
  }, [loadStates]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const pumpLoadQueue = useCallback(() => {
    while (inFlightLoadsRef.current.size < 2 && loadQueueRef.current.length > 0) {
      const key = loadQueueRef.current.shift();
      if (!key || inFlightLoadsRef.current.has(key)) {
        continue;
      }
      const item = preview.items.find(
        (candidate) => (candidate.documentPath ?? candidate.path) === key,
      );
      if (item?.kind !== "document" || !item.documentPath) {
        continue;
      }
      const currentState = loadStatesRef.current[key];
      if (
        currentState?.status === "loading" ||
        currentState?.status === "ready"
      ) {
        continue;
      }
      const requestId = (requestIds.current[key] ?? 0) + 1;
      const documentPath = item.documentPath;
      requestIds.current[key] = requestId;
      inFlightLoadsRef.current.add(key);
      setLoadStates((current) => {
        const next = {
          ...current,
          [key]: { status: "loading" } as SectionLoadState,
        };
        loadStatesRef.current = next;
        return next;
      });
      getGitDiffPreview(documentPath)
        .then(async (diffPreview) => {
          const normalizedPreview = {
            ...diffPreview,
            source: diffPreview.source ?? "git",
            leftPath: diffPreview.leftPath ?? documentPath,
            rightPath: diffPreview.rightPath ?? documentPath,
          };
          const summary = await deriveGitRenderedDiffSummary(normalizedPreview, {
            config,
            loadDocumentContext,
            resolveLocalImage,
            renderDiagram,
            confirmedRemoteDiagramKeys,
            krokiFallbackDiagramKeys,
          });
          if (requestIds.current[key] !== requestId) {
            return;
          }
          setLoadStates((current) => {
            const next = {
              ...current,
              [key]: {
                status: "ready",
                preview: normalizedPreview,
                summary,
              } as SectionLoadState,
            };
            loadStatesRef.current = next;
            return next;
          });
          documentReviewSession.markViewed(documentPath);
        })
        .catch((error) => {
          if (requestIds.current[key] !== requestId) {
            return;
          }
          setLoadStates((current) => {
            const next = {
              ...current,
              [key]: {
                status: "blocked",
                message:
                  error instanceof Error
                    ? "This file cannot be previewed right now."
                    : "Preview failed.",
              } as SectionLoadState,
            };
            loadStatesRef.current = next;
            return next;
          });
        })
        .finally(() => {
          inFlightLoadsRef.current.delete(key);
          pumpLoadQueue();
        });
    }
  }, [
    config,
    confirmedRemoteDiagramKeys,
    documentReviewSession,
    getGitDiffPreview,
    krokiFallbackDiagramKeys,
    loadDocumentContext,
    preview.items,
    renderDiagram,
    resolveLocalImage,
  ]);

  const ensureSectionLoaded = useCallback(
    (key: string, _reason: DiffStreamLoadReason) => {
      const item = preview.items.find(
        (candidate) => (candidate.documentPath ?? candidate.path) === key,
      );
      const currentState = loadStatesRef.current[key];
      if (
        item?.kind !== "document" ||
        !item.documentPath ||
        currentState?.status === "loading" ||
        currentState?.status === "ready" ||
        loadQueueRef.current.includes(key)
      ) {
        return false;
      }
      loadQueueRef.current.push(key);
      pumpLoadQueue();
      return true;
    },
    [preview.items, pumpLoadQueue],
  );

  useEffect(() => {
    const streamBody = streamBodyRef.current;
    if (!streamBody) {
      return;
    }
    const documentKeys = preview.items
      .filter((item) => item.kind === "document" && item.documentPath)
      .map((item) => item.documentPath ?? item.path);
    if (documentKeys.length === 0) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      for (const key of documentKeys.slice(0, 2)) {
        ensureSectionLoaded(key, "visible");
      }
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const key = (entry.target as HTMLElement).dataset.streamKey;
          if (key) {
            ensureSectionLoaded(key, "visible");
          }
        }
      },
      { root: streamBody, rootMargin: "800px 0px" },
    );
    const sections = Array.from(
      streamBody.querySelectorAll<HTMLElement>(
        '[data-review-id="diff-stream-file-section"]',
      ),
    );
    for (const section of sections) {
      observer.observe(section);
    }
    return () => observer.disconnect();
  }, [ensureSectionLoaded, preview.items]);

  const loadedTargets = useMemo(
    () =>
      preview.items.flatMap((item, fileIndex) => {
        const key = item.documentPath ?? item.path;
        const state = loadStates[key];
        if (state?.status !== "ready") {
          return [];
        }
        const presentation = buildRenderedDiffPresentation(
          state.summary.blocks,
        );
        return presentation.navigationTargets.map((target) => ({
          fileIndex,
          changeIndex: target.index,
          key,
          primarySide: target.primarySide,
          targetKind: target.targetKind,
        }));
      }),
    [loadStates, preview.items],
  );

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

  const selectTarget = useCallback((target: DiffStreamTarget) => {
    setActiveTarget(target);
    scrollStreamTargetIntoView(panelRef.current, target);
  }, []);

  const moveToUnloadedDocument = useCallback(
    (direction: 1 | -1) => {
      const startIndex =
        activeTarget?.fileIndex ?? (direction === 1 ? -1 : preview.items.length);
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
        pendingNavigationRef.current = { fileIndex: index, direction };
        setExpandedPaths((current) => {
          if (current.has(key)) {
            return current;
          }
          const next = new Set(current);
          next.add(key);
          return next;
        });
        ensureSectionLoaded(key, "navigation");
        const section = diffStreamSection(panelRef.current, index);
        if (typeof section?.scrollIntoView === "function") {
          section.scrollIntoView({ block: "center" });
        }
        return true;
      }
      return false;
    },
    [activeTarget?.fileIndex, ensureSectionLoaded, preview.items],
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
      const nextIndex = candidateIndex;
      selectTarget(loadedTargets[nextIndex]);
      return true;
    },
    [activeTarget, loadedTargets, moveToUnloadedDocument, selectTarget],
  );

  useEffect(() => {
    const pending = pendingNavigationRef.current;
    if (!pending) {
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
  }, [loadedTargets, selectTarget]);

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
    [],
  );

  const markNeedsAttention = useCallback(
    (path: string) => documentReviewSession.markNeedsAttention(path),
    [documentReviewSession],
  );
  const markViewed = useCallback(
    (path: string) => documentReviewSession.markViewed(path),
    [documentReviewSession],
  );
  const resetReview = useCallback(
    (path: string) => documentReviewSession.reset(path),
    [documentReviewSession],
  );
  const toggleSection = useCallback(
    (key: string) => {
      setExpandedPaths((current) => {
        const next = new Set(current);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
          ensureSectionLoaded(key, "manual-toggle");
        }
        return next;
      });
    },
    [ensureSectionLoaded],
  );

  function mouseGestureConfig() {
    return config?.mouseGestures ?? defaultMouseGestureConfig;
  }

  function dispatchStreamMouseGesture(points: GesturePoint[]) {
    const resolution = resolveMouseGesture(
      points,
      mouseGestureConfig().minDistancePx,
      mouseGestureConfig().mappings,
    );
    if (!resolution.commandId) {
      setLastMouseGesture?.({ pattern: resolution.pattern, status: "none" });
      return;
    }
    const result = dispatchDiffPreviewMouseGestureCommand({
      commandId: resolution.commandId,
      changeCount: loadedTargets.length,
      moveChange: moveTarget,
      scrollPane: scrollStream,
      closePreview: onClose,
    });
    setLastMouseGesture?.({
      pattern: resolution.pattern,
      commandId: resolution.commandId,
      status: result.status,
    });
  }

  function dispatchStreamCommand(commandId: CommandId) {
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
      default:
        return false;
    }
  }

  useEffect(() => {
    if (contentCursorCommandRef) {
      contentCursorCommandRef.current = (direction) =>
        moveTarget(direction === "next" ? 1 : -1);
    }
    if (streamCommandRef) {
      streamCommandRef.current = {
        dispatch: dispatchStreamCommand,
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
  });

  function handleStreamMouseDown(event: MouseEvent<HTMLElement>) {
    suppressNextContextMenuRef.current = false;
    if (shouldIgnoreDiffStreamGestureTarget(event.target)) {
      return;
    }
    const mouseGestures = mouseGestureConfig();
    if (
      !mouseGestures.enabled ||
      mouseGestures.trigger !== "rightButton" ||
      event.button !== 2 ||
      isGestureBlockedTarget(event.target)
    ) {
      return;
    }
    mouseGestureSessionRef.current = {
      hasDragIntent: false,
      points: [{ x: event.clientX, y: event.clientY }],
    };
  }

  function handleStreamMouseMove(event: MouseEvent<HTMLElement>) {
    const session = mouseGestureSessionRef.current;
    if (!session) {
      return;
    }
    session.points.push({ x: event.clientX, y: event.clientY });
    const resolution = resolveMouseGesture(
      session.points,
      mouseGestureConfig().minDistancePx,
      mouseGestureConfig().mappings,
    );
    if (resolution.pattern.length === 0) {
      return;
    }
    session.hasDragIntent = true;
    if (mouseGestureConfig().showTrail) {
      setMouseGestureTrail([...session.points]);
    }
    event.preventDefault();
    event.stopPropagation();
    suppressNextContextMenuRef.current = true;
  }

  function handleStreamMouseUp(event: MouseEvent<HTMLElement>) {
    const session = mouseGestureSessionRef.current;
    if (!session) {
      return;
    }
    mouseGestureSessionRef.current = null;
    setMouseGestureTrail([]);
    if (session.hasDragIntent) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextContextMenuRef.current = true;
      dispatchStreamMouseGesture(session.points);
    } else {
      suppressNextContextMenuRef.current = false;
    }
  }

  function handleStreamContextMenu(event: MouseEvent<HTMLElement>) {
    if (shouldIgnoreDiffStreamGestureTarget(event.target)) {
      return;
    }
    if (!suppressNextContextMenuRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    suppressNextContextMenuRef.current = false;
  }

  function handleStreamMouseLeave() {
    mouseGestureSessionRef.current = null;
    setMouseGestureTrail([]);
    suppressNextContextMenuRef.current = false;
  }

  return (
    <div
      className="git-diff-backdrop expanded"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={panelRef}
        className="git-diff-panel expanded diff-stream-panel"
        data-review-id="source-control-all-diffs-panel"
        data-mouse-gestures-enabled={
          config?.mouseGestures?.enabled ? "true" : "false"
        }
        aria-label="All diffs"
        onContextMenuCapture={handleStreamContextMenu}
        onMouseDownCapture={handleStreamMouseDown}
        onMouseLeave={handleStreamMouseLeave}
        onMouseMoveCapture={handleStreamMouseMove}
        onMouseUpCapture={handleStreamMouseUp}
      >
        <MouseGestureTrail points={mouseGestureTrail} />
        <header className="git-diff-toolbar diff-stream-toolbar">
          <div className="git-diff-title">
            <span>All diffs</span>
            <small>{preview.items.length} document diffs</small>
          </div>
          <div
            className="git-diff-navigation"
            data-review-id="diff-stream-navigation"
          >
            {preview.watchStatus && preview.watchStatus !== "fresh" ? (
              <span
                className={`git-diff-watch-status ${preview.watchStatus}`}
                data-watch-status={preview.watchStatus}
              >
                {preview.watchStatus === "blocked"
                  ? "Preview refresh blocked"
                  : preview.watchStatus === "refreshing"
                    ? "Refreshing"
                    : "Stale"}
              </span>
            ) : null}
            {onRefresh ? (
              <button
                type="button"
                className="git-diff-refresh-preview-button"
                data-review-id="diff-stream-refresh"
                disabled={preview.watchStatus === "refreshing"}
                onClick={onRefresh}
              >
                <RefreshCw size={13} />
                Refresh all diffs
              </button>
            ) : null}
            <div
              className="git-diff-view-toggle diff-stream-view-toggle"
              data-review-id="diff-stream-view-toggle"
            >
              <button
                type="button"
                className={viewMode === "full" ? "active" : ""}
                data-review-id="diff-stream-full-preview-view"
                aria-pressed={viewMode === "full"}
                onClick={() => setViewMode("full")}
              >
                Full Preview
              </button>
              <button
                type="button"
                className={viewMode === "changes" ? "active" : ""}
                data-review-id="diff-stream-changes-only-view"
                aria-pressed={viewMode === "changes"}
                onClick={() => setViewMode("changes")}
              >
                Changes Only
              </button>
            </div>
            <button
              type="button"
              disabled={loadedTargets.length === 0}
              onClick={() => moveTarget(-1)}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loadedTargets.length === 0}
              onClick={() => moveTarget(1)}
            >
              Next
            </button>
            <button type="button" aria-label="Close all diffs" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        </header>
        <div className="diff-stream-body-with-ruler">
          <div ref={streamBodyRef} className="diff-stream-body">
            {preview.items.map((item, index) => (
              <DiffStreamSection
                key={`${item.status}:${item.documentPath ?? item.path}`}
                activeChangeIndex={
                  activeTarget?.fileIndex === index
                    ? activeTarget.changeIndex
                    : undefined
                }
                expanded={expandedPaths.has(item.documentPath ?? item.path)}
                index={index}
                item={item}
                loadState={loadStates[item.documentPath ?? item.path] ?? null}
                viewMode={viewMode}
                copyText={copyText}
                openContextMenu={openContextMenu}
                openDocument={openDocument}
                openPathInEditor={openPathInEditor}
                resolveDocumentLink={resolveDocumentLink}
                confirmExternalLink={confirmExternalLink}
                openExternalUrl={openExternalUrl}
                onOpenDiagramPreview={onOpenDiagramPreview}
                showInlineNotice={showInlineNotice}
                reviewState={
                  item.documentPath
                    ? documentReviewSession.stateByPath[item.documentPath]
                    : undefined
                }
                onMarkNeedsAttention={markNeedsAttention}
                onMarkViewed={markViewed}
                onResetReview={resetReview}
                onToggle={toggleSection}
              />
            ))}
          </div>
          <DiffStreamChangeRuler
            activeTarget={activeTarget}
            streamBodyRef={streamBodyRef}
            targets={loadedTargets}
            onSelectTarget={selectTarget}
          />
        </div>
      </section>
    </div>
  );
}

function shouldIgnoreDiffStreamGestureTarget(target: EventTarget | null) {
  return (
    shouldIgnoreDiffMouseGestureTarget(target) ||
    (target instanceof HTMLElement &&
      Boolean(
        target.closest(
          ".diff-stream-file-header, .diff-stream-review-actions, .git-diff-change-ruler, [data-review-id='context-menu']",
        ),
      ))
  );
}

function scrollStreamTargetIntoView(
  panel: HTMLElement | null,
  target: DiffStreamTarget,
) {
  const section = diffStreamSection(panel, target.fileIndex);
  const targetElement = diffStreamTargetElement(section, target) ?? section;
  if (typeof targetElement?.scrollIntoView === "function") {
    targetElement.scrollIntoView({ block: "center" });
  }
}

function diffStreamSection(panel: HTMLElement | null, fileIndex: number) {
  return panel?.querySelector<HTMLElement>(
    `[data-review-id="diff-stream-file-section"][data-stream-index="${fileIndex}"]`,
  );
}

function diffStreamRenderedTarget(
  section: HTMLElement | null | undefined,
  target: DiffStreamTarget,
) {
  const pane = section?.querySelector<HTMLElement>(
    `[data-review-id="diff-stream-${target.primarySide}-pane"]`,
  );
  return resolveChangeTargetInPane(pane, target.changeIndex);
}

function diffStreamBlockTarget(
  section: HTMLElement | null | undefined,
  changeIndex: number,
) {
  return (
    section?.querySelector<HTMLElement>(
      `[data-review-id="diff-stream-rendered-block"][data-change-index="${changeIndex}"].right-side`,
    ) ??
    section?.querySelector<HTMLElement>(
      `[data-review-id="diff-stream-rendered-block"][data-change-index="${changeIndex}"]`,
    )
  );
}

function diffStreamTargetElement(
  section: HTMLElement | null | undefined,
  target: DiffStreamTarget,
) {
  return (
    diffStreamRenderedTarget(section, target) ??
    diffStreamBlockTarget(section, target.changeIndex)
  );
}

interface DiffStreamRulerMarker {
  fileIndex: number;
  changeIndex: number;
  index: number;
  key: string;
  kind: DiffChangeRulerMarkerKind;
  primarySide: "left" | "right";
  targetKind: RenderedDiffNavigationTarget["targetKind"];
  topPercent: number;
}

function DiffStreamChangeRuler({
  activeTarget,
  streamBodyRef,
  targets,
  onSelectTarget,
}: {
  activeTarget: { fileIndex: number; changeIndex: number } | null;
  streamBodyRef: RefObject<HTMLDivElement | null>;
  targets: readonly DiffStreamTarget[];
  onSelectTarget: (target: DiffStreamTarget) => void;
}) {
  const [markers, setMarkers] = useState<DiffStreamRulerMarker[]>([]);

  useEffect(() => {
    const streamBody = streamBodyRef.current;
    if (!streamBody || targets.length === 0) {
      setMarkers([]);
      return;
    }
    const body = streamBody;

    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;

    function measure() {
      frame = 0;
      const nextMarkers = targets.flatMap((target, index) => {
        const section = diffStreamSection(body, target.fileIndex);
        const markerTarget = diffStreamTargetElement(section, target);
        if (!markerTarget) {
          return [];
        }
        const targetTop = changeRulerTargetAnchorTop({
          container: body,
          target: markerTarget,
        });
        return [
          {
            fileIndex: target.fileIndex,
            changeIndex: target.changeIndex,
            index,
            key: target.key,
            kind: diffStreamMarkerKind(markerTarget),
            primarySide: target.primarySide,
            targetKind: target.targetKind,
            topPercent: changeRulerMarkerTopPercent({
              scrollHeight: body.scrollHeight,
              targetTop,
            }),
          },
        ];
      });
      setMarkers(nextMarkers);
    }

    function scheduleMeasure() {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(measure);
    }

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(body);
    }
    window.addEventListener("resize", scheduleMeasure);
    scheduleMeasure();

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [streamBodyRef, targets]);

  if (targets.length === 0) {
    return null;
  }

  return (
    <div
      className="git-diff-change-ruler diff-stream-change-ruler"
      data-review-id="diff-stream-change-ruler"
      aria-label="All diffs change ruler"
    >
      {markers.map((marker) => {
        const active =
          activeTarget?.fileIndex === marker.fileIndex &&
          activeTarget.changeIndex === marker.changeIndex;
        return (
          <button
            key={`diff-stream-ruler:${marker.fileIndex}:${marker.changeIndex}`}
            type="button"
            className={`git-diff-change-ruler-marker ${marker.kind} ${
              active ? "active" : ""
            }`}
            style={{ top: `${marker.topPercent}%` }}
            data-review-id="diff-stream-change-ruler-marker"
            data-stream-index={marker.fileIndex}
            data-change-index={marker.changeIndex}
            aria-label={`Go to change ${marker.index + 1}`}
            onClick={() => onSelectTarget(marker)}
          />
        );
      })}
    </div>
  );
}

function diffStreamMarkerKind(
  target: HTMLElement,
): DiffChangeRulerMarkerKind {
  if (
    target.classList.contains("has-table-row-changes") ||
    target.querySelector('[data-review-id="git-diff-table-cell"]')
  ) {
    return "table";
  }
  if (
    target.querySelector('[data-review-id="diagram-inline-image"]') ||
    target.querySelector('[data-review-id="diagram-inline-diagnostic"]') ||
    target.querySelector(".mermaid, .plantuml, .graphviz")
  ) {
    return "diagram";
  }
  if (target.classList.contains("added")) {
    return "added";
  }
  if (target.classList.contains("removed")) {
    return "removed";
  }
  return "changed";
}

const DiffStreamSection = memo(function DiffStreamSection({
  activeChangeIndex,
  expanded,
  index,
  item,
  loadState,
  viewMode,
  copyText,
  openContextMenu,
  openDocument,
  openPathInEditor,
  resolveDocumentLink,
  confirmExternalLink,
  openExternalUrl,
  onOpenDiagramPreview,
  showInlineNotice,
  reviewState,
  onMarkNeedsAttention,
  onMarkViewed,
  onResetReview,
  onToggle,
}: {
  activeChangeIndex?: number;
  expanded: boolean;
  index: number;
  item: DocumentDiffStreamItem;
  loadState: SectionLoadState | null;
  viewMode: DiffStreamViewMode;
  copyText: CopyText;
  openContextMenu: (
    event: MouseEvent<HTMLElement>,
    items: ContextMenuItem[],
    sourceReviewId?: string,
  ) => boolean;
  openDocument: (path: string) => Promise<void>;
  openPathInEditor: (path: string) => Promise<void>;
  resolveDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  confirmExternalLink: (url: string) => Promise<boolean>;
  openExternalUrl: (url: string) => Promise<void>;
  onOpenDiagramPreview: (preview: DiagramPreviewState | null) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
  reviewState?: "unreviewed" | "viewed" | "needs-attention";
  onMarkNeedsAttention: (path: string) => void;
  onMarkViewed: (path: string) => void;
  onResetReview: (path: string) => void;
  onToggle: (key: string) => void;
}) {
  const key = item.documentPath ?? item.path;
  const stateLabel = documentReviewStateLabel(reviewState);
  const formatLabel = item.documentPath
    ? documentFormatLabel(documentFormatForPath(item.documentPath))
    : null;
  return (
    <section
      className={`diff-stream-file-section ${item.kind}`}
      data-review-id={
        item.kind === "document"
          ? "diff-stream-file-section"
          : "diff-stream-blocker-row"
      }
      data-stream-index={index}
      data-stream-key={key}
      data-expanded={expanded ? "true" : "false"}
      data-load-status={loadState?.status ?? "idle"}
    >
      <header className="diff-stream-file-header">
        <button type="button" onClick={() => onToggle(key)} aria-expanded={expanded}>
          {expanded ? "-" : "+"}
        </button>
        <div className="diff-stream-file-title">
          <strong>{item.path}</strong>
          <span>
            {formatLabel ? `${formatLabel} - ${item.status}` : item.status}
          </span>
        </div>
        {item.kind === "document" && item.documentPath ? (
          <div className="diff-stream-review-actions">
            <span
              className={`document-review-state document-review-state-${reviewState ?? "unreviewed"}`}
              data-review-id="document-review-state"
            >
              {stateLabel}
            </span>
            <button type="button" onClick={() => onMarkViewed(item.documentPath!)}>
              Mark viewed
            </button>
            <button
              type="button"
              onClick={() => onMarkNeedsAttention(item.documentPath!)}
            >
              Needs attention
            </button>
            <button
              type="button"
              onClick={() => onResetReview(item.documentPath!)}
            >
              Reset
            </button>
          </div>
        ) : null}
      </header>
      {item.kind === "blocker" ? (
        <p className="diff-stream-blocker-message">
          {item.reason ?? "This file cannot be rendered in All diffs."}
        </p>
      ) : expanded ? (
        loadState?.status === "ready" ? (
          <DiffStreamRenderedSection
            activeChangeIndex={activeChangeIndex}
            preview={loadState.preview}
            summary={loadState.summary}
            viewMode={viewMode}
            copyText={copyText}
            openContextMenu={openContextMenu}
            openDocument={openDocument}
            openPathInEditor={openPathInEditor}
            resolveDocumentLink={resolveDocumentLink}
            confirmExternalLink={confirmExternalLink}
            openExternalUrl={openExternalUrl}
            onOpenDiagramPreview={onOpenDiagramPreview}
            showInlineNotice={showInlineNotice}
          />
        ) : loadState?.status === "blocked" ? (
          <p className="diff-stream-blocker-message">{loadState.message}</p>
        ) : loadState?.status === "loading" ? (
          <p className="diff-stream-loading">Loading rendered diff</p>
        ) : (
          null
        )
      ) : null}
    </section>
  );
});

function documentFormatLabel(format: ReturnType<typeof documentFormatForPath>) {
  return format === "asciidoc" ? "AsciiDoc" : "Markdown";
}

const DiffStreamRenderedSection = memo(function DiffStreamRenderedSection({
  activeChangeIndex,
  preview,
  summary,
  viewMode,
  copyText,
  openContextMenu,
  openDocument,
  openPathInEditor,
  resolveDocumentLink,
  confirmExternalLink,
  openExternalUrl,
  onOpenDiagramPreview,
  showInlineNotice,
}: {
  activeChangeIndex?: number;
  preview: DocumentDiffPreview;
  summary: GitRenderedDiffSummary;
  viewMode: DiffStreamViewMode;
  copyText: CopyText;
  openContextMenu: (
    event: MouseEvent<HTMLElement>,
    items: ContextMenuItem[],
    sourceReviewId?: string,
  ) => boolean;
  openDocument: (path: string) => Promise<void>;
  openPathInEditor: (path: string) => Promise<void>;
  resolveDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  confirmExternalLink: (url: string) => Promise<boolean>;
  openExternalUrl: (url: string) => Promise<void>;
  onOpenDiagramPreview: (preview: DiagramPreviewState | null) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}) {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const pendingContextMenuRef = useRef<{
    container: HTMLElement;
    event: MouseEvent<HTMLElement>;
    side: "left" | "right";
  } | null>(null);
  const presentation = useMemo(
    () => buildRenderedDiffPresentation(summary.blocks),
    [summary.blocks],
  );
  const changedEntries = useMemo(
    () => presentation.entries.filter(isRenderedDiffPresentationChangeEntry),
    [presentation.entries],
  );
  const visibleEntries =
    viewMode === "full" ? presentation.entries : changedEntries;
  const renderedEntrySyncIndexes = useMemo(
    () =>
      new Map(presentation.entries.map((entry, index) => [entry.id, index])),
    [presentation.entries],
  );
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
        showInlineNotice,
      }),
    [
      confirmExternalLink,
      copyText,
      onOpenDiagramPreview,
      openContextMenu,
      openDocument,
      openExternalUrl,
      openPathInEditor,
      preview,
      resolveDocumentLink,
      showInlineNotice,
    ],
  );
  const documentFormat = documentFormatForPath(preview.relativePath ?? "");
  const documentClassName = `markup-document format-${documentFormat}${
    documentFormat === "markdown" ? " markdown-body" : ""
  }`;

  function renderedPaneContext(target: EventTarget | null): {
    container: HTMLElement;
    side: "left" | "right";
  } | null {
    if (!(target instanceof HTMLElement)) {
      return null;
    }
    const pane = target.closest<HTMLElement>(".git-rendered-pane");
    if (!pane) {
      return null;
    }
    return {
      container: pane,
      side:
        pane.dataset.reviewId === "diff-stream-left-pane" ? "left" : "right",
    };
  }

  function handleRenderedContextMenuCapture(event: MouseEvent<HTMLElement>) {
    const context = renderedPaneContext(event.target);
    if (!context) {
      return;
    }
    if (event.buttons === 0) {
      pendingContextMenuRef.current = null;
      return;
    }
    pendingContextMenuRef.current = {
      container: context.container,
      event,
      side: context.side,
    };
    event.preventDefault();
    event.stopPropagation();
  }

  function handleRenderedMouseUpCapture(event: MouseEvent<HTMLElement>) {
    if (event.button !== 2) {
      return;
    }
    const pending = pendingContextMenuRef.current;
    if (!pending) {
      return;
    }
    pendingContextMenuRef.current = null;
    if (
      pending.event.target instanceof Node &&
      event.currentTarget.contains(pending.event.target)
    ) {
      handleDiffContextMenu(
        pending.event,
        pending.side,
        "rendered",
        pending.container,
      );
    }
  }

  if (summary.fallbackMessage && changedEntries.length === 0) {
    return <p className="diff-stream-blocker-message">{summary.fallbackMessage}</p>;
  }
  if (visibleEntries.length === 0) {
    return <p className="diff-stream-blocker-message">No rendered changes.</p>;
  }
  return (
    <div
      className="git-rendered-diff-body diff-stream-rendered-body"
      data-review-id="diff-stream-rendered-body"
      onContextMenuCapture={handleRenderedContextMenuCapture}
      onMouseUpCapture={handleRenderedMouseUpCapture}
    >
      <RenderedDiffPane
        label={preview.leftLabel}
        entries={visibleEntries}
        side="left"
        paneRef={leftRef}
        reviewId="diff-stream-left-pane"
        blockReviewId="diff-stream-rendered-block"
        documentClassName={documentClassName}
        documentFormat={documentFormat}
        activeChangeIndex={activeChangeIndex}
        focusTableRows={true}
        showBlockMeta={viewMode !== "full"}
        inlineDiagnostics={presentation.inlineDiagnostics}
        onContextMenu={(event) =>
          handleDiffContextMenu(event, "left", "rendered", event.currentTarget)
        }
        changeIndexForEntry={(entry) =>
          renderedEntryChangeIndex(presentation, entry, "left")
        }
        changeIndexForListItem={(entry, itemIndex) =>
          renderedListItemChangeIndex(presentation, entry, "left", itemIndex)
        }
        changeIndexForStructuredChild={(entry, childIndex) =>
          renderedStructuredChildChangeIndex(
            presentation,
            entry,
            "left",
            childIndex,
          )
        }
        changeIndexForTableRow={(entry, rowIndex) =>
          renderedTableRowChangeIndex(presentation, entry, "left", rowIndex)
        }
        syncIndexForEntry={(entry) => renderedEntrySyncIndexes.get(entry.id) ?? 0}
        onScroll={() => undefined}
      />
      <RenderedDiffPane
        label={preview.rightLabel}
        entries={visibleEntries}
        side="right"
        paneRef={rightRef}
        reviewId="diff-stream-right-pane"
        blockReviewId="diff-stream-rendered-block"
        documentClassName={documentClassName}
        documentFormat={documentFormat}
        activeChangeIndex={activeChangeIndex}
        focusTableRows={true}
        showBlockMeta={viewMode !== "full"}
        inlineDiagnostics={presentation.inlineDiagnostics}
        onContextMenu={(event) =>
          handleDiffContextMenu(event, "right", "rendered", event.currentTarget)
        }
        changeIndexForEntry={(entry) =>
          renderedEntryChangeIndex(presentation, entry, "right")
        }
        changeIndexForListItem={(entry, itemIndex) =>
          renderedListItemChangeIndex(presentation, entry, "right", itemIndex)
        }
        changeIndexForStructuredChild={(entry, childIndex) =>
          renderedStructuredChildChangeIndex(
            presentation,
            entry,
            "right",
            childIndex,
          )
        }
        changeIndexForTableRow={(entry, rowIndex) =>
          renderedTableRowChangeIndex(presentation, entry, "right", rowIndex)
        }
        syncIndexForEntry={(entry) => renderedEntrySyncIndexes.get(entry.id) ?? 0}
        onScroll={() => undefined}
      />
    </div>
  );
});
