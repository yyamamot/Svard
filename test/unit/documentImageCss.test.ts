import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const markdownShortcutCss = readFileSync(
  "src/ui/styles/viewer-markdown/shortcuts.css",
  "utf8",
);
const markdownContentCss = readFileSync(
  "src/ui/styles/viewer-markdown/markdown-content.css",
  "utf8",
);
const asciidocThemeCss = readFileSync(
  "src/ui/styles/asciidoc-theme.css",
  "utf8",
);
const renderedDiffCss = readFileSync(
  "src/ui/styles/diff-preview/rendered-content.css",
  "utf8",
);

function ruleBlock(source: string, selector: string): string {
  const start = source.indexOf(selector);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  expect(open).toBeGreaterThan(start);
  expect(close).toBeGreaterThan(open);
  return source.slice(open + 1, close);
}

describe("document image CSS", () => {
  it("does not height-limit normal viewer and rendered diff document images", () => {
    const markdownImageRule = ruleBlock(
      markdownShortcutCss,
      ".document-body :where(img)",
    );
    const asciidocImageRule = ruleBlock(
      asciidocThemeCss,
      ".document-body.format-asciidoc .imageblock img",
    );
    const diffImageRule = ruleBlock(
      renderedDiffCss,
      ".git-rendered-block-content img",
    );

    for (const rule of [markdownImageRule, asciidocImageRule, diffImageRule]) {
      expect(rule).toContain("max-width");
      expect(rule).toContain("height: auto");
      expect(rule).not.toContain("max-height");
    }
  });

  it("keeps Markdown table layout on tables and scrolls with a wrapper", () => {
    const baseTableRule = ruleBlock(
      markdownShortcutCss,
      ".document-body :where(table)",
    );
    const wrapperRule = ruleBlock(
      markdownContentCss,
      ".document-body.format-markdown .markdown-table-scroll",
    );
    const markdownTableRule = ruleBlock(
      markdownContentCss,
      ".document-body.format-markdown .markdown-table-scroll > table",
    );

    expect(baseTableRule).not.toContain("display: block");
    expect(baseTableRule).not.toContain("overflow");
    expect(wrapperRule).toContain("overflow-x: auto");
    expect(markdownTableRule).toContain("display: table");
  });
});
