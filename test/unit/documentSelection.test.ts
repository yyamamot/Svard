import { afterEach, describe, expect, it } from "vitest";

import {
  documentSelectionAtPoint,
  sourceRangeForSelection,
} from "../../src/ui/hooks/documentLinks/shared";

afterEach(() => window.getSelection()?.removeAllRanges());

describe("sourceRangeForSelection", () => {
  it("returns the exact selected code from one source block", () => {
    const article = document.createElement("article");
    article.innerHTML = `<div class="source-block-frame"><pre>const product = "Svard";\nconsole.log(product);</pre></div>`;
    const code = article.querySelector("pre")!;
    const text = code.firstChild!;
    document.body.append(article);
    const range = document.createRange();
    range.setStart(text, 6);
    range.setEnd(text, 45);
    window.getSelection()?.addRange(range);

    expect(sourceRangeForSelection()).toBe(
      'product = "Svard";\nconsole.log(product)',
    );

    article.remove();
  });

  it("does not return a range outside one visible source block", () => {
    const article = document.createElement("article");
    article.innerHTML = `<p>Before</p><div class="source-block-frame"><pre>const product = "Svard";</pre></div><div class="source-block-frame source-block-collapsed"><pre>hidden</pre></div>`;
    const paragraph = article.querySelector("p")!;
    const code = article.querySelector("pre")!;
    const hiddenCode = article.querySelectorAll("pre")[1]!;
    document.body.append(article);

    const outsideRange = document.createRange();
    outsideRange.setStart(paragraph.firstChild!, 0);
    outsideRange.setEnd(code.firstChild!, 5);
    window.getSelection()?.addRange(outsideRange);
    expect(sourceRangeForSelection()).toBeUndefined();

    window.getSelection()?.removeAllRanges();
    const hiddenRange = document.createRange();
    hiddenRange.selectNodeContents(hiddenCode);
    window.getSelection()?.addRange(hiddenRange);
    expect(sourceRangeForSelection()).toBeUndefined();

    article.remove();
  });
});

describe("documentSelectionAtPoint", () => {
  it("keeps a selection when the clicked inline element intersects its range", () => {
    const article = document.createElement("article");
    article.innerHTML = `<p>Selected <mark>text</mark>.</p>`;
    const paragraph = article.querySelector("p")!;
    const mark = article.querySelector("mark")!;
    document.body.append(article);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.getClientRects = () => [] as unknown as DOMRectList;
    window.getSelection()?.addRange(range);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => mark;

    expect(documentSelectionAtPoint(article, 10, 10)).toBe("Selected text.");

    document.elementFromPoint = original;
    article.remove();
  });

  it("uses visible math source once instead of hidden KaTeX internals", () => {
    const article = document.createElement("article");
    article.innerHTML = `<p>Equation <span class="katex" data-math-source="E = mc^2" data-math-display="inline"><span class="katex-mathml">E = mc^2</span><span class="katex-html" aria-hidden="true">hidden visual math</span></span>.</p>`;
    const paragraph = article.querySelector("p")!;
    const math = article.querySelector<HTMLElement>(".katex")!;
    document.body.append(article);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.getClientRects = () => [] as unknown as DOMRectList;
    window.getSelection()?.addRange(range);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => math;

    expect(documentSelectionAtPoint(article, 10, 10)).toBe(
      "Equation E = mc^2.",
    );

    document.elementFromPoint = original;
    article.remove();
  });

  it("treats a selection inside one KaTeX wrapper as atomic visible math", () => {
    const article = document.createElement("article");
    article.innerHTML = `<p><span class="katex" data-math-source="E = mc^2" data-math-display="inline"><span class="katex-mathml">E = mc^2</span><span class="katex-html" aria-hidden="true">hidden visual math</span></span></p>`;
    const math = article.querySelector<HTMLElement>(".katex")!;
    document.body.append(article);
    const range = document.createRange();
    range.selectNodeContents(math);
    range.getClientRects = () => [] as unknown as DOMRectList;
    window.getSelection()?.addRange(range);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => math;

    expect(documentSelectionAtPoint(article, 10, 10)).toBe("E = mc^2");

    document.elementFromPoint = original;
    article.remove();
  });
});
