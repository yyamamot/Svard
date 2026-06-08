import { describe, expect, it } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import {
  buildRenderedDiffPresentation,
  changedRenderedBlocks,
  compareRenderedBlocks,
  extractRenderedBlocksFromHtml,
  isRenderedChangeBlock,
  nextRenderedDiffContentCursorTarget,
  renderedDiffListItemChangeIndex,
  renderedDiffContentCursorTargets,
  renderedInlineDiffRanges,
  renderedTextOverlap,
  renderedBlockVisualClass,
  renderedListItemHighlightsForSide,
  applyRenderedListItemHighlights,
  wordDiffParts,
} from "../../src/ui/lib/gitRenderedDiff";
import {
  sanitizeRenderedBlockHtml,
  unwrapSafeHtml,
} from "../../src/ui/lib/sanitizeHtml";

describe("git rendered diff", () => {
  it("extracts rendered blocks from document HTML", () => {
    const blocks = extractRenderedBlocksFromHtml(`<h1>Title</h1>
<p>Intro <strong>text</strong></p>
<ul><li>First item</li></ul>
<div class="admonitionblock"><table><tr><td>Note body</td></tr></table></div>
<pre><code>const value = 1;</code></pre>`);

    expect(blocks.map((block) => block.kind)).toEqual([
      "heading",
      "paragraph",
      "list",
      "admonition",
      "source-block",
    ]);
    expect(blocks[1]?.text).toBe("Intro text");
    expect(blocks[2]?.html).toContain("<ul>");
  });

  it("extracts privacy-safe top-level list item snapshots", () => {
    const [block] = extractRenderedBlocksFromHtml(
      `<ul><li>Private item text<ul><li>Nested detail</li></ul></li></ul>`,
    );

    expect(block?.listItems).toEqual([
      expect.objectContaining({
        index: 0,
        textLength: "Private item textNested detail".length,
        directTextLength: "Private item text".length,
      }),
    ]);
    expect(JSON.stringify(block?.listItems)).not.toContain("Private item text");
    expect(JSON.stringify(block?.listItems)).not.toContain("Nested detail");
  });

  it("extracts rendered math blocks as diffable content blocks", () => {
    const blocks = extractRenderedBlocksFromHtml(`<div class="stemblock">
<div class="content math-block" data-review-id="math-block"><span class="katex">E=mc2</span></div>
</div>`);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: "paragraph",
      text: "E=mc2",
    });
    expect(blocks[0]?.html).toContain('data-review-id="math-block"');
    expect(blocks[0]?.html).toContain("katex");
  });

  it("preserves KaTeX layout styles while stripping non-math styles", () => {
    const sanitized = sanitizeRenderedBlockHtml(
      `<p style="color:red">Math <span class="math-inline"><span class="katex"><span style="top:-3em">2</span></span></span></p>`,
      { format: "asciidoc" },
    );

    expect(sanitized).not.toContain("<p style=");
    expect(sanitized).toContain('class="katex"');
    expect(sanitized).toContain('style="top:-3em"');
  });

  it("preserves highlighted Markdown source block token classes for rendered diff", () => {
    const rendered = renderMarkdownCore(`\`\`\`ts
const label = "stable";
export function readLabel() {
  return label;
}
\`\`\`
`);
    const [block] = extractRenderedBlocksFromHtml(rendered.html);
    const sanitized = sanitizeRenderedBlockHtml(block?.html ?? "", {
      format: "markdown",
    });

    expect(block).toMatchObject({
      kind: "source-block",
    });
    expect(block?.html).toContain('pre class="hljs"');
    expect(block?.html).toContain("language-ts");
    expect(block?.html).toContain("hljs-keyword");
    expect(block?.html).toContain("hljs-string");
    expect(sanitized).toContain("hljs-keyword");
    expect(sanitized).toContain("hljs-string");
  });

  it("keeps hydrated local image HTML while preserving diagram placeholders", () => {
    const blocks =
      extractRenderedBlocksFromHtml(`<div class="diagram-slot" data-diagram-id="mermaid-1"></div>
<p><img src="data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E" alt="Overview diagram" data-image-path="diagram.svg"></p>`);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      kind: "diagram",
      text: "Diagram placeholder",
    });
    expect(blocks[0]?.html).toContain("Diagram placeholder");
    expect(blocks[1]).toMatchObject({
      kind: "image",
      text: "Overview diagram",
    });
    expect(blocks[1]?.html).toContain("<img");
    expect(blocks[1]?.html).toContain("data:image/svg+xml");
  });

  it("uses image placeholders for unhydrated rendered diff images", () => {
    const [block] = extractRenderedBlocksFromHtml(
      `<p><img src="https://example.test/remote.png" alt="Remote diagram"></p>`,
    );

    expect(block).toMatchObject({
      kind: "image",
      text: "Remote diagram",
    });
    expect(block?.html).toContain("Image: Remote diagram");
    expect(block?.html).not.toContain("<img");
  });

  it("marks same-alt remote image placeholders changed when source changes without exposing source", () => {
    const left = extractRenderedBlocksFromHtml(
      `<p><img src="https://example.test/old.png" alt="Remote diagram"></p>`,
    );
    const right = extractRenderedBlocksFromHtml(
      `<p><img src="https://example.test/new.png" alt="Remote diagram"></p>`,
    );

    const diff = compareRenderedBlocks(left, right);
    const presentation = buildRenderedDiffPresentation(diff);

    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({
      kind: "changed",
      blockKind: "image",
    });
    expect(changedRenderedBlocks(diff).map((block) => block.blockKind)).toEqual(
      ["image"],
    );
    expect(presentation.navigationTargets).toHaveLength(1);
    expect(diff[0]?.left?.html).toContain("Image: Remote diagram");
    expect(diff[0]?.right?.html).toContain("Image: Remote diagram");
    expect(diff[0]?.left?.html).not.toContain("old.png");
    expect(diff[0]?.right?.html).not.toContain("new.png");
    expect(diff[0]?.left?.text).toBe("Remote diagram");
    expect(diff[0]?.right?.text).toBe("Remote diagram");
  });

  it("keeps same remote image placeholder unchanged when source and alt match", () => {
    const left = extractRenderedBlocksFromHtml(
      `<p><img src="https://example.test/remote.png" alt="Remote diagram"></p>`,
    );
    const right = extractRenderedBlocksFromHtml(
      `<p><img src="https://example.test/remote.png" alt="Remote diagram"></p>`,
    );

    expect(
      compareRenderedBlocks(left, right).map((block) => block.kind),
    ).toEqual(["unchanged"]);
  });

  it("keeps remote image elements when external images are enabled", () => {
    const [block] = extractRenderedBlocksFromHtml(
      `<p><img src="https://example.test/remote.png" alt="Remote diagram"></p>`,
      { showExternalImages: true },
    );

    expect(block).toMatchObject({
      kind: "image",
      text: "Remote diagram",
    });
    expect(block?.html).toContain("<img");
    expect(block?.html).toContain("https://example.test/remote.png");
  });

  it("extracts AsciiDoc image blocks as rendered image blocks", () => {
    const [block] = extractRenderedBlocksFromHtml(`<div class="imageblock">
<div class="content">
<img src="data:image/png;base64,AA==" alt="AsciiDoc image" data-image-path="assets/sample.png">
</div>
<div class="title">Figure 1. AsciiDoc image</div>
</div>`);

    expect(block).toMatchObject({
      kind: "image",
      text: "AsciiDoc image",
    });
    expect(block?.html).toContain("<img");
    expect(block?.html).toContain("data:image/png;base64,AA==");
  });

  it("treats diagram placeholders as changed without exposing source", () => {
    const left = extractRenderedBlocksFromHtml(
      `<p><span class="diagram-slot" data-diagram-id="mermaid-1"></span></p>`,
    );
    const right = extractRenderedBlocksFromHtml(
      `<p><span class="diagram-slot" data-diagram-id="mermaid-1"></span></p>`,
    );

    expect(left).toHaveLength(1);
    expect(right).toHaveLength(1);
    const diff = compareRenderedBlocks(left, right);

    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({
      kind: "changed",
      blockKind: "diagram",
    });
    expect(diff[0]?.left?.html).toContain("Diagram placeholder");
    expect(diff[0]?.right?.html).toContain("Diagram placeholder");
  });

  it("keeps identical signed diagram blocks unchanged without exposing source", () => {
    const source = "flowchart TD\nA[Start] --> B[Done]";
    const signatures = new Map([
      ["mermaid-1", `diagram:mermaid:mermaid:${source}`],
    ]);
    const left = extractRenderedBlocksFromHtml(
      `<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid"></div>`,
      { diagramSignatures: signatures },
    );
    const right = extractRenderedBlocksFromHtml(
      `<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid"></div>`,
      { diagramSignatures: signatures },
    );

    const diff = compareRenderedBlocks(left, right);

    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({
      kind: "unchanged",
      blockKind: "diagram",
    });
    expect(diff[0]?.left?.html).toContain("Diagram placeholder");
    expect(diff[0]?.left?.html).not.toContain("flowchart TD");
    expect(diff[0]?.left?.text).not.toContain("flowchart TD");
  });

  it("keeps identical signed PlantUML and Graphviz blocks unchanged", () => {
    const left = extractRenderedBlocksFromHtml(
      `<div class="diagram-slot" data-diagram-id="plantuml-1" data-diagram-type="plantuml"></div>
<div class="diagram-slot" data-diagram-id="graphviz-1" data-diagram-type="graphviz"></div>`,
      {
        diagramSignatures: new Map([
          ["plantuml-1", "diagram:plantuml:plantuml:actor User"],
          ["graphviz-1", "diagram:graphviz:graphviz:digraph G { A -> B }"],
        ]),
      },
    );
    const right = extractRenderedBlocksFromHtml(
      `<div class="diagram-slot" data-diagram-id="plantuml-1" data-diagram-type="plantuml"></div>
<div class="diagram-slot" data-diagram-id="graphviz-1" data-diagram-type="graphviz"></div>`,
      {
        diagramSignatures: new Map([
          ["plantuml-1", "diagram:plantuml:plantuml:actor User"],
          ["graphviz-1", "diagram:graphviz:graphviz:digraph G { A -> B }"],
        ]),
      },
    );

    expect(
      compareRenderedBlocks(left, right).map((block) => block.kind),
    ).toEqual(["unchanged", "unchanged"]);
  });

  it("marks signed diagram blocks changed when source changes", () => {
    const left = extractRenderedBlocksFromHtml(
      `<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid"></div>`,
      {
        diagramSignatures: new Map([
          ["mermaid-1", "diagram:mermaid:mermaid:flowchart TD\nA --> B"],
        ]),
      },
    );
    const right = extractRenderedBlocksFromHtml(
      `<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid"></div>`,
      {
        diagramSignatures: new Map([
          ["mermaid-1", "diagram:mermaid:mermaid:flowchart TD\nA --> C"],
        ]),
      },
    );

    expect(
      compareRenderedBlocks(left, right).map((block) => block.kind),
    ).toEqual(["changed"]);
  });

  it("extracts diagram slots nested inside AsciiDoc section bodies", () => {
    const blocks = extractRenderedBlocksFromHtml(`<div class="sect1">
<h2 id="_diagrams">Diagrams</h2>
<div class="sectionbody">
<div class="sect2">
<h3 id="_mermaid">Mermaid</h3>
<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid" data-diagram-renderer="mermaid"></div>
</div>
</div>
</div>`);

    expect(blocks.map((block) => block.kind)).toEqual([
      "heading",
      "heading",
      "diagram",
    ]);
    expect(blocks[2]).toMatchObject({
      kind: "diagram",
      text: "mermaid",
    });
    expect(blocks[2]?.html).toContain("Diagram placeholder");
  });

  it("compares rendered blocks while preserving unchanged preview context", () => {
    const left = extractRenderedBlocksFromHtml(`<h1>Title</h1>
<p>Old paragraph</p>
<ul><li>Existing item</li></ul>`);
    const right = extractRenderedBlocksFromHtml(`<h1>Title</h1>
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
    const left = extractRenderedBlocksFromHtml(`<p>Run the standard gates.</p>
<pre class="hljs"><code class="language-bash">make -f Makefile.private mirror-status
make -f Makefile.private mirror-sync
make -f Makefile.private mirror-package
make -f Makefile.private mirror-commit</code></pre>
<p>Continue with the public mirror review.</p>`);
    const right =
      extractRenderedBlocksFromHtml(`<p>Run the standard gates before export.</p>
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
    const left = extractRenderedBlocksFromHtml(`<table class="tableblock">
<tbody><tr><td class="halign-left">Name</td><td>Status</td></tr>
<tr><td>Basic</td><td>Stable</td></tr></tbody>
</table>`);
    const right =
      extractRenderedBlocksFromHtml(`<table class="tableblock stretch">
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
    const left = extractRenderedBlocksFromHtml(
      `<pre class="hljs"><code class="language-ts"><span class="hljs-keyword">const</span> label = <span class="hljs-string">"old"</span>;</code></pre>`,
    );
    const right = extractRenderedBlocksFromHtml(
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
    const left = extractRenderedBlocksFromHtml(
      `<h1>Diagram Image Diff Fixture</h1>
<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid"></div>
<p><img src="data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E" alt="Stable image"></p>`,
      { diagramSignatures },
    );
    const right = extractRenderedBlocksFromHtml(
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
    const [list] = extractRenderedBlocksFromHtml(`<ul>
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

  it("groups contiguous one-sided rendered changes for presentation", () => {
    const left = extractRenderedBlocksFromHtml(`<h2>Old section</h2>
<p>Old paragraph</p>
<ul><li>Old item</li></ul>
<h2>Stable</h2>`);
    const right = extractRenderedBlocksFromHtml(`<h2>Stable</h2>`);

    const presentation = buildRenderedDiffPresentation(
      compareRenderedBlocks(left, right),
    );

    expect(presentation.entries).toHaveLength(2);
    expect(presentation.entries[0]).toMatchObject({
      kind: "group",
      changeKind: "removed",
    });
    expect(
      presentation.entries[0]?.kind === "group"
        ? presentation.entries[0].blocks.length
        : 0,
    ).toBe(3);
    expect(presentation.navigationTargets).toHaveLength(1);
    expect(presentation.navigationTargets[0]).toMatchObject({
      index: 0,
      side: "left",
    });
    expect(
      presentation.entryChangeIndexes.get(presentation.entries[0]?.id ?? ""),
    ).toBe(0);
  });

  it("does not make empty rendered placeholders navigable", () => {
    const presentation = buildRenderedDiffPresentation([
      {
        id: "empty-added",
        kind: "added",
        blockKind: "paragraph",
        right: {
          id: "right-empty",
          kind: "paragraph",
          tagName: "p",
          text: "   ",
          html: "<p>   </p>",
        },
      },
      {
        id: "visible-added",
        kind: "added",
        blockKind: "paragraph",
        right: {
          id: "right-visible",
          kind: "paragraph",
          tagName: "p",
          text: "Visible change",
          html: "<p>Visible change</p>",
        },
      },
    ]);

    expect(presentation.navigationTargets).toHaveLength(1);
    expect(presentation.navigationTargets[0]?.block.id).toBe("visible-added");
    expect(presentation.navigationTargets[0]?.side).toBe("right");
  });

  it("keeps changed rendered blocks as individual navigation targets", () => {
    const left = extractRenderedBlocksFromHtml(`<p>Old stable text</p>
<p>Second old stable text</p>`);
    const right = extractRenderedBlocksFromHtml(`<p>New stable text</p>
<p>Second new stable text</p>`);

    const presentation = buildRenderedDiffPresentation(
      compareRenderedBlocks(left, right),
    );

    expect(presentation.entries).toHaveLength(2);
    expect(presentation.navigationTargets).toHaveLength(2);
    expect(presentation.navigationTargets.map((target) => target.side)).toEqual(
      ["both", "both"],
    );
  });

  it("derives content cursor targets from rendered diff navigation targets", () => {
    const presentation = buildRenderedDiffPresentation([
      {
        id: "stable",
        kind: "unchanged",
        blockKind: "heading",
        left: {
          id: "stable-left",
          kind: "heading",
          tagName: "h1",
          text: "Stable",
          html: "<h1>Stable</h1>",
        },
        right: {
          id: "stable-right",
          kind: "heading",
          tagName: "h1",
          text: "Stable",
          html: "<h1>Stable</h1>",
        },
      },
      {
        id: "removed",
        kind: "removed",
        blockKind: "paragraph",
        left: {
          id: "removed-left",
          kind: "paragraph",
          tagName: "p",
          text: "Removed paragraph",
          html: "<p>Removed paragraph</p>",
        },
      },
      {
        id: "changed",
        kind: "changed",
        blockKind: "paragraph",
        left: {
          id: "changed-left",
          kind: "paragraph",
          tagName: "p",
          text: "Changed before",
          html: "<p>Changed before</p>",
        },
        right: {
          id: "changed-right",
          kind: "paragraph",
          tagName: "p",
          text: "Changed after",
          html: "<p>Changed after</p>",
        },
      },
      {
        id: "added",
        kind: "added",
        blockKind: "paragraph",
        right: {
          id: "added-right",
          kind: "paragraph",
          tagName: "p",
          text: "Added paragraph",
          html: "<p>Added paragraph</p>",
        },
      },
    ]);

    expect(renderedDiffContentCursorTargets(presentation)).toEqual([
      {
        entryId: presentation.navigationTargets[0]?.entryId,
        side: "left",
        changeIndex: 0,
      },
      {
        entryId: presentation.navigationTargets[1]?.entryId,
        side: "right",
        changeIndex: 1,
      },
      {
        entryId: presentation.navigationTargets[2]?.entryId,
        side: "right",
        changeIndex: 2,
      },
    ]);
  });

  it("keeps grouped one-sided changes as one content cursor target", () => {
    const left = extractRenderedBlocksFromHtml(`<h2>Stable</h2>`);
    const right = extractRenderedBlocksFromHtml(`<p>Added one</p>
<p>Added two</p>
<h2>Stable</h2>`);

    const presentation = buildRenderedDiffPresentation(
      compareRenderedBlocks(left, right),
    );

    expect(presentation.entries[0]).toMatchObject({ kind: "group" });
    expect(renderedDiffContentCursorTargets(presentation)).toEqual([
      {
        entryId: presentation.entries[0]?.id,
        side: "right",
        changeIndex: 0,
      },
    ]);
  });

  it("wraps rendered diff content cursor navigation", () => {
    const targets = [
      { entryId: "first", side: "right" as const, changeIndex: 0 },
      { entryId: "second", side: "left" as const, changeIndex: 1 },
    ];

    expect(
      nextRenderedDiffContentCursorTarget({
        targets,
        activeTarget: null,
        activeChangeIndex: 0,
        direction: "next",
      }),
    ).toEqual(targets[0]);
    expect(
      nextRenderedDiffContentCursorTarget({
        targets,
        activeTarget: targets[0] ?? null,
        activeChangeIndex: 0,
        direction: "previous",
      }),
    ).toEqual(targets[1]);
    expect(
      nextRenderedDiffContentCursorTarget({
        targets,
        activeTarget: targets[1] ?? null,
        activeChangeIndex: 1,
        direction: "next",
      }),
    ).toEqual(targets[0]);
  });

  it("aligns inserted paragraphs without shifting the following heading", () => {
    const left = extractRenderedBlocksFromHtml(`<h2>Product Principles</h2>
<ul><li>Local-first rendering</li><li>Browser-like viewer</li></ul>
<h2>Scope</h2>`);
    const right =
      extractRenderedBlocksFromHtml(`<p>Git diff is preview based.</p>
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
    const left = extractRenderedBlocksFromHtml(`<h2>IMP-095: Content cursor</h2>
<ul><li>Status: Done</li><li>Future gates: cursor basic</li></ul>
<h2>IMP-096: Lightweight action feedback</h2>
<ul><li>Status: Backlog</li><li>Goal: Lightweight feedback</li></ul>
<h2>IMP-097: Pinned search color model polish</h2>
<ul><li>Status: Backlog</li><li>Goal: Search polish</li></ul>`);
    const right =
      extractRenderedBlocksFromHtml(`<h2>IMP-096: Lightweight action feedback</h2>
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
    const left = extractRenderedBlocksFromHtml(`<h2>Duplicate</h2>
<p>Removed introduction</p>
<h2>Duplicate</h2>
<p>Stable body</p>`);
    const right = extractRenderedBlocksFromHtml(`<h2>Duplicate</h2>
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
    const left = extractRenderedBlocksFromHtml(`<h2>Shared Heading</h2>
<p>Old section body</p>`);
    const right = extractRenderedBlocksFromHtml(`<h2>Shared Heading</h2>
<p>New section body</p>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff.map((block) => block.kind)).toEqual(["unchanged", "changed"]);
    expect(diff[0]?.left?.text).toBe("Shared Heading");
    expect(diff[1]?.left?.text).toBe("Old section body");
    expect(diff[1]?.right?.text).toBe("New section body");
  });

  it("keeps related heading rename as changed and unrelated heading replacement one-sided", () => {
    const relatedLeft = extractRenderedBlocksFromHtml(`<h2>Preview diff</h2>`);
    const relatedRight = extractRenderedBlocksFromHtml(
      `<h2>Rendered preview diff</h2>`,
    );
    const unrelatedLeft = extractRenderedBlocksFromHtml(`<h2>Packaging</h2>`);
    const unrelatedRight = extractRenderedBlocksFromHtml(`<h2>Security</h2>`);

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
    const left = extractRenderedBlocksFromHtml(`<div class="diagram-slot"></div>
<p><img src="data:image/png;base64,AA==" alt="Same image"></p>`);
    const right =
      extractRenderedBlocksFromHtml(`<div class="diagram-slot"></div>
<p><img src="data:image/png;base64,BB==" alt="Same image"></p>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff.map((block) => block.kind)).toEqual(["changed", "changed"]);
    expect(diff.map((block) => block.blockKind)).toEqual(["diagram", "image"]);
  });

  it("does not pair unrelated same-kind blocks as a changed block", () => {
    const left =
      extractRenderedBlocksFromHtml(`<p>Release notes for desktop packaging.</p>
<h2>Stable Heading</h2>`);
    const right =
      extractRenderedBlocksFromHtml(`<p>Diagram preview privacy policy.</p>
<h2>Stable Heading</h2>`);

    const diff = compareRenderedBlocks(left, right);

    expect(diff.map((block) => block.kind)).toEqual([
      "removed",
      "added",
      "unchanged",
    ]);
  });

  it("treats inline markup-only changes as rendered changes", () => {
    const left = extractRenderedBlocksFromHtml(
      `<p>Use <strong>bold</strong> text.</p>`,
    );
    const right = extractRenderedBlocksFromHtml(`<p>Use bold text.</p>`);

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

  it("builds word-level diff parts for changed rendered text", () => {
    expect(wordDiffParts("old stable text", "new stable text")).toEqual([
      { kind: "removed", value: "old" },
      { kind: "added", value: "new" },
      { kind: "unchanged", value: " stable text" },
    ]);
  });

  it("builds side-specific inline diff ranges for changed text", () => {
    expect(
      renderedInlineDiffRanges(
        "This paragraph was stable in HEAD.",
        "This paragraph changed in the working tree.",
        "left",
      ).map((range) => ({
        kind: range.kind,
        value: "This paragraph was stable in HEAD.".slice(
          range.start,
          range.end,
        ),
      })),
    ).toEqual([
      { kind: "removed", value: "was stable" },
      { kind: "removed", value: "HEAD" },
    ]);
    expect(
      renderedInlineDiffRanges(
        "This paragraph was stable in HEAD.",
        "This paragraph changed in the working tree.",
        "right",
      ).map((range) => ({
        kind: range.kind,
        value: "This paragraph changed in the working tree.".slice(
          range.start,
          range.end,
        ),
      })),
    ).toEqual([
      { kind: "added", value: "changed" },
      { kind: "added", value: "the working tree" },
    ]);
  });

  it("builds inline ranges for inserted nested list content", () => {
    const leftText =
      "Local-first rendering: AsciiDoc / Markdown parsing Browser-like viewer: tab history";
    const rightText =
      "Local-first rendering: AsciiDoc / Markdown parsing Browser-like viewer: tab history Preview-based diff: Git compare rendered preview diagram placeholder";

    const ranges = renderedInlineDiffRanges(leftText, rightText, "right").map(
      (range) => rightText.slice(range.start, range.end),
    );

    expect(ranges.join(" ")).toContain("Preview-based diff");
    expect(ranges.join(" ")).toContain("diagram placeholder");
  });

  it("adds child changes for a high-confidence changed list item", () => {
    const [block] = compareRenderedBlocks(
      extractRenderedBlocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Later.</li><li>Tail item</li></ul>",
      ),
      extractRenderedBlocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Paused.</li><li>Tail item</li></ul>",
      ),
    );

    expect(block).toMatchObject({
      kind: "changed",
      blockKind: "list",
      childChanges: [
        {
          kind: "changed",
          side: "both",
          confidence: "high",
          leftIndex: 1,
          rightIndex: 1,
        },
      ],
    });
    expect(block?.childChangeFallback).toBeUndefined();
  });

  it("adds child changes for added and removed list items on visible sides", () => {
    const [block] = compareRenderedBlocks(
      extractRenderedBlocksFromHtml(
        "<ul><li>Stable item</li><li>Removed item</li><li>Tail item</li></ul>",
      ),
      extractRenderedBlocksFromHtml(
        "<ul><li>Stable item</li><li>Tail item</li><li>Added item</li></ul>",
      ),
    );

    expect(block?.childChanges).toEqual([
      {
        kind: "removed",
        side: "left",
        confidence: "high",
        leftIndex: 1,
      },
      {
        kind: "added",
        side: "right",
        confidence: "high",
        rightIndex: 2,
      },
    ]);
  });

  it("treats nested list edits as a parent top-level item change", () => {
    const [block] = compareRenderedBlocks(
      extractRenderedBlocksFromHtml(
        "<ul><li>Parent<ul><li>Nested stable</li></ul></li><li>Tail</li></ul>",
      ),
      extractRenderedBlocksFromHtml(
        "<ul><li>Parent<ul><li>Nested changed</li></ul></li><li>Tail</li></ul>",
      ),
    );

    expect(block?.childChanges).toEqual([
      {
        kind: "changed",
        side: "both",
        confidence: "high",
        leftIndex: 0,
        rightIndex: 0,
      },
    ]);
  });

  it("adds child changes for high-overlap Japanese list item text", () => {
    const [block] = compareRenderedBlocks(
      extractRenderedBlocksFromHtml(
        "<ul><li>差分プレビューを改善する</li><li>安定項目</li></ul>",
      ),
      extractRenderedBlocksFromHtml(
        "<ul><li>差分表示を改善する</li><li>安定項目</li></ul>",
      ),
    );

    expect(block?.childChanges).toEqual([
      expect.objectContaining({
        kind: "changed",
        side: "both",
        confidence: "high",
        leftIndex: 0,
        rightIndex: 0,
      }),
    ]);
  });

  it("keeps item-level changes for low-overlap list item replacements with stable anchors", () => {
    const [block] = compareRenderedBlocks(
      extractRenderedBlocksFromHtml(
        [
          "<ul>",
          "<li>Read local AsciiDoc and Markdown documents</li>",
          "<li>Compare Git changes against a merge target</li>",
          "<li>Review diagrams with local rendering first</li>",
          "<li>Avoid rewriting source for viewer convenience</li>",
          "</ul>",
        ].join(""),
      ),
      extractRenderedBlocksFromHtml(
        [
          "<ul>",
          "<li>Read local AsciiDoc and Markdown documents</li>",
          "<li>Compare Git changes against a merge target</li>",
          "<li>Review changed list items and tables in the preview</li>",
          "<li>Keep Git change markers stable while nearby files update</li>",
          "<li>Avoid rewriting source for viewer convenience</li>",
          "</ul>",
        ].join(""),
      ),
    );

    expect(block?.childChanges).toEqual([
      {
        kind: "changed",
        side: "both",
        confidence: "high",
        leftIndex: 2,
        rightIndex: 2,
      },
      {
        kind: "added",
        side: "right",
        confidence: "high",
        rightIndex: 3,
      },
    ]);
    expect(block?.childChangeFallback).toBeUndefined();
  });

  it("falls back instead of producing low-confidence reordered list item changes", () => {
    const [block] = compareRenderedBlocks(
      extractRenderedBlocksFromHtml(
        "<ul><li>Alpha stable item</li><li>Beta stable item</li></ul>",
      ),
      extractRenderedBlocksFromHtml(
        "<ul><li>Beta stable item</li><li>Alpha stable item</li></ul>",
      ),
    );

    expect(block?.childChanges).toBeUndefined();
    expect(block?.childChangeFallback).toEqual({ reason: "reorder" });
  });

  it("keeps child change fallback summaries privacy-safe", () => {
    const [block] = compareRenderedBlocks(
      extractRenderedBlocksFromHtml(
        "<ul><li>Secret Alpha</li><li>Secret Alpha</li></ul>",
      ),
      extractRenderedBlocksFromHtml(
        "<ul><li>Secret Alpha</li><li>Secret Beta</li></ul>",
      ),
    );

    const serialized = JSON.stringify({
      childChanges: block?.childChanges,
      fallback: block?.childChangeFallback,
      leftItems: block?.left?.listItems,
      rightItems: block?.right?.listItems,
    });
    expect(serialized).not.toContain("Secret Alpha");
    expect(serialized).not.toContain("Secret Beta");
    expect(block?.childChangeFallback).toEqual({ reason: "ambiguous" });
  });

  it("uses list item child changes as rendered navigation targets", () => {
    const [block] = compareRenderedBlocks(
      extractRenderedBlocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Later.</li><li>Tail item</li></ul>",
      ),
      extractRenderedBlocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Paused.</li><li>Tail item</li></ul>",
      ),
    );
    expect(block).toBeDefined();
    const listBlock = block as NonNullable<typeof block>;
    const presentation = buildRenderedDiffPresentation([listBlock]);
    const entry = presentation.entries[0];

    expect(presentation.navigationTargets).toEqual([
      expect.objectContaining({
        index: 0,
        entryId: entry?.id,
        side: "right",
        block: listBlock,
        childChangeIndex: 0,
      }),
    ]);
    expect(presentation.entryChangeIndexes.get(entry?.id ?? "")).toBeUndefined();
    expect(
      entry
        ? renderedDiffListItemChangeIndex(presentation, entry, "right", 1)
        : null,
    ).toBe(0);
    expect(
      entry
        ? renderedDiffListItemChangeIndex(presentation, entry, "left", 1)
        : null,
    ).toBeNull();
    expect(renderedDiffContentCursorTargets(presentation)).toEqual([
      {
        entryId: entry?.id,
        side: "right",
        changeIndex: 0,
        childChangeIndex: 0,
      },
    ]);
  });

  it("keeps low-confidence list fallback as a block-level navigation target", () => {
    const [block] = compareRenderedBlocks(
      extractRenderedBlocksFromHtml(
        "<ul><li>Alpha stable item</li><li>Beta stable item</li></ul>",
      ),
      extractRenderedBlocksFromHtml(
        "<ul><li>Beta stable item</li><li>Alpha stable item</li></ul>",
      ),
    );
    expect(block).toBeDefined();
    const listBlock = block as NonNullable<typeof block>;
    const presentation = buildRenderedDiffPresentation([listBlock]);
    const entry = presentation.entries[0];

    expect(listBlock.childChanges).toBeUndefined();
    expect(listBlock.childChangeFallback).toEqual({ reason: "reorder" });
    expect(presentation.navigationTargets).toEqual([
      expect.objectContaining({
        index: 0,
        entryId: entry?.id,
        side: "both",
        block: listBlock,
      }),
    ]);
    expect(presentation.navigationTargets[0]?.childChangeIndex).toBeUndefined();
    expect(presentation.entryChangeIndexes.get(entry?.id ?? "")).toBe(0);
  });

  it("annotates only changed top-level list items for the visible side", () => {
    const [block] = compareRenderedBlocks(
      extractRenderedBlocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Later.</li><li>Tail item</li></ul>",
      ),
      extractRenderedBlocksFromHtml(
        "<ul><li>Stable item</li><li>Status: Draft / Paused.</li><li>Tail item</li></ul>",
      ),
    );
    expect(block).toBeDefined();
    const listBlock = block as NonNullable<typeof block>;

    const rightHtml = applyRenderedListItemHighlights(
      listBlock.right?.html ?? "",
      renderedListItemHighlightsForSide({
        activeChangeIndex: 7,
        block: listBlock,
        changeIndexForItem: (itemIndex) => (itemIndex === 1 ? 7 : null),
        side: "right",
      }),
    );
    const leftHtml = applyRenderedListItemHighlights(
      listBlock.left?.html ?? "",
      renderedListItemHighlightsForSide({
        block: listBlock,
        changeIndexForItem: () => null,
        side: "left",
      }),
    );
    const rightDoc = new DOMParser().parseFromString(rightHtml, "text/html");
    const leftDoc = new DOMParser().parseFromString(leftHtml, "text/html");

    expect(
      rightDoc.querySelectorAll('[data-review-id="git-rendered-list-item-change"]'),
    ).toHaveLength(1);
    expect(
      rightDoc.querySelectorAll(".git-rendered-list-item-change.changed"),
    ).toHaveLength(1);
    expect(
      rightDoc.querySelectorAll('[data-change-index="7"]'),
    ).toHaveLength(1);
    expect(
      rightDoc.querySelector('[data-content-cursor-active="true"]'),
    ).toBeTruthy();
    expect(
      rightDoc.querySelectorAll("li:not(.git-rendered-list-item-change)"),
    ).toHaveLength(2);
    expect(
      leftDoc.querySelectorAll(".git-rendered-list-item-change.changed"),
    ).toHaveLength(1);
    expect(leftDoc.querySelector("[data-change-index]")).toBeNull();
  });

  it("keeps list item highlight metadata through rendered block sanitizing", () => {
    const html = applyRenderedListItemHighlights(
      "<ul><li>Stable</li><li>Changed</li></ul>",
      [
        {
          active: true,
          changeIndex: 3,
          itemIndex: 1,
          kind: "changed",
        },
      ],
    );
    const sanitized = unwrapSafeHtml(
      sanitizeRenderedBlockHtml(html, { format: "markdown" }),
    );

    expect(sanitized).toContain("git-rendered-list-item-change");
    expect(sanitized).toContain('data-review-id="git-rendered-list-item-change"');
    expect(sanitized).toContain('data-change-index="3"');
    expect(sanitized).toContain('data-content-cursor-active="true"');
  });

  it("uses character overlap for Japanese text without whitespace", () => {
    expect(
      renderedTextOverlap("差分プレビューを改善する", "差分表示を改善する"),
    ).toBeGreaterThan(0.2);
    expect(renderedTextOverlap("要求仕様", "まったく別の文章")).toBe(0);
  });
});
