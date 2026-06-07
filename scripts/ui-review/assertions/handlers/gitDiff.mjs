import { buildGitDiffFileCompareAssertions } from "./gitDiff/fileCompare.mjs";
import { buildGitDiffNavigationAssertions } from "./gitDiff/navigation.mjs";
import { buildGitDiffRenderedAssertions } from "./gitDiff/rendered.mjs";
import { buildGitDiffSourceControlAssertions } from "./gitDiff/sourceControl.mjs";
import { buildGitDiffSourceDiffAssertions } from "./gitDiff/sourceDiff.mjs";

export async function buildGitDiffAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const diffRegressionSuite =
    scenario === "viewer-diff-preview-regression-suite"
      ? await page.evaluate(() => {
          function rgbTriplet(value) {
            const match = value.match(
              /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/,
            );
            return match
              ? [Number(match[1]), Number(match[2]), Number(match[3])]
              : null;
          }
          function relativeLuminance([red, green, blue]) {
            return [red, green, blue]
              .map((channel) => {
                const normalized = channel / 255;
                return normalized <= 0.03928
                  ? normalized / 12.92
                  : ((normalized + 0.055) / 1.055) ** 2.4;
              })
              .reduce(
                (sum, channel, index) =>
                  sum + channel * [0.2126, 0.7152, 0.0722][index],
                0,
              );
          }
          function contrastRatio(foreground, background) {
            const foregroundRgb = rgbTriplet(foreground);
            const backgroundRgb = rgbTriplet(background);
            if (!foregroundRgb || !backgroundRgb) {
              return 0;
            }
            const light = Math.max(
              relativeLuminance(foregroundRgb),
              relativeLuminance(backgroundRgb),
            );
            const dark = Math.min(
              relativeLuminance(foregroundRgb),
              relativeLuminance(backgroundRgb),
            );
            return (light + 0.05) / (dark + 0.05);
          }
          const highlightNodes = Array.from(
            document.querySelectorAll(
              '[data-review-id="git-diff-word-highlight"]',
            ),
          );
          const highlightTexts = highlightNodes.map(
            (node) => node.textContent?.trim() ?? "",
          );
          const highlightRects = highlightNodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          });
          const rightPane = document.querySelector(
            '[data-review-id="git-full-preview-right-pane"]',
          );
          const unrelatedBlocks = Array.from(
            document.querySelectorAll(
              '[data-review-id="git-full-preview-block"]',
            ),
          )
            .filter((node) =>
              /legacy footer note|fresh working tree closing note/.test(
                node.textContent ?? "",
              ),
            )
            .map((node) => ({
              added: node.classList.contains("added"),
              removed: node.classList.contains("removed"),
              changed: node.classList.contains("changed"),
            }));
          const tableCells = Array.from(
            document.querySelectorAll(
              '[data-review-id="git-full-preview-block"] table :is(th, td)',
            ),
          );
          const tableContrasts = tableCells.map((cell) => {
            const style = window.getComputedStyle(cell);
            return contrastRatio(style.color, style.backgroundColor);
          });

          return {
            hasGalleryTitle: document.body.textContent?.includes(
              "Diff Preview Regression Gallery",
            ),
            hasJapaneseChange: document.body.textContent?.includes("差分表示"),
            hasPreviewBasedDiff:
              document.body.textContent?.includes("Preview-based diff"),
            hasFullPreview:
              document.querySelectorAll(
                '[data-review-id="git-full-preview-diff"]',
              ).length === 1,
            hasNoPreviewMeta:
              document.querySelectorAll(".git-rendered-block-meta").length ===
              0,
            highlightCount: highlightNodes.length,
            hasOnlyTextHighlights: highlightTexts.every(Boolean),
            hasOnlyVisibleHighlights: highlightRects.every(
              (rect) => rect.width >= 4 && rect.height >= 8,
            ),
            nestedListCount:
              rightPane?.querySelectorAll("li ul, li ol").length ?? 0,
            hasChangedBlock:
              document.querySelectorAll(
                '[data-review-id="git-full-preview-block"].changed.right-side',
              ).length > 0,
            hasAddedBlock:
              document.querySelectorAll(
                '[data-review-id="git-full-preview-block"].added.right-side',
              ).length > 0,
            hasRemovedBlock:
              document.querySelectorAll(
                '[data-review-id="git-full-preview-block"].removed.left-side',
              ).length > 0,
            hasReadableTableCells:
              tableContrasts.length > 0 &&
              tableContrasts.every((ratio) => ratio >= 3),
            unrelatedBlocks,
          };
        })
      : null;
  const renderedPlaceholderGrouping =
    scenario === "viewer-rendered-diff-placeholder-grouping"
      ? await page.evaluate(() => {
          const groups = Array.from(
            document.querySelectorAll(
              '[data-review-id="git-rendered-placeholder-group"]',
            ),
          );
          const groupTexts = groups.map(
            (node) => node.textContent?.trim() ?? "",
          );
          const groupLabels = Array.from(
            document.querySelectorAll(".git-rendered-block-meta"),
          ).map((node) => node.textContent?.trim() ?? "");
          const groupChangeTargets = groups.filter((node) =>
            node.closest("[data-change-index]"),
          );
          const activeTargetText =
            document
              .querySelector(
                '[data-review-id="git-rendered-block"].change-target',
              )
              ?.textContent?.trim() ?? "";
          return {
            groupCount: groups.length,
            groupTexts,
            groupLabels,
            groupChangeTargetCount: groupChangeTargets.length,
            activeTargetText,
          };
        })
      : null;

  return {
    ...(await buildGitDiffSourceControlAssertions(context)),
    ...(await buildGitDiffSourceDiffAssertions(context)),
    ...(await buildGitDiffRenderedAssertions(context, {
      diffRegressionSuite,
      renderedPlaceholderGrouping,
    })),
    ...(await buildGitDiffNavigationAssertions(context)),
    ...(await buildGitDiffFileCompareAssertions(context)),
  };
}
