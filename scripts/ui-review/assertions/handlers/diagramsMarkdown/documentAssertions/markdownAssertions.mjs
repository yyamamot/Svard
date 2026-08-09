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
          (await page.locator(".math-inline .katex").count()) === 28 &&
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
            .count()) === 3 &&
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
