import { afterEach, describe, expect, it, vi } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderMarkdownCore", () => {
  it("renders safe Markdown details blocks without enabling raw HTML", () => {
    const result = renderMarkdownCore(`<details>
<summary>Click **here** & stay safe</summary>

### Hidden Heading

- Rust
- Node.js

\`\`\`python
print("inside details")
\`\`\`
</details>
`);

    expect(result.html).toContain('class="markdown-details"');
    expect(result.html).toContain('data-review-id="markdown-details"');
    expect(result.html).toContain("Click <strong>here</strong>");
    expect(result.html).toContain("<h3>Hidden Heading</h3>");
    expect(result.html).toContain("language-python");
    expect(result.html).toContain("inside details");
    expect(result.headings).toEqual([]);
    expect(result.sourceBlocks).toEqual([]);
    expect(result).not.toHaveProperty("markdownAuthorHtmlFragments");
    expect(result.html).not.toContain("svard-markdown-author-html-");
  });

  it("renders open Markdown details and body Markdown features", () => {
    const result = renderMarkdownCore(`<details open>
<summary>Open by default</summary>

Inline math $E = mc^2$.

> [!NOTE]
> Alert inside details.
</details>
`);

    expect(result.html).toContain('<details class="markdown-details" open');
    expect(result.html).toContain('class="math-inline"');
    expect(result.html).toContain("markdown-alert-note");
  });

  it("renders compact Markdown details opening lines", () => {
    const result = renderMarkdownCore(`<details><summary>解答</summary>

\`D_head = D_model / H = 12 / 3 = 4\`です。

</details>

<details open><summary>Open **answer**</summary>

Inline math $E = mc^2$.

</details>
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const details = doc.querySelectorAll(".markdown-details");

    expect(details).toHaveLength(2);
    expect(details[0].hasAttribute("open")).toBe(false);
    expect(details[0].querySelector("summary")?.textContent).toBe("解答");
    expect(details[0].querySelector("code")?.textContent).toBe(
      "D_head = D_model / H = 12 / 3 = 4",
    );
    expect(details[1].hasAttribute("open")).toBe(true);
    expect(details[1].querySelector("summary strong")?.textContent).toBe(
      "answer",
    );
    expect(details[1].querySelector(".math-inline .katex")).toBeTruthy();
  });

  it("keeps compact details inside fenced code as source text", () => {
    const result = renderMarkdownCore(`\`\`\`markdown
<details><summary>Not interactive</summary>
body
</details>
\`\`\`
`);

    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(result.html).not.toContain('class="markdown-details"');
    expect(doc.querySelector("pre")?.textContent).toContain(
      "<details><summary>Not interactive</summary>",
    );
  });

  it("escapes raw HTML inside Markdown details summary and body", () => {
    const result = renderMarkdownCore(`<details>
<summary><img onerror=alert(1)> Summary</summary>

<script>window.unsafeDetails = true</script>
</details>
`);

    expect(result.html).toContain('class="markdown-details"');
    expect(result.html).toContain("&lt;img onerror=alert(1)&gt;");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).not.toContain("<img onerror");
    expect(result.html).not.toContain("<script>");
    expect(result).not.toHaveProperty("markdownAuthorHtmlFragments");
    expect(result.html).not.toContain("svard-markdown-author-html-");
  });

  it("keeps unsupported Markdown details syntax escaped", () => {
    const invalidCases = [
      `<details>
No summary
</details>`,
      `<details>
<summary>Missing close</summary>
body`,
      `<details>
<summary>Nested</summary>
<details>
<summary>Inner</summary>
body
</details>
</details>`,
      `<details><summary>Single line</summary>body</details>`,
    ];

    for (const source of invalidCases) {
      const result = renderMarkdownCore(source);
      expect(result.html).not.toContain('class="markdown-details"');
      expect(result.html).toContain("&lt;details");
    }
  });
});
