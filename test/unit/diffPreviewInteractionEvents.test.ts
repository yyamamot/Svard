import { afterEach, describe, expect, it } from "vitest";

import { hasRenderedDiffSelectionAtPoint } from "../../src/ui/components/gitDiffPreview/diffPreviewInteractionEvents";

afterEach(() => window.getSelection()?.removeAllRanges());

describe("diff preview interaction events", () => {
  it("recognizes a rendered selection through an inline diff highlight", () => {
    const pane = document.createElement("section");
    pane.className = "git-rendered-pane";
    pane.dataset.reviewId = "git-rendered-right-pane";
    pane.innerHTML = `<p data-source-selection-block-id="selection-paragraph-1">Selected <mark>text</mark>.</p>`;
    document.body.append(pane);
    const paragraph = pane.querySelector("p")!;
    const mark = pane.querySelector("mark")!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.getClientRects = () => [] as unknown as DOMRectList;
    window.getSelection()?.addRange(range);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => mark;

    expect(hasRenderedDiffSelectionAtPoint(mark, 10, 10)).toBe(true);

    document.elementFromPoint = original;
    pane.remove();
  });
});
