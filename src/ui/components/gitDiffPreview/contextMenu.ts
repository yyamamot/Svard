import type { MouseEvent } from "react";
import {
  isLocationReferenceTarget,
  locationReferenceForElement,
  locationReferenceForSelection,
  locationReferenceTargetLabel,
} from "../../lib/locationReference";
import { isExternalUrl } from "../../lib/path";
import {
  diffReferenceForTarget,
  originalDiffTextReferenceForSelection,
} from "../../lib/diffReference";
import type { ContextMenuItem } from "../../types";
import {
  addDiagramItems,
  addHeadingItems,
  addImageItems,
  addLinkItems,
  addTextReferenceItem,
  addSelectionItems,
  addSourceItems,
} from "../../hooks/documentLinks/contextMenuItems";
import { documentSelectionAtPoint } from "../../hooks/documentLinks/shared";
import { addTableItems } from "../../hooks/documentLinks/tableActions";
import {
  buildDiffDiagramComparisonPreview,
  openDiffDiagramPreview,
  openDiffImagePreview,
  openDiffLinkElement,
  saveDiffDiagramSvg,
} from "./contextMenuActions";
import {
  diffPreviewDocumentPath,
  diffPreviewDocumentPayload,
  diffPreviewDocumentPayloadWithWorkspace,
} from "./contextMenuDocument";
import {
  addCopyPaneTextItem,
  addDiffDocumentPathItems,
  addDiffPreSourceItems,
} from "./contextMenuFallbackItems";
import { resolveDiffContextTable } from "./contextMenuTable";
import type {
  DiffPreviewContextMenuOptions,
  DiffSide,
  DiffSurface,
} from "./contextMenuTypes";

export type {
  DiffPreviewContextMenuOptions,
  DiffSide,
  DiffSurface,
} from "./contextMenuTypes";
export { openDiffLinkElement } from "./contextMenuActions";
export { diffPreviewDocumentPath } from "./contextMenuDocument";

export function createDiffPreviewContextMenuHandler({
  allowLocationReference,
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
}: DiffPreviewContextMenuOptions) {
  return function handleDiffPreviewContextMenu(
    event: MouseEvent<HTMLElement>,
    side: DiffSide,
    surface: DiffSurface,
    containerOverride?: HTMLElement,
  ) {
    const target = event.target as HTMLElement;
    const container = containerOverride ?? event.currentTarget;
    const items = diffPreviewContextMenuItems({
      container,
      event,
      target,
      side,
      surface,
      preview,
      copyText,
      openDocument,
      openPathInEditor,
      resolveDocumentLink,
      confirmExternalLink,
      openExternalUrl,
      onOpenDiagramPreview,
      showInlineNotice,
      allowLocationReference,
    });
    const opened = openContextMenu(
      event,
      items,
      target.closest<HTMLElement>("[data-review-id]")?.dataset.reviewId,
    );
    event.preventDefault();
    event.stopPropagation();
    if (!opened) {
      return;
    }
  };
}

export function diffPreviewContextMenuItems({
  container,
  event,
  target,
  side,
  surface,
  preview,
  copyText,
  openDocument,
  openPathInEditor,
  resolveDocumentLink,
  confirmExternalLink,
  openExternalUrl,
  onOpenDiagramPreview,
  showInlineNotice,
  allowLocationReference = true,
}: Omit<DiffPreviewContextMenuOptions, "openContextMenu"> & {
  container: HTMLElement;
  event: Pick<MouseEvent<HTMLElement>, "clientX" | "clientY">;
  target: HTMLElement;
  side: DiffSide;
  surface: DiffSurface;
}): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];
  const documentPath = diffPreviewDocumentPath(preview, side);
  const documentPayload = documentPath
    ? diffPreviewDocumentPayloadWithWorkspace(
        documentPath,
        preview.repositoryRoot,
      )
    : null;
  const selection = documentSelectionAtPoint(
    container,
    event.clientX,
    event.clientY,
  );
  const table = resolveDiffContextTable({
    container,
    event,
    selection,
    target,
  });

  if (selection) {
    addSelectionItems(
      items,
      table,
      copyText,
      allowLocationReference && surface === "rendered" && documentPayload
        ? locationReferenceForSelection({
            article: container,
            document: documentPayload,
            selection,
            revision: {
              label: side === "left" ? preview.leftLabel : preview.rightLabel,
              side,
            },
          })
        : undefined,
      surface === "rendered"
        ? diffReferenceForTarget({
            target,
            preview,
            leftPath: diffPreviewDocumentPath(preview, "left"),
            rightPath: diffPreviewDocumentPath(preview, "right"),
        })
        : undefined,
      surface === "rendered"
        ? originalDiffTextReferenceForSelection({
            target,
            preview,
            path: documentPath ?? diffPreviewDocumentPath(preview, "right"),
            side,
          })
        : undefined,
    );
    return items;
  }

  if (surface === "rendered") {
    addRenderedSurfaceItems(items, {
      preview,
      target,
      table,
      documentPath,
      documentPayload,
      copyText,
      openDocument,
      openPathInEditor,
      resolveDocumentLink,
      confirmExternalLink,
      openExternalUrl,
      onOpenDiagramPreview,
      showInlineNotice,
      side,
      allowLocationReference,
    });
  } else if (surface === "table" && table) {
    addTableItems(items, table, copyText);
  }

  if (items.length === 0 && documentPath) {
    addDiffDocumentPathItems(items, documentPath, {
      copyText,
      openPathInEditor,
    });
  }
  if (items.length === 0) {
    addCopyPaneTextItem(items, container, copyText);
  }
  return items;
}

function addRenderedSurfaceItems(
  items: ContextMenuItem[],
  {
    preview,
    target,
    table,
    documentPath,
    documentPayload,
    copyText,
    openDocument,
    openPathInEditor,
    resolveDocumentLink,
    confirmExternalLink,
    openExternalUrl,
    onOpenDiagramPreview,
    showInlineNotice,
    side,
    allowLocationReference,
  }: Omit<DiffPreviewContextMenuOptions, "preview" | "openContextMenu"> & {
    preview: DiffPreviewContextMenuOptions["preview"];
    target: HTMLElement;
    table: HTMLTableElement | null;
    documentPath: string | null;
    documentPayload: ReturnType<typeof diffPreviewDocumentPayload> | null;
    side: DiffSide;
    allowLocationReference: boolean;
  },
) {
  addDiagramItems(items, target, {
    copyText,
    prepareDiagramPreview: (svg) =>
      buildDiffDiagramComparisonPreview({
        svg,
        documentPath,
        target,
        beforeTitle: preview.leftLabel,
        afterTitle: preview.rightLabel,
      }),
    openDiagramPreview: (svg, sourceReference, preparedPreview) =>
      openDiffDiagramPreview({
        svg,
        sourceReference,
        documentPath,
        onOpenDiagramPreview,
        target,
        beforeTitle: preview.leftLabel,
        afterTitle: preview.rightLabel,
        preparedPreview,
      }),
    saveDiagramSvg: (svg) =>
      saveDiffDiagramSvg({
        svg,
        documentPath,
        showInlineNotice,
      }),
  });
  addSourceItems(items, target, copyText);
  if (items.length === 0) {
    addDiffPreSourceItems(items, target, copyText);
  }
  if (items.length === 0 && table) {
    addTableItems(items, table, copyText);
  }
  const linkHref =
    target.closest<HTMLAnchorElement>("a[href]")?.getAttribute("href") ?? "";
  if (!linkHref || documentPayload || isExternalUrl(linkHref)) {
    addLinkItems(items, target, {
      copyText,
      documentPayload,
      openLinkElement: (link) =>
        openDiffLinkElement({
          link,
          documentPath,
          confirmExternalLink,
          openDocument,
          openExternalUrl,
          resolveDocumentLink,
          showInlineNotice,
        }),
      openPathInEditor,
      resolveDocumentLink,
      showInlineNotice,
    });
  }
  addImageItems(items, target, {
    copyText,
    openImagePreview: (image) =>
      openDiffImagePreview({
        image,
        onOpenDiagramPreview,
        showInlineNotice,
      }),
  });
  addHeadingItems(items, target, documentPayload, copyText);
  const diffReference = diffReferenceForTarget({
    target,
    preview,
    leftPath: diffPreviewDocumentPath(preview, "left"),
    rightPath: diffPreviewDocumentPath(preview, "right"),
  });
  if (diffReference) {
    items.push({
      id: "copy-diff-reference",
      label: "Copy Diff Reference",
      onSelect: () => copyText("Diff reference", diffReference.value),
    });
  }
  if (
    allowLocationReference &&
    documentPayload &&
    isLocationReferenceTarget(target)
  ) {
    const locationReference = locationReferenceForElement({
      article: target.closest<HTMLElement>(".git-rendered-pane"),
      document: documentPayload,
      element: target,
      revision: {
        label: side === "left" ? preview.leftLabel : preview.rightLabel,
        side,
      },
      targetLabel: locationReferenceTargetLabel(target),
    });
    if (locationReference) {
      addTextReferenceItem(items, locationReference, copyText);
    }
  }
}
