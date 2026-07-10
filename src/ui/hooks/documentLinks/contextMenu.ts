import type { MouseEvent, RefObject } from "react";
import type { ContextMenuItem } from "../../types";
import {
  isLocationReferenceTarget,
  locationReferenceForElement,
  locationReferenceForSelection,
  locationReferenceTargetLabel,
} from "../../lib/locationReference";
import type { CopyText, UseDocumentLinksOptions } from "./types";
import { documentSelectionAtPoint } from "./shared";
import {
  addDiagramItems,
  addDocumentItems,
  addHeadingItems,
  addImageItems,
  addLinkItems,
  addLocationReferenceItem,
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
> & {
  openLinkElement: (link: HTMLAnchorElement) => Promise<void>;
  openDiagramPreview: (
    svg: SVGElement,
    sourceReference: string | undefined,
  ) => void;
  openImagePreview: (image: HTMLImageElement) => void;
  saveDiagramSvg: (svg: SVGElement) => Promise<void>;
  copyText: CopyText;
}) {
  return function handleArticleContextMenu(event: MouseEvent<HTMLElement>) {
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
      addSelectionItems(
        items,
        selection,
        table,
        copyText,
        documentPayload
          ? locationReferenceForSelection({
              article: articleRef.current,
              document: documentPayload,
              renderResult,
              selection,
            })
          : undefined,
      );
    } else {
      addDiagramItems(items, target, {
        copyText,
        openDiagramPreview,
        saveDiagramSvg,
      });
      addSourceItems(items, target, copyText);
      if (items.length === 0 && table) {
        addTableItems(items, table, copyText);
      }
      addLinkItems(items, linkTarget ?? target, {
        copyText,
        documentPayload,
        openDocumentInNewWindow,
        openLinkElement,
        openPathInEditor,
        resolveDocumentLink,
        showInlineNotice,
      });
      addImageItems(items, target, { copyText, openImagePreview });
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
          addLocationReferenceItem(items, locationReference, copyText);
        }
      }
      addDocumentItems(items, documentPayload, {
        copyText,
        onCompareGitRef,
        onShowGitDiff,
        openPathInEditor,
      });
    }

    openContextMenu(
      event,
      items,
      target.closest<HTMLElement>("[data-review-id]")?.dataset.reviewId,
    );
  };
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
