import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  createArticleClickHandler,
  createArticleLinkCaptureHandler,
} from "../../src/ui/hooks/documentLinks/articleClick";

function clickHandler(copyText = vi.fn()) {
  return {
    copyText,
    handler: createArticleClickHandler({
      onConfirmKrokiRender: vi.fn(),
      onOpenPreferences: vi.fn(),
      onSelectDiagram: vi.fn(),
      onTryKrokiFallback: vi.fn(),
      copyText,
    }),
  };
}

function mouseEventFor(target: HTMLElement) {
  return {
    target,
    preventDefault: vi.fn(),
  } as unknown as MouseEvent<HTMLElement>;
}

describe("createArticleClickHandler source block actions", () => {
  it("toggles section collapse controls before link handling", () => {
    document.body.innerHTML = `<article><h2 data-section-collapse-heading="true" data-section-collapsed="false"><button data-section-collapse-toggle="true" aria-expanded="true"></button>Intro</h2><p>Body</p></article>`;
    const { handler } = clickHandler();
    const button = document.querySelector("button") as HTMLElement;

    handler(mouseEventFor(button));

    expect(
      document.querySelector("h2")?.getAttribute("data-section-collapsed"),
    ).toBe("true");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("copies only the rendered source block body", () => {
    document.body.innerHTML = `<div class="source-block-frame"><button data-copy-source-button="1">Copy</button><pre>const value = 1;</pre></div>`;
    const { copyText, handler } = clickHandler();

    handler(mouseEventFor(document.querySelector("button") as HTMLElement));

    expect(copyText).toHaveBeenCalledWith("Source block", "const value = 1;");
  });

  it("toggles line wrapping on the targeted source block frame", () => {
    document.body.innerHTML = `<div class="source-block-frame"><button data-source-wrap-toggle="1" aria-pressed="false">Wrap</button><pre>const value = 1;</pre></div>`;
    const { handler } = clickHandler();
    const button = document.querySelector("button") as HTMLElement;
    const frame = document.querySelector(".source-block-frame") as HTMLElement;

    handler(mouseEventFor(button));
    expect(frame.classList.contains("source-block-wrapped")).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    handler(mouseEventFor(button));
    expect(frame.classList.contains("source-block-wrapped")).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("toggles source block collapse state and action label", () => {
    document.body.innerHTML = `<div class="source-block-frame"><button data-source-collapse-toggle="1" aria-expanded="true">Collapse</button><pre>const value = 1;</pre></div>`;
    const { handler } = clickHandler();
    const button = document.querySelector("button") as HTMLElement;
    const frame = document.querySelector(".source-block-frame") as HTMLElement;

    handler(mouseEventFor(button));
    expect(frame.classList.contains("source-block-collapsed")).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.textContent).toBe("Expand");

    handler(mouseEventFor(button));
    expect(frame.classList.contains("source-block-collapsed")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.textContent).toBe("Collapse");
  });

  it("selects a clicked diagram without blocking existing handlers", () => {
    const onSelectDiagram = vi.fn();
    const handler = createArticleClickHandler({
      onConfirmKrokiRender: vi.fn(),
      onOpenPreferences: vi.fn(),
      onSelectDiagram,
      onTryKrokiFallback: vi.fn(),
      copyText: vi.fn(),
    });
    document.body.innerHTML = `<div data-diagram-id="plantuml-1"><svg><g></g></svg></div>`;

    handler(
      mouseEventFor(document.querySelector("g") as unknown as HTMLElement),
    );

    expect(onSelectDiagram).toHaveBeenCalledWith("plantuml-1");
  });
});

describe("createArticleClickHandler Kroki actions", () => {
  const documentPath = "/workspace/docs/guide.adoc";
  const diagramSlots = [
    {
      id: "kroki-1",
      diagramType: "ditaa",
      renderer: "kroki" as const,
    },
    {
      id: "plantuml-1",
      diagramType: "plantuml",
      renderer: "plantuml" as const,
    },
    {
      id: "graphviz-1",
      diagramType: "graphviz",
      renderer: "graphviz" as const,
    },
  ];

  function krokiHandler() {
    const callbacks = {
      onConfirmKrokiRender: vi.fn(),
      onOpenPreferences: vi.fn(),
      onSelectDiagram: vi.fn(),
      onTryKrokiFallback: vi.fn(),
    };
    return {
      callbacks,
      handler: createArticleClickHandler({
        ...callbacks,
        copyText: vi.fn(),
        documentPath,
        diagramSlots,
      }),
    };
  }

  it("accepts only current-render confirm, fallback, and preferences actions", () => {
    document.body.innerHTML = `
      <div class="diagram-slot" data-diagram-id="kroki-1" data-diagram-renderer="kroki">
        <button type="button" class="diagram-inline-action" data-review-id="kroki-confirm" data-kroki-confirm-key="${documentPath}::kroki:kroki-1">Render once</button>
      </div>
      <div class="diagram-slot" data-diagram-id="plantuml-1" data-diagram-renderer="plantuml">
        <button type="button" class="diagram-inline-action" data-review-id="plantuml-fallback-kroki" data-kroki-fallback-key="${documentPath}::plantuml:plantuml-1">Try with Kroki</button>
        <button type="button" class="diagram-inline-action" data-review-id="plantuml-configure-kroki" data-kroki-open-preferences="true">Configure Kroki</button>
      </div>`;
    const { callbacks, handler } = krokiHandler();

    for (const button of document.querySelectorAll("button")) {
      handler(mouseEventFor(button));
    }

    expect(callbacks.onConfirmKrokiRender).toHaveBeenCalledWith(
      `${documentPath}::kroki:kroki-1`,
    );
    expect(callbacks.onTryKrokiFallback).toHaveBeenCalledWith(
      `${documentPath}::plantuml:plantuml-1`,
    );
    expect(callbacks.onOpenPreferences).toHaveBeenCalledOnce();
    expect(callbacks.onSelectDiagram).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "unknown key",
      slot: "kroki-1",
      renderer: "kroki",
      reviewId: "kroki-confirm",
      attribute: 'data-kroki-confirm-key="unknown"',
    },
    {
      name: "different document key",
      slot: "kroki-1",
      renderer: "kroki",
      reviewId: "kroki-confirm",
      attribute:
        'data-kroki-confirm-key="/workspace/other.adoc::kroki:kroki-1"',
    },
    {
      name: "renderer mismatch",
      slot: "plantuml-1",
      renderer: "graphviz",
      reviewId: "plantuml-fallback-kroki",
      attribute: `data-kroki-fallback-key="${documentPath}::plantuml:plantuml-1"`,
    },
    {
      name: "action mismatch",
      slot: "kroki-1",
      renderer: "kroki",
      reviewId: "kroki-fallback-kroki",
      attribute: `data-kroki-fallback-key="${documentPath}::kroki:kroki-1"`,
    },
    {
      name: "forged element shape",
      slot: "kroki-1",
      renderer: "kroki",
      reviewId: "kroki-confirm",
      attribute: `data-kroki-confirm-key="${documentPath}::kroki:kroki-1"`,
      tag: "span",
    },
  ])("ignores $name without changing action state", (caseSpec) => {
    const tag = caseSpec.tag ?? "button";
    document.body.innerHTML = `<div class="diagram-slot" data-diagram-id="${caseSpec.slot}" data-diagram-renderer="${caseSpec.renderer}"><${tag} type="button" class="diagram-inline-action" data-review-id="${caseSpec.reviewId}" ${caseSpec.attribute}>Action</${tag}></div>`;
    const { callbacks, handler } = krokiHandler();
    const target = document.querySelector(tag) as HTMLElement;
    const event = mouseEventFor(target);

    handler(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(callbacks.onConfirmKrokiRender).not.toHaveBeenCalled();
    expect(callbacks.onTryKrokiFallback).not.toHaveBeenCalled();
    expect(callbacks.onOpenPreferences).not.toHaveBeenCalled();
    expect(callbacks.onSelectDiagram).not.toHaveBeenCalled();
  });
});

describe("createArticleLinkCaptureHandler", () => {
  it("captures allowed links before delegating their action", () => {
    const root = document.createElement("article");
    root.innerHTML = '<a href="next.md"><span>Next</span></a>';
    const openLinkElement = vi.fn().mockResolvedValue(undefined);
    const handler = createArticleLinkCaptureHandler({ openLinkElement });
    const event = {
      target: root.querySelector("span"),
      currentTarget: root,
      button: 0,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent<HTMLElement>;

    handler(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(openLinkElement).toHaveBeenCalledWith(root.querySelector("a"));
  });

  it("captures unsupported and modifier links without opening them", () => {
    const openLinkElement = vi.fn();
    const handler = createArticleLinkCaptureHandler({ openLinkElement });
    for (const [href, metaKey] of [
      ["mailto:user@example.test", false],
      ["https://example.test/docs", true],
    ] as const) {
      const root = document.createElement("article");
      root.innerHTML = `<a href="${href}">Link</a>`;
      const event = {
        target: root.querySelector("a"),
        currentTarget: root,
        button: 0,
        altKey: false,
        ctrlKey: false,
        metaKey,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as MouseEvent<HTMLElement>;

      handler(event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(event.stopPropagation).toHaveBeenCalledOnce();
    }
    expect(openLinkElement).not.toHaveBeenCalled();
  });
});
