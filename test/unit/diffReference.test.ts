import { describe, expect, it } from "vitest";

import {
  diffReferenceForTarget,
  originalDiffTextReferenceForSelection,
} from "../../src/ui/lib/diffReference";
import type { DocumentDiffPreview } from "../../src/core/types";

const preview: DocumentDiffPreview = {
  repositoryRoot: "/workspace",
  relativePath: "docs/guide.md",
  leftPath: "/workspace/docs/guide.md",
  rightPath: "/workspace/docs/guide.md",
  status: "modified",
  leftLabel: "HEAD",
  rightLabel: "Working Tree",
  hunks: [],
  leftText: "Before *text*.\n",
  rightText: "After *text*.\n",
};

describe("diff reference", () => {
  it("copies matching before and after source blocks", () => {
    const surface = document.createElement("div");
    surface.className = "git-diff-body-with-ruler";
    surface.innerHTML = `<article class="git-rendered-block left-side" data-sync-index="1" data-change-index="0"><p data-source-selection-start="1" data-source-selection-end="1">Before text.</p></article><article class="git-rendered-block right-side" data-sync-index="1" data-change-index="0"><p data-source-selection-start="1" data-source-selection-end="1">After text.</p></article>`;
    document.body.append(surface);
    const target = surface.querySelector<HTMLElement>(".right-side p")!;

    expect(
      diffReferenceForTarget({
        target,
        preview,
        leftPath: preview.leftPath!,
        rightPath: preview.rightPath!,
      })?.value,
    ).toBe(`File: /workspace/docs/guide.md
Change: modified

Before (HEAD):
File: /workspace/docs/guide.md:1-1
Original text:
Before *text*.

After (Working Tree):
File: /workspace/docs/guide.md:1-1
Original text:
After *text*.`);
    surface.remove();
  });

  it("uses a none marker for an added block", () => {
    const surface = document.createElement("div");
    surface.className = "git-diff-body-with-ruler";
    surface.innerHTML = `<article class="git-rendered-block left-side blank" data-sync-index="1" data-change-index="0"></article><article class="git-rendered-block right-side" data-sync-index="1" data-change-index="0"><p data-source-selection-start="1" data-source-selection-end="1">After text.</p></article>`;
    document.body.append(surface);
    const target = surface.querySelector<HTMLElement>(".right-side p")!;

    expect(
      diffReferenceForTarget({ target, preview, leftPath: preview.leftPath!, rightPath: preview.rightPath! })?.value,
    ).toContain("Change: added\n\nBefore (HEAD):\n(none)");
    surface.remove();
  });

  it("copies source blocks from a paragraph through a code block", () => {
    const pane = document.createElement("section");
    pane.className = "git-rendered-pane";
    pane.innerHTML = `<article class="git-rendered-block right-side"><h1 data-source-selection-start="1" data-source-selection-end="1">Guide</h1><p data-source-selection-start="3" data-source-selection-end="3">Before paragraph.</p></article><article class="git-rendered-block right-side"><div class="source-block-frame" data-source-selection-start="5" data-source-selection-end="7"><pre data-source-selection-start="5" data-source-selection-end="7">$ run</pre></div></article><article class="git-rendered-block right-side"><p data-source-selection-start="9" data-source-selection-end="9">After paragraph.</p></article>`;
    document.body.append(pane);
    const paragraph = pane.querySelector("p")!;
    const pre = pane.querySelector("pre")!;
    const range = document.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(pre.firstChild!, pre.textContent!.length);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    expect(originalDiffTextReferenceForSelection({
      target: paragraph,
      preview: {
        ...preview,
        rightText: "# Guide\n\nBefore *paragraph*.\n\n```sh\n$ run\n```\n\nAfter paragraph.\n",
      },
      path: preview.rightPath!,
      side: "right",
    })?.value).toBe(`File: /workspace/docs/guide.md:3-7
Revision: Working Tree (right)
Section: Guide
Original text:
Before *paragraph*.

\`\`\`sh
$ run
\`\`\``);
    const after = pane.querySelectorAll("p")[1]!;
    const codeToParagraph = document.createRange();
    codeToParagraph.setStart(pre.firstChild!, 0);
    codeToParagraph.setEnd(after.firstChild!, after.textContent!.length);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(codeToParagraph);
    expect(originalDiffTextReferenceForSelection({
      target: pre,
      preview: {
        ...preview,
        rightText: "# Guide\n\nBefore *paragraph*.\n\n```sh\n$ run\n```\n\nAfter paragraph.\n",
      },
      path: preview.rightPath!,
      side: "right",
    })?.value).toContain("File: /workspace/docs/guide.md:5-9\nRevision: Working Tree (right)");
    window.getSelection()?.removeAllRanges();
    pane.remove();
  });

  it("does not copy a cross-block selection that contains include source", () => {
    const pane = document.createElement("section");
    pane.className = "git-rendered-pane";
    pane.innerHTML = `<article class="git-rendered-block right-side"><p data-source-selection-start="1" data-source-selection-end="1">Root.</p></article><article class="git-rendered-block right-side"><p data-source-selection-start="1" data-source-selection-end="1" data-source-selection-source-path="/workspace/docs/include.md">Included.</p></article>`;
    document.body.append(pane);
    const paragraphs = pane.querySelectorAll("p");
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild!, 0);
    range.setEnd(paragraphs[1].firstChild!, 9);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    expect(originalDiffTextReferenceForSelection({
      target: paragraphs[0],
      preview,
      path: preview.rightPath!,
      side: "right",
    })).toBeUndefined();
    window.getSelection()?.removeAllRanges();
    pane.remove();
  });

});
