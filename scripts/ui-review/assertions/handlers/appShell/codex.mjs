export async function buildAppShellCodexAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  return {
    hasCodexOpenUi:
      scenario === "viewer-codex-openui" ||
      scenario === "viewer-codex-multifile"
        ? await page.evaluate(() => {
            if (
              window.__SVARD_CODEX_MULTIFILE_CHECK__ &&
              !window.__SVARD_CODEX_OPENUI_CHECK__
            ) {
              const result = window.__SVARD_CODEX_MULTIFILE_CHECK__;
              return (
                result.currentDocumentPending === true &&
                result.readOnlyDefault === true &&
                result.settingsRequireNewChat === true &&
                result.executionSettingsApplied === true &&
                result.dangerConfirmationShown === true &&
                result.dangerCancelKeptWorkspaceWrite === true &&
                result.initialComposerBottomAligned === true &&
                result.sharedCount === 4 &&
                result.contextCountAfterSwitch === 4 &&
                result.internalDragAdded === true &&
                result.internalDragPreviewVisible === true &&
                result.internalDropTargetVisible === true &&
                result.nativeDropAdded === true &&
                result.newChatAvailable === true &&
                result.staleBlocked === true &&
                result.unsupportedRejected === true &&
                document.querySelectorAll(
                  '[data-review-id="codex-openui-response"]',
                ).length >= 1
              );
            }
            const result = window.__SVARD_CODEX_OPENUI_CHECK__;
            return (
              result?.documentWidth >= 300 &&
              result?.aiWidth >= 320 &&
              document.querySelectorAll('[data-review-id="codex-main-split"]')
                .length === 1 &&
              document.querySelectorAll(
                '[data-review-id="codex-openui-response"]',
              ).length >= 1 &&
              document.querySelectorAll('[data-review-id="right-sidebar"]')
                .length === 0
            );
          })
        : true,
    hasCodexInitialSidebar:
      scenario === "viewer-codex-openui" ||
      scenario === "viewer-codex-multifile"
        ? await page.evaluate(
            () =>
              (
                window.__SVARD_CODEX_OPENUI_CHECK__ ??
                window.__SVARD_CODEX_MULTIFILE_CHECK__
              )?.initialRightSidebar === true,
          )
        : true,
    hasCodexSplitBlock:
      scenario === "viewer-codex-openui"
        ? await page.evaluate(
            () =>
              window.__SVARD_CODEX_OPENUI_CHECK__?.splitViewBlocked === true,
          )
        : true,
    hasCodexFocusedResponse:
      scenario === "viewer-codex-openui" ||
      scenario === "viewer-codex-multifile"
        ? await page.evaluate(
            () =>
              (
                window.__SVARD_CODEX_OPENUI_CHECK__ ??
                window.__SVARD_CODEX_MULTIFILE_CHECK__
              )?.focusedResponseVisible === true,
          )
        : true,
    hasCodexPlainTextFallback:
      scenario === "viewer-codex-openui"
        ? await page.evaluate(
            () =>
              window.__SVARD_CODEX_OPENUI_CHECK__?.plainTextFallback === true,
          )
        : true,
    hasCodexSidebarRestore:
      scenario === "viewer-codex-openui" ||
      scenario === "viewer-codex-multifile"
        ? await page.evaluate(
            () =>
              (
                window.__SVARD_CODEX_OPENUI_CHECK__ ??
                window.__SVARD_CODEX_MULTIFILE_CHECK__
              )?.rightSidebarRestored === true,
          )
        : true,
  };
}
