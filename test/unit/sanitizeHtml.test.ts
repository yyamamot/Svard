import { describe, expect, it, vi } from "vitest";

import {
  sanitizeDocumentBodyInPlace,
  sanitizeDocumentHtml,
  sanitizeRenderedBlockHtml,
  sanitizeSvg,
} from "../../src/ui/lib/sanitizeHtml";
import { dangerouslySetSafeHtml } from "../../src/ui/lib/safeHtml";

describe("sanitizeHtml", () => {
  it("removes unsafe rendered block attributes and URLs", () => {
    const html = sanitizeRenderedBlockHtml(
      '<p onclick="alert(1)"><a href="javascript:alert(1)">bad</a><strong>safe</strong></p>',
    );

    expect(html).toContain("<strong>safe</strong>");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
  });

  it("never retains private Markdown renderer identities in sanitizer consumers", () => {
    const input =
      '<p data-source-renderer-id="svard-renderer-11111111111111111111111111111111-0">safe</p>';
    const body = new DOMParser().parseFromString(input, "text/html").body;

    expect(sanitizeDocumentHtml(input)).not.toContain(
      "data-source-renderer-id",
    );
    expect(sanitizeDocumentBodyInPlace(body)).not.toContain(
      "data-source-renderer-id",
    );
    expect(sanitizeRenderedBlockHtml(input)).not.toContain(
      "data-source-renderer-id",
    );
    expect(
      sanitizeRenderedBlockHtml(
        `<span class="katex" style="display:inline" data-source-renderer-id="svard-renderer-11111111111111111111111111111111-0">math</span>`,
      ),
    ).not.toContain("data-source-renderer-id");
    expect(
      sanitizeSvg(
        '<svg data-source-renderer-id="svard-renderer-11111111111111111111111111111111-0"><text>safe</text></svg>',
      ),
    ).not.toContain("data-source-renderer-id");
  });

  it("never retains private Markdown author identities in sanitizer consumers", () => {
    const input =
      '<kbd data-svard-markdown-author-html-id="private">Ctrl</kbd><svard-markdown-author-html-inline data-svard-markdown-author-html-id="private">fallback</svard-markdown-author-html-inline>';
    const body = new DOMParser().parseFromString(input, "text/html").body;

    expect(sanitizeDocumentHtml(input)).not.toContain(
      "data-svard-markdown-author-html-id",
    );
    expect(sanitizeDocumentBodyInPlace(body)).not.toContain(
      "data-svard-markdown-author-html-id",
    );
    expect(sanitizeRenderedBlockHtml(input)).not.toContain(
      "data-svard-markdown-author-html-id",
    );
  });

  it("preserves the resource-free Markdown author element set", () => {
    const html = sanitizeDocumentHtml(
      '<kbd>Ctrl</kbd><sub>2</sub><sup>3</sup><mark>mark</mark><ins>ins</ins><s>s</s><del>del</del><small>small</small><abbr title="Application programming interface">API</abbr><ruby>漢<rp>(</rp><rt>kan</rt><rp>)</rp></ruby><br>',
      { format: "markdown" },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(
      doc.body.querySelectorAll(
        "kbd,sub,sup,mark,ins,s,del,small,abbr,ruby,rt,rp,br",
      ),
    ).toHaveLength(14);
    expect(doc.querySelector("abbr")?.getAttribute("title")).toBe(
      "Application programming interface",
    );
  });

  it("keeps approved resource elements while removing independent navigation attributes", () => {
    const html = sanitizeDocumentHtml(
      '<a href="https://example.test/guide" title="Guide" download ping="https://example.test/ping" referrerpolicy="unsafe-url">Guide</a><img src="https://example.test/logo.png" srcset="https://example.test/large.png 2x" alt="Logo" title="Logo" width="64" height="32">',
      { format: "markdown" },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.test/guide",
    );
    expect(doc.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.test/logo.png",
    );
    expect(doc.querySelector("img")?.getAttribute("width")).toBe("64");
    expect(doc.querySelector("img")?.getAttribute("height")).toBe("32");
    expect(
      doc.querySelector("[download],[ping],[referrerpolicy],[srcset]"),
    ).toBeNull();
  });

  it("preserves AsciiDoc structural table and admonition markup", () => {
    const html = sanitizeDocumentHtml(
      '<div class="admonitionblock warning"><table><tr><td class="icon"><i class="fa icon-warning" title="Warning"></i></td><td class="content">Be careful</td></tr></table></div><table class="tableblock frame-all grid-all stretch"><caption class="title">Table 1. Feature Matrix</caption><colgroup><col style="width: 30%"><col width="70%"></colgroup><tbody><tr><td class="tableblock halign-left valign-top" rowspan="2" width="30%" valign="top"><p class="tableblock">Group</p></td><td class="tableblock halign-center valign-middle" colspan="2" align="center"><p class="tableblock">Cell</p></td></tr></tbody></table>',
      { format: "asciidoc" },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(
      doc.querySelector(".admonitionblock.warning .icon-warning"),
    ).toBeTruthy();
    expect(
      doc.querySelector("table.tableblock caption.title")?.textContent,
    ).toBe("Table 1. Feature Matrix");
    expect(doc.querySelector("table.tableblock colgroup col")).toBeTruthy();
    expect(
      doc.querySelector("table.tableblock col")?.hasAttribute("style"),
    ).toBe(false);
    expect(
      doc.querySelector("table.tableblock td")?.getAttribute("rowspan"),
    ).toBe("2");
    expect(
      doc
        .querySelector("table.tableblock td:nth-child(2)")
        ?.getAttribute("colspan"),
    ).toBe("2");
    expect(
      doc.querySelector("table.tableblock td")?.getAttribute("width"),
    ).toBe("30%");
    expect(
      doc
        .querySelector("table.tableblock td:nth-child(2)")
        ?.getAttribute("align"),
    ).toBe("center");
  });

  it("keeps the AsciiDoc profile security boundary", () => {
    const html = sanitizeDocumentHtml(
      '<p onclick="alert(1)" style="color:red"><a href="javascript:alert(1)">bad</a></p><script>alert(1)</script><iframe src="https://example.com"></iframe><object data="x"></object><svg><foreignObject><p>unsafe</p></foreignObject></svg>',
      { format: "asciidoc" },
    );

    expect(html).not.toContain("onclick");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<object");
    expect(html).not.toContain("foreignObject");
  });

  it("removes AsciiDoc forms and image-map navigation while preserving static text", () => {
    const html = sanitizeDocumentHtml(
      '<form action="https://example.test/submit"><label>Choice</label><input name="secret" value="hidden"><button type="submit" formaction="http://127.0.0.1/action">Send</button><textarea>Notes</textarea><select><option>First</option></select></form><img src="data:image/png;base64,AA==" usemap="#routes" ismap><map name="routes"><area href="https://example.test/escape" shape="rect"></map>',
      { format: "asciidoc" },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(
      doc.querySelector("form,input,textarea,select,option,map,area"),
    ).toBeNull();
    expect(
      doc.querySelector("[action],[formaction],[usemap],[ismap]"),
    ).toBeNull();
    expect(doc.body.textContent).toContain("Choice");
    expect(doc.body.textContent).toContain("Send");
    expect(doc.body.textContent).toContain("Notes");
    expect(doc.body.textContent).toContain("First");
    expect(doc.querySelector("img")?.getAttribute("src")).toBe(
      "data:image/png;base64,AA==",
    );
  });

  it("keeps Markdown task-list inputs outside the AsciiDoc-only policy", () => {
    const html = sanitizeDocumentHtml(
      '<ul><li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox" disabled checked> Done</li></ul>',
      { format: "markdown" },
    );

    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
    expect(html).toContain("disabled");
  });

  it("keeps the document body in-place sanitizer aligned with string sanitization", () => {
    const input =
      '<h2 onclick="alert(1)">Title</h2><p style="color:red"><a href="javascript:alert(1)" onmouseover="alert(2)">bad</a><strong>safe</strong></p><table><tbody><tr><td rowspan="2" width="30%">Cell</td></tr></tbody></table><script>alert(1)</script>';
    const doc = new DOMParser().parseFromString(input, "text/html");
    const stringSanitized = sanitizeDocumentHtml(input, { format: "asciidoc" });
    const bodySanitized = sanitizeDocumentBodyInPlace(doc.body, {
      format: "asciidoc",
    });

    expect(bodySanitized).toBe(stringSanitized);
    expect(bodySanitized).toContain("<strong>safe</strong>");
    expect(bodySanitized).toContain('rowspan="2"');
    expect(bodySanitized).not.toContain("onclick");
    expect(bodySanitized).not.toContain("onmouseover");
    expect(bodySanitized).not.toContain("javascript:");
    expect(bodySanitized).not.toContain("style=");
    expect(bodySanitized).not.toContain("<script");
  });

  it("keeps the URI scheme boundary explicit", () => {
    const html = sanitizeDocumentHtml(
      '<a href="https://example.test">https</a><a href="file:///tmp/guide.adoc">file</a><a href="asset://localhost/image.svg">asset</a><a href="data:text/plain,hello">data</a><a href="javascript:alert(1)">script</a><img src="data:image/png;base64,AA=="><img src="javascript:alert(1)">',
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const links = Array.from(doc.querySelectorAll("a"));
    const images = Array.from(doc.querySelectorAll("img"));

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://example.test",
      "file:///tmp/guide.adoc",
      "asset://localhost/image.svg",
      "data:text/plain,hello",
      null,
    ]);
    expect(images.map((image) => image.getAttribute("src"))).toEqual([
      "data:image/png;base64,AA==",
      null,
    ]);
  });

  it("does not add a task-list restore parse when there are no task list checkboxes", () => {
    const parseSpy = vi.spyOn(DOMParser.prototype, "parseFromString");

    const html = sanitizeDocumentHtml("<p>Safe</p>");
    const nonTaskListParseCount = parseSpy.mock.calls.length;
    sanitizeDocumentHtml(
      '<input class="task-list-item-checkbox" type="checkbox" disabled checked>',
    );

    expect(html).toContain("<p>Safe</p>");
    expect(parseSpy.mock.calls.length).toBeGreaterThan(nonTaskListParseCount);
    parseSpy.mockRestore();
  });

  it("preserves typed Safe HTML attributes without enabling AsciiDoc-only attributes", () => {
    const html = sanitizeDocumentHtml(
      '<table><tbody><tr><td rowspan="2" colspan="3" width="80%" align="center">Cell</td></tr></tbody></table>',
      { format: "markdown" },
    );

    expect(html).toContain("<td");
    expect(html).toContain('rowspan="2"');
    expect(html).toContain('colspan="3"');
    expect(html).not.toContain("width=");
    expect(html).toContain('align="center"');
  });

  it("removes unsafe SVG content while preserving diagram geometry", () => {
    const svg = sanitizeSvg(
      '<svg viewBox="0 0 100 50" width="100" height="50" onclick="alert(1)"><foreignObject><script>alert(1)</script></foreignObject><image href="https://attacker.invalid/pixel.png"></image><text x="4" y="10">Safe</text></svg>',
    );

    expect(svg).toContain('viewBox="0 0 100 50"');
    expect(svg).toContain('width="100"');
    expect(svg).toContain("Safe");
    expect(svg).not.toContain("onclick");
    expect(svg).not.toContain("foreignObject");
    expect(svg).not.toContain("script");
    expect(svg).not.toContain("image");
    expect(svg).not.toContain("attacker.invalid");
  });

  it("keeps sanitized SVG valid when draw.io text contains non-breaking spaces", () => {
    const svg = sanitizeSvg(
      '<svg viewBox="0 0 100 50" width="100" height="50"><text x="4" y="10">A&#160;B</text></svg>',
    );

    expect(svg).toContain("A&#160;B");
    expect(svg).not.toContain("&nbsp;");
  });

  it("wraps sanitized HTML for React sinks", () => {
    const html = sanitizeDocumentHtml("<p>Safe</p>");

    expect(dangerouslySetSafeHtml(html)).toEqual({ __html: "<p>Safe</p>" });
    // @ts-expect-error raw strings must not be passed to SafeHtml sinks
    dangerouslySetSafeHtml("<p>raw</p>");
  });
});
