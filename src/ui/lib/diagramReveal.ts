import { expandCollapsedSectionsContaining } from "./sectionCollapse";

export const diagramInspectorJumpHighlightClass =
  "diagram-inspector-jump-highlight";

const diagramRevealSelectors = [
  ".diagram-slot",
  ".diagram-inline",
  ".diagram-placeholder-card",
  ".diagram-inline-diagnostic",
  ".diagram-inline-image",
];

export function revealDiagramInViewer(
  article: HTMLElement | null,
  diagramId: string,
) {
  const target = diagramRevealTarget(article, diagramId);
  if (!target) {
    return;
  }
  expandCollapsedSectionsContaining(target);
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target.classList.add(diagramInspectorJumpHighlightClass);
  target.setAttribute("data-diagram-inspector-jump-highlight", "true");
  window.setTimeout(() => {
    target.classList.remove(diagramInspectorJumpHighlightClass);
    target.removeAttribute("data-diagram-inspector-jump-highlight");
  }, 1800);
}

export function diagramRevealTarget(
  article: HTMLElement | null,
  diagramId: string,
): HTMLElement | null {
  if (!article) {
    return null;
  }
  const escapedId = cssEscape(diagramId);
  for (const selector of diagramRevealSelectors) {
    const target = article.querySelector<HTMLElement>(
      `${selector}[data-diagram-id="${escapedId}"]`,
    );
    if (target) {
      return target;
    }
  }
  return article.querySelector<HTMLElement>(`[data-diagram-id="${escapedId}"]`);
}

function cssEscape(value: string): string {
  return (
    globalThis.CSS?.escape(value) ??
    value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  );
}
