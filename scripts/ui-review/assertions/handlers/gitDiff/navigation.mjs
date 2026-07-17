async function hasConsistentActiveRulerMarker(page) {
  return page.evaluate(() => {
    const targets = Array.from(
      document.querySelectorAll(
        '.git-rendered-diff-body [data-active-change="true"][data-change-index]',
      ),
    );
    if (targets.length === 0) {
      return false;
    }
    const indexes = new Set(
      targets.map((target) => target.getAttribute("data-change-index")),
    );
    return indexes.size === 1;
  });
}

export async function buildGitDiffNavigationAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  const geometryReviewIds = context.geometryReviewIds;

  return {
    hasDiffPreviewExpand:
      scenario === "viewer-diff-preview-expand"
        ? (await page
            .locator('[data-review-id="git-diff-preview-panel"].expanded')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-preview-expand"]')
            .getAttribute("aria-label")) === "Exit full screen"
        : true,
    hasDiffFullPreviewAsciiDoc:
      scenario === "viewer-diff-full-preview-asciidoc"
        ? bodyText.includes("Git Rendered AsciiDoc Diff Fixture") &&
          bodyText.includes("Rendered admonitions are compared as blocks") &&
          bodyText.includes("Changed") &&
          (await page
            .locator('[data-review-id="git-full-preview-diff"]')
            .count()) === 1
        : true,
    hasDiffFullPreviewOverviewJump:
      scenario === "viewer-diff-full-preview-overview-jump"
        ? (await page
            .locator('[data-review-id="git-diff-full-preview-view"]')
            .getAttribute("aria-pressed")) === "true" &&
          (await hasConsistentActiveRulerMarker(page)) &&
          (await page
            .locator('[data-review-id="git-full-preview-diff"]')
            .count()) === 1
        : true,
    hasDiffOverview:
      scenario === "viewer-diff-overview"
        ? bodyText.includes("Overview") &&
          bodyText.includes("Changed sections") &&
          bodyText.includes("Changed blocks") &&
          bodyText.includes("Tables") &&
          bodyText.includes("2 changes") &&
          !bodyText.includes("Added blocks") &&
          !bodyText.includes("Removed blocks") &&
          !bodyText.includes("Diagrams") &&
          !bodyText.includes("Changes-only and source diff data") &&
          (await page
            .locator('[data-review-id="git-diff-fallback-reason"]')
            .count()) === 0 &&
          (await page
            .locator('[data-review-id="git-diff-overview"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-overview-sections"] li')
            .count()) > 0 &&
          (await page.evaluate(() => {
            const sectionButtons = Array.from(
              document.querySelectorAll(
                '[data-review-id="git-diff-overview-sections"] button',
              ),
            );
            const labels = sectionButtons.map((button) =>
              (button.textContent ?? "")
                .replace(/\s*·?\s*\d+\s+changes?\s*$/u, "")
                .trim(),
            );
            return new Set(labels).size === labels.length;
          }))
        : true,
    hasDiffChangeNavigation:
      scenario === "viewer-diff-change-navigation"
        ? bodyText.includes("changes") &&
          (await hasConsistentActiveRulerMarker(page)) &&
          (await page
            .locator('[data-review-id="git-diff-change-ruler"]')
            .count()) === 0 &&
          (await page
            .locator('[data-review-id="git-full-preview-block"].change-target')
            .count()) > 0
        : true,
    hasDiffLargeMarkdownScrollReturn:
      scenario === "viewer-diff-large-markdown-scroll-return"
        ? await page.evaluate(() => {
            const result = window.__SVARD_DIFF_LARGE_SCROLL_RETURN_CHECK__;
            const bottom = result?.bottom;
            const manualUp = result?.afterManualUp;
            const samples = [
              result?.afterMinimap,
              result?.afterNext,
              result?.afterPrevious,
            ];
            return (
              bottom?.syncEnabled === true &&
              bottom.rightScrollTop > 500 &&
              manualUp?.syncEnabled === true &&
              manualUp.rightScrollTop < bottom.rightScrollTop &&
              manualUp.leftScrollTop < bottom.leftScrollTop &&
              samples.every(
                (sample) =>
                  sample?.syncEnabled === true &&
                  sample?.targetInView === true &&
                  typeof sample?.targetOffset === "number" &&
                  sample.targetOffset >= 0 &&
                  sample.targetOffset <= 360 &&
                  sample.rightScrollTop < bottom.rightScrollTop,
              ) &&
              result?.afterMinimap?.activeChangeIndex === 0 &&
              result?.afterNext?.activeChangeIndex >= 1 &&
              result?.afterPrevious?.activeChangeIndex === 0
            );
          })
        : true,
    hasDiffMouseGestureChangeNavigation:
      scenario === "viewer-diff-mouse-gestures-change-navigation"
        ? await page.evaluate(() => {
            const result = window.__SVARD_DIFF_MOUSE_GESTURE_CHECK__;
            return (
              result?.afterRight?.activeLabel === "Go to change 2" &&
              result?.afterRight?.lastGesture?.pattern === "Right" &&
              result?.afterRight?.lastGesture?.commandId ===
                "navigation.forward" &&
              result?.afterRight?.lastGesture?.status === "handled" &&
              result?.afterLeft?.activeLabel === "Go to change 1" &&
              result?.afterLeft?.lastGesture?.pattern === "Left" &&
              result?.afterLeft?.lastGesture?.commandId === "navigation.back" &&
              result?.afterLeft?.lastGesture?.status === "handled"
            );
          })
        : true,
    hasDiffMouseGestureExpandedActions:
      scenario === "viewer-diff-mouse-gestures-expanded-actions"
        ? await page.evaluate(() => {
            const result = window.__SVARD_DIFF_MOUSE_GESTURE_EXPANDED_CHECK__;
            return (
              result?.afterRight?.activeLabel === "Go to change 2" &&
              result?.afterRight?.lastGesture?.pattern === "Right" &&
              result?.afterRight?.lastGesture?.commandId ===
                "navigation.forward" &&
              result?.afterLeft?.activeLabel === "Go to change 1" &&
              result?.afterLeft?.lastGesture?.pattern === "Left" &&
              result?.afterLeft?.lastGesture?.commandId === "navigation.back" &&
              result?.afterDown?.scrollTop > 0 &&
              result?.afterDown?.lastGesture?.pattern === "Down" &&
              result?.afterDown?.lastGesture?.commandId === "viewer.bottom" &&
              result?.afterDown?.lastGesture?.status === "handled" &&
              result?.afterUp?.scrollTop === 0 &&
              result?.afterUp?.lastGesture?.pattern === "Up" &&
              result?.afterUp?.lastGesture?.commandId === "viewer.top" &&
              result?.afterUp?.lastGesture?.status === "handled" &&
              result?.afterClose?.panelCount === 0 &&
              result?.afterClose?.lastGesture?.pattern === "Down Right" &&
              result?.afterClose?.lastGesture?.commandId === "tab.close" &&
              result?.afterClose?.lastGesture?.status === "handled"
            );
          })
        : true,
    hasDiffMouseGestureScrollSync:
      scenario === "viewer-diff-mouse-gestures-scroll-sync"
        ? await page.evaluate(() => {
            const result =
              window.__SVARD_DIFF_MOUSE_GESTURE_SCROLL_SYNC_CHECK__;
            return (
              result?.syncEnabled === true &&
              result?.leftScrollTop > 0 &&
              result?.rightScrollTop > 0 &&
              result?.lastGesture?.pattern === "Down" &&
              result?.lastGesture?.commandId === "viewer.bottom" &&
              result?.lastGesture?.status === "handled"
            );
          })
        : true,
    hasDiffShortcutGestureHints:
      scenario === "viewer-diff-shortcut-gesture-hints"
        ? await page.evaluate(() => {
            const result = window.__SVARD_DIFF_SHORTCUT_GESTURE_HINTS_CHECK__;
            const text = result?.text ?? "";
            return (
              text.includes("Diff Preview shortcuts and gestures") &&
              text.includes("Keyboard") &&
              text.includes("Mouse Gestures") &&
              text.includes("Previous change") &&
              text.includes("Next change") &&
              text.includes("Scroll active pane to bottom") &&
              text.includes("Close Diff Preview") &&
              text.includes("Down Right") &&
              result?.disabledNoticeCount === 0
            );
          })
        : true,
    hasDiffScrollSync:
      scenario === "viewer-diff-scroll-sync"
        ? (await page
            .locator('[data-review-id="git-diff-scroll-sync"]')
            .count()) === 1 &&
          !(await page
            .locator('[data-review-id="git-diff-scroll-sync"]')
            .isChecked())
        : true,
    hasDiffScrollAnchorSync:
      scenario === "viewer-diff-scroll-anchor-sync"
        ? (await page
            .locator('[data-review-id="git-diff-scroll-sync"]')
            .isChecked()) &&
          (await page.evaluate(() => {
            const result = window.__SVARD_DIFF_ANCHOR_SYNC__;
            return (
              Boolean(result?.syncIndex) &&
              typeof result?.leftOffset === "number" &&
              typeof result?.rightOffset === "number" &&
              typeof result?.delta === "number" &&
              result.delta <= 24 &&
              typeof result?.leftScrollDrift === "number" &&
              typeof result?.rightScrollDrift === "number" &&
              result.leftScrollDrift <= 2 &&
              result.rightScrollDrift <= 2
            );
          }))
        : true,
    hasDiffDiagramPlaceholder:
      scenario === "viewer-diff-diagram-placeholder"
        ? bodyText.includes("Diagram rendering is disabled") &&
          !bodyText.includes('Rel(user, app, "Reviews")') &&
          (await page
            .locator('[data-review-id="diagram-inline-diagnostic"]')
            .count()) > 0
        : true,
    hasDiffDiagramRenderedPreview:
      scenario === "viewer-diff-diagram-rendered-preview"
        ? (await page
            .locator(
              '[data-review-id="git-full-preview-diff"] [data-review-id="mermaid-render"] [data-review-id="diagram-inline-image"] svg',
            )
            .count()) >= 1 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-diff"] [data-review-id="plantuml-render"] [data-review-id="diagram-inline-image"] svg',
            )
            .count()) >= 1 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-diff"] [data-review-id="graphviz-render"] [data-review-id="diagram-inline-image"] svg',
            )
            .count()) >= 1 &&
          (await page
            .locator('[data-review-id="diagram-preview-panel"]')
            .count()) === 1 &&
          (await page.evaluate(() => {
            const diagramBackdrop = document.querySelector(
              '[data-review-id="diagram-preview-backdrop"]',
            );
            const diffBackdrop = document.querySelector(
              '[data-review-id="git-diff-backdrop"]',
            );
            if (!diagramBackdrop || !diffBackdrop) {
              return false;
            }
            const diagramZ = Number(
              window.getComputedStyle(diagramBackdrop).zIndex,
            );
            const diffZ = Number(window.getComputedStyle(diffBackdrop).zIndex);
            return diagramZ > diffZ;
          })) &&
          !bodyText.includes("User -> Viewer: Review") &&
          !bodyText.includes("digraph G")
        : true,
    hasDiffDiagramBeforeAfterPreview:
      scenario === "viewer-diff-diagram-before-after-preview"
        ? (await page
            .locator('[data-review-id="diagram-preview-comparison"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="diagram-preview-comparison-before"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="diagram-preview-comparison-after"]')
            .count()) === 1
        : true,
    hasDiffDiagramPreviewEscapeStack:
      scenario === "viewer-diff-diagram-preview-escape-stack"
        ? (await page
            .locator('[data-review-id="diagram-preview-panel"]')
            .count()) === 0 &&
          (await page
            .locator('[data-review-id="git-diff-preview-panel"]')
            .count()) === 0 &&
          (await page.locator('[data-review-id="document-body"]').count()) === 1
        : true,
    hasDiffMathRendering:
      scenario === "viewer-diff-math-rendering"
        ? await page.evaluate(() => {
            const root = document.querySelector(
              '[data-review-id="git-rendered-diff"]',
            );
            if (!(root instanceof HTMLElement)) {
              return false;
            }
            const inlineMath = root.querySelector(".math-inline .katex");
            const blockMath = root.querySelector(
              '[data-review-id="math-block"] .katex',
            );
            const inlineMathRect = inlineMath?.getBoundingClientRect();
            const blockMathRect = blockMath?.getBoundingClientRect();
            const mermaid = root.querySelector(
              '[data-review-id="mermaid-render"] svg',
            );
            const mathHighlight = root.querySelector(
              ".math-inline .git-inline-word-highlight, .math-block .git-inline-word-highlight, .katex .git-inline-word-highlight",
            );
            const diagramHighlight = root.querySelector(
              ".diagram-inline .git-inline-word-highlight, svg .git-inline-word-highlight",
            );
            return (
              inlineMathRect !== undefined &&
              blockMathRect !== undefined &&
              inlineMathRect.width > 20 &&
              inlineMathRect.height > 12 &&
              blockMathRect.width > 40 &&
              blockMathRect.height > 20 &&
              mermaid !== null &&
              mathHighlight === null &&
              diagramHighlight === null
            );
          })
        : true,
    hasDiffRichAsciiDocPreview:
      scenario === "viewer-diff-rich-asciidoc-preview"
        ? (await page
            .locator(
              '[data-review-id="git-full-preview-diff"] .admonitionblock .icon-note',
            )
            .count()) >= 1 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-diff"] table.tableblock td[colspan]',
            )
            .count()) >= 1 &&
          (await page
            .locator('[data-review-id="git-full-preview-diff"] pre code')
            .count()) >= 1
        : true,
    hasDiffLocalImagePreview:
      scenario === "viewer-diff-local-image-preview" ||
      scenario === "viewer-diff-same-path-image-revision"
        ? (await page
            .locator(
              '[data-review-id="git-full-preview-diff"] img[data-image-path]',
            )
            .count()) >= 2 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-diff"] img[src^="data:image/"]',
            )
            .count()) >= 2 &&
          (await page.evaluate(() => {
            const pane = document.querySelector(
              '[data-review-id="git-full-preview-diff"]',
            );
            if (!pane) return false;
            const paneRect = pane.getBoundingClientRect();
            return Array.from(
              pane.querySelectorAll('img[src^="data:image/"]'),
            ).every((image) => {
              const imageRect = image.getBoundingClientRect();
              return (
                imageRect.width <= paneRect.width &&
                imageRect.right <= paneRect.right + 1
              );
            });
          })) &&
          bodyText.includes("Local image: missing-diff-image.png") &&
          (await page.evaluate(() => {
            const imageForSide = (reviewId) =>
              document.querySelector(
                `[data-review-id="${reviewId}"] img[data-image-path$="diff-same-path-image.svg"]`,
              );
            const left = imageForSide("git-full-preview-left-pane");
            const right = imageForSide("git-full-preview-right-pane");
            return Boolean(
              left instanceof HTMLImageElement &&
              right instanceof HTMLImageElement &&
              left.src.startsWith("data:image/svg+xml") &&
              right.src.startsWith("data:image/svg+xml") &&
              left.src !== right.src,
            );
          }))
        : true,
    hasDiffImageReferenceContextMenu:
      scenario === "viewer-diff-same-path-image-revision"
        ? geometryReviewIds.has(
            "context-menu-item-copy-image-with-reference",
          ) &&
          geometryReviewIds.has("context-menu-item-copy-image-path") &&
          !geometryReviewIds.has("context-menu-item-copy-image-reference")
        : true,
    hasDiffImagePreview:
      scenario === "viewer-diff-image-preview"
        ? (await page
            .locator('[data-review-id="diagram-preview-panel"].expanded')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="image-svg-preview-content"] svg text')
            .count()) >= 1 &&
          (await page
            .locator('[data-review-id="diagram-preview-close"]')
            .count()) === 1
        : true,
  };
}
