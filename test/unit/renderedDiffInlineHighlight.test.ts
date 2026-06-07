import { describe, expect, it } from "vitest";
import { applyInlineDiffHighlights } from "../../src/ui/lib/gitRenderedDiff";

function parseBody(html: string): HTMLElement {
  return new DOMParser().parseFromString(html, "text/html").body;
}

describe("rendered diff inline highlight", () => {
  it("keeps source blocks excluded unless explicitly enabled", () => {
    const body = parseBody(`
      <pre class="hljs"><code>const label = "old";</code></pre>
      <p>Changed paragraph.</p>
    `);

    applyInlineDiffHighlights(body, [{ kind: "removed", start: 0, end: 5 }]);

    expect(body.querySelector("pre .git-inline-word-highlight")).toBeNull();
    expect(body.querySelector("p .git-inline-word-highlight")).toBeTruthy();
  });

  it("wraps changed words inside source blocks when enabled", () => {
    const body = parseBody(`
      <pre class="hljs"><code class="language-ts"><span class="hljs-keyword">const</span> label = <span class="hljs-string">"old"</span>;</code></pre>
    `);

    applyInlineDiffHighlights(body, [{ kind: "removed", start: 15, end: 18 }], {
      includeSourceBlocks: true,
    });

    const highlight = body.querySelector("pre .git-inline-word-highlight");
    expect(highlight?.textContent).toBe("old");
    expect(body.querySelector("pre.hljs")).toBeTruthy();
    expect(body.querySelector(".hljs-keyword")).toBeTruthy();
    expect(body.querySelector(".hljs-string")).toBeTruthy();
    expect(
      body.querySelector("pre [data-review-id='git-diff-word-highlight']"),
    ).toBeNull();
  });

  it("does not wrap KaTeX math content", () => {
    const body = parseBody(`
      <p>
        Inline stem should render:
        <span class="math-inline">
          <span class="katex">
            <span class="katex-html">
              <span class="base">E = mc<span class="msupsub">2</span></span>
            </span>
          </span>
        </span>
        in diff.
      </p>
    `);

    applyInlineDiffHighlights(body, [{ kind: "added", start: 0, end: 12 }]);

    expect(body.querySelector(".katex .git-inline-word-highlight")).toBeNull();
    expect(
      body.querySelector(".math-inline .git-inline-word-highlight"),
    ).toBeNull();
    expect(body.querySelector(".git-inline-word-highlight")).toBeTruthy();
  });

  it("does not wrap diagram or SVG text content", () => {
    const body = parseBody(`
      <div class="diagram-inline">
        <svg><text>Mermaid math E = mc2</text></svg>
      </div>
      <p>Changed diagram caption.</p>
    `);

    applyInlineDiffHighlights(body, [{ kind: "added", start: 0, end: 10 }]);

    expect(
      body.querySelector(".diagram-inline .git-inline-word-highlight"),
    ).toBeNull();
    expect(body.querySelector("svg .git-inline-word-highlight")).toBeNull();
    expect(body.querySelector("p .git-inline-word-highlight")).toBeTruthy();
  });

  it("keeps SVG and math excluded even when source blocks are enabled", () => {
    const body = parseBody(`
      <pre><code>const label = "new";</code></pre>
      <svg><text>Diagram label</text></svg>
      <span class="katex">E=mc2</span>
    `);

    applyInlineDiffHighlights(body, [{ kind: "added", start: 0, end: 20 }], {
      includeSourceBlocks: true,
    });

    expect(body.querySelector("pre .git-inline-word-highlight")).toBeTruthy();
    expect(body.querySelector("svg .git-inline-word-highlight")).toBeNull();
    expect(body.querySelector(".katex .git-inline-word-highlight")).toBeNull();
  });
});
