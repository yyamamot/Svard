export async function applyGitDiffRenderedCoreScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (
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
    scenario === "viewer-rendered-visual-diff-section-outline" ||
    scenario === "viewer-rendered-visual-diff-section-outline-list-table" ||
    scenario === "viewer-rendered-visual-diff-section-outline-privacy"
  ) {
    await page.locator("text=diff-regression-gallery.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Diff Preview Regression Gallery" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-overview-view"]').click();
    await page.locator('[data-review-id="git-diff-overview"]').waitFor();
    await page
      .locator('[data-review-id="git-diff-overview-jump-preview"]')
      .first()
      .click();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    await page.locator('[data-review-id="git-diff-overview-view"]').click();
    await page.locator('[data-review-id="git-diff-overview"]').waitFor();
    const overviewSummary = await page.evaluate(() => {
      const overviewButtons = Array.from(
        document.querySelectorAll(
          '[data-review-id="git-diff-overview-jump-preview"]',
        ),
      );
      const labels = overviewButtons.map((button) =>
        (button.textContent ?? "")
          .replace(/\s*·?\s*\d+\s+changes?\s*$/u, "")
          .trim(),
      );
      const changeCounts = overviewButtons.map((button) => {
        const match = (button.textContent ?? "").match(/(\d+)\s+changes?/u);
        return match ? Number(match[1]) : 1;
      });
      return {
        sectionCount: overviewButtons.length,
        duplicateLabelCount: labels.length - new Set(labels).size,
        totalChangeCount: changeCounts.reduce((sum, count) => sum + count, 0),
        activeSectionCount: overviewButtons.filter(
          (button) => button.getAttribute("data-active-change") === "true",
        ).length,
      };
    });
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();

    await page.evaluate(
      ({ scenarioName, overviewSummary }) => {
        window.__SVARD_RENDERED_SECTION_OUTLINE__ = {
          scenario: scenarioName,
          ...overviewSummary,
          listTargetCount: document.querySelectorAll(
            '[data-review-id="git-rendered-list-item-change"][data-change-index]',
          ).length,
          tableRowTargetCount: document.querySelectorAll(
            '[data-review-id="git-rendered-table-row-change"][data-change-index]',
          ).length,
        };
      },
      { scenarioName: scenario, overviewSummary },
    );
  } else if (
    scenario === "viewer-rendered-visual-diff-structured-block-targets" ||
    scenario === "viewer-rendered-visual-diff-structured-block-fallback" ||
    scenario === "viewer-rendered-visual-diff-structured-block-privacy"
  ) {
    await page.locator("text=git-rendered-asciidoc.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered AsciiDoc Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
    await page
      .locator('[data-review-id="git-rendered-structured-child-change"]')
      .first()
      .waitFor();
    const summary = await page.evaluate(() => {
      const root = document.querySelector(
        '[data-review-id="git-rendered-diff"]',
      );
      const structuredTargets = Array.from(
        root?.querySelectorAll(
          '[data-review-id="git-rendered-structured-child-change"]',
        ) ?? [],
      );
      const definitionTargets = structuredTargets.filter(
        (target) => target.tagName.toLowerCase() === "dd",
      );
      const admonitionTargets = structuredTargets.filter((target) =>
        target.matches("td.content, .markdown-alert > :not(.markdown-alert-title)"),
      );
      const iconTargets = Array.from(
        root?.querySelectorAll(
          '.admonitionblock td.icon[data-change-index], .markdown-alert-title[data-change-index]',
        ) ?? [],
      );
      const fallbackIndicators = Array.from(
        root?.querySelectorAll(
          '[data-review-id="git-rendered-fallback-indicator"]',
        ) ?? [],
      ).filter((item) => /Structured fallback/.test(item.textContent ?? ""));
      const parentDuplicateTargets = structuredTargets.filter((target) =>
        target.closest(".git-rendered-block[data-change-index]"),
      );
      const bodyText = root?.textContent ?? "";
      return {
        admonitionTargetCount: admonitionTargets.length,
        definitionTargetCount: definitionTargets.length,
        fallbackCount: fallbackIndicators.length,
        iconTargetCount: iconTargets.length,
        parentDuplicateTargetCount: parentDuplicateTargets.length,
        privatePathVisible: bodyText.includes("/Users/"),
        sourceHunkVisible: bodyText.includes("@@"),
        structuredTargetCount: structuredTargets.length,
      };
    });
    await page.evaluate(
      ({ scenarioName, summary }) => {
        window.__SVARD_RENDERED_STRUCTURED_BLOCK_TARGETS__ = {
          scenario: scenarioName,
          summary,
        };
      },
      { scenarioName: scenario, summary },
    );
  } else if (
    scenario === "viewer-rendered-visual-diff-active-change-context" ||
    scenario === "viewer-rendered-visual-diff-active-change-keyboard"
  ) {
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

    const summarizeActiveChange = async () =>
      await page.evaluate(() => {
        const activeBlocks = Array.from(
          document.querySelectorAll(
            ".git-rendered-block[data-active-change='true']",
          ),
        );
        const activeListItems = Array.from(
          document.querySelectorAll(
            '[data-review-id="git-rendered-list-item-change"][data-active-change="true"]',
          ),
        );
        const activeRows = Array.from(
          document.querySelectorAll(
            '[data-review-id="git-rendered-table-row-change"][data-active-change="true"]',
          ),
        );
        const activeMarkers = Array.from(
          document.querySelectorAll(
            '[data-review-id="git-diff-change-ruler-marker"].active',
          ),
        );
        const contentCursorTargets = Array.from(
          document.querySelectorAll('[data-content-cursor-active="true"]'),
        );
        const childParentActiveCount = [
          ...activeListItems,
          ...activeRows,
        ].filter((target) =>
          target.closest(".git-rendered-block[data-active-change='true']"),
        ).length;
        const contentCursorActiveTargets = contentCursorTargets.filter((target) =>
          target.matches("[data-active-change='true']"),
        );
        return {
          activeBlockCount: activeBlocks.length,
          activeListItemCount: activeListItems.length,
          activeMarkerCount: activeMarkers.length,
          activeTableRowCount: activeRows.length,
          childParentActiveCount,
          contentCursorActiveOverlapCount: contentCursorActiveTargets.length,
          contentCursorCount: contentCursorTargets.length,
        };
      });

    const initialSummary = await summarizeActiveChange();
    let listSummary = null;
    let tableSummary = null;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await page.getByRole("button", { name: "Next change" }).click();
      await page.waitForTimeout(80);
      const summary = await summarizeActiveChange();
      if (!listSummary && summary.activeListItemCount > 0) {
        listSummary = summary;
      }
      if (!tableSummary && summary.activeTableRowCount > 0) {
        tableSummary = summary;
      }
      if (listSummary && tableSummary) {
        break;
      }
    }

    let rulerSummary = null;
    let contentCursorSummary = null;
    if (scenario === "viewer-rendered-visual-diff-active-change-keyboard") {
      await page
        .locator('[data-review-id="git-diff-change-ruler-marker"]')
        .last()
        .click();
      await page.waitForTimeout(120);
      rulerSummary = await summarizeActiveChange();
      await page.evaluate(async () => {
        await window.__SVARD_COMMANDS__?.dispatch("viewer.contentCursor.next");
      });
      await page.waitForTimeout(120);
      contentCursorSummary = await summarizeActiveChange();
    }

    await page.evaluate(
      ({
        contentCursorSummary,
        initialSummary,
        listSummary,
        scenarioName,
        tableSummary,
        rulerSummary,
      }) => {
        window.__SVARD_RENDERED_ACTIVE_CHANGE_CONTEXT__ = {
          scenario: scenarioName,
          initialSummary,
          listSummary,
          tableSummary,
          rulerSummary,
          contentCursorSummary,
        };
      },
      {
        contentCursorSummary,
        initialSummary,
        listSummary,
        scenarioName: scenario,
        tableSummary,
        rulerSummary,
      },
    );
  } else if (
    scenario === "viewer-rendered-visual-diff-table-review-assist" ||
    scenario === "viewer-rendered-visual-diff-table-horizontal-context"
  ) {
    await page.locator("text=git-asciidoc-table.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git AsciiDoc Table Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
    await page
      .locator('[data-review-id="git-rendered-table-row-change"][data-change-index]')
      .first()
      .waitFor();

    await page.evaluate(() => {
      const rightPane = document.querySelector(
        '[data-review-id="git-rendered-right-pane"]',
      )?.querySelector(".git-rendered-scroll");
      if (rightPane instanceof HTMLElement) {
        rightPane.scrollLeft = 0;
      }
    });
    if (scenario === "viewer-rendered-visual-diff-table-horizontal-context") {
      await page.getByRole("button", { name: "Next change" }).click();
      await page.waitForTimeout(120);
    }

    let activeTableRowFound = false;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      activeTableRowFound = await page.evaluate(() =>
        Boolean(
          document.querySelector(
            '[data-review-id="git-rendered-table-row-change"][data-active-change="true"]',
          ),
        ),
      );
      if (activeTableRowFound) {
        break;
      }
      await page.getByRole("button", { name: "Next change" }).click();
      await page.waitForTimeout(80);
    }

    await page.evaluate(
      ({ scenarioName, activeTableRowFound }) => {
        const activeRows = Array.from(
          document.querySelectorAll(
            '[data-review-id="git-rendered-table-row-change"][data-active-change="true"]',
          ),
        );
        const rightPane = document.querySelector(
          '[data-review-id="git-rendered-right-pane"]',
        )?.querySelector(".git-rendered-scroll");
        window.__SVARD_RENDERED_TABLE_REVIEW_ASSIST__ = {
          scenario: scenarioName,
          activeTableRowFound,
          activeRowCount: activeRows.length,
          activeCellCount: activeRows.reduce(
            (count, row) =>
              count +
              row.querySelectorAll(
                '[data-review-id="git-rendered-table-cell-change"]',
              ).length,
            0,
          ),
          captionContextCount: document.querySelectorAll(
            '[data-review-id="git-rendered-table-caption-context"]',
          ).length,
          headerContextCount: document.querySelectorAll(
            '[data-review-id="git-rendered-table-header-context"]',
          ).length,
          rightPaneScrollLeft:
            rightPane instanceof HTMLElement ? rightPane.scrollLeft : 0,
        };
      },
      { scenarioName: scenario, activeTableRowFound },
    );
  } else if (
    scenario === "viewer-rendered-visual-diff-list-item-highlight-basic" ||
    scenario === "viewer-rendered-visual-diff-list-item-navigation" ||
    scenario === "viewer-rendered-visual-diff-list-item-low-confidence-fallback" ||
    scenario === "viewer-rendered-visual-diff-list-item-privacy" ||
    scenario === "viewer-rendered-visual-diff-fallback-visibility" ||
    scenario === "viewer-rendered-visual-diff-fallback-privacy"
  ) {
    const isFallbackScenario =
      scenario === "viewer-rendered-visual-diff-list-item-low-confidence-fallback" ||
      scenario === "viewer-rendered-visual-diff-fallback-visibility" ||
      scenario === "viewer-rendered-visual-diff-fallback-privacy";
    await page
      .locator(
        `text=${
          isFallbackScenario
            ? "git-rendered-list-reorder.md"
            : "git-rendered-markdown.md"
        }`,
      )
      .click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({
        hasText: isFallbackScenario
          ? "Git Rendered List Reorder Fixture"
          : "Git Rendered Markdown Diff Fixture",
      })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();

    if (!isFallbackScenario) {
      await page
        .locator('[data-review-id="git-rendered-list-item-change"]')
        .first()
        .waitFor();
    }

    if (scenario === "viewer-rendered-visual-diff-list-item-navigation") {
      await page.getByRole("button", { name: "Next change" }).click();
      await page
        .locator('[data-review-id="git-rendered-list-item-change"][data-change-index]')
        .first()
        .scrollIntoViewIfNeeded();
      await page
        .locator('[data-review-id="git-diff-change-ruler-marker"].active')
        .waitFor();
      await page
        .locator('[data-review-id="git-diff-change-ruler-marker"]')
        .last()
        .click();
    }

    await page.evaluate((scenarioName) => {
      const itemHighlights = Array.from(
        document.querySelectorAll(
          '[data-review-id="git-rendered-list-item-change"]',
        ),
      );
      const itemTargets = itemHighlights.filter((item) =>
        item.hasAttribute("data-change-index"),
      );
      const parentTargets = Array.from(
        document.querySelectorAll(
          ".git-rendered-block.has-list-item-changes[data-change-index]",
        ),
      );
      const activeMarkers = document.querySelectorAll(
        '[data-review-id="git-diff-change-ruler-marker"].active',
      );
      window.__SVARD_RENDERED_LIST_ITEM_DIFF__ = {
        scenario: scenarioName,
        fallback: itemHighlights.length === 0,
        highlightCount: itemHighlights.length,
        itemTargetCount: itemTargets.length,
        parentTargetCount: parentTargets.length,
        activeMarkerCount: activeMarkers.length,
      };
      const fallbackIndicators = Array.from(
        document.querySelectorAll(
          '[data-review-id="git-rendered-fallback-indicator"]',
        ),
      ).map((indicator) => indicator.textContent?.trim()).filter(Boolean);
      const reasonCounts = fallbackIndicators.reduce((counts, label) => {
        counts[label] = (counts[label] ?? 0) + 1;
        return counts;
      }, {});
      window.__SVARD_RENDERED_FALLBACK_VISIBILITY__ = {
        scenario: scenarioName,
        fallbackCount: fallbackIndicators.length,
        reasonCounts,
      };
    }, scenario);
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
