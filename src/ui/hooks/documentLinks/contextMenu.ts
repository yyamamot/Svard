import type { MouseEvent, RefObject } from "react";
import type { ContextMenuItem } from "../../types";
import {
  isLocationReferenceTarget,
  locationReferenceForElement,
  locationReferenceForSelection,
  locationReferenceTargetLabel,
} from "../../lib/locationReference";
import { imageReferenceForElement } from "../../lib/imageReference";
import { extractDocumentSelection } from "../../lib/documentSelection";
import { extractDocumentMedia } from "../../lib/documentMedia";
import {
  originalTextReferenceForSelection,
  sourceReferenceForSelection,
} from "../../lib/sourceTextCopy";
import type { CopyText, UseDocumentLinksOptions } from "./types";
import { documentSelectionAtPoint } from "./shared";
import {
  addDiagramItems,
  addCaptureAreaItem,
  addDocumentItems,
  addHeadingItems,
  addImageItems,
  addLinkItems,
  addTextReferenceItem,
  addSelectionItems,
  addSourceItems,
} from "./contextMenuItems";
import {
  addTableItems,
  tableFromNode,
  tableFromSelectionRange,
} from "./tableActions";

export function createArticleContextMenuHandler({
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
}: Pick<
  UseDocumentLinksOptions,
  | "articleRef"
  | "documentPayload"
  | "openDocumentInNewWindow"
  | "renderResult"
  | "openContextMenu"
  | "openPathInEditor"
  | "resolveDocumentLink"
  | "showInlineNotice"
  | "onCompareGitRef"
  | "onShowGitDiff"
  | "onAddAgentSelection"
  | "onAddAgentMedia"
  | "workspaceRoot"
> & {
  openLinkElement: (link: HTMLAnchorElement) => Promise<void>;
  openDiagramPreview: (
    svg: SVGElement,
    sourceReference: string | undefined,
  ) => void;
  openImagePreview: (image: HTMLImageElement) => void;
  saveDiagramSvg: (svg: SVGElement) => Promise<void>;
  copyText: CopyText;
  copyImage: (
    source: HTMLImageElement | SVGElement,
    referenceText?: string,
  ) => Promise<void>;
  onBeginCaptureArea: (variant?: "plain" | "reference") => void;
}) {
  return async function handleArticleContextMenu(
    event: MouseEvent<HTMLElement>,
  ) {
    const target = event.target as HTMLElement;
    if (target.closest('[data-review-id="git-diff-preview-panel"]')) {
      return;
    }
    const linkTarget =
      target.closest<HTMLAnchorElement>("a[href]") ??
      linkAtPoint(articleRef.current, event.clientX, event.clientY);
    const items: ContextMenuItem[] = [];
    const selection = linkTarget
      ? ""
      : documentSelectionAtPoint(
          articleRef.current,
          event.clientX,
          event.clientY,
        );
    const table = resolveContextTable({
      articleRef,
      event,
      selection,
      target,
    });

    if (selection) {
      const activeSelection = window.getSelection();
      const selectionRange =
        activeSelection?.rangeCount && articleRef.current
          ? activeSelection.getRangeAt(0).cloneRange()
          : null;
      const textReference = documentPayload
        ? locationReferenceForSelection({
            article: articleRef.current,
            document: documentPayload,
            renderResult,
            selection,
            range: selectionRange ?? undefined,
            sourceReference: sourceReferenceForSelection({
              article: articleRef.current,
              document: documentPayload,
              renderResult,
              range: selectionRange ?? undefined,
            }),
          })
        : undefined;
      const originalTextReference = documentPayload
        ? originalTextReferenceForSelection({
            article: articleRef.current,
            document: documentPayload,
            renderResult,
            range: selectionRange ?? undefined,
          })
        : undefined;
      const snapshot =
        onAddAgentSelection &&
        documentPayload &&
        articleRef.current &&
        selectionRange
          ? await extractDocumentSelection({
              article: articleRef.current,
              document: documentPayload,
              range: selectionRange,
              renderResult,
            })
          : null;
      addSelectionItems(
        items,
        table,
        copyText,
        textReference,
        undefined,
        originalTextReference,
        snapshot &&
          !snapshot.diagnostics.some(
            (diagnostic) => diagnostic.severity === "blocking",
          ) &&
          onAddAgentSelection
          ? () => onAddAgentSelection(snapshot)
          : undefined,
      );
    } else {
      addDiagramItems(items, target, {
        copyText,
        openDiagramPreview,
        saveDiagramSvg,
        copyImage,
        askAgent:
          documentPayload && onAddAgentMedia
            ? async () => {
                onAddAgentMedia(
                  await extractDocumentMedia({
                    document: documentPayload,
                    element: target,
                    renderResult,
                    displayPath: workspaceRelativeLabel(
                      documentPayload.path,
                      workspaceRoot,
                    ),
                  }),
                );
              }
            : undefined,
      });
      addSourceItems(items, target, copyText);
      if (items.length === 0 && table) {
        addTableItems(items, table, copyText);
      }
      const image = target.closest<HTMLImageElement>("img");
      if (!image) {
        addLinkItems(items, linkTarget ?? target, {
          copyText,
          documentPayload,
          openDocumentInNewWindow,
          openLinkElement,
          openPathInEditor,
          resolveDocumentLink,
          showInlineNotice,
        });
      }
      addImageItems(
        items,
        target,
        {
          copyText,
          openImagePreview,
          copyImage,
          askAgent:
            documentPayload && onAddAgentMedia
              ? async () => {
                  onAddAgentMedia(
                    await extractDocumentMedia({
                      document: documentPayload,
                      element: target,
                      renderResult,
                      displayPath: workspaceRelativeLabel(
                        documentPayload.path,
                        workspaceRoot,
                      ),
                    }),
                  );
                }
              : undefined,
        },
        image
          ? imageReferenceForElement(image, {
              documentPath: documentPayload?.path,
            })
          : undefined,
      );
      addHeadingItems(items, target, documentPayload, copyText, {
        renderResult,
        includeSectionCopy: true,
      });
      if (documentPayload && isLocationReferenceTarget(target)) {
        const locationReference = locationReferenceForElement({
          article: articleRef.current,
          document: documentPayload,
          element: target,
          renderResult,
          targetLabel: locationReferenceTargetLabel(target),
        });
        if (locationReference) {
          addTextReferenceItem(items, locationReference, copyText);
        }
      }
      const isDocumentBackground = items.length === 0;
      // Keep document actions at the top of the body-background menu. Capture
      // Area starts a separate interaction, so it belongs in its own trailing
      // group rather than displacing the usual document actions.
      addDocumentItems(items, documentPayload, {
        copyText,
        onCompareGitRef,
        onShowGitDiff,
        openPathInEditor,
      });
      if (documentPayload && isDocumentBackground) {
        addCaptureAreaItem(
          items,
          () => onBeginCaptureArea("plain"),
          () => onBeginCaptureArea("reference"),
        );
      }
    }

    openContextMenu(
      event,
      items,
      target.closest<HTMLElement>("[data-review-id]")?.dataset.reviewId,
    );
  };
}

function workspaceRelativeLabel(path: string, workspaceRoot?: string | null) {
  const root = workspaceRoot?.replace(/[\\/]+$/u, "");
  if (root && path.startsWith(`${root}/`)) {
    return path.slice(root.length + 1);
  }
  return path.split(/[\\/]/u).pop() ?? "Document";
}

function linkAtPoint(
  article: HTMLElement | null,
  clientX: number,
  clientY: number,
) {
  if (!article) {
    return null;
  }
  const elementAtPoint = document
    .elementsFromPoint(clientX, clientY)
    .find(
      (element) =>
        article.contains(element) &&
        element.closest("a[href]") instanceof HTMLAnchorElement,
    );
  const linkFromPoint = elementAtPoint?.closest("a[href]");
  if (linkFromPoint instanceof HTMLAnchorElement) {
    return linkFromPoint;
  }

  const tolerance = 4;
  return (
    Array.from(article.querySelectorAll<HTMLAnchorElement>("a[href]")).find(
      (link) =>
        Array.from(link.getClientRects()).some(
          (rect) =>
            clientX >= rect.left - tolerance &&
            clientX <= rect.right + tolerance &&
            clientY >= rect.top - tolerance &&
            clientY <= rect.bottom + tolerance,
        ),
    ) ?? null
  );
}

function resolveContextTable({
  articleRef,
  event,
  selection,
  target,
}: {
  articleRef: RefObject<HTMLElement | null>;
  event: MouseEvent<HTMLElement>;
  selection: string;
  target: HTMLElement;
}) {
  const activeSelection = window.getSelection();
  const selectedTable =
    selection && activeSelection
      ? (tableFromNode(activeSelection.anchorNode) ??
        tableFromNode(activeSelection.focusNode) ??
        tableFromSelectionRange(articleRef.current))
      : null;
  const pointTable = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest("table") as HTMLTableElement | null;
  return (
    (target.closest("table") as HTMLTableElement | null) ??
    pointTable ??
    selectedTable
  );
}
