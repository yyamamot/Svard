import type { MouseEvent } from "react";
import type { DiagramSlot } from "../../../core/types";
import { captureDocumentLinkActivation } from "../../lib/documentLinkNavigation";
import { toggleSectionCollapse } from "../../lib/sectionCollapse";
import type { CopyText, UseDocumentLinksOptions } from "./types";

export function createArticleLinkCaptureHandler({
  openLinkElement,
}: {
  openLinkElement: (link: HTMLAnchorElement) => Promise<void>;
}) {
  return function handleArticleLinkCapture(event: MouseEvent<HTMLElement>) {
    const activation = captureDocumentLinkActivation(event);
    if (!activation || activation.intent.kind === "blocked") {
      return;
    }
    void openLinkElement(activation.link);
  };
}

export function createArticleClickHandler({
  documentPath,
  diagramSlots,
  onConfirmKrokiRender,
  onOpenPreferences,
  onSelectDiagram,
  onTryKrokiFallback,
  copyText,
}: Pick<
  UseDocumentLinksOptions,
  | "onConfirmKrokiRender"
  | "onOpenPreferences"
  | "onSelectDiagram"
  | "onTryKrokiFallback"
> & {
  copyText: CopyText;
  documentPath?: string | null;
  diagramSlots?: readonly DiagramSlot[];
}) {
  const slotsById = new Map(
    (diagramSlots ?? []).map((slot) => [slot.id, slot]),
  );

  function trustedKrokiAction(
    target: HTMLElement,
    action: "confirm" | "fallback" | "preferences",
  ): { element: HTMLButtonElement; key?: string } | null {
    const attribute =
      action === "confirm"
        ? "data-kroki-confirm-key"
        : action === "fallback"
          ? "data-kroki-fallback-key"
          : "data-kroki-open-preferences";
    const element = target.closest<HTMLButtonElement>(`button[${attribute}]`);
    if (
      !element ||
      element.type !== "button" ||
      !element.classList.contains("diagram-inline-action")
    ) {
      return null;
    }
    const slotElement = element.closest<HTMLElement>(
      ".diagram-slot[data-diagram-id][data-diagram-renderer]",
    );
    const slotId = slotElement?.dataset.diagramId;
    const slot = slotId ? slotsById.get(slotId) : undefined;
    if (
      !documentPath ||
      !slot ||
      slotElement?.dataset.diagramRenderer !== slot.renderer
    ) {
      return null;
    }

    const expectedReviewId =
      action === "confirm"
        ? "kroki-confirm"
        : action === "fallback"
          ? `${slot.renderer}-fallback-kroki`
          : `${slot.renderer}-configure-kroki`;
    if (element.dataset.reviewId !== expectedReviewId) return null;

    if (action !== "confirm" && slot.renderer === "kroki") return null;
    if (action === "preferences") {
      return element.getAttribute(attribute) === "true" ? { element } : null;
    }

    const key = element.getAttribute(attribute) ?? "";
    const expectedKey = `${documentPath}::${slot.renderer}:${slot.id}`;
    return key === expectedKey ? { element, key } : null;
  }

  return function handleArticleClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    const hasKrokiActionMetadata = target.closest(
      "[data-kroki-confirm-key], [data-kroki-fallback-key], [data-kroki-open-preferences]",
    );
    if (hasKrokiActionMetadata) {
      event.preventDefault();
      const krokiConfirm = trustedKrokiAction(target, "confirm");
      if (krokiConfirm?.key) {
        onConfirmKrokiRender(krokiConfirm.key);
        return;
      }
      const krokiFallback = trustedKrokiAction(target, "fallback");
      if (krokiFallback?.key) {
        onTryKrokiFallback(krokiFallback.key);
        return;
      }
      if (trustedKrokiAction(target, "preferences")) {
        onOpenPreferences();
      }
      return;
    }

    const diagram = target.closest<HTMLElement>("[data-diagram-id]");
    if (diagram?.dataset.diagramId) {
      onSelectDiagram(diagram.dataset.diagramId);
    }

    const sectionCollapseToggle = target.closest<HTMLElement>(
      "[data-section-collapse-toggle]",
    );
    if (sectionCollapseToggle) {
      event.preventDefault();
      toggleSectionCollapse(sectionCollapseToggle);
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
  };
}
