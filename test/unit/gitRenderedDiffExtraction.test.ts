import { describe, expect, it } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import {
  buildRenderedDiffPresentation,
  changedRenderedBlocks,
  compareRenderedBlocks,
} from "../../src/ui/lib/gitRenderedDiff";
import { extractRenderedBlocksFromRoot } from "../../src/ui/lib/gitRenderedDiff/extraction";
import { normalizeRenderResultHtml } from "../../src/ui/lib/renderResultHtml";
import { sanitizeRenderedBlockHtml } from "../../src/ui/lib/sanitizeHtml";
import { blocksFromHtml } from "./helpers/gitRenderedDiffFixtures";

describe("git rendered diff extraction", () => {
  it("extracts rendered blocks from document HTML", () => {
    const blocks = blocksFromHtml(`<h1>Title</h1>
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

  it("keeps identical paragraphs unchanged when generated source IDs shift", () => {
    const left = blocksFromHtml(
      renderMarkdownCore(`Before.\n\nAppendix:`).html,
    );
    const right = blocksFromHtml(
      renderMarkdownCore(`Inserted.\n\nBefore.\n\nAppendix:`).html,
    );

    const diff = compareRenderedBlocks(left, right);

    expect(
      diff.map((block) => [block.kind, block.right?.text ?? block.left?.text]),
    ).toEqual([
      ["added", "Inserted."],
      ["unchanged", "Before."],
      ["unchanged", "Appendix:"],
    ]);
  });

  it("extracts rendered math blocks as diffable content blocks", () => {
    const blocks = blocksFromHtml(`<div class="stemblock">
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
    const [block] = blocksFromHtml(rendered.html);
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

  it("does not retain private renderer identities at the rendered diff HTML sink", () => {
    const rendered = renderMarkdownCore("Rendered diff paragraph.");
    const [block] = blocksFromHtml(rendered.html);
    const sanitized = sanitizeRenderedBlockHtml(block?.html ?? "", {
      format: "markdown",
    });

    expect(rendered.html).toContain("data-source-renderer-id");
    expect(sanitized).not.toContain("data-source-renderer-id");
    expect(sanitized).toContain("Rendered diff paragraph.");
  });

  it("keeps Safe HTML visible text without using provenance in pathless block signatures", () => {
    const source = "Status: <kbd>Ctrl</kbd> and <mark>Ready</mark>.";
    const rendered = renderMarkdownCore(source);
    const normalized = normalizeRenderResultHtml("markdown", source, rendered);
    const blocks = extractRenderedBlocksFromRoot(normalized.body);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: "paragraph",
      text: "Status: Ctrl and Ready.",
    });
    expect(blocks[0]?.html).toContain("<kbd>Ctrl</kbd>");
    expect(JSON.stringify(blocks)).not.toMatch(
      /svard-markdown-author-html|data-svard-markdown-author-html-id|svard-author-/u,
    );
    expect(blocks[0]?.signature ?? "").not.toMatch(
      /svard-markdown-author-html|svard-author-/u,
    );
    expect(
      normalized.body.querySelector(
        "[data-source-reference],[data-source-selection-block-id]",
      ),
    ).toBeNull();
  });

  it("keeps AsciiDoc active controls and forged Kroki actions out of pathless blocks", () => {
    const normalized = normalizeRenderResultHtml("asciidoc", "", {
      html: '<div><form action="https://example.test/submit"><p>Static form text</p><button data-kroki-confirm-key="spoof">Send</button></form><img alt="Map" usemap="#routes"><map name="routes"><area href="http://127.0.0.1/action"></map><span data-kroki-fallback-key="spoof">Fallback</span></div>',
    });
    const blocks = extractRenderedBlocksFromRoot(normalized.body);
    const serialized = JSON.stringify(blocks);

    expect(serialized).toContain("Static form text");
    expect(serialized).not.toMatch(
      /<form|<button|<map|<area|example\.test|127\.0\.0\.1|data-kroki|usemap/u,
    );
  });

  it("extracts author block roots once and preserves thematic breaks and table structure", () => {
    const source = `<div><p>Container <mark>text</mark>.</p></div>

<hr>

<table><tbody><tr><th>Name</th><td>Svard</td></tr></tbody></table>`;
    const rendered = renderMarkdownCore(source);
    const normalized = normalizeRenderResultHtml("markdown", source, rendered);
    const blocks = extractRenderedBlocksFromRoot(normalized.body);

    expect(
      blocks.map((block) => [block.kind, block.tagName, block.text]),
    ).toEqual([
      ["paragraph", "div", "Container text."],
      ["thematic-break", "hr", "Horizontal rule"],
      ["table", "table", "NameSvard"],
    ]);
    expect(blocks[0]?.html).toContain("markdown-safe-html-block");
    expect(blocks[2]?.tableRows).toHaveLength(1);
    expect(JSON.stringify(blocks)).not.toMatch(
      /svard-markdown-author-html|data-svard-markdown-author-html-id/u,
    );
  });

  it("detects author table cell changes through the existing structured comparison", () => {
    const render = (value: string) => {
      const source = `<table><tbody><tr><th>Status</th><td>${value}</td></tr></tbody></table>`;
      const result = renderMarkdownCore(source);
      return extractRenderedBlocksFromRoot(
        normalizeRenderResultHtml("markdown", source, result).body,
      );
    };
    const diff = compareRenderedBlocks(
      render("Beta status"),
      render("Beta stable"),
    );

    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ kind: "changed", blockKind: "table" });
    expect(diff[0]?.tableChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "changed",
          leftRowIndex: 0,
          rightRowIndex: 0,
          leftCellIndex: 1,
          rightCellIndex: 1,
        }),
      ]),
    );
  });

  it("keeps hydrated local image HTML while preserving diagram placeholders", () => {
    const blocks =
      blocksFromHtml(`<div class="diagram-slot" data-diagram-id="mermaid-1"></div>
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

  it("keeps diagram source as internal block metadata for the rendered side", () => {
    const source = "flowchart LR\nBefore --> After";
    const [block] = blocksFromHtml(
      `<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid"></div>`,
      {
        diagramSources: new Map([["mermaid-1", { type: "mermaid", source }]]),
      },
    );

    expect(block?.diagram).toEqual({ type: "mermaid", source });
    expect(block?.html).not.toContain(source);
  });

  it("keeps diagram source after the placeholder is replaced by rendered output", () => {
    const source = "flowchart LR\nBefore --> After";
    const [block] = blocksFromHtml(
      `<div class="diagram-inline" data-review-id="mermaid-render" data-diagram-id="mermaid-1">
        <svg role="img"><text>Before to After</text></svg>
      </div>`,
      {
        diagramSources: new Map([["mermaid-1", { type: "mermaid", source }]]),
      },
    );

    expect(block).toMatchObject({
      kind: "diagram",
      diagram: { type: "mermaid", source },
    });
    expect(block?.html).not.toContain(source);
  });

  it("uses image placeholders for unhydrated rendered diff images", () => {
    const [block] = blocksFromHtml(
      `<p><img src="https://example.test/remote.png" alt="Remote diagram"></p>`,
    );

    expect(block).toMatchObject({
      kind: "image",
      text: "Remote diagram",
    });
    expect(block?.html).toContain("Image: Remote diagram");
    expect(block?.html).not.toContain("<img");
  });

  it("classifies blocked and missing image placeholders as privacy-safe inline diagnostics", () => {
    const blocked = compareRenderedBlocks(
      blocksFromHtml(`<p><img src="https://example.test/private.png"></p>`),
      blocksFromHtml(`<p><img src="https://example.test/private-new.png"></p>`),
    );
    const [missingLeft] = blocksFromHtml(`<p><img></p>`);
    const [missingRight] = blocksFromHtml(`<p><img></p>`);
    const blockedPresentation = buildRenderedDiffPresentation(blocked);
    const missingPresentation = buildRenderedDiffPresentation([
      {
        id: "missing-image",
        kind: "changed",
        blockKind: "image",
        left: missingLeft!,
        right: missingRight!,
      },
    ]);

    expect(blockedPresentation.inlineDiagnostics).toEqual([
      expect.objectContaining({
        category: "blocked-asset",
        label: "Blocked asset",
      }),
    ]);
    expect(missingPresentation.inlineDiagnostics).toEqual([
      expect.objectContaining({
        category: "missing-reference",
        label: "Missing image",
      }),
    ]);
    expect(JSON.stringify(blockedPresentation.inlineDiagnostics)).not.toContain(
      "private.png",
    );
    expect(JSON.stringify(missingPresentation.inlineDiagnostics)).not.toContain(
      "<img",
    );
  });

  it("marks same-alt remote image placeholders changed when source changes without exposing source", () => {
    const left = blocksFromHtml(
      `<p><img src="https://example.test/old.png" alt="Remote diagram"></p>`,
    );
    const right = blocksFromHtml(
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
    const left = blocksFromHtml(
      `<p><img src="https://example.test/remote.png" alt="Remote diagram"></p>`,
    );
    const right = blocksFromHtml(
      `<p><img src="https://example.test/remote.png" alt="Remote diagram"></p>`,
    );

    expect(
      compareRenderedBlocks(left, right).map((block) => block.kind),
    ).toEqual(["unchanged"]);
  });

  it("keeps remote image elements when external images are enabled", () => {
    const [block] = blocksFromHtml(
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
    const [block] = blocksFromHtml(`<div class="imageblock">
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
    const left = blocksFromHtml(
      `<p><span class="diagram-slot" data-diagram-id="mermaid-1"></span></p>`,
    );
    const right = blocksFromHtml(
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

  it("classifies diagram placeholders as unsupported inline diagnostics", () => {
    const diff = compareRenderedBlocks(
      blocksFromHtml(
        `<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid"></div>`,
      ),
      blocksFromHtml(
        `<div class="diagram-slot" data-diagram-id="mermaid-2" data-diagram-type="mermaid"></div>`,
      ),
    );
    const presentation = buildRenderedDiffPresentation(diff);

    expect(presentation.inlineDiagnostics).toEqual([
      expect.objectContaining({
        category: "unsupported",
        label: "Unsupported diagram",
        detail: "Diagram output is unavailable for this rendered diff target.",
      }),
    ]);
    expect(JSON.stringify(presentation.inlineDiagnostics)).not.toContain(
      "mermaid-1",
    );
  });

  it("keeps identical signed diagram blocks unchanged without exposing source", () => {
    const source = "flowchart TD\nA[Start] --> B[Done]";
    const signatures = new Map([
      ["mermaid-1", `diagram:mermaid:mermaid:${source}`],
    ]);
    const left = blocksFromHtml(
      `<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid"></div>`,
      { diagramSignatures: signatures },
    );
    const right = blocksFromHtml(
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
    const left = blocksFromHtml(
      `<div class="diagram-slot" data-diagram-id="plantuml-1" data-diagram-type="plantuml"></div>
<div class="diagram-slot" data-diagram-id="graphviz-1" data-diagram-type="graphviz"></div>`,
      {
        diagramSignatures: new Map([
          ["plantuml-1", "diagram:plantuml:plantuml:actor User"],
          ["graphviz-1", "diagram:graphviz:graphviz:digraph G { A -> B }"],
        ]),
      },
    );
    const right = blocksFromHtml(
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
    const left = blocksFromHtml(
      `<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid"></div>`,
      {
        diagramSignatures: new Map([
          ["mermaid-1", "diagram:mermaid:mermaid:flowchart TD\nA --> B"],
        ]),
      },
    );
    const right = blocksFromHtml(
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
    const blocks = blocksFromHtml(`<div class="sect1">
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
});
