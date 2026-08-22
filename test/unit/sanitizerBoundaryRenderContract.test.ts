import { describe, expect, it } from "vitest";

import { sanitizeSvg } from "../../src/ui/lib/sanitizeHtml";
import { renderMarkdownContract } from "./renderContractTestUtils";

describe("sanitizer boundary render contract", () => {
  it("keeps unsafe HTML and URL payloads out of executable document DOM", async () => {
    const { doc, preparedHtml, renderResult } = await renderMarkdownContract({
      source: `# Sanitizer Boundary

<div style="color:red" onclick="window.__unsafe = true">unsafe div</div>

<a href="javascript:alert(1)" onclick="alert(2)">unsafe link</a>

<iframe srcdoc="<script>alert(1)</script>"></iframe>
<object data="x"></object>
<embed src="x">

![Unsafe data](data:text/html,<script>alert(1)</script>)

<svg><script>alert(1)</script><text>inline svg text</text></svg>`,
    });
    const bodyText = doc.body.textContent ?? "";

    expect(renderResult.markdownAuthorHtmlFragments).toEqual([
      expect.objectContaining({ kind: "block" }),
      expect.objectContaining({ kind: "inline" }),
    ]);
    expect(preparedHtml).not.toContain("svard-markdown-author-html-");
    expect(bodyText).toContain("unsafe div");
    expect(doc.querySelector("div.markdown-safe-html-block")?.textContent).toBe(
      "unsafe div",
    );
    expect(bodyText).not.toContain('<div style="color:red"');
    expect(bodyText).toContain("unsafe link");
    expect(bodyText).not.toContain("javascript:alert(1)");
    expect(bodyText).toContain('<iframe srcdoc="<script>');
    expect(bodyText).toContain("<svg><script>alert(1)</script>");
    expect(doc.querySelector("script, iframe, object, embed")).toBeNull();
    expect(doc.querySelector("[onclick], [style], [srcdoc]")).toBeNull();
    expect(doc.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(doc.querySelector('img[src^="data:text/html"]')).toBeNull();
    expect(
      doc.querySelector('img[data-image-path^="data:text/html"]'),
    ).toBeNull();
  });

  it("sanitizes inline SVG preview payloads without active content", () => {
    const sanitized = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg">
  <script>alert(1)</script>
  <foreignObject><iframe srcdoc="<script>alert(1)</script>"></iframe></foreignObject>
  <a href="javascript:alert(1)" onclick="alert(1)"><text>unsafe</text></a>
  <text style="fill:red">safe text</text>
</svg>`);
    const doc = new DOMParser().parseFromString(
      sanitized as unknown as string,
      "image/svg+xml",
    );
    const serialized = new XMLSerializer().serializeToString(doc);

    expect(serialized).toContain("safe text");
    expect(serialized).not.toContain("<script");
    expect(serialized).not.toContain("foreignObject");
    expect(serialized).not.toContain("iframe");
    expect(serialized).not.toContain("onclick");
    expect(serialized).not.toContain("javascript:");
  });
});
