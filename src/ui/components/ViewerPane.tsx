import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  MouseEvent,
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { StartPage } from "./StartPage";
import { MouseGestureTrail } from "./MouseGestureTrail";
import { SearchHitRuler } from "./SearchHitRuler";
import { PostDiffGitMarkers } from "./PostDiffGitMarkers";
import { CaptureAreaOverlay } from "./CaptureAreaOverlay";
import { fileName } from "../lib/path";
import { detectPlatform } from "../../core/keybindings";
import {
  perfBasename,
  perfDuration,
  perfNow,
  perfTraceEnabled,
  tracePerf,
} from "../lib/perfTrace";
import { setElementSafeHtml, unwrapSafeHtml } from "../lib/safeHtml";
import type { SafeHtml } from "../lib/safeHtml";
import {
  countInlineRasterDataUrls,
  hydrateResolvedLocalRasterPayloads,
} from "../lib/resolvedLocalRasterPayloads";
import {
  setArticleLayoutState,
  waitForArticleLayoutStability,
} from "../lib/articleLayoutStability";
import { traceCommittedImageDecode } from "../lib/renderCriticalPathTrace";
import type { CommandId } from "../../core/commands";
import type {
  CaptureAreaRect,
  CaptureAreaRequest,
  CaptureAreaVariant,
} from "../lib/captureArea";
import type {
  AppConfig,
  BookmarkEntry,
  DocumentPayload,
  DocumentSelectionSnapshot,
} from "../../core/types";
import type { GesturePoint } from "../../core/mouseGestures";
import type {
  MouseGestureContextMenuResult,
  MouseGesturePointerUpResult,
} from "../hooks/useMouseGestures";
import type {
  InlineNotice,
  LightweightActionFeedback,
  PaneId,
  SearchHitSummary,
  ResolveRevisionLensTargets,
  ViewerPaneSnapshot,
  ViewerPostDiffGitMarkerContext,
} from "../types";
import {
  extractDocumentSelection,
  selectionOriginalTextReference,
  selectionPlainCopy,
  selectionSnapshotText,
  selectionTextReference,
} from "../lib/documentSelection";
import { useSelectionRangeController } from "../hooks/useSelectionRangeController";
import { useSelectionSnapshotActions } from "../hooks/useSelectionSnapshotActions";
import { SelectionMiniToolbar } from "./SelectionMiniToolbar";

export const loadingMessageDelayMs = 200;
const wheelZoomDeltaThreshold = 80;

interface ViewerPaneProps {
  articleRef?: RefObject<HTMLElement | null>;
  config: AppConfig | null;
  error: string | null;
  inlineNotice: InlineNotice | null;
  lightweightActionFeedback: LightweightActionFeedback | null;
  isLoading: boolean;
  mouseGestureTrail: GesturePoint[];
  paneId: PaneId;
  snapshot: ViewerPaneSnapshot;
  splitEnabled: boolean;
  focusedPaneId: PaneId;
  centeredContentWidth?: number | null;
  hideStatusFeedback?: boolean;
  documentPayload: DocumentPayload | null;
  documentRenderRevision?: number;
  renderResult: ViewerPaneSnapshot["renderResult"];
  documentHtml: SafeHtml;
  postDiffGitMarkers: ViewerPostDiffGitMarkerContext | null;
  resolveRevisionLensTargets?: ResolveRevisionLensTargets;
  captureAreaRequest?: CaptureAreaRequest | null;
  query: string;
  searchHits: SearchHitSummary[];
  searchIndex: number;
  viewerRef?: RefObject<HTMLElement | null>;
  onArticleClick: (event: MouseEvent<HTMLElement>) => void;
  onArticleLinkCapture: (event: MouseEvent<HTMLElement>) => void;
  onArticleContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onArticleDoubleClick: (event: MouseEvent<HTMLElement>) => void;
  onArticleBlur: (event: ReactFocusEvent<HTMLElement>) => void;
  onArticleFocus: (event: ReactFocusEvent<HTMLElement>) => void;
  onArticlePointerLeave: () => void;
  onArticlePointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onCaptureArea?: (
    rect: CaptureAreaRect,
    captureTarget?: HTMLElement,
    variant?: CaptureAreaVariant,
  ) => Promise<void>;
  onClearContentCursor: () => void;
  onDismissInlineNotice: () => void;
  onDispatchCommand: (commandId: CommandId) => void;
  onFocusPane: (paneId: PaneId) => void;
  onActivateSearchHit: (index: number) => void;
  onMouseGestureContextMenu: (
    event: MouseEvent<HTMLElement>,
  ) => MouseGestureContextMenuResult;
  onConsumePendingMouseGestureContextMenu: () => MouseEvent<HTMLElement> | null;
  onMouseGesturePointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onMouseGesturePointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onMouseGesturePointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onMouseGesturePointerUp: (
    event: ReactPointerEvent<HTMLElement>,
  ) => MouseGesturePointerUpResult | Promise<MouseGesturePointerUpResult>;
  onOpenDirectory: (path: string) => void;
  onOpenDocument: (path: string) => void;
  onPickDirectory: () => void;
  onPickDocument: () => void;
  onClearRecentDocuments: () => void;
  onClearRecentDirectories: () => void;
  onAddAgentSelection?: (snapshot: DocumentSelectionSnapshot) => void;
  onShowSelectionNotice?: (message: string) => void;
}

export function ViewerPane({
  articleRef,
  config,
  error,
  inlineNotice,
  lightweightActionFeedback,
  isLoading,
  mouseGestureTrail,
  paneId,
  snapshot,
  splitEnabled,
  focusedPaneId,
  centeredContentWidth,
  hideStatusFeedback = false,
  documentPayload,
  documentRenderRevision = 0,
  renderResult,
  documentHtml,
  postDiffGitMarkers,
  captureAreaRequest = null,
  query,
  searchHits,
  searchIndex,
  viewerRef,
  onArticleClick,
  onArticleLinkCapture,
  onArticleContextMenu,
  onArticleDoubleClick,
  onArticleBlur,
  onArticleFocus,
  onArticlePointerLeave,
  onArticlePointerMove,
  onCaptureArea = async () => undefined,
  onClearContentCursor,
  onDismissInlineNotice,
  onDispatchCommand,
  onFocusPane,
  onActivateSearchHit,
  onMouseGestureContextMenu,
  onConsumePendingMouseGestureContextMenu,
  onMouseGesturePointerCancel,
  onMouseGesturePointerDown,
  onMouseGesturePointerMove,
  onMouseGesturePointerUp,
  onOpenDirectory,
  onOpenDocument,
  onPickDirectory,
  onPickDocument,
  onClearRecentDocuments,
  onClearRecentDirectories,
  onAddAgentSelection,
  onShowSelectionNotice,
  resolveRevisionLensTargets,
}: ViewerPaneProps) {
  const isFocused = !splitEnabled || paneId === focusedPaneId;
  const payload = isFocused ? documentPayload : snapshot.documentPayload;
  const result = isFocused ? renderResult : snapshot.renderResult;
  const html = isFocused ? documentHtml : snapshot.documentHtml;
  const articleRenderIdentity = isFocused
    ? String(documentRenderRevision)
    : (payload?.updatedAt ?? "snapshot");
  const paneTitle = payload ? fileName(payload.path) : "Empty";
  const asciidocThemeClass =
    payload?.format === "asciidoc"
      ? ` asciidoc-theme-${config?.reader.asciidocTheme ?? "antora"}`
      : "";
  const [showLoadingMessage, setShowLoadingMessage] = useState(false);
  const articleNodeRef = useRef<HTMLElement | null>(null);
  const layoutCommitSequenceRef = useRef(0);
  const renderCountRef = useRef(0);
  const previousDebugSnapshotRef = useRef<{
    html: SafeHtml;
    isLoading: boolean;
    path: string | null;
    result: ViewerPaneSnapshot["renderResult"];
    searchIndex: number;
  } | null>(null);
  const wheelZoomDeltaRef = useRef(0);
  const handledCaptureAreaRequestRef = useRef(0);
  const [captureAreaActive, setCaptureAreaActive] = useState(false);
  const [captureAreaVariant, setCaptureAreaVariant] =
    useState<CaptureAreaVariant>("plain");
  const [inspectedSelection, setInspectedSelection] =
    useState<DocumentSelectionSnapshot | null>(null);
  const selectionScenario = new URLSearchParams(window.location.search);
  const selectionScenarioId = selectionScenario.get("scenario") ?? "";
  const selectionInspectorEnabled =
    selectionScenarioId.includes("selection-extraction") ||
    (import.meta.env.DEV &&
      selectionScenario.get("selectionInspector") === "1");
  const platform = useMemo(() => detectPlatform(), []);
  const setArticleNode = useCallback(
    (node: HTMLElement | null) => {
      articleNodeRef.current = node;

      if (!isFocused || !articleRef) {
        return;
      }

      (articleRef as { current: HTMLElement | null }).current = node;
    },
    [articleRef, isFocused],
  );

  const showSelectionNotice = useCallback(
    (message: string) => onShowSelectionNotice?.(message),
    [onShowSelectionNotice],
  );
  const resolveViewerSelection = useCallback(
    (range: Range, article: HTMLElement) => {
      if (
        !payload ||
        !result ||
        !article.contains(range.startContainer) ||
        !article.contains(range.endContainer)
      ) {
        return {};
      }
      return {
        selection: {
          bounds: article.closest<HTMLElement>(".viewer-pane") ?? article,
          context: {
            article,
            document: payload,
            renderResult: result,
          },
        },
      };
    },
    [payload, result],
  );
  const documentSelection = useSelectionRangeController({
    enabled: isFocused && Boolean(payload && result),
    isPointerSelectionTarget: (target, article) => article.contains(target),
    resetKey: `${payload?.path ?? ""}:${articleRenderIdentity}`,
    resolveSelection: resolveViewerSelection,
    rootRef: articleNodeRef,
    showNotice: showSelectionNotice,
  });
  const prepareViewerSelection = useCallback(
    async (
      active: NonNullable<typeof documentSelection.active>,
    ): Promise<DocumentSelectionSnapshot> =>
      extractDocumentSelection({
        article: active.context.article,
        document: active.context.document,
        range: active.range.cloneRange(),
        renderResult: active.context.renderResult,
      }),
    [],
  );
  const attachViewerSelection = useCallback(
    (snapshot: DocumentSelectionSnapshot) => {
      setInspectedSelection(snapshot);
      onAddAgentSelection?.(snapshot);
    },
    [onAddAgentSelection],
  );
  const selectionActions = useSelectionSnapshotActions({
    active: documentSelection.active,
    canAsk: Boolean(onAddAgentSelection),
    dismissSelection: documentSelection.dismiss,
    onAddSelection: attachViewerSelection,
    prepareSnapshot: prepareViewerSelection,
    showNotice: showSelectionNotice,
  });

  useEffect(() => {
    setInspectedSelection(null);
  }, [articleRenderIdentity, payload?.path]);

  useEffect(() => {
    renderCountRef.current += 1;
    const previous = previousDebugSnapshotRef.current;
    const path = payload?.path ?? null;
    tracePerf("viewer.render", {
      paneId,
      focused: isFocused,
      count: renderCountRef.current,
      basename: perfBasename(path),
      format: payload?.format ?? null,
      htmlChanged: previous ? previous.html !== html : true,
      loadingChanged: previous ? previous.isLoading !== isLoading : true,
      pathChanged: previous ? previous.path !== path : true,
      resultChanged: previous ? previous.result !== result : true,
      searchIndexChanged: previous
        ? previous.searchIndex !== searchIndex
        : true,
      searchHitCount: searchHits.length,
    });
    previousDebugSnapshotRef.current = {
      html,
      isLoading,
      path,
      result,
      searchIndex,
    };
  });

  const documentPath = payload?.path ?? null;
  const documentFormat = payload?.format ?? null;
  const hasRenderResult = result !== null;
  const activePostDiffGitMarkers: ViewerPostDiffGitMarkerContext | null =
    config?.experimental.postDiffGitMarkers &&
    payload &&
    postDiffGitMarkers?.documentPath === payload.path &&
    (postDiffGitMarkers.documentUpdatedAt ?? null) ===
      (payload.updatedAt ?? null)
      ? postDiffGitMarkers
      : null;

  useLayoutEffect(() => {
    const article = articleNodeRef.current;
    if (!article || !hasRenderResult || !documentPath || !documentFormat) {
      return;
    }

    const startedAt = perfNow();
    const criticalPathTracingEnabled = perfTraceEnabled();
    const layoutCommitSequence = layoutCommitSequenceRef.current + 1;
    layoutCommitSequenceRef.current = layoutCommitSequence;
    tracePerf("render.articleRefReady", {
      basename: perfBasename(documentPath),
      format: documentFormat,
      durationMs: 0,
    });
    tracePerf("render.layoutEffect.start", {
      basename: perfBasename(documentPath),
      format: documentFormat,
      durationMs: 0,
    });
    setElementSafeHtml(article, html);
    const inlineRasterDataUrlCount = criticalPathTracingEnabled
      ? countInlineRasterDataUrls(article)
      : 0;
    const rasterSidecarResult = hydrateResolvedLocalRasterPayloads(
      article,
      result,
    );
    if (criticalPathTracingEnabled) {
      tracePerf("render.rasterSidecar.complete", {
        hydratedCount: rasterSidecarResult.hydratedCount,
        inlineRasterDataUrlCount,
        status: rasterSidecarResult.status,
      });
    }
    const commitCompletedAt = perfNow();
    article.dataset.renderedDocumentPath = documentPath;
    article.dataset.renderRevision = articleRenderIdentity;
    article.dataset.layoutCommit = String(layoutCommitSequence);
    setArticleLayoutState(article, articleRenderIdentity, "pending");
    tracePerf("render.articleInnerHtmlCommit", {
      basename: perfBasename(documentPath),
      format: documentFormat,
      bytes: unwrapSafeHtml(html).length,
      durationMs: Number((commitCompletedAt - startedAt).toFixed(2)),
    });
    tracePerf("render.layoutEffect.done", {
      basename: perfBasename(documentPath),
      format: documentFormat,
      durationMs: perfDuration(startedAt),
    });
    const isCurrentLayoutCommit = () =>
      articleNodeRef.current === article &&
      article.dataset.renderRevision === articleRenderIdentity &&
      article.dataset.layoutCommit === String(layoutCommitSequence) &&
      layoutCommitSequenceRef.current === layoutCommitSequence;
    void traceCommittedImageDecode({
      article,
      commitCompletedAt,
      isCurrent: isCurrentLayoutCommit,
    });
    let layoutFrameCount = 0;
    const commitFrameDurations: number[] = [];
    const cancelLayoutWait = waitForArticleLayoutStability({
      article,
      isCurrent: isCurrentLayoutCommit,
      onFrame: criticalPathTracingEnabled
        ? (frameCount) => {
            layoutFrameCount = frameCount;
            if (frameCount <= 2) {
              commitFrameDurations[frameCount - 1] =
                perfDuration(commitCompletedAt);
            }
          }
        : undefined,
      onComplete: (state) => {
        setArticleLayoutState(article, articleRenderIdentity, state);
        if (criticalPathTracingEnabled) {
          commitFrameDurations.forEach((durationMs, index) => {
            tracePerf("render.commitFrame", {
              durationMs,
              frame: index + 1,
              status: "measured",
            });
          });
          tracePerf("render.layoutStability", {
            durationMs: perfDuration(commitCompletedAt),
            frameCount: layoutFrameCount,
            status: state,
          });
        }
        tracePerf("render.postCommitAnimationFrame", {
          basename: perfBasename(documentPath),
          format: documentFormat,
          durationMs: perfDuration(startedAt),
          layoutState: state,
        });
        tracePerf("workspaceBoot.firstDocumentFrame", {
          durationMs: perfDuration(startedAt),
          status: state,
        });
      },
    });
    return () => {
      cancelLayoutWait();
    };
  }, [
    articleRenderIdentity,
    documentFormat,
    documentPath,
    hasRenderResult,
    html,
    result,
  ]);

  useEffect(() => {
    if (!isLoading) {
      setShowLoadingMessage(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowLoadingMessage(true);
    }, loadingMessageDelayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isLoading]);

  const handleArticleWheel = useCallback(
    (event: WheelEvent) => {
      tracePerf("viewer.articleWheel", {
        paneId,
        focused: isFocused,
        basename: perfBasename(payload?.path),
        deltaX: Number(event.deltaX.toFixed(2)),
        deltaY: Number(event.deltaY.toFixed(2)),
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
      });
      if (!isFocused || !config?.zoomWithMouseWheel) {
        wheelZoomDeltaRef.current = 0;
        return;
      }

      const hasZoomModifier =
        platform === "mac" ? event.metaKey : event.ctrlKey;
      if (!hasZoomModifier) {
        wheelZoomDeltaRef.current = 0;
        return;
      }

      event.preventDefault();
      wheelZoomDeltaRef.current += event.deltaY;
      if (Math.abs(wheelZoomDeltaRef.current) < wheelZoomDeltaThreshold) {
        return;
      }

      const currentZoom = config.zoom ?? 100;
      const commandId: CommandId =
        wheelZoomDeltaRef.current < 0 ? "zoom.in" : "zoom.out";
      wheelZoomDeltaRef.current = 0;
      if (commandId === "zoom.in" && currentZoom >= 140) {
        return;
      }
      if (commandId === "zoom.out" && currentZoom <= 80) {
        return;
      }
      onDispatchCommand(commandId);
    },
    [
      config?.zoom,
      config?.zoomWithMouseWheel,
      isFocused,
      onDispatchCommand,
      paneId,
      payload?.path,
      platform,
    ],
  );

  useEffect(() => {
    const article = articleNodeRef.current;
    if (!article || !isFocused) {
      return;
    }

    article.addEventListener("wheel", handleArticleWheel, { passive: false });
    return () => {
      article.removeEventListener("wheel", handleArticleWheel);
    };
  }, [handleArticleWheel, isFocused, html]);

  useEffect(() => {
    // Capture applies to the document that was visible when the command was
    // issued. Do not leave the mode active when the focused pane loads a
    // different file from the tree or another navigation action.
    setCaptureAreaActive(false);
  }, [payload?.path]);

  useEffect(() => {
    if (
      !captureAreaRequest ||
      captureAreaRequest.id === handledCaptureAreaRequestRef.current ||
      !isFocused ||
      !payload ||
      !result
    ) {
      return;
    }
    handledCaptureAreaRequestRef.current = captureAreaRequest.id;
    setCaptureAreaVariant(captureAreaRequest.variant);
    setCaptureAreaActive(true);
  }, [captureAreaRequest, isFocused, payload, result]);

  function handlePaneArticleLinkCapture(event: MouseEvent<HTMLElement>) {
    if (isFocused) {
      onArticleLinkCapture(event);
      return;
    }
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("a[href]") &&
      event.currentTarget.contains(target)
    ) {
      event.preventDefault();
      event.stopPropagation();
      onFocusPane(paneId);
    }
  }

  return (
    <section
      ref={isFocused ? viewerRef : undefined}
      className={`viewer-shell viewer-pane ${isFocused ? "focused" : ""} ${
        centeredContentWidth ? "zen-centered-content" : ""
      }`}
      data-review-id={
        isFocused ? "document-viewer" : "document-viewer-secondary"
      }
      data-pane-id={paneId}
      data-capture-document-path={payload?.path}
      tabIndex={0}
      onFocus={() => onFocusPane(paneId)}
      onPointerDown={(event) => {
        onFocusPane(paneId);
        onClearContentCursor();
        if (isFocused) {
          onMouseGesturePointerDown(event);
        }
      }}
      onPointerMove={isFocused ? onMouseGesturePointerMove : undefined}
      onPointerUp={
        isFocused
          ? (event) => {
              const currentTarget = event.currentTarget;
              void Promise.resolve(onMouseGesturePointerUp(event)).then(
                (result) => {
                  if (
                    result.status !== "plain-right-click" ||
                    !result.contextMenuEvent
                  ) {
                    return;
                  }
                  const article = currentTarget.querySelector(
                    '[data-review-id="document-body"]',
                  );
                  if (
                    article instanceof HTMLElement &&
                    result.contextMenuEvent.target instanceof Node &&
                    article.contains(result.contextMenuEvent.target)
                  ) {
                    onArticleContextMenu(result.contextMenuEvent);
                  }
                },
              );
            }
          : undefined
      }
      onPointerCancel={isFocused ? onMouseGesturePointerCancel : undefined}
      onContextMenu={isFocused ? onMouseGestureContextMenu : undefined}
    >
      {splitEnabled && (
        <div className="viewer-pane-header" data-review-id="viewer-pane-header">
          <span>{paneTitle}</span>
          <button
            type="button"
            className="icon-button"
            data-review-id="split-pane-close"
            aria-label="Close split pane"
            title="Close split pane"
            onClick={() => onDispatchCommand("view.closeSplit")}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {isFocused && <MouseGestureTrail points={mouseGestureTrail} />}
      {isFocused && documentSelection.active ? (
        <SelectionMiniToolbar
          toolbarRef={documentSelection.toolbarRef}
          placement={documentSelection.active}
          canAsk={Boolean(onAddAgentSelection)}
          menuOpen={Boolean(selectionActions.menuSnapshot)}
          onAsk={() => void selectionActions.ask()}
          onCopy={() => void selectionActions.copy(selectionPlainCopy)}
          onToggleMenu={() => void selectionActions.toggleMenu()}
          actions={[
            selectionActions.textReferenceAction(selectionTextReference),
            ...(payload &&
            selectionActions.menuSnapshot &&
            selectionOriginalTextReference(
              selectionActions.menuSnapshot,
              payload.source,
            )
              ? [
                  {
                    id: "original-text-reference",
                    label: "Copy Original Text Reference",
                    onSelect: () =>
                      void selectionActions.copy((snapshot) =>
                        selectionOriginalTextReference(
                          snapshot,
                          payload.source,
                        ),
                      ),
                  },
                ]
              : []),
            ...(selectionInspectorEnabled && selectionActions.menuSnapshot
              ? [
                  {
                    id: "inspect-selection",
                    label: "Inspect Selection",
                    onSelect: () => {
                      setInspectedSelection(selectionActions.menuSnapshot);
                      selectionActions.setMenuSnapshot(null);
                    },
                  },
                ]
              : []),
          ]}
        />
      ) : null}
      {isFocused && selectionInspectorEnabled && inspectedSelection ? (
        <aside
          className="selection-inspector"
          data-review-id="selection-inspector"
        >
          <header>
            <strong>Selection Inspector</strong>
            <button
              type="button"
              aria-label="Close selection inspector"
              onClick={() => setInspectedSelection(null)}
            >
              <X size={13} />
            </button>
          </header>
          <details open>
            <summary>Visible text</summary>
            <pre>{inspectedSelection.plainText}</pre>
          </details>
          <details>
            <summary>Model serialization</summary>
            <pre>{selectionSnapshotText(inspectedSelection)}</pre>
          </details>
          <details>
            <summary>AST / provenance / diagnostics</summary>
            <pre>
              {JSON.stringify(
                {
                  blocks: inspectedSelection.blocks,
                  provenance: inspectedSelection.provenance,
                  diagnostics: inspectedSelection.diagnostics,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </aside>
      ) : null}
      {isFocused && inlineNotice && (
        <div
          className={`inline-notice ${inlineNotice.tone}`}
          data-review-id="inline-notice"
          role={
            inlineNotice.tone === "error" || inlineNotice.tone === "warning"
              ? "alert"
              : "status"
          }
        >
          <span>{inlineNotice.message}</span>
          <button
            type="button"
            className="inline-notice-close"
            data-review-id="inline-notice-close"
            aria-label="Dismiss notification"
            onClick={onDismissInlineNotice}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {isFocused && lightweightActionFeedback && !hideStatusFeedback && (
        <div
          className="lightweight-action-feedback"
          data-review-id="lightweight-action-feedback"
          role="status"
          aria-live="polite"
        >
          {lightweightActionFeedback.message}
        </div>
      )}
      {isFocused && showLoadingMessage && (
        <div className="state-message">Loading document</div>
      )}
      {isFocused && error && <div className="state-message error">{error}</div>}
      {isFocused &&
        config?.experimental.searchHitRuler &&
        result &&
        payload && (
          <SearchHitRuler
            articleRef={articleNodeRef}
            query={query}
            searchHits={searchHits}
            searchIndex={searchIndex}
            onActivateSearchHit={onActivateSearchHit}
          />
        )}
      {isFocused && result && payload && activePostDiffGitMarkers && (
        <PostDiffGitMarkers
          articleRef={articleNodeRef}
          context={activePostDiffGitMarkers}
          displayMode={config?.experimental.changeReviewDisplay ?? "detailed"}
          resolveRevisionLensTargets={resolveRevisionLensTargets}
        />
      )}
      {result && payload && (
        <article
          key={`${paneId}:${documentPath ?? "empty"}`}
          ref={setArticleNode}
          className={`document-body markup-document format-${payload.format}${payload.format === "markdown" ? " markdown-body" : ""}${asciidocThemeClass}`}
          data-review-id={
            isFocused ? "document-body" : "document-body-secondary"
          }
          style={{
            fontSize: `${config?.zoom ?? 100}%`,
            ...(centeredContentWidth
              ? {
                  maxWidth: `${centeredContentWidth}px`,
                  marginInline: "auto",
                }
              : {}),
          }}
          onClick={isFocused ? onArticleClick : undefined}
          onClickCapture={handlePaneArticleLinkCapture}
          onAuxClickCapture={handlePaneArticleLinkCapture}
          onDoubleClick={isFocused ? onArticleDoubleClick : undefined}
          onBlur={isFocused ? onArticleBlur : undefined}
          onFocus={isFocused ? onArticleFocus : undefined}
          onPointerMove={isFocused ? onArticlePointerMove : undefined}
          onPointerLeave={isFocused ? onArticlePointerLeave : undefined}
          onContextMenu={
            isFocused
              ? (event) => {
                  const currentTarget = event.currentTarget;
                  const result = onMouseGestureContextMenu(event);
                  if (result === "ignored" || result === "plain-right-click") {
                    onArticleContextMenu(event);
                  } else if (result === "deferred") {
                    window.setTimeout(() => {
                      const pendingEvent =
                        onConsumePendingMouseGestureContextMenu();
                      if (
                        pendingEvent?.target instanceof Node &&
                        currentTarget.contains(pendingEvent.target)
                      ) {
                        onArticleContextMenu(pendingEvent);
                      }
                    }, 500);
                  }
                }
              : undefined
          }
        />
      )}
      {captureAreaActive &&
        isFocused &&
        articleNodeRef.current &&
        (() => {
          const captureTarget = splitEnabled
            ? articleNodeRef.current.closest<HTMLElement>(".viewer-split")
            : articleNodeRef.current;
          return captureTarget ? (
            <CaptureAreaOverlay
              article={captureTarget}
              viewer={captureTarget}
              onCapture={(rect) =>
                void onCaptureArea(rect, captureTarget, captureAreaVariant)
              }
              onClose={() => setCaptureAreaActive(false)}
            />
          ) : null;
        })()}
      {isFocused && !isLoading && !error && !payload && (
        <StartPage
          recentDocuments={config?.workspace.recentDocuments ?? []}
          recentDirectories={config?.workspace.recentDirectories ?? []}
          bookmarks={(config?.workspace.bookmarks ?? []) as BookmarkEntry[]}
          onOpenDocument={onOpenDocument}
          onOpenDirectory={onOpenDirectory}
          onPickDocument={onPickDocument}
          onPickDirectory={onPickDirectory}
          onClearRecentDocuments={onClearRecentDocuments}
          onClearRecentDirectories={onClearRecentDirectories}
        />
      )}
    </section>
  );
}
