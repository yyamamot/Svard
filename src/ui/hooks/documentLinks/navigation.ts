import { expandCollapsedSectionsContaining } from "../../lib/sectionCollapse";
import {
  activateDocumentLinkIntent,
  classifyDocumentLinkHref,
} from "../../lib/documentLinkNavigation";
import type { CopyText, UseDocumentLinksOptions } from "./types";

export function createNavigationActions({
  activeHeadingId,
  articleRef,
  confirmExternalLink,
  documentPayload,
  openDocument,
  openExternalUrl,
  recordNavigation,
  renderResult,
  resolveDocumentLink,
  setActiveHeadingId,
  showInlineNotice,
  copyText,
}: Pick<
  UseDocumentLinksOptions,
  | "activeHeadingId"
  | "articleRef"
  | "confirmExternalLink"
  | "documentPayload"
  | "openDocument"
  | "openExternalUrl"
  | "recordNavigation"
  | "renderResult"
  | "resolveDocumentLink"
  | "setActiveHeadingId"
  | "showInlineNotice"
> & {
  copyText: CopyText;
}) {
  function headingLabel(headingId: string): string {
    return (
      renderResult?.headings.find((heading) => heading.id === headingId)
        ?.text ?? headingId
    );
  }

  function navigateToHeading(
    headingId: string,
    options: { recordNavigation?: boolean } = {},
  ) {
    if (options.recordNavigation !== false && documentPayload) {
      recordNavigation({
        path: documentPayload.path,
        headingId,
        label: headingLabel(headingId),
      });
    }

    const target = articleRef.current?.querySelector(
      `#${CSS.escape(headingId)}`,
    );
    expandCollapsedSectionsContaining(target ?? null);
    target?.scrollIntoView({ block: "start", behavior: "smooth" });
    setActiveHeadingId(headingId);
  }

  function headingSourceReference(headingId: string): string | undefined {
    if (!documentPayload) {
      return undefined;
    }
    const heading = renderResult?.headings.find(
      (item) => item.id === headingId,
    );
    const line = heading?.sourceLocation?.line;
    if (!line) {
      return undefined;
    }
    return `${documentPayload.path}:${line}#${encodeURIComponent(headingId)}`;
  }

  async function copyHeadingLink() {
    if (!documentPayload) {
      await copyText("Heading link", undefined);
      return;
    }
    const headingId = activeHeadingId ?? undefined;
    const link = headingId
      ? (headingSourceReference(headingId) ??
        `${documentPayload.path}#${encodeURIComponent(headingId)}`)
      : documentPayload.path;
    await copyText("Heading link", link);
  }

  async function openLinkElement(link: HTMLAnchorElement) {
    await activateDocumentLinkIntent(
      classifyDocumentLinkHref(link.getAttribute("href") ?? ""),
      {
        documentPath: documentPayload?.path ?? null,
        confirmExternalLink,
        openDocument,
        openExternalUrl,
        resolveDocumentLink,
        navigateFragment: (fragment, context) =>
          navigateToHeading(fragment, {
            recordNavigation: !context.afterDocumentOpen,
          }),
        showInlineNotice,
      },
    );
  }

  async function openFocusedLink() {
    const active = document.activeElement;
    const link =
      active instanceof HTMLElement
        ? (active.closest("a[href]") as HTMLAnchorElement | null)
        : null;
    if (!link) {
      showInlineNotice("No focused link", { tone: "warning" });
      return;
    }
    await openLinkElement(link);
  }

  return {
    copyHeadingLink,
    headingSourceReference,
    navigateToHeading,
    openFocusedLink,
    openLinkElement,
  };
}
