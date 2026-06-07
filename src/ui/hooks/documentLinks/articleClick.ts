import type { MouseEvent } from "react";
import { isExternalUrl } from "../../lib/path";
import { toggleSectionCollapse } from "../../lib/sectionCollapse";
import type { CopyText, UseDocumentLinksOptions } from "./types";
import { isSupportedDocumentHref } from "./shared";

export function createArticleClickHandler({
  onConfirmKrokiRender,
  onOpenPreferences,
  onTryKrokiFallback,
  openLinkElement,
  copyText,
}: Pick<
  UseDocumentLinksOptions,
  "onConfirmKrokiRender" | "onOpenPreferences" | "onTryKrokiFallback"
> & {
  openLinkElement: (link: HTMLAnchorElement) => Promise<void>;
  copyText: CopyText;
}) {
  return function handleArticleClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    const krokiConfirm = target.closest<HTMLElement>(
      "[data-kroki-confirm-key]",
    );
    if (krokiConfirm?.dataset.krokiConfirmKey) {
      event.preventDefault();
      onConfirmKrokiRender(krokiConfirm.dataset.krokiConfirmKey);
      return;
    }

    const sectionCollapseToggle = target.closest<HTMLElement>(
      "[data-section-collapse-toggle]",
    );
    if (sectionCollapseToggle) {
      event.preventDefault();
      toggleSectionCollapse(sectionCollapseToggle);
      return;
    }

    const krokiFallback = target.closest<HTMLElement>(
      "[data-kroki-fallback-key]",
    );
    if (krokiFallback?.dataset.krokiFallbackKey) {
      event.preventDefault();
      onTryKrokiFallback(krokiFallback.dataset.krokiFallbackKey);
      return;
    }

    const krokiPreferences = target.closest<HTMLElement>(
      "[data-kroki-open-preferences]",
    );
    if (krokiPreferences) {
      event.preventDefault();
      onOpenPreferences();
      return;
    }

    const copyButton = target.closest("[data-copy-source-button]");
    if (copyButton) {
      const frame = copyButton.closest(".source-block-frame");
      const source = frame?.querySelector("pre")?.textContent ?? "";
      void copyText("Source block", source);
      return;
    }

    const sourceLocationButton = target.closest(
      "[data-copy-source-location-button]",
    );
    if (sourceLocationButton) {
      const frame = sourceLocationButton.closest(".source-block-frame");
      void copyText(
        "Source reference",
        frame?.getAttribute("data-source-reference") ?? undefined,
      );
      return;
    }

    const wrapButton = target.closest<HTMLElement>("[data-source-wrap-toggle]");
    if (wrapButton) {
      const frame = wrapButton.closest(".source-block-frame");
      const wrapped = !frame?.classList.contains("source-block-wrapped");
      frame?.classList.toggle("source-block-wrapped", wrapped);
      wrapButton.setAttribute("aria-pressed", wrapped ? "true" : "false");
      return;
    }

    const collapseButton = target.closest<HTMLElement>(
      "[data-source-collapse-toggle]",
    );
    if (collapseButton) {
      const frame = collapseButton.closest(".source-block-frame");
      const collapsed = !frame?.classList.contains("source-block-collapsed");
      frame?.classList.toggle("source-block-collapsed", collapsed);
      collapseButton.setAttribute(
        "aria-expanded",
        collapsed ? "false" : "true",
      );
      collapseButton.textContent = collapsed ? "Expand" : "Collapse";
      collapseButton.title = collapsed
        ? "Expand source block"
        : "Collapse source block";
      return;
    }

    const link = target.closest("a[href]") as HTMLAnchorElement | null;
    if (!link) {
      return;
    }

    const href = link.getAttribute("href") ?? "";
    if (
      isExternalUrl(href) ||
      isSupportedDocumentHref(href) ||
      href.startsWith("#")
    ) {
      event.preventDefault();
      void openLinkElement(link);
    }
  };
}
