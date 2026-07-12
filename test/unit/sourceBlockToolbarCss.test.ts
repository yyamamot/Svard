import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sourceBlockCss = readFileSync(
  "src/ui/styles/viewer-markdown/base.css",
  "utf8",
);

describe("source block toolbar CSS", () => {
  it("reveals source block toolbar on hover, keyboard focus, collapsed state, and touch", () => {
    expect(sourceBlockCss).toContain(".source-block-toolbar");
    expect(sourceBlockCss).toContain("opacity: 0;");
    expect(sourceBlockCss).toContain("pointer-events: none;");
    expect(sourceBlockCss).toContain(
      ".source-block-frame:hover .source-block-toolbar",
    );
    expect(sourceBlockCss).toContain(
      ".source-block-frame:focus-within .source-block-toolbar",
    );
    expect(sourceBlockCss).toContain(
      ".source-block-frame.source-block-collapsed .source-block-toolbar",
    );
    expect(sourceBlockCss).toContain("@media (hover: none)");
  });

  it("contains source block margins and overflow layout inside the frame", () => {
    expect(sourceBlockCss).toMatch(
      /\.source-block-frame\s*\{[^}]*display: flow-root;/s,
    );
  });
});
