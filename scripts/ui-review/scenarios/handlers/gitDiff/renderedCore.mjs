import { applyGitDiffRenderedCoreAdvancedScenario } from "./renderedCoreAdvanced.mjs";
export async function applyGitDiffRenderedCoreScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (await applyGitDiffRenderedCoreAdvancedScenario(context)) {
    return true;
  }
  if (scenario === "viewer-git-diff-large-markdown-table-row-addition") {
    const path = "/workspace/docs/git-large-table-row-addition.md";
    const leftText = largeMarkdownTableSource({ includeLocalPlantUmlCache: false });
    const rightText = largeMarkdownTableSource({ includeLocalPlantUmlCache: true });
    await page.evaluate(
      ({ leftText, path, rightText }) => {
        window.__SVARD_PICK_DOCUMENT__ = path;
        window.__SVARD_DOCUMENT_OVERRIDES__ = {
          ...(window.__SVARD_DOCUMENT_OVERRIDES__ ?? {}),
          [path]: { source: rightText },
        };
        window.__SVARD_GIT_STATUS_OVERRIDES__ = {
          ...(window.__SVARD_GIT_STATUS_OVERRIDES__ ?? {}),
          [path]: "modified",
        };
        window.__SVARD_GIT_DIFF_OVERRIDES__ = {
          ...(window.__SVARD_GIT_DIFF_OVERRIDES__ ?? {}),
          [path]: {
            repositoryRoot: null,
            relativePath: "docs/git-large-table-row-addition.md",
            leftPath: path,
            rightPath: path,
            status: "modified",
            leftLabel: "HEAD",
            rightLabel: "Working Tree",
            hunks: [
              {
                oldStart: 1,
                oldLines: 18,
                newStart: 1,
                newLines: 19,
                lines: [
                  { kind: "context", oldLine: 1, newLine: 1, text: "# Large Table Row Addition" },
                  { kind: "context", oldLine: 2, newLine: 2, text: "" },
                  { kind: "context", oldLine: 3, newLine: 3, text: "| Area | Feature | Status |" },
                  { kind: "context", oldLine: 4, newLine: 4, text: "| --- | --- | --- |" },
                  { kind: "context", oldLine: 5, newLine: 5, text: "| Documents | Open files | Stable |" },
                  { kind: "context", oldLine: 6, newLine: 6, text: "| Diagrams | Fast diagram loading | Stable |" },
                  { kind: "added", oldLine: null, newLine: 7, text: "| Diagrams | Local PlantUML SVG cache | Stable |" },
                  { kind: "context", oldLine: 7, newLine: 8, text: "| Files | File tree | Stable |" },
                  { kind: "context", oldLine: 8, newLine: 9, text: "| Search | Quick Open | Stable |" },
                ],
              },
            ],
            message: null,
            leftText,
            rightText,
          },
        };
      },
      { leftText, path, rightText },
    );
    await page.evaluate(() => window.__SVARD_COMMANDS__?.dispatch("file.open"));
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Large Table Row Addition" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.getByRole("button", { name: "Changes Only" }).click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
    await page.evaluate(() => {
      const rightPane = document.querySelector(
        '[data-review-id="git-rendered-right-pane"]',
      );
      window.__SVARD_LARGE_TABLE_ROW_DIFF__ = {
        changesOnlyText: rightPane?.textContent ?? "",
        changesOnlyRows: Array.from(rightPane?.querySelectorAll("tr") ?? []).map(
          (row) => row.textContent?.replace(/\s+/g, " ").trim() ?? "",
        ),
        renderedChangedRows: rightPane?.querySelectorAll(
          '[data-review-id="git-rendered-table-row-change"]',
        ).length ?? 0,
      };
    });
    await page.locator('[data-review-id="git-diff-table-view"]').click();
    await page.locator('[data-review-id="git-diff-table-diff"]').waitFor();
    await page.evaluate(() => {
      const result = window.__SVARD_LARGE_TABLE_ROW_DIFF__ ?? {};
      const tablePane = document.querySelector(
        '[data-review-id="git-diff-table-right-pane"]',
      );
      window.__SVARD_LARGE_TABLE_ROW_DIFF__ = {
        ...result,
        tableText: tablePane?.textContent ?? "",
        tableChangeTargets: new Set(
          Array.from(
            tablePane?.querySelectorAll("[data-change-index]") ?? [],
          ).map((cell) => cell.getAttribute("data-change-index")),
        ).size,
        tableChangedCells: tablePane?.querySelectorAll(
          '[data-review-id="git-diff-table-cell"].added, [data-review-id="git-diff-table-cell"].changed, [data-review-id="git-diff-table-cell"].removed',
        ).length ?? 0,
      };
    });
    await page.getByRole("button", { name: "Changes Only" }).click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
    return true;
  } else if (
    scenario === "viewer-git-diff-rendered-markdown" ||
    scenario === "viewer-diff-context-menu-rendered"
  ) {
    if (scenario === "viewer-diff-context-menu-rendered") {
      await page.evaluate(async () => {
        await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
      });
      await page.locator('[data-review-id="preferences-page"]').waitFor();
      await page
        .locator('[data-review-id="preferences-nav"] button')
        .filter({ hasText: "Mouse Gestures" })
        .click();
      await page
        .locator('[data-review-id="mouse-gestures-enabled"] input')
        .check();
      await page.evaluate(() =>
        window.__SVARD_COMMANDS__?.dispatch("preferences.close"),
      );
    }
    const fixtureName =
      scenario === "viewer-diff-context-menu-rendered"
        ? "git-rendered-markdown.md"
        : "diff-regression-gallery.md";
    await page.locator(`text=${fixtureName}`).click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({
        hasText:
          scenario === "viewer-diff-context-menu-rendered"
            ? "Git Rendered Markdown Diff Fixture"
            : "Diff Preview Regression Gallery",
      })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    if (scenario === "viewer-git-diff-rendered-markdown") {
      await page.getByRole("button", { name: "Changes Only" }).click();
      await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
    }
    if (scenario === "viewer-diff-context-menu-rendered") {
      await page.getByRole("button", { name: "Changes Only" }).click();
      await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
      const rightPane = page.locator(
        '[data-review-id="git-rendered-right-pane"]',
      );
      const sourceBlock = rightPane.locator("pre").first();
      await sourceBlock.scrollIntoViewIfNeeded();
      await sourceBlock.click({ button: "right" });
      await page
        .locator('[data-review-id="context-menu"]')
        .filter({ hasText: "Copy Source" })
        .waitFor();
      const contextMenuLayering = await page.evaluate(() => {
        const menu = document.querySelector('[data-review-id="context-menu"]');
        const backdrop = document.querySelector(
          '[data-review-id="git-diff-backdrop"]',
        );
        if (
          !(menu instanceof HTMLElement) ||
          !(backdrop instanceof HTMLElement)
        ) {
          return null;
        }
        return {
          menuZIndex: Number(window.getComputedStyle(menu).zIndex),
          backdropZIndex: Number(window.getComputedStyle(backdrop).zIndex),
        };
      });
      const sourceContextMenuText = await page
        .locator('[data-review-id="context-menu"]')
        .innerText();
      await page.keyboard.press("Escape");
      await page
        .locator('[data-review-id="context-menu"]')
        .waitFor({ state: "detached" });
      await rightPane
        .locator(".git-rendered-scroll")
        .click({ button: "right", position: { x: 12, y: 72 } });
      await page
        .locator('[data-review-id="context-menu"]')
        .filter({ hasText: /Open in Editor|Copy Pane Text/u })
        .waitFor();
      const backgroundContextMenuText = await page
        .locator('[data-review-id="context-menu"]')
        .innerText();
      await page.evaluate(
        ({
          sourceContextMenuText,
          backgroundContextMenuText,
          contextMenuLayering,
        }) => {
          window.__SVARD_DIFF_CONTEXT_MENU_RENDERED__ = {
            sourceContextMenuText,
            backgroundContextMenuText,
            contextMenuLayering,
          };
        },
        {
          sourceContextMenuText,
          backgroundContextMenuText,
          contextMenuLayering,
        },
      );
    } else {
      await page.locator('[data-review-id="git-diff-rendered-view"]').click();
      await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
    }
  } else if (scenario === "viewer-git-diff-rendered-asciidoc") {
    await page.locator("text=diff-regression-gallery.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Diff Preview Regression Gallery" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
  } else if (scenario === "viewer-git-diff-rendered-diagram-placeholder") {
    await page.locator("text=git-rendered-diagram.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Diagram Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
  } else if (
    scenario === "viewer-git-diff-markdown-table" ||
    scenario === "viewer-diff-context-menu-table"
  ) {
    await page.locator("text=git-table.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Table Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-table-view"]').click();
    await page.locator('[data-review-id="git-diff-table-diff"]').waitFor();
    if (scenario === "viewer-diff-context-menu-table") {
      const tableCell = page
        .locator('[data-review-id="git-diff-table-cell"]')
        .filter({ hasText: "$12" })
        .first();
      await tableCell.click({ button: "right" });
      await page
        .locator('[data-review-id="context-menu"]')
        .filter({ hasText: "Copy as TSV" })
        .waitFor();
      const tableCellContextMenuText = await page
        .locator('[data-review-id="context-menu"]')
        .innerText();
      await page.keyboard.press("Escape");
      await page
        .locator('[data-review-id="context-menu"]')
        .waitFor({ state: "detached" });
      await page
        .locator('[data-review-id="git-diff-table-right-pane"]')
        .locator(".git-diff-table-scroll")
        .click({ button: "right", position: { x: 12, y: 12 } });
      await page
        .locator('[data-review-id="context-menu"]')
        .filter({ hasText: "Open in Editor" })
        .waitFor();
      const tableBackgroundContextMenuText = await page
        .locator('[data-review-id="context-menu"]')
        .innerText();
      await page.evaluate(
        ({ tableCellContextMenuText, tableBackgroundContextMenuText }) => {
          window.__SVARD_DIFF_CONTEXT_MENU_TABLE__ = {
            tableCellContextMenuText,
            tableBackgroundContextMenuText,
          };
        },
        { tableCellContextMenuText, tableBackgroundContextMenuText },
      );
    }
  } else if (scenario === "viewer-git-diff-asciidoc-table-dom") {
    await page.locator("text=git-asciidoc-table.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git AsciiDoc Table Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-table-view"]').click();
    await page.locator('[data-review-id="git-diff-table-diff"]').waitFor();
  } else if (scenario === "viewer-git-diff-asciidoc-table-marker") {
    await page.locator("text=git-asciidoc-table-complex.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git AsciiDoc Complex Table Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page
      .locator('[data-review-id="git-diff-asciidoc-table-badge"]')
      .first()
      .waitFor();
  } else if (scenario === "viewer-rendered-diff-quality") {
    await page.locator("text=diff-regression-gallery.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Diff Preview Regression Gallery" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    await page
      .locator('[data-review-id="git-diff-change-ruler-marker"]')
      .first()
      .waitFor();
  } else if (
    scenario === "viewer-rendered-visual-diff-markdown" ||
    scenario === "viewer-rendered-visual-diff-inline-highlight" ||
    scenario === "viewer-rendered-visual-diff-minimap"
  ) {
    await page.locator("text=git-rendered-markdown.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Markdown Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
    if (scenario === "viewer-rendered-visual-diff-inline-highlight") {
      await page
        .locator('[data-review-id="git-diff-word-highlight"]')
        .first()
        .waitFor();
    }
    if (scenario === "viewer-rendered-visual-diff-minimap") {
      await page.getByRole("button", { name: "Next change" }).click();
      await page
        .locator('[data-review-id="git-diff-change-ruler-marker"].active')
        .waitFor();
      await page.locator('[data-review-id="git-diff-change-ruler"]').waitFor();
      await page
        .locator('[data-review-id="git-diff-change-ruler-marker"]')
        .nth(1)
        .click();
      await page
        .locator('[data-review-id="git-diff-change-ruler-marker"].active')
        .waitFor();
    }
  } else if (scenario === "viewer-rendered-visual-diff-asciidoc") {
    await page.locator("text=diff-regression-gallery.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Diff Preview Regression Gallery" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
  } else if (
    scenario === "viewer-diff-full-preview-markdown" ||
    scenario === "viewer-diff-code-syntax-highlight" ||
    scenario === "viewer-diff-code-fence-word-highlight" ||
    scenario === "viewer-diff-preview-expand" ||
    scenario === "viewer-diff-full-preview-backlog-resync" ||
    scenario === "viewer-diff-diagram-unchanged-with-image-change" ||
    scenario === "viewer-diff-image-placeholder-source-change" ||
    scenario === "viewer-diff-external-images-security-policy"
  ) {
    const targetFile =
      scenario === "viewer-diff-full-preview-backlog-resync"
        ? "git-backlog-resync.md"
        : scenario === "viewer-diff-diagram-unchanged-with-image-change"
          ? "git-diagram-image-diff.adoc"
          : scenario === "viewer-diff-image-placeholder-source-change" ||
              scenario === "viewer-diff-external-images-security-policy"
            ? "git-image-placeholder-source-change.adoc"
            : "git-rendered-markdown.md";
    const targetText =
      scenario === "viewer-diff-full-preview-backlog-resync"
        ? "Backlog Resync Diff Fixture"
        : scenario === "viewer-diff-diagram-unchanged-with-image-change"
          ? "Diagram Image Diff Fixture"
          : scenario === "viewer-diff-image-placeholder-source-change" ||
              scenario === "viewer-diff-external-images-security-policy"
            ? "Image Placeholder Source Diff Fixture"
            : "Git Rendered Markdown Diff Fixture";
    await page.locator(`text=${targetFile}`).click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: targetText })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    if (scenario === "viewer-diff-external-images-security-policy") {
      const blockedSample = await page.evaluate(() => {
        const root = document.querySelector(
          '[data-review-id="git-full-preview-diff"]',
        );
        const bodyText = root?.textContent ?? "";
        return {
          remoteImages: root?.querySelectorAll('img[src^="https://"]').length,
          blockedPlaceholders: Array.from(
            root?.querySelectorAll(
              '[data-review-id="git-full-preview-block"]',
            ) ?? [],
          ).filter((block) =>
            /External image blocked|Image: Shared remote image/.test(
              block.textContent ?? "",
            ),
          ).length,
          rawUrlVisible:
            bodyText.includes("old-remote-image.png") ||
            bodyText.includes("new-remote-image.png"),
        };
      });
      await page.locator('[data-review-id="git-diff-preview-close"]').click();
      await page.evaluate(async () => {
        await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
      });
      await page.locator('[data-review-id="preferences-page"]').waitFor();
      await page
        .locator('[data-review-id="preferences-nav"] button')
        .filter({ hasText: "Security" })
        .click();
      await page
        .locator('[data-review-id="show-external-images-control"]')
        .check();
      await page.evaluate(() =>
        window.__SVARD_COMMANDS__?.dispatch("preferences.close"),
      );
      await page
        .locator('[data-review-id="document-body"]')
        .filter({ hasText: targetText })
        .waitFor();
      await page.evaluate(() =>
        window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
      );
      await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
      await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
      await page
        .locator(
          '[data-review-id="git-full-preview-diff"] img[src^="https://"]',
        )
        .first()
        .waitFor();
      const enabledSample = await page.evaluate(() => {
        const root = document.querySelector(
          '[data-review-id="git-full-preview-diff"]',
        );
        return {
          remoteImages: root?.querySelectorAll('img[src^="https://"]').length,
          oldImage:
            root?.querySelectorAll(
              'img[src="https://example.test/old-remote-image.png"]',
            ).length ?? 0,
          newImage:
            root?.querySelectorAll(
              'img[src="https://example.test/new-remote-image.png"]',
            ).length ?? 0,
          blockedPlaceholders: Array.from(
            root?.querySelectorAll(
              '[data-review-id="git-full-preview-block"]',
            ) ?? [],
          ).filter((block) =>
            block.textContent?.includes("Image: Shared remote image"),
          ).length,
        };
      });
      await page.evaluate(
        ({ blockedSample, enabledSample }) => {
          window.__SVARD_DIFF_EXTERNAL_IMAGE_POLICY__ = {
            blockedSample,
            enabledSample,
          };
        },
        { blockedSample, enabledSample },
      );
    }
    if (scenario === "viewer-diff-code-syntax-highlight") {
      await page.waitForFunction(() => {
        const keyword = document.querySelector(
          '[data-review-id="git-full-preview-diff"] .git-rendered-block-content pre.hljs .hljs-keyword',
        );
        const string = document.querySelector(
          '[data-review-id="git-full-preview-diff"] .git-rendered-block-content pre.hljs .hljs-string',
        );
        return keyword instanceof HTMLElement && string instanceof HTMLElement;
      });
      const fullPreviewCheck = await page.evaluate(() => {
        const root = document.querySelector(
          '[data-review-id="git-full-preview-diff"]',
        );
        const keyword = root?.querySelector(
          ".git-rendered-block-content pre.hljs .hljs-keyword",
        );
        const string = root?.querySelector(
          ".git-rendered-block-content pre.hljs .hljs-string",
        );
        const code = root?.querySelector(
          ".git-rendered-block-content pre.hljs code",
        );
        if (
          !(keyword instanceof HTMLElement) ||
          !(string instanceof HTMLElement) ||
          !(code instanceof HTMLElement)
        ) {
          return false;
        }
        const codeColor = getComputedStyle(code).color;
        return (
          getComputedStyle(keyword).color !== codeColor &&
          getComputedStyle(string).color !== codeColor
        );
      });
      await page.locator('[data-review-id="git-diff-rendered-view"]').click();
      await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
      const changesOnlyCheck = await page.evaluate(() => {
        const root = document.querySelector(
          '[data-review-id="git-rendered-diff"]',
        );
        const keyword = root?.querySelector(
          ".git-rendered-block-content pre.hljs .hljs-keyword",
        );
        const string = root?.querySelector(
          ".git-rendered-block-content pre.hljs .hljs-string",
        );
        const code = root?.querySelector(
          ".git-rendered-block-content pre.hljs code",
        );
        const wordHighlight = root?.querySelector(
          ".git-rendered-block-content pre.hljs .git-inline-word-highlight",
        );
        if (
          !(keyword instanceof HTMLElement) ||
          !(string instanceof HTMLElement) ||
          !(code instanceof HTMLElement)
        ) {
          return false;
        }
        const codeColor = getComputedStyle(code).color;
        return (
          getComputedStyle(keyword).color !== codeColor &&
          getComputedStyle(string).color !== codeColor &&
          wordHighlight instanceof HTMLElement
        );
      });
      await page.evaluate(
        ({ fullPreviewCheck, changesOnlyCheck }) => {
          window.__SVARD_DIFF_CODE_HIGHLIGHT_CHECK__ = {
            fullPreviewCheck,
            changesOnlyCheck,
          };
        },
        { fullPreviewCheck, changesOnlyCheck },
      );
      await page
        .locator('[data-review-id="git-diff-full-preview-view"]')
        .click();
      await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    }
    if (scenario === "viewer-diff-code-fence-word-highlight") {
      await page.waitForFunction(() => {
        const root = document.querySelector(
          '[data-review-id="git-full-preview-diff"]',
        );
        return Boolean(
          root?.querySelector(
            ".git-rendered-block-content pre.hljs .git-inline-word-highlight",
          ),
        );
      });
      const fullPreviewCheck = await sampleCodeFenceWordHighlight(page, [
        '[data-review-id="git-full-preview-diff"]',
      ]);
      await page.locator('[data-review-id="git-diff-rendered-view"]').click();
      await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
      await page.waitForFunction(() => {
        const root = document.querySelector(
          '[data-review-id="git-rendered-diff"]',
        );
        return Boolean(
          root?.querySelector(
            ".git-rendered-block-content pre.hljs .git-inline-word-highlight",
          ),
        );
      });
      const changesOnlyCheck = await sampleCodeFenceWordHighlight(page, [
        '[data-review-id="git-rendered-diff"]',
      ]);
      await page.evaluate(
        ({ fullPreviewCheck, changesOnlyCheck }) => {
          window.__SVARD_DIFF_CODE_FENCE_WORD_HIGHLIGHT__ = {
            fullPreviewCheck,
            changesOnlyCheck,
          };
        },
        { fullPreviewCheck, changesOnlyCheck },
      );
      await page
        .locator('[data-review-id="git-diff-full-preview-view"]')
        .click();
      await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    }
  } else if (
    scenario === "viewer-content-cursor-diff-preview" ||
    scenario === "viewer-content-cursor-diff-change-only"
  ) {
    await page.locator("text=git-rendered-markdown.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Markdown Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    await page
      .locator('[data-review-id="git-full-preview-block"].right-side')
      .first()
      .waitFor();
    await page.waitForTimeout(1200);
    if (scenario === "viewer-content-cursor-diff-change-only") {
      await page.keyboard.press("Alt+ArrowDown");
    } else {
      await page.evaluate(async () => {
        await window.__SVARD_COMMANDS__?.dispatch("viewer.contentCursor.next");
      });
    }
    await page.waitForFunction(() => {
      const active = document.querySelector(
        '[data-review-id="content-cursor-active"]',
      );
      return (
        active
          ?.closest(".git-rendered-pane")
          ?.getAttribute("data-review-id") === "git-full-preview-right-pane"
      );
    });
    if (scenario === "viewer-content-cursor-diff-change-only") {
      await page.keyboard.press("Alt+ArrowUp");
    }
  } else {
    return false;
  }
  return true;
}

function largeMarkdownTableSource({ includeLocalPlantUmlCache }) {
  const rows = [
    ["Documents", "Open files", "Stable"],
    ["Diagrams", "Fast diagram loading", "Stable"],
    ...(includeLocalPlantUmlCache
      ? [["Diagrams", "Local PlantUML SVG cache", "Stable"]]
      : []),
    ["Files", "File tree", "Stable"],
    ["Search", "Quick Open", "Stable"],
    ["Navigation", "Table of contents", "Stable"],
    ["Review", "Source Control changes", "Stable"],
    ["Review", "Rendered diff", "Stable"],
    ["Review", "Table view", "Stable"],
    ["Review", "Change navigation", "Stable"],
    ["Context", "Copy as TSV", "Stable"],
    ["Context", "Open in editor", "Stable"],
    ["Preferences", "Theme", "Stable"],
    ["Preferences", "Cache", "Stable"],
  ];
  return `# Large Table Row Addition

| Area | Feature | Status |
| --- | --- | --- |
${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}
`;
}

async function sampleCodeFenceWordHighlight(page, rootSelectors) {
  return await page.evaluate((selectors) => {
    const root = selectors
      .map((selector) => document.querySelector(selector))
      .find((node) => node instanceof HTMLElement);
    const codeHighlights = Array.from(
      root?.querySelectorAll(
        ".git-rendered-block-content pre.hljs .git-inline-word-highlight",
      ) ?? [],
    );
    return {
      codeHighlightCount: codeHighlights.length,
      hasCodeWordHighlight: codeHighlights.length > 0,
      codeHighlightsHaveNoReviewId: codeHighlights.every(
        (node) => !node.hasAttribute("data-review-id"),
      ),
      preservesSyntaxTokens:
        (root?.querySelectorAll(
          ".git-rendered-block-content pre.hljs .hljs-keyword",
        ).length ?? 0) > 0 &&
        (root?.querySelectorAll(
          ".git-rendered-block-content pre.hljs .hljs-string",
        ).length ?? 0) > 0,
      hasNoMathHighlight:
        (root?.querySelectorAll(
          ".katex .git-inline-word-highlight, .math-inline .git-inline-word-highlight, .math-block .git-inline-word-highlight",
        ).length ?? 0) === 0,
      hasNoSvgHighlight:
        (root?.querySelectorAll("svg .git-inline-word-highlight").length ??
          0) === 0,
    };
  }, rootSelectors);
}
