export async function applyMarkdownScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-math-rendering") {
    await page.locator("text=math-rendering.adoc").click();
    await page
      .getByRole("heading", { name: "Math Rendering Sample" })
      .waitFor();
    await page.getByRole("heading", { name: "Block Stem" }).waitFor();
    await page.locator(".math-inline .katex").first().waitFor();
    await page
      .locator('[data-review-id="math-block"] .katex')
      .first()
      .waitFor();
    await page
      .locator('[data-review-id="math-block"] .mtable')
      .first()
      .waitFor();
    await page
      .getByRole("heading", { name: "Invalid Math Fallback" })
      .waitFor();
  } else if (scenario === "viewer-markdown-math-edge-cases") {
    await page.locator("text=markdown-math-edge-cases.md").click();
    await page
      .getByRole("heading", { name: "Markdown Math Edge Cases" })
      .waitFor();
    await page.getByRole("heading", { name: "Valid Math" }).waitFor();
    await page.getByRole("heading", { name: "Non-ASCII Boundaries" }).waitFor();
    await page
      .getByRole("heading", { name: "ASCII Label Boundaries" })
      .waitFor();
    await page.getByRole("heading", { name: "Numeric Table Math" }).waitFor();
    await page.locator(".math-inline .katex").first().waitFor();
    await page.locator(".math-inline .mfrac").first().waitFor();
    await page
      .locator('[data-review-id="math-block"] .katex')
      .first()
      .waitFor();
    await page.getByRole("heading", { name: "Invalid Fallback" }).waitFor();
  } else if (scenario === "viewer-external-images-security-policy") {
    await page.locator("text=external-images.md").click();
    await page
      .getByRole("heading", { name: "External Images Security Fixture" })
      .waitFor();
    await page
      .locator('[data-review-id="document-body"] .image-placeholder')
      .filter({ hasText: "External image blocked: Rust Logo" })
      .waitFor();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-page"]').waitFor();
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Security" })
      .click();
    await page
      .locator('[data-review-id="show-external-images-control"]')
      .check();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.close");
    });
    await page
      .getByRole("heading", { name: "External Images Security Fixture" })
      .waitFor();
    await page
      .locator(
        '[data-review-id="document-body"] img[src="https://www.rust-lang.org/static/images/rust-logo-blk.svg"]',
      )
      .waitFor();
  } else if (scenario === "viewer-markdown-basic") {
    await page.locator("text=markdown-sample.md").click();
    await page.getByRole("heading", { name: "Markdown Sample" }).waitFor();
    await page.getByRole("heading", { name: "Reader Workflow" }).waitFor();
    await page.getByRole("heading", { name: "Code Fence" }).waitFor();
    await page.getByRole("heading", { name: "Table" }).waitFor();
  } else if (scenario === "viewer-markdown-toc-inline-formatting") {
    await page.locator("text=markdown-toc-inline.md").click();
    await page
      .getByRole("heading", { name: "Markdown TOC Inline Formatting" })
      .waitFor();
    const formattedHeading = page
      .locator('[data-review-id="toc"] a')
      .filter({ hasText: "Hugging Face Conv1D と nn.Linear の違い" });
    await formattedHeading.waitFor();
    await formattedHeading.click();
    await formattedHeading.locator("strong").waitFor();
    await formattedHeading.locator("em").waitFor();
    await formattedHeading.locator("code").waitFor();
    await formattedHeading.waitFor({ state: "visible" });
    await page.waitForFunction(() =>
      document
        .querySelector('[data-review-id="toc"] a.active')
        ?.textContent?.includes("Hugging Face Conv1D と nn.Linear の違い"),
    );
    const normalLayout = await page.evaluate(() => {
      const shell = document.querySelector(".app-shell");
      const code = document.querySelector('[data-review-id="toc"] code');
      const longHeading = Array.from(
        document.querySelectorAll('[data-review-id="toc"] a'),
      ).find((item) => item.textContent?.includes("configuration_id"));
      if (!shell || !code || !longHeading) {
        return null;
      }
      const lightCodeBackground = getComputedStyle(code).backgroundColor;
      shell.classList.remove("theme-light");
      shell.classList.add("theme-dark");
      const darkCodeBackground = getComputedStyle(code).backgroundColor;
      shell.classList.remove("theme-dark");
      shell.classList.add("theme-light");
      return {
        lightCodeBackground,
        darkCodeBackground,
        ellipsis: longHeading.scrollWidth > longHeading.clientWidth,
        viewportFits: document.documentElement.scrollWidth <= window.innerWidth,
      };
    });
    await page.setViewportSize({ width: 1000, height: 640 });
    await page.evaluate((normal) => {
      const longHeading = Array.from(
        document.querySelectorAll('[data-review-id="toc"] a'),
      ).find((item) => item.textContent?.includes("configuration_id"));
      window.__SVARD_MARKDOWN_TOC_INLINE_CHECK__ = {
        normal,
        narrow: longHeading
          ? {
              ellipsis: longHeading.scrollWidth > longHeading.clientWidth,
              viewportFits:
                document.documentElement.scrollWidth <= window.innerWidth,
            }
          : null,
      };
    }, normalLayout);
  } else if (scenario === "viewer-content-cursor-basic") {
    await page.locator("text=markdown-sample.md").click();
    await page.getByRole("heading", { name: "Markdown Sample" }).waitFor();
    await page.locator('[data-review-id="document-body"]').click();
    await page.keyboard.press("Alt+ArrowDown");
    await page.locator('[data-review-id="content-cursor-active"]').waitFor();
    await page.keyboard.press("Alt+ArrowDown");
    await page.keyboard.press("Alt+ArrowUp");
  } else if (scenario === "viewer-markdown-code") {
    await page.locator("text=markdown-code.md").click();
    await page.getByRole("heading", { name: "Markdown Code Sample" }).waitFor();
    await page
      .locator(".document-body.format-markdown pre.hljs")
      .first()
      .waitFor();
  } else if (scenario === "viewer-markdown-github") {
    await page.locator("text=markdown-github.md").click();
    await page
      .getByRole("heading", { name: "Markdown GitHub Sample" })
      .waitFor();
    await page.locator(".markdown-alert-warning").waitFor();
    await page.locator(".markdown-alert-tip").waitFor();
    await page.locator(".task-list-item-checkbox").first().waitFor();
    await page.locator(".markdown-frontmatter").waitFor();
    await page.locator(".footnotes").waitFor();
  } else if (scenario === "viewer-markdown-footnotes-admonitions") {
    await page.locator("text=markdown-footnotes-admonitions.md").click();
    await page
      .getByRole("heading", {
        name: "Markdown Footnotes And Admonitions Sample",
      })
      .waitFor();
    await page.locator(".markdown-alert-caution").waitFor();
    await page
      .getByRole("heading", { name: "Lists And Tables" })
      .scrollIntoViewIfNeeded();
    await page.locator(".task-list-item-checkbox").first().waitFor();
    await page.locator(".footnotes").waitFor();
  } else if (scenario === "viewer-markdown-details") {
    await page.locator("text=markdown-details.md").click();
    await page
      .getByRole("heading", { name: "Markdown Details Sample" })
      .waitFor();
    await page.locator('[data-review-id="markdown-details"]').first().waitFor();
    await page.getByText("Open by default summary").waitFor();
    await page.getByText("Inline math").waitFor();
    await page.locator(".markdown-details[open] .language-python").waitFor();
    const compactDetails = page
      .locator('[data-review-id="markdown-details"]')
      .filter({ has: page.getByText("Compact answer", { exact: true }) });
    await compactDetails.waitFor();
    if (await compactDetails.locator(".markdown-details-body").isVisible()) {
      throw new Error("Compact Markdown details body must start collapsed.");
    }
    await compactDetails.locator("summary").click();
    await compactDetails
      .locator(".markdown-details-body")
      .waitFor({ state: "visible" });
    await page
      .locator('[data-review-id="source-copy-button"]')
      .first()
      .waitFor({ state: "attached" });
    await page.locator(".markdown-details[open] pre").hover();
  } else if (scenario === "viewer-markdown-diagrams") {
    await page.locator("text=markdown-diagrams.md").click();
    await page
      .getByRole("heading", { name: "Markdown Diagram Sample" })
      .waitFor();
    await page
      .locator('[data-review-id="mermaid-render"] svg')
      .first()
      .waitFor();
    await page.locator('[data-review-id="plantuml-render"] svg').waitFor();
    await page.locator('[data-review-id="graphviz-render"] svg').waitFor();
  } else if (scenario === "viewer-markdown-japanese") {
    await page.locator("text=markdown-japanese.md").click();
    await page.getByRole("heading", { name: "Markdown 日本語確認" }).waitFor();
    await page.getByRole("heading", { name: "日本語の見出し" }).waitFor();
    await page.locator('[data-review-id="mermaid-render"] svg').waitFor();
  } else if (scenario === "viewer-obsidian-wikilink-note-jump") {
    await page.locator("text=obsidian-vault").click();
    await page.locator("text=index.md").click();
    await page.getByRole("heading", { name: "Obsidian Index" }).waitFor();
    await page
      .locator(
        '[data-review-id="document-body"] a[href="/workspace/obsidian-vault/Guide.md"]',
      )
      .first()
      .waitFor();
    await page
      .locator(
        '[data-review-id="document-body"] a[href="/workspace/obsidian-vault/folder/Nested.md"]',
      )
      .first()
      .waitFor();
  } else if (scenario === "viewer-obsidian-wikilink-cache-refresh") {
    await page.locator("text=obsidian-vault").click();
    await page.locator("text=index.md").click();
    await page.getByRole("heading", { name: "Obsidian Index" }).waitFor();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("viewer.reloadForce");
    });
    await page
      .locator(
        '[data-review-id="document-body"] a[href="/workspace/obsidian-vault/Guide.md"]',
      )
      .first()
      .waitFor();
  } else if (scenario === "viewer-obsidian-wikilink-live-refresh") {
    await page.evaluate(() => {
      window.__SVARD_DOCUMENT_OVERRIDES__ = {
        "/workspace/obsidian-vault/index.md": {
          source: "# Obsidian Index\n\nNo note link yet.\n",
          updatedAt: "2026-05-12T00:01:00.000Z",
        },
      };
    });
    await page.locator("text=obsidian-vault").click();
    await page.locator("text=index.md").click();
    await page.getByRole("heading", { name: "Obsidian Index" }).waitFor();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "No note link yet." })
      .waitFor();
    await page.evaluate(() => {
      window.__SVARD_DOCUMENT_OVERRIDES__ = {
        "/workspace/obsidian-vault/index.md": {
          source: "# Obsidian Index\n\nOpen [[Guide]].\n",
          updatedAt: "2026-05-12T00:02:00.000Z",
        },
      };
      window.__SVARD_TRIGGER_DOCUMENT_CHANGE__?.(
        "/workspace/obsidian-vault/index.md",
      );
    });
    await page
      .locator(
        '[data-review-id="document-body"] a[href="/workspace/obsidian-vault/Guide.md"]',
      )
      .first()
      .waitFor();
  } else if (scenario === "viewer-obsidian-wikilink-disabled-without-vault") {
    await page.locator("text=obsidian-wikilink-disabled.md").click();
    await page.getByRole("heading", { name: "Wikilink Disabled" }).waitFor();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "[[Guide]]" })
      .waitFor();
  } else {
    return false;
  }
  return true;
}
