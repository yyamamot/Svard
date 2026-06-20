import { afterEach, describe, expect, it, vi } from "vitest";

import {
  diagramInspectorJumpHighlightClass,
  diagramRevealTarget,
  revealDiagramInViewer,
} from "../../src/ui/lib/diagramReveal";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function articleFromHtml(html: string) {
  const article = document.createElement("article");
  article.innerHTML = html;
  document.body.replaceChildren(article);
  article.querySelectorAll<HTMLElement>("*").forEach((element) => {
    element.scrollIntoView = vi.fn();
  });
  return article;
}

describe("diagramReveal", () => {
  it("prefers the rendered diagram wrapper over nested diagram image nodes", () => {
    const article = articleFromHtml(`
      <div class="diagram-inline" data-diagram-id="plantuml-1">
        <div class="diagram-inline-image" data-diagram-id="plantuml-1"></div>
      </div>
    `);

    expect(diagramRevealTarget(article, "plantuml-1")).toBe(
      article.querySelector(".diagram-inline"),
    );
  });

  it("scrolls the target diagram into view and applies a temporary highlight", () => {
    vi.useFakeTimers();
    const article = articleFromHtml(`
      <div class="diagram-inline" data-diagram-id="graphviz-1"></div>
    `);
    const target = article.querySelector<HTMLElement>(".diagram-inline")!;

    revealDiagramInViewer(article, "graphviz-1");

    expect(target.scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      behavior: "smooth",
    });
    expect(target.classList.contains(diagramInspectorJumpHighlightClass)).toBe(
      true,
    );
    expect(target.getAttribute("data-diagram-inspector-jump-highlight")).toBe(
      "true",
    );

    vi.advanceTimersByTime(1800);

    expect(target.classList.contains(diagramInspectorJumpHighlightClass)).toBe(
      false,
    );
    expect(target.hasAttribute("data-diagram-inspector-jump-highlight")).toBe(
      false,
    );
  });

  it("does nothing when the diagram target is not present", () => {
    const article = articleFromHtml(`<p>No diagrams</p>`);

    expect(() => revealDiagramInViewer(article, "missing-1")).not.toThrow();
  });
});
