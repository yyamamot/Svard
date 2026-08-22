import type { FocusEvent, PointerEvent } from "react";
import { useEffect, useRef } from "react";
import { linkHoverDestination } from "../lib/linkHover";
import {
  buildLinkPreview,
  linkPreviewDelayMs,
  linkPreviewKey,
  rememberLinkPreviewCache,
  shouldPreviewLinkHref,
  type LinkPreviewState,
} from "../lib/linkPreview";
import {
  createArticleClickHandler,
  createArticleLinkCaptureHandler,
} from "./documentLinks/articleClick";
import { createArticleContextMenuHandler } from "./documentLinks/contextMenu";
import { createDiagramActions } from "./documentLinks/diagramActions";
import { createNavigationActions } from "./documentLinks/navigation";
import { createArticleDoubleClickHandler } from "./documentLinks/previewDoubleClick";
import type { UseDocumentLinksOptions } from "./documentLinks/types";
import {
  copyImageToClipboard,
  copyImageWithReferenceToClipboard,
} from "../lib/imageClipboard";
import {
  captureAreaFailureNotice,
  captureAreaReferenceForRect,
  copyCaptureAreaToClipboard,
  type CaptureAreaRect,
  type CaptureAreaVariant,
} from "../lib/captureArea";

export function useDocumentLinks({
  activeHeadingId,
  articleRef,
  documentPayload,
  loadDocumentForPreview,
  openDocument,
  openDocumentInNewWindow,
  openPathInEditor,
  resolveDocumentLink,
  onConfirmKrokiRender,
  onLinkHoverDestinationChange,
  onLinkPreviewChange,
  onOpenDiagramPreview,
  onOpenPreferences,
  onSelectDiagram,
  onCompareGitRef,
  onShowGitDiff,
  onTryKrokiFallback,
  confirmExternalLink,
  openContextMenu,
  openExternalUrl,
  recordNavigation,
  renderResult,
  setActiveHeadingId,
  showInlineNotice,
  showLightweightActionFeedback,
  saveSvgFile,
  onBeginCaptureArea,
  onAddAgentSelection,
  onAddAgentMedia,
  workspaceRoot,
}: UseDocumentLinksOptions) {
  const lastDocumentSelectionRef = useRef("");
  const linkPreviewTimerRef = useRef<number | null>(null);
  const linkPreviewRequestRef = useRef(0);
  const linkPreviewActiveKeyRef = useRef<string | null>(null);
  const linkPreviewCacheRef = useRef(new Map<string, LinkPreviewState>());

  useEffect(() => {
    function rememberDocumentSelection() {
      const selection = window.getSelection();
      const text = selection?.toString() ?? "";
      if (!text || !articleRef.current || !selection?.rangeCount) {
        return;
      }
      const range = selection.getRangeAt(0);
      const ancestor = range.commonAncestorContainer;
      const node =
        ancestor.nodeType === Node.ELEMENT_NODE
          ? ancestor
          : ancestor.parentElement;
      if (node && articleRef.current.contains(node)) {
        lastDocumentSelectionRef.current = text;
      }
    }

    document.addEventListener("selectionchange", rememberDocumentSelection);
    return () =>
      document.removeEventListener(
        "selectionchange",
        rememberDocumentSelection,
      );
  }, [articleRef]);

  useEffect(
    () => () => {
      if (linkPreviewTimerRef.current !== null) {
        window.clearTimeout(linkPreviewTimerRef.current);
      }
    },
    [],
  );

  async function copyText(label: string, content?: string) {
    if (!content) {
      showInlineNotice(`${label} has no content to copy`, { tone: "warning" });
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      showLightweightActionFeedback(`${label} copied`);
    } catch {
      showInlineNotice(`${label} ready to copy`, { tone: "info" });
    }
  }

  async function copyImage(
    source: HTMLImageElement | SVGElement,
    referenceText?: string,
  ) {
    try {
      if (referenceText && source instanceof HTMLImageElement) {
        await copyImageWithReferenceToClipboard(source, referenceText);
        showLightweightActionFeedback("Image with reference copied");
      } else {
        await copyImageToClipboard(source);
        showLightweightActionFeedback("Image copied");
      }
    } catch {
      showInlineNotice("Image could not be copied", { tone: "warning" });
    }
  }

  async function copyCaptureArea(
    rect: CaptureAreaRect,
    captureTarget = articleRef.current,
    variant: CaptureAreaVariant = "plain",
  ) {
    const article = captureTarget;
    if (!article) {
      showInlineNotice(captureAreaFailureNotice, { tone: "warning" });
      return;
    }
    try {
      const referenceText =
        variant === "reference"
          ? captureAreaReferenceForRect(article, rect)
          : undefined;
      await copyCaptureAreaToClipboard(article, rect, referenceText);
      showLightweightActionFeedback(
        variant === "reference"
          ? "Image with reference copied"
          : "Image copied",
      );
    } catch {
      showInlineNotice(captureAreaFailureNotice, { tone: "warning" });
    }
  }

  const {
    copyHeadingLink,
    navigateToHeading,
    openFocusedLink,
    openLinkElement,
  } = createNavigationActions({
    activeHeadingId,
    articleRef,
    documentPayload,
    confirmExternalLink,
    openDocument,
    openExternalUrl,
    recordNavigation,
    renderResult,
    resolveDocumentLink,
    setActiveHeadingId,
    showInlineNotice,
    copyText,
  });
  const { openDiagramPreview, openImagePreview, saveDiagramSvg } =
    createDiagramActions({
      documentPayload,
      onOpenDiagramPreview,
      showInlineNotice,
      saveSvgFile,
    });
  const handleArticleClick = createArticleClickHandler({
    documentPath: documentPayload?.path,
    diagramSlots: renderResult?.diagramSlots,
    onConfirmKrokiRender,
    onOpenPreferences,
    onSelectDiagram,
    onTryKrokiFallback,
    copyText,
  });
  const handleArticleLinkCapture = createArticleLinkCaptureHandler({
    openLinkElement,
  });
  const handleArticleDoubleClick = createArticleDoubleClickHandler({
    openDiagramPreview,
    openImagePreview,
  });
  const handleArticleContextMenu = createArticleContextMenuHandler({
    articleRef,
    documentPayload,
    renderResult,
    openContextMenu,
    openLinkElement,
    openDocumentInNewWindow,
    openPathInEditor,
    openDiagramPreview,
    openImagePreview,
    saveDiagramSvg,
    resolveDocumentLink,
    showInlineNotice,
    onCompareGitRef,
    onShowGitDiff,
    copyText,
    copyImage,
    onBeginCaptureArea,
    onAddAgentSelection,
    onAddAgentMedia,
    workspaceRoot,
  });

  function clearLinkPreview() {
    if (linkPreviewTimerRef.current !== null) {
      window.clearTimeout(linkPreviewTimerRef.current);
      linkPreviewTimerRef.current = null;
    }
    linkPreviewRequestRef.current += 1;
    linkPreviewActiveKeyRef.current = null;
    onLinkPreviewChange(null);
  }

  function scheduleLinkPreview(link: HTMLAnchorElement) {
    if (!documentPayload) {
      clearLinkPreview();
      return;
    }
    const href = link.getAttribute("href") ?? "";
    if (!shouldPreviewLinkHref(href)) {
      clearLinkPreview();
      return;
    }

    const rect = link.getBoundingClientRect();
    const key = linkPreviewKey(documentPayload.path, href);
    if (linkPreviewActiveKeyRef.current === key) {
      return;
    }
    linkPreviewActiveKeyRef.current = key;

    const cached = linkPreviewCacheRef.current.get(key);
    if (cached) {
      onLinkPreviewChange({ ...cached, x: rect.left, y: rect.bottom });
      return;
    }

    if (linkPreviewTimerRef.current !== null) {
      window.clearTimeout(linkPreviewTimerRef.current);
    }
    const requestId = linkPreviewRequestRef.current + 1;
    linkPreviewRequestRef.current = requestId;
    onLinkPreviewChange({
      status: "loading",
      key,
      x: rect.left,
      y: rect.bottom,
      title: "Loading preview",
    });
    linkPreviewTimerRef.current = window.setTimeout(() => {
      linkPreviewTimerRef.current = null;
      void buildLinkPreview({
        href,
        currentDocument: documentPayload,
        renderResult,
        article: articleRef.current,
        x: rect.left,
        y: rect.bottom,
        resolveDocumentLink,
        loadDocument: loadDocumentForPreview,
      }).then((preview) => {
        if (linkPreviewRequestRef.current !== requestId) {
          return;
        }
        if (!preview) {
          onLinkPreviewChange(null);
          return;
        }
        rememberLinkPreviewCache(linkPreviewCacheRef.current, key, preview);
        onLinkPreviewChange(preview);
      });
    }, linkPreviewDelayMs);
  }

  function linkFromTarget(target: EventTarget | null) {
    return target instanceof HTMLElement
      ? (target.closest("a[href]") as HTMLAnchorElement | null)
      : null;
  }

  function handleArticlePointerMove(event: PointerEvent<HTMLElement>) {
    onLinkHoverDestinationChange(linkHoverDestination(event.target));
    const link = linkFromTarget(event.target);
    if (link) {
      scheduleLinkPreview(link);
    } else {
      clearLinkPreview();
    }
  }

  function handleArticlePointerLeave() {
    onLinkHoverDestinationChange(null);
    clearLinkPreview();
  }

  function handleArticleFocus(event: FocusEvent<HTMLElement>) {
    const link = linkFromTarget(event.target);
    if (link) {
      scheduleLinkPreview(link);
    }
  }

  function handleArticleBlur(event: FocusEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      articleRef.current?.contains(nextTarget)
    ) {
      return;
    }
    clearLinkPreview();
  }

  return {
    copyHeadingLink,
    copyText,
    copyImage,
    copyCaptureArea,
    handleArticleContextMenu,
    handleArticleClick,
    handleArticleLinkCapture,
    handleArticleDoubleClick,
    handleArticleBlur,
    handleArticleFocus,
    handleArticlePointerLeave,
    handleArticlePointerMove,
    navigateToHeading,
    openFocusedLink,
  };
}
