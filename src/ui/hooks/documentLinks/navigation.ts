import { isExternalUrl, splitPathAndHash } from "../../lib/path";
import { expandCollapsedSectionsContaining } from "../../lib/sectionCollapse";
import type { CopyText, UseDocumentLinksOptions } from "./types";
import { isSupportedDocumentHref } from "./shared";

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
    const href = link.getAttribute("href") ?? "";
    if (!href) {
      return;
    }

    if (href.startsWith("#")) {
      navigateToHeading(decodeURIComponent(href.slice(1)));
      return;
    }

    if (isExternalUrl(href)) {
      if (await confirmExternalLink(href)) {
        try {
          await openExternalUrl(href);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "External link open failed";
          showInlineNotice(message, { tone: "error" });
        }
      }
      return;
    }

    if (isSupportedDocumentHref(href)) {
      const target = splitPathAndHash(href);
      const resolved = documentPayload
        ? await resolveDocumentLink(href, documentPayload.path)
        : {
            status: "resolved" as const,
            path: target.path,
            hash: target.hash,
          };
      if (resolved.status !== "resolved" || !resolved.path) {
        showInlineNotice(resolved.message ?? "Document link is not available", {
          tone: "warning",
        });
        return;
      }
      await openDocument(resolved.path);
      const hash = resolved.hash ?? target.hash;
      if (hash) {
        window.setTimeout(
          () => navigateToHeading(hash, { recordNavigation: false }),
          50,
        );
      }
    }
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
