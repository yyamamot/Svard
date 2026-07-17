import { describe, expect, it } from "vitest";

import {
  changedRenderedBlocks,
  compareRenderedBlocks,
  isRenderedChangeBlock,
  renderedBlockVisualClass,
  renderedInlineDiffRanges,
} from "../../src/ui/lib/gitRenderedDiff";
import { blocksFromHtml } from "./helpers/gitRenderedDiffFixtures";

describe("git rendered diff matching", () => {
  it("compares rendered blocks while preserving unchanged preview context", () => {
    const left = blocksFromHtml(`<h1>Title</h1>
<p>Old paragraph</p>
<ul><li>Existing item</li></ul>`);
    const right = blocksFromHtml(`<h1>Title</h1>
<p>New paragraph</p>
<ul><li>Existing item</li><li>Added item</li></ul>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff.map((block) => block.kind)).toEqual([
      "unchanged",
      "changed",
      "changed",
    ]);
    expect(
      diff.filter(isRenderedChangeBlock).map((block) => block.kind),
    ).toEqual(["changed", "changed"]);
    expect(diff[1]?.blockKind).toBe("paragraph");
    expect(diff[1]?.left?.text).toBe("Old paragraph");
    expect(diff[1]?.right?.text).toBe("New paragraph");
    expect(diff[2]?.blockKind).toBe("list");
    expect(diff[2]?.right?.text).toBe("Existing item Added item");
    expect(changedRenderedBlocks(diff).map((block) => block.kind)).toEqual([
      "changed",
      "changed",
    ]);
  });

  it("keeps identical source blocks unchanged when gap pairing handles surrounding changes", () => {
    const left = blocksFromHtml(`<p>Run the standard gates.</p>
<pre class="hljs"><code class="language-bash">make -f Makefile.private mirror-status
make -f Makefile.private mirror-sync
make -f Makefile.private mirror-package
make -f Makefile.private mirror-commit</code></pre>
<p>Continue with the public mirror review.</p>`);
    const right = blocksFromHtml(`<p>Run the standard gates before export.</p>
<pre class="hljs"><code>make -f Makefile.private mirror-status
make -f Makefile.private mirror-sync
make -f Makefile.private mirror-package
make -f Makefile.private mirror-commit</code></pre>
<p>Continue with the public mirror review after the readiness check.</p>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff.map((block) => block.kind)).toEqual([
      "changed",
      "unchanged",
      "changed",
    ]);
    expect(diff[1]).toMatchObject({
      blockKind: "source-block",
      left: expect.objectContaining({
        text: expect.stringContaining("mirror-status"),
      }),
      right: expect.objectContaining({
        text: expect.stringContaining("mirror-status"),
      }),
    });
  });

  it("keeps identical table content unchanged when rendered table HTML differs", () => {
    const left = blocksFromHtml(`<table class="tableblock">
<tbody><tr><td class="halign-left">Name</td><td>Status</td></tr>
<tr><td>Basic</td><td>Stable</td></tr></tbody>
</table>`);
    const right = blocksFromHtml(`<table class="tableblock stretch">
<tbody><tr><td class="halign-left valign-top">Name</td><td>Status</td></tr>
<tr><td>Basic</td><td>Stable</td></tr></tbody>
</table>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({
      kind: "unchanged",
      blockKind: "table",
      left: expect.objectContaining({
        text: "NameStatus BasicStable",
      }),
      right: expect.objectContaining({
        text: "NameStatus BasicStable",
      }),
    });
  });

  it("keeps changed source blocks diffable by word while preserving token HTML", () => {
    const left = blocksFromHtml(
      `<pre class="hljs"><code class="language-ts"><span class="hljs-keyword">const</span> label = <span class="hljs-string">"old"</span>;</code></pre>`,
    );
    const right = blocksFromHtml(
      `<pre class="hljs"><code class="language-ts"><span class="hljs-keyword">const</span> label = <span class="hljs-string">"new"</span>;</code></pre>`,
    );

    const diff = compareRenderedBlocks(left, right);

    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({
      kind: "changed",
      blockKind: "source-block",
      left: expect.objectContaining({
        text: 'const label = "old";',
        html: expect.stringContaining("hljs-string"),
      }),
      right: expect.objectContaining({
        text: 'const label = "new";',
        html: expect.stringContaining("hljs-string"),
      }),
    });
    expect(
      renderedInlineDiffRanges(
        diff[0]?.left?.text,
        diff[0]?.right?.text,
        "left",
      ),
    ).toEqual([{ kind: "removed", start: 15, end: 18 }]);
    expect(
      renderedInlineDiffRanges(
        diff[0]?.left?.text,
        diff[0]?.right?.text,
        "right",
      ),
    ).toEqual([{ kind: "added", start: 15, end: 18 }]);
  });

  it("does not count unchanged diagrams as rendered changes when only a local image is added", () => {
    const diagramSignatures = new Map([
      [
        "mermaid-1",
        "diagram:mermaid:mermaid:flowchart TD\nA[Start] --> B[Done]",
      ],
    ]);
    const left = blocksFromHtml(
      `<h1>Diagram Image Diff Fixture</h1>
<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid"></div>
<p><img src="data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E" alt="Stable image"></p>`,
      { diagramSignatures },
    );
    const right = blocksFromHtml(
      `<h1>Diagram Image Diff Fixture</h1>
<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid"></div>
<p><img src="data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E" alt="Stable image"></p>
<p><img src="data:image/png;base64,iVBORw0KGgo=" alt="Added image"></p>`,
      { diagramSignatures },
    );

    const blocks = compareRenderedBlocks(left, right);
    const changed = changedRenderedBlocks(blocks);

    expect(
      blocks
        .filter((block) => block.blockKind === "diagram")
        .map((block) => block.kind),
    ).toEqual(["unchanged"]);
    expect(changed.map((block) => block.blockKind)).toEqual(["image"]);
    expect(
      changed.some((block) => block.left?.html.includes("flowchart TD")),
    ).toBe(false);
    expect(
      changed.some((block) => block.right?.html.includes("flowchart TD")),
    ).toBe(false);
  });

  it("preserves nested list HTML for full preview diff blocks", () => {
    const [list] = blocksFromHtml(`<ul>
<li>Local-first rendering:
  <ul>
    <li>AsciiDoc / Markdown parsing stays local.</li>
    <li>Common diagrams remain readable offline.</li>
  </ul>
</li>
<li>Preview-based diff:
  <ul>
    <li>Rendered preview is the primary comparison surface.</li>
  </ul>
</li>
</ul>`);

    expect(list?.kind).toBe("list");
    expect(list?.html).toContain("<ul>");
    expect(list?.html).toMatch(/<li>Preview-based diff:[\s\S]*<ul>/u);
  });

  it("aligns inserted paragraphs without shifting the following heading", () => {
    const left = blocksFromHtml(`<h2>Product Principles</h2>
<ul><li>Local-first rendering</li><li>Browser-like viewer</li></ul>
<h2>Scope</h2>`);
    const right = blocksFromHtml(`<p>Git diff is preview based.</p>
<h2>Product Principles</h2>
<ul><li>Local-first rendering</li><li>Preview-based diff</li><li>Browser-like viewer</li></ul>
<h2>Scope</h2>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff.map((block) => block.kind)).toEqual([
      "added",
      "unchanged",
      "changed",
      "unchanged",
    ]);
    expect(diff[0]?.right?.text).toBe("Git diff is preview based.");
    expect(diff[1]?.left?.text).toBe("Product Principles");
    expect(diff[1]?.right?.text).toBe("Product Principles");
    expect(diff[2]?.blockKind).toBe("list");
    expect(diff[3]?.left?.text).toBe("Scope");
  });

  it("resyncs stable backlog sections after a deleted section", () => {
    const left = blocksFromHtml(`<h2>IMP-095: Content cursor</h2>
<ul><li>Status: Done</li><li>Future gates: cursor basic</li></ul>
<h2>IMP-096: Lightweight action feedback</h2>
<ul><li>Status: Backlog</li><li>Goal: Lightweight feedback</li></ul>
<h2>IMP-097: Pinned search color model polish</h2>
<ul><li>Status: Backlog</li><li>Goal: Search polish</li></ul>`);
    const right = blocksFromHtml(`<h2>IMP-096: Lightweight action feedback</h2>
<ul><li>Status: Backlog</li><li>Goal: Lightweight feedback</li></ul>
<h2>IMP-097: Pinned search color model polish</h2>
<ul><li>Status: Backlog</li><li>Goal: Search polish</li></ul>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff.map((block) => block.kind)).toEqual([
      "removed",
      "removed",
      "unchanged",
      "unchanged",
      "unchanged",
      "unchanged",
    ]);
    expect(diff[2]?.left?.text).toBe("IMP-096: Lightweight action feedback");
    expect(diff[3]?.right?.text).toBe(
      "Status: Backlog Goal: Lightweight feedback",
    );
    expect(
      diff
        .filter((block) => block.left?.text?.includes("IMP-096"))
        .map((block) => block.kind),
    ).toEqual(["unchanged"]);
  });

  it("keeps duplicate heading anchors in document order", () => {
    const left = blocksFromHtml(`<h2>Duplicate</h2>
<p>Removed introduction</p>
<h2>Duplicate</h2>
<p>Stable body</p>`);
    const right = blocksFromHtml(`<h2>Duplicate</h2>
<p>Stable body</p>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff.map((block) => block.kind)).toEqual([
      "removed",
      "removed",
      "unchanged",
      "unchanged",
    ]);
    expect(diff[2]?.left?.text).toBe("Duplicate");
    expect(diff[3]?.left?.text).toBe("Stable body");
  });

  it("anchors unchanged headings while keeping changed section body marked", () => {
    const left = blocksFromHtml(`<h2>Shared Heading</h2>
<p>Old section body</p>`);
    const right = blocksFromHtml(`<h2>Shared Heading</h2>
<p>New section body</p>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff.map((block) => block.kind)).toEqual(["unchanged", "changed"]);
    expect(diff[0]?.left?.text).toBe("Shared Heading");
    expect(diff[1]?.left?.text).toBe("Old section body");
    expect(diff[1]?.right?.text).toBe("New section body");
  });

  it("keeps related heading rename as changed and unrelated heading replacement one-sided", () => {
    const relatedLeft = blocksFromHtml(`<h2>Preview diff</h2>`);
    const relatedRight = blocksFromHtml(`<h2>Rendered preview diff</h2>`);
    const unrelatedLeft = blocksFromHtml(`<h2>Packaging</h2>`);
    const unrelatedRight = blocksFromHtml(`<h2>Security</h2>`);

    expect(
      compareRenderedBlocks(relatedLeft, relatedRight).map(
        (block) => block.kind,
      ),
    ).toEqual(["changed"]);
    expect(
      compareRenderedBlocks(unrelatedLeft, unrelatedRight).map(
        (block) => block.kind,
      ),
    ).toEqual(["removed", "added"]);
  });

  it("does not use diagram or image blocks as stable anchors", () => {
    const left = blocksFromHtml(`<div class="diagram-slot"></div>
<p><img src="data:image/png;base64,AA==" alt="Same image"></p>`);
    const right = blocksFromHtml(`<div class="diagram-slot"></div>
<p><img src="data:image/png;base64,BB==" alt="Same image"></p>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff.map((block) => block.kind)).toEqual(["changed", "changed"]);
    expect(diff.map((block) => block.blockKind)).toEqual(["diagram", "image"]);
  });

  it("does not pair unrelated same-kind blocks as a changed block", () => {
    const left = blocksFromHtml(`<p>Release notes for desktop packaging.</p>
<h2>Stable Heading</h2>`);
    const right = blocksFromHtml(`<p>Diagram preview privacy policy.</p>
<h2>Stable Heading</h2>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff.map((block) => block.kind)).toEqual([
      "removed",
      "added",
      "unchanged",
    ]);
  });

  it("treats inline markup-only changes as rendered changes", () => {
    const left = blocksFromHtml(`<p>Use <strong>bold</strong> text.</p>`);
    const right = blocksFromHtml(`<p>Use bold text.</p>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff).toHaveLength(1);
    expect(diff[0]?.kind).toBe("changed");
    expect(diff[0]?.left?.text).toBe(diff[0]?.right?.text);
  });

  it("assigns side-aware visual classes for rendered diff blocks", () => {
    const [removed, added, changed, unchanged] = [
      { id: "removed", kind: "removed", blockKind: "paragraph" },
      { id: "added", kind: "added", blockKind: "paragraph" },
      { id: "changed", kind: "changed", blockKind: "paragraph" },
      { id: "unchanged", kind: "unchanged", blockKind: "paragraph" },
    ] as const;

    expect(renderedBlockVisualClass(removed, "left")).toBe("removed");
    expect(renderedBlockVisualClass(removed, "right")).toBe("blank");
    expect(renderedBlockVisualClass(added, "left")).toBe("blank");
    expect(renderedBlockVisualClass(added, "right")).toBe("added");
    expect(renderedBlockVisualClass(changed, "left")).toBe("changed");
    expect(renderedBlockVisualClass(unchanged, "right")).toBe("unchanged");
  });
});
