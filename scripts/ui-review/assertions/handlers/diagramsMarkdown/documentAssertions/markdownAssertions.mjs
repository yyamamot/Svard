import { hasExpectedMatrixLayout } from "../../../../core/mathLayout.mjs";

async function hasNaturalInlineMathBaseline(page) {
  const fractionLines = page
    .locator(".document-body li")
    .filter({ has: page.locator(".math-inline .mfrac") });
  if ((await fractionLines.count()) !== 2) {
    return false;
  }

  for (let index = 0; index < 2; index += 1) {
    const valid = await fractionLines.nth(index).evaluate((line) => {
      const wrappers = Array.from(line.querySelectorAll(".math-inline"));
      const simpleWrappers = wrappers.filter(
        (wrapper) => !wrapper.querySelector(".mfrac"),
      );
      const fractionWrapper = wrappers.find((wrapper) =>
        wrapper.querySelector(".mfrac"),
      );
      const proseNode = Array.from(line.childNodes).find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      if (simpleWrappers.length !== 2 || !fractionWrapper || !proseNode) {
        return false;
      }

      const proseRange = document.createRange();
      proseRange.selectNodeContents(proseNode);
      const proseRect = proseRange.getBoundingClientRect();
      const simpleMathAligned = simpleWrappers.every((wrapper) => {
        const mathRect = wrapper
          .querySelector(".katex")
          ?.getBoundingClientRect();
        return mathRect && Math.abs(mathRect.top - proseRect.top) <= 3;
      });
      const usesNaturalInlineLayout = wrappers.every((wrapper) => {
        const style = getComputedStyle(wrapper);
        return (
          style.verticalAlign === "baseline" &&
          style.overflowX === "visible" &&
          style.overflowY === "visible"
        );
      });
      const lineRect = line.getBoundingClientRect();
      const fractionRect = fractionWrapper
        .querySelector(".katex")
        ?.getBoundingClientRect();
      const fractionIsNotClipped =
        fractionRect &&
        lineRect.top <= fractionRect.top + 1 &&
        lineRect.bottom >= fractionRect.bottom - 1;

      return Boolean(
        simpleMathAligned && usesNaturalInlineLayout && fractionIsNotClipped,
      );
    });
    if (!valid) {
      return false;
    }
  }
  return true;
}

export async function buildMarkdownAssertions({
  scenario,
  page,
  bodyText,
  ganttDiagramFit,
}) {
  return {
    hasMathRendering:
      scenario === "viewer-math-rendering"
        ? bodyText.includes("Math Rendering Sample") &&
          bodyText.includes("Inline Stem") &&
          bodyText.includes("Block Stem") &&
          bodyText.includes("Invalid Math Fallback") &&
          (await page.locator(".math-inline .katex").count()) >= 2 &&
          (await page
            .locator('[data-review-id="math-block"] .katex')
            .count()) >= 2 &&
          (await hasExpectedMatrixLayout(
            page.locator('[data-review-id="document-body"]'),
            [[2, 1, 1]],
          )) &&
          bodyText.includes("not rendered inside source")
        : true,
    hasMarkdownMathEdgeCases:
      scenario === "viewer-markdown-math-edge-cases"
        ? bodyText.includes("Markdown Math Edge Cases") &&
          bodyText.includes("Costs stay readable") &&
          bodyText.includes("$12.00") &&
          bodyText.includes("USD $5") &&
          bodyText.includes("price is $5 and $6") &&
          bodyText.includes("$escaped$") &&
          bodyText.includes("$not math$") &&
          bodyText.includes("not rendered inside source") &&
          bodyText.includes("After invalid math remains visible") &&
          (await page.locator(".math-inline .katex").count()) === 32 &&
          (await page
            .getByRole("heading", { name: "ASCII Label Boundaries" })
            .locator("xpath=following-sibling::p[position() <= 4]")
            .locator(".math-inline .katex")
            .count()) === 4 &&
          !bodyText.includes("ID$v$の") &&
          !bodyText.includes("API$x$を") &&
          bodyText.includes("word$x$word") &&
          bodyText.includes("v2$x$.") &&
          bodyText.includes("end-of-line ID$v$") &&
          bodyText.includes("ID$5$です") &&
          (await page
            .getByRole("heading", { name: "Numeric Table Math" })
            .locator("xpath=following::table[1]")
            .locator(".math-inline .katex")
            .count()) === 12 &&
          !bodyText.includes("$0.5774$") &&
          (await page
            .locator("li")
            .filter({ hasText: "学習データ。optimizerは更新しない" })
            .locator(".math-inline .katex")
            .count()) === 2 &&
          (await page
            .locator("li")
            .filter({ hasText: "学習可能なパラメータ。optimizerが更新する" })
            .locator(".math-inline .katex")
            .count()) === 2 &&
          (await page
            .locator("li")
            .filter({
              hasText: "入力と現在のパラメータから一時的に計算される値",
            })
            .locator(".math-inline .katex")
            .count()) === 3 &&
          (await hasNaturalInlineMathBaseline(page)) &&
          (await page
            .locator('[data-review-id="math-block"] .katex')
            .count()) === 1 &&
          (await page.locator(".math-render-error").count()) >= 2
        : true,
    hasExternalImagesSecurityPolicy:
      scenario === "viewer-external-images-security-policy"
        ? bodyText.includes("External Images Security Fixture") &&
          (await page
            .locator(
              '[data-review-id="document-body"] img[src="https://www.rust-lang.org/static/images/rust-logo-blk.svg"]',
            )
            .count()) === 1 &&
          !(await page
            .locator('[data-review-id="document-body"] .image-placeholder')
            .filter({ hasText: "External image blocked: Rust Logo" })
            .count())
        : true,
    hasMarkdownBasic:
      scenario === "viewer-markdown-basic"
        ? bodyText.includes("Markdown Sample") &&
          bodyText.includes("Reader Workflow") &&
          bodyText.includes("Code Fence") &&
          bodyText.includes("Table") &&
          (await page
            .locator(".document-body.format-markdown.markdown-body")
            .count()) === 1 &&
          (await page.locator("[data-copy-source-button]").count()) > 0
        : true,
    hasMarkdownTocInlineFormatting:
      scenario === "viewer-markdown-toc-inline-formatting"
        ? await page.evaluate(() => {
            const layoutCheck = window.__SVARD_MARKDOWN_TOC_INLINE_CHECK__;
            const toc = document.querySelector('[data-review-id="toc"]');
            const formatted = Array.from(toc?.querySelectorAll("a") ?? []).find(
              (item) =>
                item.textContent?.includes(
                  "Hugging Face Conv1D と nn.Linear の違い",
                ),
            );
            const linked = Array.from(toc?.querySelectorAll("a") ?? []).find(
              (item) => item.textContent?.includes("Linked API"),
            );
            const longHeading = Array.from(
              toc?.querySelectorAll("a") ?? [],
            ).find((item) => item.textContent?.includes("configuration_id"));
            return Boolean(
              formatted?.classList.contains("active") &&
              formatted.querySelector("strong")?.textContent ===
                "Hugging Face" &&
              formatted.querySelector("em")?.textContent === "nn.Linear" &&
              formatted.querySelector("code")?.textContent === "Conv1D" &&
              formatted.textContent ===
                "Hugging Face Conv1D と nn.Linear の違い" &&
              linked?.textContent === "Linked API and legacy behavior" &&
              linked.querySelector("a") === null &&
              longHeading &&
              longHeading.scrollWidth > longHeading.clientWidth &&
              layoutCheck?.normal?.ellipsis === true &&
              layoutCheck.normal.viewportFits === true &&
              layoutCheck.normal.lightCodeBackground !==
                layoutCheck.normal.darkCodeBackground &&
              layoutCheck?.narrow?.ellipsis === true &&
              layoutCheck.narrow.viewportFits === true &&
              !toc?.textContent?.includes("**") &&
              !toc?.textContent?.includes("~~") &&
              !toc?.textContent?.includes("`") &&
              toc?.querySelectorAll('a[href^="http"]').length === 0,
            );
          })
        : true,
    hasMarkdownCode:
      scenario === "viewer-markdown-code"
        ? bodyText.includes("Markdown Code Sample") &&
          (await page
            .locator(".document-body.format-markdown pre.hljs")
            .count()) >= 3 &&
          (await page.locator(".language-ts").count()) > 0 &&
          bodyText.includes("this stays readable")
        : true,
    hasMarkdownGithub:
      scenario === "viewer-markdown-github"
        ? bodyText.includes("Markdown GitHub Sample") &&
          (await page.locator(".markdown-frontmatter").count()) === 1 &&
          (await page.locator(".frontmatter-list li").count()) >= 2 &&
          (await page.locator(".frontmatter-nested").count()) >= 1 &&
          (await page.locator(".frontmatter-null").count()) === 1 &&
          (await page.locator(".markdown-alert").count()) >= 3 &&
          (await page.locator(".markdown-alert-tip").count()) >= 1 &&
          (await page.locator(".footnotes").count()) === 1 &&
          (await page.locator(".footnote-ref").count()) >= 2 &&
          (await page.locator(".task-list-item-checkbox").count()) >= 3 &&
          !bodyText.includes("[!NOTE]") &&
          !bodyText.includes("[TIP]") &&
          !bodyText.includes("[x] Render Markdown")
        : true,
    hasMarkdownFootnotesAdmonitions:
      scenario === "viewer-markdown-footnotes-admonitions"
        ? bodyText.includes("Markdown Footnotes And Admonitions Sample") &&
          (await page.locator(".markdown-alert").count()) >= 7 &&
          (await page.locator(".markdown-alert-note").count()) >= 2 &&
          (await page.locator(".markdown-alert-tip").count()) >= 1 &&
          (await page.locator(".markdown-alert-important").count()) >= 1 &&
          (await page.locator(".markdown-alert-warning").count()) >= 2 &&
          (await page.locator(".markdown-alert-caution").count()) >= 1 &&
          (await page.locator(".footnotes").count()) === 1 &&
          (await page.locator(".footnote-ref").count()) >= 2 &&
          (await page
            .locator('.task-list-item-checkbox[type="checkbox"][disabled]')
            .count()) >= 3 &&
          bodyText.includes("[^missing]") &&
          bodyText.includes("[^code]") &&
          bodyText.includes("This stays inside the source block.") &&
          !bodyText.includes("[!NOTE]") &&
          !bodyText.includes("[CAUTION]")
        : true,
    hasMarkdownDetails:
      scenario === "viewer-markdown-details"
        ? bodyText.includes("Markdown Details Sample") &&
          bodyText.includes("Click to expand: Installation Instructions") &&
          bodyText.includes("Open by default summary") &&
          bodyText.includes("Inline math") &&
          bodyText.includes("Compact answer") &&
          bodyText.includes("D_head = D_model / H = 12 / 3 = 4") &&
          bodyText.includes("Unsafe attributes stay escaped") &&
          (await page
            .locator('[data-review-id="markdown-details"]')
            .count()) === 4 &&
          (await page.locator(".markdown-details[open]").count()) === 2 &&
          (await page
            .locator(".markdown-details .math-inline .katex")
            .count()) === 1 &&
          (await page
            .locator(".markdown-details .markdown-alert-note")
            .count()) === 1 &&
          (await page.locator(".markdown-details .language-python").count()) >=
            1 &&
          (await page.locator(".document-body script").count()) === 0 &&
          !(await page.evaluate(() => Boolean(window.__SVARD_UNSAFE_DETAILS__)))
        : true,
    hasMarkdownSafeHtml:
      scenario === "viewer-markdown-safe-html"
        ? bodyText.includes("Markdown Safe HTML Sample") &&
          bodyText.includes("<kbd>Unclosed fragment") &&
          (await page.evaluate(() => {
            const body = document.querySelector(
              '[data-review-id="document-body"].format-markdown',
            );
            if (!body) {
              return false;
            }
            const count = (selector) => body.querySelectorAll(selector).length;
            const authorElements = body.querySelectorAll(
              "kbd, br, sub, sup, mark, ins, s, del, small, abbr, ruby, rt, rp",
            );
            const inlineParagraphs = Array.from(
              body.querySelectorAll("p"),
            ).filter((paragraph) =>
              paragraph.querySelector("kbd, mark, abbr, ruby"),
            );
            return (
              count("kbd") === 2 &&
              count("br") === 1 &&
              count("sub") === 1 &&
              count("sup") === 1 &&
              count("mark") === 3 &&
              count("ins") === 1 &&
              count("s") === 1 &&
              count("del") === 1 &&
              count("small") === 1 &&
              count('abbr[title="Application Programming Interface"]') === 1 &&
              count("ruby") === 1 &&
              count("ruby > rt") === 2 &&
              count("ruby > rp") === 2 &&
              count('[data-review-id="markdown-details"][open]') === 1 &&
              count(".markdown-details.author-style") === 0 &&
              count('mark[class="author-style"]') === 0 &&
              !Array.from(authorElements).some((element) =>
                Array.from(element.attributes).some(
                  (attribute) =>
                    attribute.name !== "title" && attribute.name !== "open",
                ),
              ) &&
              inlineParagraphs.length >= 3 &&
              inlineParagraphs.every(
                (paragraph) =>
                  !paragraph.hasAttribute("data-source-reference") &&
                  !paragraph.hasAttribute("data-source-selection-block-id"),
              ) &&
              count("svard-markdown-author-html-inline") === 0 &&
              count("svard-markdown-author-html-block") === 0 &&
              count("[data-svard-markdown-author-html-id]") === 0 &&
              count("script, style, iframe, form, svg, math") === 0
            );
          }))
        : true,
    hasMarkdownSafeHtmlBlocks:
      scenario === "viewer-markdown-safe-html-blocks"
        ? bodyText.includes("Markdown Safe HTML Blocks") &&
          bodyText.includes("Following Markdown keeps its source location.") &&
          (await page.evaluate(() => {
            const body = document.querySelector(
              '[data-review-id="document-body"].format-markdown',
            );
            if (!body) return false;
            const roots = Array.from(
              body.querySelectorAll(".markdown-safe-html-block"),
            );
            const table = body.querySelector("table.markdown-safe-html-block");
            const followingHeading = Array.from(
              body.querySelectorAll("h2"),
            ).find(
              (heading) =>
                heading.textContent?.trim() === "Following Markdown heading",
            );
            return (
              roots.length === 5 &&
              body.querySelector(
                'div.markdown-safe-html-block[align="center"]',
              ) !== null &&
              body.querySelector(".markdown-safe-html-block.author-layout") ===
                null &&
              body.querySelector("table.author-table") === null &&
              body.querySelector('ol[start="2"][reversed][type="A"]') !==
                null &&
              body.querySelector('ol > li[value="4"]') !== null &&
              body.querySelector("dl > dt + dd") !== null &&
              body.querySelector("hr.markdown-safe-html-block") !== null &&
              table?.closest(".markdown-table-scroll") !== null &&
              table?.querySelector('th[scope="col"]') !== null &&
              !roots.some(
                (root) =>
                  root.hasAttribute("data-source-reference") ||
                  root.hasAttribute("data-source-selection-block-id") ||
                  root.querySelector(
                    "[data-source-reference],[data-source-selection-block-id]",
                  ),
              ) &&
              followingHeading?.hasAttribute("data-source-reference") ===
                true &&
              body.querySelector(
                "svard-markdown-author-html-inline,svard-markdown-author-html-block,[data-svard-markdown-author-html-id]",
              ) === null &&
              body.querySelector("a,img,script,style,iframe,form,svg,math") ===
                null
            );
          }))
        : true,
    hasMarkdownDiagrams:
      scenario === "viewer-markdown-diagrams"
        ? bodyText.includes("Markdown Diagram Sample") &&
          bodyText.includes("Mermaid Gantt") &&
          (await page
            .locator('[data-review-id="mermaid-render"] svg')
            .count()) >= 2 &&
          (await page
            .locator('[data-review-id="plantuml-render"] svg')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="graphviz-render"] svg')
            .count()) > 0 &&
          !bodyText.includes("flowchart LR") &&
          !bodyText.includes("dateFormat  YYYY-MM-DD") &&
          !bodyText.includes("@startuml") &&
          !bodyText.includes("digraph G") &&
          !bodyText.includes("Try Kroki")
        : true,
    hasMermaidGanttScale:
      scenario === "viewer-markdown-diagrams"
        ? ganttDiagramFit !== null &&
          ganttDiagramFit.canvasRatio >= 0.88 &&
          ganttDiagramFit.svgRatio >= 0.82 &&
          ganttDiagramFit.svgHeight <= ganttDiagramFit.viewerHeight * 0.82
        : true,
    hasMarkdownJapanese:
      scenario === "viewer-markdown-japanese"
        ? bodyText.includes("Markdown 日本語確認") &&
          bodyText.includes("日本語の見出し") &&
          bodyText.includes("句読点") &&
          bodyText.includes("<script>window.__svardUnsafe") &&
          (await page
            .locator('[data-review-id="mermaid-render"] svg')
            .count()) > 0
        : true,
    hasObsidianWikilinkNoteJump:
      scenario === "viewer-obsidian-wikilink-note-jump"
        ? bodyText.includes("Obsidian Index") &&
          bodyText.includes("the guide") &&
          (await page
            .locator(
              '[data-review-id="document-body"] a[href="/workspace/obsidian-vault/Guide.md"]',
            )
            .count()) >= 2 &&
          (await page
            .locator(
              '[data-review-id="document-body"] a[href="/workspace/obsidian-vault/Guide.md#Details"]',
            )
            .count()) === 1 &&
          (await page
            .locator(
              '[data-review-id="document-body"] a[href="/workspace/obsidian-vault/folder/Nested.md"]',
            )
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="document-body"] [data-wikilink-target]')
            .count()) === 0
        : true,
    hasObsidianWikilinkCacheRefresh:
      scenario === "viewer-obsidian-wikilink-cache-refresh"
        ? bodyText.includes("Obsidian Index") &&
          (await page
            .locator(
              '[data-review-id="document-body"] a[href="/workspace/obsidian-vault/Guide.md"]',
            )
            .count()) >= 2 &&
          (await page
            .locator('[data-review-id="document-body"] [data-wikilink-target]')
            .count()) === 0 &&
          (await page.evaluate(
            () =>
              window.__SVARD_COMMANDS__?.getLastCommand?.() ===
              "viewer.reloadForce",
          ))
        : true,
    hasObsidianWikilinkLiveRefresh:
      scenario === "viewer-obsidian-wikilink-live-refresh"
        ? bodyText.includes("Obsidian Index") &&
          bodyText.includes("Open Guide.") &&
          !bodyText.includes("[[Guide]]") &&
          (await page
            .locator(
              '[data-review-id="document-body"] a[href="/workspace/obsidian-vault/Guide.md"]',
            )
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="document-body"] [data-wikilink-target]')
            .count()) === 0
        : true,
    hasObsidianWikilinkDisabledWithoutVault:
      scenario === "viewer-obsidian-wikilink-disabled-without-vault"
        ? bodyText.includes("Wikilink Disabled") &&
          bodyText.includes("[[Guide]]") &&
          (await page
            .locator('[data-review-id="document-body"] a')
            .filter({ hasText: "Guide" })
            .count()) === 0
        : true,
    hasContentCursorBasic:
      scenario === "viewer-content-cursor-basic"
        ? bodyText.includes("Markdown Sample") &&
          (await page
            .locator(
              '[data-review-id="document-body"] [data-review-id="content-cursor-active"]',
            )
            .count()) === 1 &&
          (await page.evaluate(() => {
            const active = document.querySelector(
              '[data-review-id="document-body"] [data-review-id="content-cursor-active"]',
            );
            if (!(active instanceof HTMLElement)) return false;
            const rect = active.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
          }))
        : true,
  };
}
