export async function applyGitDiffNavigationScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-diff-overview") {
    await page.locator("text=git-rendered-asciidoc.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered AsciiDoc Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-overview-view"]').click();
    await page.locator('[data-review-id="git-diff-overview"]').waitFor();
  } else if (scenario === "viewer-diff-change-navigation") {
    await page.locator("text=git-rendered-markdown.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Markdown Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.getByRole("button", { name: "Next change" }).click();
    await page
      .locator('[data-review-id="git-diff-change-ruler-marker"].active')
      .waitFor();
  } else if (scenario === "viewer-diff-large-markdown-scroll-return") {
    await page.locator("text=git-large-markdown-scroll.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Large Markdown Scroll Return Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    await page.waitForFunction(() => {
      const left = document.querySelector(
        '[data-review-id="git-full-preview-left-pane"] .git-rendered-scroll',
      );
      const right = document.querySelector(
        '[data-review-id="git-full-preview-right-pane"] .git-rendered-scroll',
      );
      const minimapButtons = document.querySelectorAll(
        '[data-review-id="git-diff-change-ruler-marker"]',
      );
      return (
        left instanceof HTMLElement &&
        right instanceof HTMLElement &&
        left.scrollHeight > left.clientHeight * 2 &&
        right.scrollHeight > right.clientHeight * 2 &&
        minimapButtons.length >= 2
      );
    });

    await page.evaluate(() => {
      function renderedPane(reviewId) {
        const fallbackReviewId = reviewId.includes("left")
          ? "git-rendered-left-pane"
          : "git-rendered-right-pane";
        const pane =
          document.querySelector(
            `[data-review-id="${reviewId}"] .git-rendered-scroll`,
          ) ??
          document.querySelector(
            `[data-review-id="${fallbackReviewId}"] .git-rendered-scroll`,
          );
        if (!(pane instanceof HTMLElement)) {
          throw new Error(`Rendered pane unavailable: ${reviewId}`);
        }
        return pane;
      }

      function activeIndex() {
        const label =
          document
            .querySelector(
              '[data-review-id="git-diff-change-ruler-marker"].active',
            )
            ?.getAttribute("aria-label") ?? "";
        const match = label.match(/change (\d+)/i);
        return match ? Number(match[1]) - 1 : 0;
      }

      function sample() {
        const left = renderedPane("git-full-preview-left-pane");
        const right = renderedPane("git-full-preview-right-pane");
        const index = activeIndex();
        const target =
          right.querySelector(`[data-change-index="${index}"]`) ??
          left.querySelector(`[data-change-index="${index}"]`);
        const pane = right.contains(target) ? right : left;
        const paneRect = pane.getBoundingClientRect();
        const targetRect = target?.getBoundingClientRect();
        const targetOffset =
          targetRect && Number.isFinite(targetRect.top)
            ? Math.round(targetRect.top - paneRect.top)
            : null;
        const targetInView =
          Boolean(targetRect) &&
          targetRect.bottom >= paneRect.top &&
          targetRect.top <= paneRect.bottom;
        return {
          activeChangeIndex: index,
          leftScrollTop: Math.round(left.scrollTop),
          rightScrollTop: Math.round(right.scrollTop),
          targetOffset,
          targetInView,
          syncEnabled:
            document.querySelector('[data-review-id="git-diff-scroll-sync"]')
              ?.checked ?? false,
        };
      }

      function scrollBothToBottom() {
        const left = renderedPane("git-full-preview-left-pane");
        const right = renderedPane("git-full-preview-right-pane");
        left.scrollTop = left.scrollHeight;
        right.scrollTop = right.scrollHeight;
      }

      async function manualScrollRightUp() {
        const right = renderedPane("git-full-preview-right-pane");
        right.scrollTop = Math.max(0, right.scrollTop - 420);
        right.dispatchEvent(new Event("scroll", { bubbles: true }));
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      }

      window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__ = {
        sample,
        scrollBothToBottom,
        manualScrollRightUp,
      };
    });

    await page.evaluate(() => {
      window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__.scrollBothToBottom();
      window.__SVARD_DIFF_LARGE_SCROLL_RETURN_CHECK__ = {
        bottom: window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__.sample(),
      };
    });
    await page.evaluate(async () => {
      await window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__.manualScrollRightUp();
      window.__SVARD_DIFF_LARGE_SCROLL_RETURN_CHECK__ = {
        ...window.__SVARD_DIFF_LARGE_SCROLL_RETURN_CHECK__,
        afterManualUp:
          window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__.sample(),
      };
    });
    await page
      .locator('[data-review-id="git-diff-change-ruler"]')
      .getByRole("button", { name: "Go to change 1", exact: true })
      .click();
    await page.waitForFunction(() => {
      try {
        const sample =
          window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__.sample();
        if (sample.activeChangeIndex === 0 && sample.targetInView) {
          window.__SVARD_DIFF_LARGE_SCROLL_RETURN_CHECK__ = {
            ...window.__SVARD_DIFF_LARGE_SCROLL_RETURN_CHECK__,
            afterMinimap: sample,
          };
          return true;
        }
      } catch {
        return false;
      }
      return false;
    });
    if (
      (await page
        .locator('[data-review-id="git-full-preview-left-pane"]')
        .count()) === 0
    ) {
      await page
        .locator('[data-review-id="git-diff-full-preview-view"]')
        .click();
      await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    }

    await page.evaluate(() => {
      window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__.scrollBothToBottom();
    });
    await page
      .locator('[data-review-id="git-diff-change-navigation"]')
      .getByRole("button", { name: "Next change", exact: true })
      .click();
    await page.waitForFunction(() => {
      try {
        const sample =
          window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__.sample();
        if (sample.activeChangeIndex >= 1 && sample.targetInView) {
          window.__SVARD_DIFF_LARGE_SCROLL_RETURN_CHECK__ = {
            ...window.__SVARD_DIFF_LARGE_SCROLL_RETURN_CHECK__,
            afterNext: sample,
          };
          return true;
        }
      } catch {
        return false;
      }
      return false;
    });

    await page.evaluate(() => {
      window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__.scrollBothToBottom();
    });
    await page
      .locator('[data-review-id="git-diff-change-ruler"]')
      .getByRole("button", { name: "Go to change 2", exact: true })
      .click();
    await page.waitForFunction(() => {
      try {
        return (
          window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__.sample()
            .activeChangeIndex === 1
        );
      } catch {
        return false;
      }
    });
    await page.evaluate(() => {
      window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__.scrollBothToBottom();
    });
    await page
      .locator('[data-review-id="git-diff-change-navigation"]')
      .getByRole("button", { name: "Previous change", exact: true })
      .click();
    await page.waitForFunction(() => {
      try {
        const sample =
          window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__.sample();
        if (sample.activeChangeIndex === 0 && sample.targetInView) {
          window.__SVARD_DIFF_LARGE_SCROLL_RETURN_CHECK__ = {
            ...window.__SVARD_DIFF_LARGE_SCROLL_RETURN_CHECK__,
            afterPrevious: sample,
          };
          return true;
        }
      } catch {
        return false;
      }
      return false;
    });

    await page.evaluate(() => {
      delete window.__SVARD_DIFF_LARGE_SCROLL_RETURN_HELPERS__;
    });
  } else if (scenario === "viewer-diff-mouse-gestures-change-navigation") {
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

    await context.performRightButtonGesture(
      ["Right"],
      '[data-review-id="git-diff-preview-panel"]',
    );
    await page.waitForFunction(() => {
      const active = document.querySelector(
        '[data-review-id="git-diff-change-ruler-marker"].active',
      );
      return active?.getAttribute("aria-label")?.includes("2");
    });
    const afterRight = await page.evaluate(() => ({
      activeLabel:
        document
          .querySelector(
            '[data-review-id="git-diff-change-ruler-marker"].active',
          )
          ?.getAttribute("aria-label") ?? "",
      lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
    }));

    await context.performRightButtonGesture(
      ["Left"],
      '[data-review-id="git-diff-preview-panel"]',
    );
    await page.waitForFunction(() => {
      const active = document.querySelector(
        '[data-review-id="git-diff-change-ruler-marker"].active',
      );
      return active?.getAttribute("aria-label")?.includes("1");
    });
    const afterLeft = await page.evaluate(() => ({
      activeLabel:
        document
          .querySelector(
            '[data-review-id="git-diff-change-ruler-marker"].active',
          )
          ?.getAttribute("aria-label") ?? "",
      lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
    }));

    await page.evaluate(
      ({ afterRight, afterLeft }) => {
        window.__SVARD_DIFF_MOUSE_GESTURE_CHECK__ = {
          afterRight,
          afterLeft,
        };
      },
      { afterRight, afterLeft },
    );
  } else if (scenario === "viewer-diff-mouse-gestures-expanded-actions") {
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
    const paneSelector = '[data-review-id="git-full-preview-right-pane"]';
    await page.waitForFunction((selector) => {
      const pane = document.querySelector(`${selector} .git-rendered-scroll`);
      const fullPreviewButton = document.querySelector(
        '[data-review-id="git-diff-full-preview-view"]',
      );
      return (
        pane instanceof HTMLElement &&
        pane.scrollHeight > pane.clientHeight &&
        fullPreviewButton instanceof HTMLButtonElement &&
        !fullPreviewButton.disabled
      );
    }, paneSelector);
    await page.waitForTimeout(750);

    await context.performRightButtonGesture(["Right"], paneSelector);
    await page.waitForFunction(() =>
      document
        .querySelector('[data-review-id="git-diff-change-ruler-marker"].active')
        ?.getAttribute("aria-label")
        ?.includes("2"),
    );
    const afterRight = await page.evaluate(() => ({
      activeLabel:
        document
          .querySelector(
            '[data-review-id="git-diff-change-ruler-marker"].active',
          )
          ?.getAttribute("aria-label") ?? "",
      lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
    }));

    await context.performRightButtonGesture(["Left"], paneSelector);
    await page.waitForFunction(() =>
      document
        .querySelector('[data-review-id="git-diff-change-ruler-marker"].active')
        ?.getAttribute("aria-label")
        ?.includes("1"),
    );
    const afterLeft = await page.evaluate(() => ({
      activeLabel:
        document
          .querySelector(
            '[data-review-id="git-diff-change-ruler-marker"].active',
          )
          ?.getAttribute("aria-label") ?? "",
      lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
    }));

    await context.performRightButtonGesture(["Down"], paneSelector);
    await page.waitForFunction((selector) => {
      const pane = document.querySelector(`${selector} .git-rendered-scroll`);
      return pane instanceof HTMLElement && pane.scrollTop > 0;
    }, paneSelector);
    const afterDown = await page.evaluate((selector) => {
      const pane = document.querySelector(`${selector} .git-rendered-scroll`);
      return {
        scrollTop: pane instanceof HTMLElement ? pane.scrollTop : 0,
        lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
      };
    }, paneSelector);

    await context.performRightButtonGesture(["Up"], paneSelector);
    await page.waitForFunction((selector) => {
      const pane = document.querySelector(`${selector} .git-rendered-scroll`);
      return pane instanceof HTMLElement && pane.scrollTop === 0;
    }, paneSelector);
    const afterUp = await page.evaluate((selector) => {
      const pane = document.querySelector(`${selector} .git-rendered-scroll`);
      return {
        scrollTop: pane instanceof HTMLElement ? pane.scrollTop : -1,
        lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
      };
    }, paneSelector);

    await context.performRightButtonGesture(["Down", "Right"], paneSelector);
    await page
      .locator('[data-review-id="git-diff-preview-panel"]')
      .waitFor({ state: "detached" });
    const afterClose = await page.evaluate(() => ({
      panelCount: document.querySelectorAll(
        '[data-review-id="git-diff-preview-panel"]',
      ).length,
      lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
    }));

    await page.evaluate(
      ({ afterRight, afterLeft, afterDown, afterUp, afterClose }) => {
        window.__SVARD_DIFF_MOUSE_GESTURE_EXPANDED_CHECK__ = {
          afterRight,
          afterLeft,
          afterDown,
          afterUp,
          afterClose,
        };
      },
      { afterRight, afterLeft, afterDown, afterUp, afterClose },
    );
  } else if (scenario === "viewer-diff-mouse-gestures-scroll-sync") {
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
    await page.waitForFunction(() => {
      const left = document.querySelector(
        '[data-review-id="git-full-preview-left-pane"] .git-rendered-scroll',
      );
      const right = document.querySelector(
        '[data-review-id="git-full-preview-right-pane"] .git-rendered-scroll',
      );
      const fullPreviewButton = document.querySelector(
        '[data-review-id="git-diff-full-preview-view"]',
      );
      return (
        left instanceof HTMLElement &&
        right instanceof HTMLElement &&
        left.scrollHeight > left.clientHeight &&
        right.scrollHeight > right.clientHeight &&
        fullPreviewButton instanceof HTMLButtonElement &&
        !fullPreviewButton.disabled
      );
    });
    await page.waitForTimeout(750);
    await context.performRightButtonGesture(
      ["Down"],
      '[data-review-id="git-full-preview-right-pane"]',
    );
    await page.waitForFunction(() => {
      const left = document.querySelector(
        '[data-review-id="git-full-preview-left-pane"] .git-rendered-scroll',
      );
      const right = document.querySelector(
        '[data-review-id="git-full-preview-right-pane"] .git-rendered-scroll',
      );
      return (
        left instanceof HTMLElement &&
        right instanceof HTMLElement &&
        left.scrollTop > 0 &&
        right.scrollTop > 0
      );
    });
    const syncCheck = await page.evaluate(() => {
      const left = document.querySelector(
        '[data-review-id="git-full-preview-left-pane"] .git-rendered-scroll',
      );
      const right = document.querySelector(
        '[data-review-id="git-full-preview-right-pane"] .git-rendered-scroll',
      );
      return {
        leftScrollTop: left instanceof HTMLElement ? left.scrollTop : 0,
        rightScrollTop: right instanceof HTMLElement ? right.scrollTop : 0,
        syncEnabled:
          document.querySelector('[data-review-id="git-diff-scroll-sync"]')
            ?.checked ?? false,
        lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
      };
    });
    await page.evaluate((syncCheck) => {
      window.__SVARD_DIFF_MOUSE_GESTURE_SCROLL_SYNC_CHECK__ = syncCheck;
    }, syncCheck);
  } else if (scenario === "viewer-diff-shortcut-gesture-hints") {
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
    await page.locator("text=git-rendered-markdown.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Markdown Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page
      .locator('[data-review-id="diff-shortcut-gesture-hints-open"]')
      .click();
    await page
      .locator('[data-review-id="diff-shortcut-gesture-hints-panel"]')
      .waitFor();
    await page.evaluate(() => {
      const panel = document.querySelector(
        '[data-review-id="diff-shortcut-gesture-hints-panel"]',
      );
      window.__SVARD_DIFF_SHORTCUT_GESTURE_HINTS_CHECK__ = {
        text: panel?.textContent ?? "",
        disabledNoticeCount: document.querySelectorAll(
          '[data-review-id="shortcut-gesture-hints-gestures-disabled"]',
        ).length,
      };
    });
  } else if (scenario === "viewer-diff-scroll-sync") {
    await page.locator("text=git-rendered-asciidoc.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered AsciiDoc Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-scroll-sync"]').click();
  } else if (scenario === "viewer-diff-scroll-anchor-sync") {
    await page.locator("text=git-rendered-asciidoc.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered AsciiDoc Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    await page.evaluate(async () => {
      function anchorOffset(pane, syncIndex) {
        const anchor = pane?.querySelector(`[data-sync-index="${syncIndex}"]`);
        if (!pane || !anchor) {
          return null;
        }
        return (
          anchor.getBoundingClientRect().top - pane.getBoundingClientRect().top
        );
      }

      const left = document.querySelector(
        '[data-review-id="git-full-preview-left-pane"] .git-rendered-scroll',
      );
      const right = document.querySelector(
        '[data-review-id="git-full-preview-right-pane"] .git-rendered-scroll',
      );
      const sourceAnchor = left?.querySelector(
        '[data-change-index="0"][data-sync-index]',
      );
      if (!(left instanceof HTMLElement) || !(right instanceof HTMLElement)) {
        throw new Error("Rendered diff panes were not available.");
      }
      if (!(sourceAnchor instanceof HTMLElement)) {
        throw new Error("Rendered diff change anchor was not available.");
      }
      const leftRect = left.getBoundingClientRect();
      const anchorRect = sourceAnchor.getBoundingClientRect();
      left.scrollTop += anchorRect.top - leftRect.top - 24;
      left.dispatchEvent(new Event("scroll", { bubbles: true }));
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );

      const syncIndex = sourceAnchor.dataset.syncIndex ?? "";
      const leftOffset = anchorOffset(left, syncIndex);
      const rightOffset = anchorOffset(right, syncIndex);
      const stableLeftScrollTop = left.scrollTop;
      const stableRightScrollTop = right.scrollTop;
      for (let index = 0; index < 6; index += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const finalLeftScrollTop = left.scrollTop;
      const finalRightScrollTop = right.scrollTop;
      window.__SVARD_DIFF_ANCHOR_SYNC__ = {
        syncIndex,
        leftOffset,
        rightOffset,
        delta:
          leftOffset === null || rightOffset === null
            ? null
            : Math.abs(leftOffset - rightOffset),
        leftScrollDrift: Math.abs(finalLeftScrollTop - stableLeftScrollTop),
        rightScrollDrift: Math.abs(finalRightScrollTop - stableRightScrollTop),
      };
    });
  } else if (
    scenario === "viewer-diff-diagram-placeholder" ||
    scenario === "viewer-diff-inline-diagnostics" ||
    scenario === "viewer-diff-inline-diagnostics-privacy"
  ) {
    await page.locator("text=git-rendered-unsupported-diagram.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Unsupported Diagram Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page
      .locator(
        '[data-review-id="git-full-preview-diff"] [data-review-id="diagram-inline-diagnostic"]',
      )
      .first()
      .waitFor();
    if (
      scenario === "viewer-diff-inline-diagnostics" ||
      scenario === "viewer-diff-inline-diagnostics-privacy"
    ) {
      await page
        .locator(
          '[data-review-id="git-full-preview-diff"] [data-review-id="diff-inline-diagnostic-note"]',
        )
        .first()
        .waitFor();
      await page.evaluate((scenarioName) => {
        const notes = Array.from(
          document.querySelectorAll(
            '[data-review-id="diff-inline-diagnostic-note"]',
          ),
        );
        window.__SVARD_DIFF_INLINE_DIAGNOSTICS__ = {
          scenario: scenarioName,
          count: notes.length,
          categories: notes.map((note) =>
            note.getAttribute("data-diagnostic-category"),
          ),
          text: notes.map((note) =>
            (note.textContent ?? "").replace(/\s+/g, " ").trim(),
          ),
        };
        if (scenarioName === "viewer-diff-inline-diagnostics-privacy") {
          const unsafePattern =
            /\/workspace|\/Users|data-diagram|data-source|@startuml|mermaid|flowchart|```|@@/iu;
          const unsafeText =
            window.__SVARD_DIFF_INLINE_DIAGNOSTICS__.text.find((item) =>
              unsafePattern.test(item),
            ) ?? null;
          if (unsafeText) {
            throw new Error(
              `Inline diagnostic note exposed unsafe text: ${unsafeText}`,
            );
          }
        }
      }, scenario);
    }
  } else {
    return false;
  }
  return true;
}
