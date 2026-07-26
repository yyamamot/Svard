import { beforeEach, describe, expect, it } from "vitest";
import type { DocumentDiffPreview } from "../../src/core/types";
import {
  extractRenderedDiffSelection,
  renderedDiffReference,
  revealRenderedDiffSelection,
} from "../../src/ui/lib/diffDocumentSelection";
import { selectionTextReference } from "../../src/ui/lib/documentSelection";

const preview: DocumentDiffPreview = {
  source: "git",
  repositoryRoot: "/workspace",
  relativePath: "docs/guide.md",
  leftPath: "/workspace/docs/guide.md",
  rightPath: "/workspace/docs/guide.md",
  leftLabel: "HEAD",
  rightLabel: "Working tree",
  status: "modified",
  hunks: [],
  leftText: "# Guide\nBefore text\n",
  rightText: "# Guide\nAfter text\n",
};

describe("rendered diff document selections", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main id="root">
        <section class="git-rendered-diff-body">
          <section class="git-rendered-pane"
            data-capture-side="right"
            data-capture-revision-label="Working tree">
            <article class="git-rendered-block right-side"
              data-sync-index="1" data-change-index="0">
              <p data-source-selection-start="2"
                data-source-selection-end="2"
                data-source-selection-source-path="/workspace/docs/guide.md">After text</p>
            </article>
          </section>
        </section>
      </main>`;
  });

  it("adds safe side and revision context without exposing the workspace path", async () => {
    const pane = document.querySelector<HTMLElement>(".git-rendered-pane")!;
    const text = pane.querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, text.textContent!.length);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const snapshot = await extractRenderedDiffSelection({
      pane,
      preview,
      range,
      side: "right",
      comparisonLabel: "HEAD → Working tree",
    });

    expect(snapshot.documentPath).toBe("docs/guide.md");
    expect(snapshot.diffContext).toEqual({
      kind: "renderedDiff",
      displayPath: "docs/guide.md",
      side: "right",
      revisionLabel: "Working tree",
      comparisonLabel: "HEAD → Working tree",
    });
    expect(snapshot.provenance).toEqual([
      {
        sourcePath: "docs/guide.md",
        startLine: 2,
        endLine: 2,
        exact: true,
      },
    ]);
    expect(selectionTextReference(snapshot)).toContain(
      "Revision: Working tree (right)",
    );
    expect(selectionTextReference(snapshot)).not.toContain("/workspace");
  });

  it("only offers a diff reference inside one changed sync block", () => {
    const pane = document.querySelector<HTMLElement>(".git-rendered-pane")!;
    const text = pane.querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(text);
    expect(
      renderedDiffReference({ pane, preview, side: "right" }, range),
    ).toContain("Change: added");

    const other = document.createElement("p");
    other.textContent = "Other";
    pane.append(other);
    range.setEnd(other.firstChild!, 5);
    expect(
      renderedDiffReference({ pane, preview, side: "right" }, range),
    ).toBeUndefined();
  });

  it("reveals the immutable snapshot in its original side", async () => {
    const root = document.querySelector<HTMLElement>("#root")!;
    const pane = document.querySelector<HTMLElement>(".git-rendered-pane")!;
    const text = pane.querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(text);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const snapshot = await extractRenderedDiffSelection({
      pane,
      preview,
      range,
      side: "right",
    });

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: () => undefined,
    });
    window.getSelection()?.removeAllRanges();
    expect(revealRenderedDiffSelection(root, snapshot)).toBe(true);
    expect(window.getSelection()?.toString()).toBe("After text");
  });
});
