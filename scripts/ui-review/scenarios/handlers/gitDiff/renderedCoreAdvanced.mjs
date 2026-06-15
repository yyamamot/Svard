export async function applyGitDiffRenderedCoreAdvancedScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (
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
  } else {
    return false;
  }
  return true;
}
