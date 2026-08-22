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
