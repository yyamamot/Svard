export async function buildOpenFilesAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  const consoleMessages = context.consoleMessages;
  const documentRenderCacheBenchmark = context.documentRenderCacheBenchmark;
  const renderCacheExpectation = context.renderCacheExpectation;
  const commandAutomation = context.commandAutomation;
  const contextMenuText = context.contextMenuText;
  const editorOpenRequests = context.editorOpenRequests;
  const geometryReviewIds = context.geometryReviewIds;
  const renderCachePhases = documentRenderCacheBenchmark?.phases;
  const cacheInstrumentationObserved = Object.values(
    renderCachePhases ?? {},
  ).some(
    (metrics) =>
      (metrics?.cacheHitCount ?? 0) +
        (metrics?.cacheMissCount ?? 0) +
        (metrics?.inFlightCount ?? 0) >
      0,
  );
  const cacheInstrumentationRequired =
    scenario === "viewer-render-cache-tab-revisit" &&
    renderCacheExpectation === "required";
  return {
    hasRenderCacheTabRevisitFlow:
      scenario === "viewer-render-cache-tab-revisit"
        ? await page.evaluate(() => {
            const check = window.__SVARD_RENDER_CACHE_UI_CHECK__;
            return (
              check?.equivalentShape === true &&
              check?.selectionUsable === true &&
              check?.searchUsable === true &&
              check?.themeApplied === true &&
              check?.latestContentVisible === true
            );
          })
        : true,
    hasRenderCacheBenchmarkPhases:
      scenario === "viewer-render-cache-tab-revisit"
        ? documentRenderCacheBenchmark?.schemaVersion === 2 &&
          documentRenderCacheBenchmark?.scenarioId ===
            "viewer-render-cache-tab-revisit" &&
          documentRenderCacheBenchmark?.status === "ok" &&
          ["cold-a", "cold-b", "revisit-a", "theme-a", "reload-a"].every(
            (phase) => {
              const metrics = documentRenderCacheBenchmark?.phases?.[phase];
              return (
                typeof metrics?.durationMs === "number" &&
                metrics.durationMs >= 0 &&
                Number.isInteger(metrics.coreProducerCount) &&
                Number.isInteger(metrics.prepareProducerCount) &&
                Number.isInteger(metrics.cacheEventCount) &&
                Number.isInteger(metrics.inFlightActiveCountFinal) &&
                Number.isInteger(metrics.inFlightSnapshotCount) &&
                Number.isInteger(metrics.residentBytesMax)
              );
            },
          )
        : true,
    hasRenderCacheInstrumentation:
      scenario === "viewer-render-cache-tab-revisit"
        ? !cacheInstrumentationRequired || cacheInstrumentationObserved
        : true,
    hasRenderCacheProducerElision:
      scenario === "viewer-render-cache-tab-revisit"
        ? (!cacheInstrumentationObserved && !cacheInstrumentationRequired) ||
          (cacheInstrumentationObserved &&
            renderCachePhases?.["cold-a"]?.coreProducerCount === 1 &&
            renderCachePhases?.["cold-a"]?.prepareProducerCount === 1 &&
            renderCachePhases?.["cold-b"]?.coreProducerCount === 1 &&
            renderCachePhases?.["cold-b"]?.prepareProducerCount === 1 &&
            renderCachePhases?.["revisit-a"]?.coreProducerCount === 0 &&
            renderCachePhases?.["revisit-a"]?.prepareProducerCount === 0 &&
            renderCachePhases?.["revisit-a"]?.coreHitCount >= 1 &&
            renderCachePhases?.["revisit-a"]?.preparedHitCount >= 1 &&
            renderCachePhases?.["theme-a"]?.coreProducerCount === 0 &&
            renderCachePhases?.["theme-a"]?.prepareProducerCount === 0 &&
            renderCachePhases?.["theme-a"]?.coreHitCount >= 1 &&
            renderCachePhases?.["theme-a"]?.preparedHitCount >= 1 &&
            renderCachePhases?.["reload-a"]?.coreProducerCount === 1 &&
            renderCachePhases?.["reload-a"]?.prepareProducerCount === 1 &&
            ["cold-a", "cold-b", "revisit-a", "theme-a", "reload-a"].every(
              (phase) =>
                renderCachePhases?.[phase]?.inFlightSnapshotCount >= 1 &&
                renderCachePhases?.[phase]?.inFlightActiveCountFinal === 0,
            ))
        : true,
    hasRenderCacheBoundedAccounting:
      scenario === "viewer-render-cache-tab-revisit"
        ? Object.values(documentRenderCacheBenchmark?.phases ?? {}).every(
            (metrics) => metrics?.residentBytesMax <= 33_554_432,
          )
        : true,
    hasRenderCachePrivacySafeConsole:
      scenario === "viewer-render-cache-tab-revisit"
        ? consoleMessages.every(
            (message) => !String(message?.text ?? "").startsWith("[perf]"),
          )
        : true,
    hasOpenFilesDragReorder:
      scenario === "viewer-drag-reorder-open-files"
        ? (await page
            .locator('[data-review-id="open-file-drag-handle"]')
            .count()) === 0 &&
          (await page.locator('[data-review-id="open-file-item"]').count()) >=
            4 &&
          (await page
            .locator('[data-review-id="open-file-item"]')
            .first()
            .textContent()
            .then((text) => text?.includes("preferences.adoc"))) === true &&
          bodyText.includes("Render Fixtures")
        : true,
    hasPinnedTabs:
      scenario === "viewer-pinned-tabs"
        ? (await page
            .locator('[data-review-id="open-file-item"].pinned')
            .filter({ hasText: "preferences.adoc" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-file-item"]')
            .filter({ hasText: "render-fixtures.adoc" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-file-item"]')
            .filter({ hasText: "mvp-guide.adoc" })
            .count()) === 0 &&
          commandAutomation.availableCommands.includes("tab.togglePinned")
        : true,
    hasOpenFilesRowActions:
      scenario === "viewer-open-files-row-actions"
        ? await page.evaluate(() => {
            const result = window.__SVARD_OPEN_FILES_ROW_ACTIONS_CHECK__;
            const isHidden = (action) =>
              action?.visibility === "hidden" &&
              action?.pointerEvents === "none";
            const isVisible = (action) =>
              action?.visibility === "visible" &&
              action?.pointerEvents !== "none" &&
              action?.opacity >= 0.95;
            return (
              isHidden(result?.restingPin) &&
              isHidden(result?.restingClose) &&
              isVisible(result?.hoveredPin) &&
              isVisible(result?.hoveredClose) &&
              isVisible(result?.pinnedPin) &&
              isVisible(result?.pinnedClose) &&
              isVisible(result?.activeClose) &&
              result?.pinnedRowClass === true &&
              result?.activeRowClass === true &&
              result?.hoveredPin?.ariaLabel === "Pin copy-actions.adoc" &&
              result?.pinnedPin?.ariaLabel === "Unpin preferences.adoc" &&
              result?.activeClose?.ariaLabel === "Close render-fixtures.adoc"
            );
          })
        : true,
    hasOpenFilesFilter:
      scenario === "viewer-open-files-filter"
        ? (await page
            .locator('[data-review-id="open-files-filter"]')
            .count()) === 1 &&
          bodyText.includes("Preferences Defaults") &&
          commandAutomation.availableCommands.includes("tab.search")
        : true,
    hasOpenFilesGlobFilter:
      scenario === "viewer-open-files-glob-filter"
        ? (await page
            .locator('[data-review-id="open-files-filter"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-files-filter-mode"]')
            .filter({ hasText: "Glob" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-file-item"]')
            .filter({ hasText: "copy-actions.adoc" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-file-item"]')
            .filter({ hasText: "math-rendering.md" })
            .count()) === 0 &&
          bodyText.includes("Copy Actions") &&
          commandAutomation.availableCommands.includes("tab.search")
        : true,
    hasOpenFilesCollapse:
      scenario === "viewer-open-files-collapse"
        ? (await page
            .locator('[data-review-id="open-files-collapsed-bar"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-files-expand"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-files-filter"]')
            .count()) === 0 &&
          (await page
            .locator('[data-review-id="open-files-split-resizer"]')
            .count()) === 0 &&
          (await page.locator('[data-review-id="file-tree"]').count()) === 1 &&
          bodyText.includes("Copy Actions")
        : true,
    hasInactiveOpenFileAutoReload:
      scenario === "viewer-open-files-auto-reload-inactive"
        ? bodyText.includes("Markdown Sample Reloaded") &&
          (await page
            .locator(
              '[data-review-id="open-file-item"][data-path="/workspace/docs/markdown-sample.md"][data-reload-status="reloaded"]',
            )
            .count()) === 0 &&
          (await page
            .locator(
              '[data-review-id="open-file-item"][data-path="/workspace/docs/markdown-sample.md"] [data-review-id="open-file-reload-status"]',
            )
            .count()) === 0
        : true,
    hasOpenFileAutoReloadError:
      scenario === "viewer-open-files-auto-reload-error"
        ? (await page
            .locator(
              '[data-review-id="open-file-item"][data-path="/workspace/docs/markdown-sample.md"][data-reload-status="error"] [data-review-id="open-file-reload-status"]',
            )
            .count()) === 1 && bodyText.includes("Reload failed")
        : true,
  };
}
