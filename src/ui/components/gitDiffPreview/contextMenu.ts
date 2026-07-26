import type { MouseEvent } from "react";
import {
  isLocationReferenceTarget,
  locationReferenceForElement,
  locationReferenceForSelection,
  locationReferenceTargetLabel,
} from "../../lib/locationReference";
import { isExternalUrl } from "../../lib/path";
import {
  copyImageToClipboard,
  copyImageWithReferenceToClipboard,
} from "../../lib/imageClipboard";
import { imageReferenceForElement } from "../../lib/imageReference";
import { extractRenderedDiffMedia } from "../../lib/documentMedia";
import {
  diffReferenceForTarget,
  originalDiffTextReferenceForSelection,
} from "../../lib/diffReference";
import type { ContextMenuItem } from "../../types";
import {
  addDiagramItems,
  addCaptureAreaItem,
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
  onBeginCaptureArea,
  onPrepareAgentSelection,
  onAddAgentMedia,
  resolveAgentMediaDiagram,
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
      onBeginCaptureArea,
      onPrepareAgentSelection,
      onAddAgentMedia,
      resolveAgentMediaDiagram,
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
  onBeginCaptureArea,
  onPrepareAgentSelection,
  onAddAgentMedia,
  resolveAgentMediaDiagram,
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
  const selectionRange =
    selection && window.getSelection()?.rangeCount
      ? window.getSelection()?.getRangeAt(0).cloneRange()
      : null;
  const askAgentSelection =
    surface === "rendered" && selectionRange
      ? onPrepareAgentSelection?.(selectionRange)
      : undefined;
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
        ? safeDiffReference(
            locationReferenceForSelection({
              article: container,
              document: documentPayload,
              selection,
              revision: {
                label: side === "left" ? preview.leftLabel : preview.rightLabel,
                side,
              },
            }),
            preview,
          )
        : undefined,
      surface === "rendered"
        ? safeReferenceValue(
            diffReferenceForTarget({
              target,
              preview,
              leftPath: diffPreviewDocumentPath(preview, "left"),
              rightPath: diffPreviewDocumentPath(preview, "right"),
            }),
            preview,
          )
        : undefined,
      surface === "rendered"
        ? safeReferenceValue(
            originalDiffTextReferenceForSelection({
              target,
              preview,
              path: documentPath ?? diffPreviewDocumentPath(preview, "right"),
              side,
            }),
            preview,
          )
        : undefined,
      askAgentSelection,
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
      onAddAgentMedia,
      resolveAgentMediaDiagram,
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
  if (surface === "rendered" && onBeginCaptureArea) {
    addCaptureAreaItem(
      items,
      () => onBeginCaptureArea(container, "plain"),
      () => onBeginCaptureArea(container, "reference"),
    );
  }
  return items;
}

function safeReferenceValue<T extends { value: string } | undefined>(
  reference: T,
  preview: DiffPreviewContextMenuOptions["preview"],
): T {
  if (!reference) return reference;
  return {
    ...reference,
    value: safeDiffReference(reference.value, preview),
  } as T;
}

function safeDiffReference(
  value: string | null | undefined,
  preview: DiffPreviewContextMenuOptions["preview"],
) {
  if (!value || !preview.relativePath) return value ?? undefined;
  return [preview.leftPath, preview.rightPath].reduce<string>(
    (current, path) =>
      path ? current.replaceAll(path, preview.relativePath!) : current,
    value,
  );
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
    onAddAgentMedia,
    resolveAgentMediaDiagram,
  }: Omit<DiffPreviewContextMenuOptions, "preview" | "openContextMenu"> & {
    preview: DiffPreviewContextMenuOptions["preview"];
    target: HTMLElement;
    table: HTMLTableElement | null;
    documentPath: string | null;
    documentPayload: ReturnType<typeof diffPreviewDocumentPayload> | null;
    side: DiffSide;
    allowLocationReference: boolean;
    onAddAgentMedia?: DiffPreviewContextMenuOptions["onAddAgentMedia"];
    resolveAgentMediaDiagram?: DiffPreviewContextMenuOptions["resolveAgentMediaDiagram"];
  },
) {
  const diagramSource = resolveAgentMediaDiagram?.(target, side);
  const copyImage = async (
    source: HTMLImageElement | SVGElement,
    referenceText?: string,
  ) => {
    try {
      if (referenceText && source instanceof HTMLImageElement) {
        await copyImageWithReferenceToClipboard(source, referenceText);
        showInlineNotice("Image with reference copied", { tone: "success" });
      } else {
        await copyImageToClipboard(source);
        showInlineNotice("Image copied", { tone: "success" });
      }
    } catch {
      showInlineNotice("Image could not be copied", { tone: "warning" });
    }
  };
  const askAgent = onAddAgentMedia
    ? async () => {
        try {
          const path =
            diffPreviewDocumentPath(preview, side) ??
            preview.relativePath ??
            "Document";
          const displayPath =
            preview.relativePath ?? path.split(/[\\/]/u).pop() ?? "Document";
          const revisionLabel =
            side === "left" ? preview.leftLabel : preview.rightLabel;
          onAddAgentMedia(
            await extractRenderedDiffMedia({
              comparisonLabel: `${preview.leftLabel} → ${preview.rightLabel}`,
              displayPath,
              element: target,
              path,
              revisionLabel,
              side,
              diagramSource,
            }),
            side,
          );
        } catch {
          showInlineNotice("This image could not be prepared for AI Chat.", {
            tone: "warning",
          });
        }
      }
    : undefined;
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
        sourceReference:
          svg
            .closest<HTMLElement>(".diagram-inline-image")
            ?.getAttribute("data-source-reference") ?? undefined,
        showInlineNotice,
      }),
    copyImage,
    askAgent,
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
  const image = target.closest<HTMLImageElement>("img");
  addImageItems(
    items,
    target,
    {
      copyText,
      openImagePreview: (image) =>
        openDiffImagePreview({
          image,
          onOpenDiagramPreview,
          showInlineNotice,
        }),
      copyImage,
      askAgent,
    },
    image
      ? imageReferenceForElement(image, {
          documentPath,
          revision: {
            label: side === "left" ? preview.leftLabel : preview.rightLabel,
            side,
          },
        })
      : undefined,
  );
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
