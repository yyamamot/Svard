import type { MouseEvent } from "react";
import type {
  DocumentDiffPreview,
  DocumentLinkResolution,
} from "../../../core/types";
import { documentSelectionAtPoint } from "../../hooks/documentLinks/shared";
import { captureDocumentLinkActivation } from "../../lib/documentLinkNavigation";
import { diffPreviewDocumentPath, openDiffLinkElement } from "./contextMenu";
import type { createDiffPreviewContextMenuHandler } from "./contextMenu";
import { diffContextForTarget } from "./diffContext";

export function shouldIgnoreDiffMouseGestureTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        ".git-diff-toolbar, .git-diff-overview, .git-diff-agent-dock",
      ),
    )
  );
}

export function shouldOpenDeferredSourceContextMenuImmediately(
  target: EventTarget | null,
) {
  return target instanceof HTMLElement && Boolean(target.closest("pre"));
}

export function hasRenderedDiffSelectionAtPoint(
  target: HTMLElement,
  clientX: number,
  clientY: number,
) {
  const context = diffContextForTarget(target);
  return Boolean(
    context?.surface === "rendered" &&
    documentSelectionAtPoint(context.container, clientX, clientY),
  );
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
  if (
    target.closest(
      ".git-diff-toolbar, .git-diff-overview, .git-diff-agent-dock",
    )
  ) {
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
  const activation = captureDocumentLinkActivation(event);
  if (!activation || activation.intent.kind === "blocked") {
    return;
  }
  const target = event.target as HTMLElement;
  const context = diffContextForTarget(target);
  if (!context) {
    return;
  }
  void openDiffLinkElement({
    link: activation.link,
    documentPath: diffPreviewDocumentPath(preview, context.side),
    confirmExternalLink,
    openDocument,
    openExternalUrl,
    resolveDocumentLink,
    showInlineNotice,
    fragmentRoot: context.container,
  });
}
