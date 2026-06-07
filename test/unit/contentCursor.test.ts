import { describe, expect, it, vi } from "vitest";

import {
  clearContentCursor,
  extractContentCursorTargets,
  moveContentCursor,
} from "../../src/ui/lib/contentCursor";

function rootFromHtml(html: string) {
  const root = document.createElement("article");
  root.innerHTML = html;
  document.body.replaceChildren(root);
  root.querySelectorAll<HTMLElement>("*").forEach((element, index) => {
    element.getBoundingClientRect = vi.fn(
      () =>
        ({
          top: index * 100,
          bottom: index * 100 + 20,
          left: 0,
          right: 100,
          width: 100,
          height: 20,
          x: 0,
          y: index * 100,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    element.scrollIntoView = vi.fn();
  });
  return root;
}

describe("content cursor", () => {
  it("extracts technical document block targets", () => {
    const root = rootFromHtml(`
      <h1>Title</h1>
      <p>Intro</p>
      <ul><li>Item</li></ul>
      <table><tbody><tr><td>Cell paragraph</td></tr></tbody></table>
      <div class="source-block-frame"><button>Copy</button><pre>code</pre></div>
      <div class="imageblock"><div class="content"><img alt="diagram"></div></div>
      <div class="diagram-inline-diagnostic"><span>Diagram unavailable</span></div>
    `);

    expect(
      extractContentCursorTargets(root).map((target) => target.tagName),
    ).toEqual(["H1", "P", "UL", "TABLE", "DIV", "DIV", "DIV"]);
  });

  it("excludes hidden, empty, nested, and control-only elements", () => {
    const root = rootFromHtml(`
      <h2>Visible heading</h2>
      <p hidden>Hidden paragraph</p>
      <p>  </p>
      <ul><li><p>Nested paragraph</p></li></ul>
      <table><tbody><tr><td><p>Nested cell paragraph</p></td></tr></tbody></table>
      <div class="source-block-frame"><button>Copy</button><pre>code</pre></div>
      <button><p>Control text</p></button>
    `);

    expect(
      extractContentCursorTargets(root).map((target) =>
        target.textContent?.trim(),
      ),
    ).toEqual([
      "Visible heading",
      "Nested paragraph",
      "Nested cell paragraph",
      "Copycode",
    ]);
  });

  it("moves from the nearest viewport target and clamps at document edges", () => {
    const root = rootFromHtml(`
      <h1>Title</h1>
      <p>First</p>
      <p>Second</p>
    `);
    const scrollContainer = document.createElement("section");
    scrollContainer.getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 0,
          bottom: 600,
          left: 0,
          right: 800,
          width: 800,
          height: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    expect(
      moveContentCursor({ root, scrollContainer, direction: "next" }),
    ).toBe(true);
    expect(
      root.querySelector("[data-review-id='content-cursor-active']")
        ?.textContent,
    ).toBe("First");

    expect(
      moveContentCursor({ root, scrollContainer, direction: "next" }),
    ).toBe(true);
    expect(
      root.querySelector("[data-review-id='content-cursor-active']")
        ?.textContent,
    ).toBe("Second");

    expect(
      moveContentCursor({ root, scrollContainer, direction: "next" }),
    ).toBe(true);
    expect(
      root.querySelector("[data-review-id='content-cursor-active']")
        ?.textContent,
    ).toBe("Second");

    expect(
      moveContentCursor({ root, scrollContainer, direction: "previous" }),
    ).toBe(true);
    expect(
      root.querySelector("[data-review-id='content-cursor-active']")
        ?.textContent,
    ).toBe("First");
  });

  it("clears active cursor state and restores an existing review id", () => {
    const root = rootFromHtml(`<h2 data-review-id="heading-marker">Title</h2>`);
    const scrollContainer = document.createElement("section");

    moveContentCursor({ root, scrollContainer, direction: "previous" });
    const active = root.querySelector("h2");
    expect(active?.getAttribute("data-review-id")).toBe(
      "content-cursor-active",
    );

    clearContentCursor(root);
    expect(active?.classList.contains("content-cursor-active")).toBe(false);
    expect(active?.getAttribute("data-review-id")).toBe("heading-marker");
  });
});
