export async function applyGitDiffFileCompareScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-file-diff-source") {
    await page.locator("text=file-diff-left.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "left document" })
      .waitFor();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "file-diff-right.md" })
      .click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Compare with Active File" })
      .click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-left-pane"]').waitFor();
    await page.locator('[data-review-id="git-diff-right-pane"]').waitFor();
  } else if (scenario === "viewer-file-diff-command") {
    await page.locator("text=file-diff-left.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "left document" })
      .waitFor();
    await page.evaluate(() => {
      globalThis.__SVARD_PICK_DOCUMENTS__ = [
        "/workspace/docs/file-diff-right.md",
      ];
    });
    await page.keyboard.press("Control+L");
    await page
      .locator('[data-review-id="quick-open-input"]')
      .fill(">compare files");
    await page
      .locator('[data-review-id="quick-open-result"]')
      .filter({ hasText: "Compare Files..." })
      .click();
    await page.locator('[data-review-id="file-compare-picker"]').waitFor();
    await page.locator('[data-review-id="file-compare-right-choose"]').click();
    await page.locator('[data-review-id="file-compare-run"]').click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-source-view"]').click();
    await page.locator('[data-review-id="git-diff-left-pane"]').waitFor();
    await page.locator('[data-review-id="git-diff-right-pane"]').waitFor();
  } else if (scenario === "viewer-file-compare-picker-basic") {
    await page.locator("text=file-diff-left.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "left document" })
      .waitFor();
    await page.evaluate(() => {
      globalThis.__SVARD_PICK_DOCUMENTS__ = [
        "/workspace/docs/file-diff-right.md",
      ];
    });
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("file.compareFiles"),
    );
    await page.locator('[data-review-id="file-compare-picker"]').waitFor();
    await page.locator('[data-review-id="file-compare-right-choose"]').click();
    await page.locator('[data-review-id="file-compare-run"]').click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-source-view"]').click();
    await page.locator('[data-review-id="git-diff-left-pane"]').waitFor();
    await page.locator('[data-review-id="git-diff-right-pane"]').waitFor();
  } else if (scenario === "viewer-file-compare-picker-context-menu") {
    await page.locator("text=file-diff-left.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "left document" })
      .waitFor();
    await page.evaluate(() => {
      globalThis.__SVARD_PICK_DOCUMENTS__ = [
        "/workspace/docs/file-diff-right.md",
      ];
    });
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "file-diff-left.md" })
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "Compare Files..." }).click();
    await page.locator('[data-review-id="file-compare-picker"]').waitFor();
    await page.locator('[data-review-id="file-compare-right-choose"]').click();
    await page.locator('[data-review-id="file-compare-run"]').click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-source-view"]').click();
    await page.locator('[data-review-id="git-diff-left-pane"]').waitFor();
    await page.locator('[data-review-id="git-diff-right-pane"]').waitFor();
  } else if (scenario === "viewer-file-compare-picker-drag-drop") {
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("file.compareFiles"),
    );
    await page.locator('[data-review-id="file-compare-picker"]').waitFor();
    const treeDragGeometry = await page.evaluate(() => {
      const sidebar = document
        .querySelector('[data-review-id="left-sidebar"]')
        ?.getBoundingClientRect();
      const picker = document
        .querySelector('[data-review-id="file-compare-picker"]')
        ?.getBoundingClientRect();
      const sampleFile = Array.from(
        document.querySelectorAll('[data-review-id="tree-file"]'),
      ).find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const sampleRect = sampleFile?.getBoundingClientRect();
      const sampleHitTargets = sampleRect
        ? [16, 60, 120, 180, 230].map((offset) => {
            const target = document.elementFromPoint(
              sampleRect.left + offset,
              sampleRect.top + sampleRect.height / 2,
            );
            return {
              offset,
              reviewId:
                target
                  ?.closest("[data-review-id]")
                  ?.getAttribute("data-review-id") ?? null,
            };
          })
        : [];
      return {
        sidebarVisible: Boolean(sidebar && sidebar.width > 0),
        pickerLeavesSidebarClear: Boolean(
          sidebar && picker && picker.left >= sidebar.right,
        ),
        sampleHitTargets,
      };
    });
    await page.evaluate((sample) => {
      window.__SVARD_FILE_COMPARE_TREE_DRAG_GEOMETRY__ = sample;
    }, treeDragGeometry);
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "file-diff-left.md" })
      .dragTo(page.locator('[data-review-id="file-compare-left-slot"]'));
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "file-diff-right.md" })
      .dragTo(page.locator('[data-review-id="file-compare-right-slot"]'));
    await page.locator('[data-review-id="file-compare-run"]').click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-source-view"]').click();
    await page.locator('[data-review-id="git-diff-left-pane"]').waitFor();
    await page.locator('[data-review-id="git-diff-right-pane"]').waitFor();
  } else if (scenario === "viewer-file-compare-picker-native-drop") {
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("file.compareFiles"),
    );
    await page.locator('[data-review-id="file-compare-picker"]').waitFor();
    await page.evaluate(async () => {
      function slotCenter(selector) {
        const slot = document.querySelector(selector);
        if (!(slot instanceof HTMLElement)) {
          throw new Error(`Missing file compare slot: ${selector}`);
        }
        const rect = slot.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
      const trigger = window.__SVARD_TRIGGER_NATIVE_FILE_DROP__;
      if (!trigger) {
        throw new Error("Native file drop trigger was not registered.");
      }
      for (const [selector, path] of [
        [
          '[data-review-id="file-compare-left-slot"]',
          "/workspace/docs/file-diff-left.md",
        ],
        [
          '[data-review-id="file-compare-right-slot"]',
          "/workspace/docs/file-diff-right.md",
        ],
      ]) {
        const position = slotCenter(selector);
        trigger({ type: "over", position });
        trigger({ type: "drop", paths: [path], position });
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      }
    });
    await page.locator('[data-review-id="file-compare-run"]').click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-source-view"]').click();
    await page.locator('[data-review-id="git-diff-left-pane"]').waitFor();
    await page.locator('[data-review-id="git-diff-right-pane"]').waitFor();
  } else if (scenario === "viewer-file-compare-picker-swap-clear") {
    await page.locator("text=file-diff-left.md").click();
    await page.evaluate(() => {
      globalThis.__SVARD_PICK_DOCUMENTS__ = [
        "/workspace/docs/file-diff-right.md",
      ];
    });
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("file.compareFiles"),
    );
    await page.locator('[data-review-id="file-compare-picker"]').waitFor();
    await page.locator('[data-review-id="file-compare-right-choose"]').click();
    await page.locator('[data-review-id="file-compare-swap"]').click();
    await page.locator('[data-review-id="file-compare-left-clear"]').click();
  } else if (scenario === "viewer-file-compare-picker-validation") {
    await page.locator("text=file-diff-left.md").click();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("file.compareFiles"),
    );
    await page.locator('[data-review-id="file-compare-picker"]').waitFor();
    await page.locator('[data-review-id="file-compare-run"]').click();
  } else if (scenario === "viewer-cli-file-diff-open") {
    await page.addInitScript(() => {
      globalThis.__SVARD_PENDING_OPEN_REQUESTS__ = [
        {
          source: "initial",
          paths: [
            "/workspace/docs/file-diff-left.md",
            "/workspace/docs/file-diff-right.md",
          ],
        },
      ];
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-source-view"]').click();
    await page.locator('[data-review-id="git-diff-left-pane"]').waitFor();
    await page.locator('[data-review-id="git-diff-right-pane"]').waitFor();
  } else if (scenario === "viewer-cli-open-contract") {
    await page.addInitScript(() => {
      globalThis.__SVARD_PENDING_OPEN_REQUESTS__ = [
        {
          source: "initial",
          paths: [
            "/workspace/docs/file-diff-left.md",
            "/workspace/docs/file-diff-right.md",
            "/workspace/docs",
          ],
          diagnostics: [
            "Unsupported desktop open path ignored: missing-private.adoc",
          ],
        },
      ];
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .locator('[data-review-id="inline-notice"]')
      .filter({ hasText: "missing-private.adoc" })
      .waitFor();
    await page.waitForFunction(() => {
      const title = document
        .querySelector('[data-review-id="active-document-title"]')
        ?.textContent?.trim();
      const body = document
        .querySelector('[data-review-id="document-body"]')
        ?.textContent?.trim();
      const root = document.querySelector('[data-review-id="tree-root"]');
      return (
        title?.includes("file-diff-right.md") &&
        body?.includes("right document") &&
        root instanceof HTMLElement &&
        root.title === "/workspace/docs"
      );
    });
  } else if (scenario === "viewer-file-diff-rendered") {
    await page.locator("text=file-diff-left.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "left document" })
      .waitFor();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "file-diff-right.adoc" })
      .click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Compare with Active File" })
      .click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
  } else if (scenario === "viewer-file-diff-table") {
    await page.locator("text=file-diff-table-left.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "File Diff Table Fixture" })
      .waitFor();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "file-diff-table-right.md" })
      .click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Compare with Active File" })
      .click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-table-view"]').click();
    await page.locator('[data-review-id="git-diff-table-diff"]').waitFor();
  } else {
    return false;
  }
  return true;
}
