import type { MouseEvent } from "react";
import type {
  DocumentDiffPreview,
  DocumentLinkResolution,
} from "../../../core/types";
import { isSupportedDocumentHref } from "../../hooks/documentLinks/shared";
import { isExternalUrl } from "../../lib/path";
import { diffPreviewDocumentPath, openDiffLinkElement } from "./contextMenu";
import type { createDiffPreviewContextMenuHandler } from "./contextMenu";
import { diffContextForTarget } from "./diffContext";

export function shouldIgnoreDiffMouseGestureTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest(".git-diff-toolbar, .git-diff-overview"))
  );
}

export function shouldOpenDeferredSourceContextMenuImmediately(
  target: EventTarget | null,
) {
  return target instanceof HTMLElement && Boolean(target.closest("pre"));
}

export function handleDiffPanelContextMenu({
  event,
  allowPreventedEvent = false,
  handleDiffContextMenu,
}: {
  event: MouseEvent<HTMLElement>;
  allowPreventedEvent?: boolean;
  handleDiffContextMenu: ReturnType<typeof createDiffPreviewContextMenuHandler>;
}) {
  if (event.defaultPrevented && !allowPreventedEvent) {
    return;
  }
  const target = event.target as HTMLElement;
  if (target.closest(".git-diff-toolbar, .git-diff-overview")) {
    return;
  }
  const context = diffContextForTarget(target);
  if (context) {
    handleDiffContextMenu(
      event,
      context.side,
      context.surface,
      context.container,
    );
  }
}

export function handleDiffPanelClick({
  event,
  preview,
  confirmExternalLink,
  openDocument,
  openExternalUrl,
  resolveDocumentLink,
  showInlineNotice,
}: {
  event: MouseEvent<HTMLElement>;
  preview: DocumentDiffPreview;
  confirmExternalLink: (url: string) => Promise<boolean>;
  openDocument: (path: string) => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  resolveDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}) {
  if (event.defaultPrevented) {
    return;
  }
  const target = event.target as HTMLElement;
  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (!link) {
    return;
  }
  const context = diffContextForTarget(target);
  if (!context) {
    return;
  }
  const href = link.getAttribute("href") ?? "";
  if (
    !href ||
    (!href.startsWith("#") &&
      !isExternalUrl(href) &&
      !isSupportedDocumentHref(href))
  ) {
    return;
  }
  event.preventDefault();
  void openDiffLinkElement({
    link,
    documentPath: diffPreviewDocumentPath(preview, context.side),
    confirmExternalLink,
    openDocument,
    openExternalUrl,
    resolveDocumentLink,
    showInlineNotice,
  });
}
