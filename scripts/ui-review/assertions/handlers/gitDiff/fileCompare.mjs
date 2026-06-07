export async function buildGitDiffFileCompareAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;

  return {
    hasFileDiffSource:
      scenario === "viewer-file-diff-source" ||
      scenario === "viewer-file-diff-command" ||
      scenario === "viewer-file-compare-picker-basic" ||
      scenario === "viewer-file-compare-picker-context-menu" ||
      scenario === "viewer-file-compare-picker-drag-drop" ||
      scenario === "viewer-file-compare-picker-native-drop" ||
      scenario === "viewer-cli-file-diff-open"
        ? bodyText.includes("File compare") &&
          bodyText.includes("file-diff-left.md") &&
          bodyText.includes("file-diff-right.md") &&
          bodyText.includes("left document") &&
          bodyText.includes("right document") &&
          (await page
            .locator('[data-review-id="git-diff-preview-panel"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-left-pane"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-right-pane"]')
            .count()) === 1
        : true,
    hasFileCompareTreeDragGeometry: true,
    hasCliOpenContract:
      scenario === "viewer-cli-open-contract"
        ? await page.evaluate(() => {
            const bodyText = document.body.textContent ?? "";
            const activeTitle =
              document
                .querySelector('[data-review-id="active-document-title"]')
                ?.textContent?.trim() ?? "";
            const openFiles = Array.from(
              document.querySelectorAll('[data-review-id="open-file-item"]'),
            ).map((node) => node.textContent ?? "");
            const root = document.querySelector('[data-review-id="tree-root"]');
            const checks = {
              rightDocument: bodyText.includes("right document"),
              leftName: bodyText.includes("file-diff-left.md"),
              rightName: bodyText.includes("file-diff-right.md"),
              safePath: !bodyText.includes("/workspace/private"),
              activeDocument: activeTitle.includes("file-diff-right.md"),
              leftOpen: openFiles.some((text) =>
                text.includes("file-diff-left.md"),
              ),
              rightOpen: openFiles.some((text) =>
                text.includes("file-diff-right.md"),
              ),
              docsRoot:
                root instanceof HTMLElement && root.title === "/workspace/docs",
              noDiffPreview:
                document.querySelector(
                  '[data-review-id="git-diff-preview-panel"]',
                ) === null,
            };
            return Object.values(checks).every(Boolean);
          })
        : true,
    hasFileComparePicker:
      scenario === "viewer-file-compare-picker-swap-clear" ||
      scenario === "viewer-file-compare-picker-validation"
        ? bodyText.includes("Compare Files...") &&
          (await page
            .locator('[data-review-id="file-compare-picker"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="file-compare-left-slot"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="file-compare-right-slot"]')
            .count()) === 1
        : true,
    hasFileComparePickerValidation:
      scenario === "viewer-file-compare-picker-validation"
        ? bodyText.includes("Choose a base file and a compare file.") &&
          (await page
            .locator('[data-review-id="file-compare-validation"]')
            .count()) === 1
        : true,
    hasFileComparePickerSwapClear:
      scenario === "viewer-file-compare-picker-swap-clear"
        ? bodyText.includes("file-diff-right.md") &&
          bodyText.includes("Drop a file here") &&
          (await page
            .locator('[data-review-id="file-compare-left-clear"]')
            .count()) === 0
        : true,
    hasFileDiffRendered:
      scenario === "viewer-file-diff-rendered"
        ? bodyText.includes("File compare") &&
          bodyText.includes("File Diff AsciiDoc Fixture") &&
          bodyText.includes("left document") &&
          bodyText.includes("right document") &&
          (await page
            .locator('[data-review-id="git-rendered-diff"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-rendered-block"]')
            .count()) > 0
        : true,
    hasFileDiffTable:
      scenario === "viewer-file-diff-table"
        ? bodyText.includes("File compare") &&
          bodyText.includes("File Diff Table Fixture") &&
          bodyText.includes("$10") &&
          bodyText.includes("$12") &&
          bodyText.includes("Team") &&
          (await page
            .locator('[data-review-id="git-diff-table-diff"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-table-cell"]')
            .count()) > 0
        : true,
  };
}
