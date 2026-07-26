export async function applyAppShellLegacyCodexScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-codex-multifile") {
    const initialRightSidebar =
      (await page.locator('[data-review-id="right-sidebar"]').count()) === 1;
    await page.locator('[data-review-id="codex-spike-toggle"]').click();
    await page.locator('[data-review-id="codex-consent"]').waitFor();
    await page.locator('[data-review-id="codex-consent-continue"]').click();
    await page.evaluate(() => {
      window.__SVARD_CODEX_CONTEXT_FILES__ = {
        "/outside/notes.md": {
          source: "# External notes\n\nUse only with explicit selection.",
        },
        "/workspace/.env": {
          source: "SECRET=blocked",
        },
      };
    });

    const composer = page.getByRole("textbox", {
      name: "Type your query here",
    });
    const contextChips = page.locator('[data-review-id="codex-context-chip"]');
    await composer.waitFor();
    await page.locator('[data-review-id="codex-new-chat"]').waitFor();
    const newChatAvailable =
      (await page.locator('[data-review-id="codex-new-chat"]').count()) === 1;
    await contextChips.filter({ hasText: "mvp-guide.adoc" }).waitFor();
    const currentDocumentPending =
      (await contextChips.filter({ hasText: "mvp-guide.adoc" }).count()) === 1;
    const initialPanelBox = await page
      .locator('[data-review-id="codex-panel"]')
      .boundingBox();
    const initialComposerBox = await page
      .locator('[data-review-id="codex-composer"]')
      .boundingBox();
    const initialComposerBottomAligned = Boolean(
      initialPanelBox &&
      initialComposerBox &&
      Math.abs(
        initialPanelBox.y +
          initialPanelBox.height -
          (initialComposerBox.y + initialComposerBox.height),
      ) <= 20,
    );

    await page
      .locator('[data-review-id="codex-execution-settings-toggle"]')
      .click();
    const executionSettings = page.locator(
      '[data-review-id="codex-execution-settings"]',
    );
    await executionSettings.waitFor();
    const readOnlyDefault = await page
      .getByRole("radio", { name: "Read only" })
      .isChecked();
    await page.getByRole("radio", { name: "Workspace write" }).check();
    await page
      .getByRole("checkbox", { name: "Command network access" })
      .check();
    await page.getByRole("checkbox", { name: "Web search" }).check();
    const settingsRequireNewChat = await executionSettings
      .getByText("New Chat required")
      .isVisible();
    await page
      .locator('[data-review-id="codex-execution-settings-toggle"]')
      .click();
    await page.locator('[data-review-id="codex-new-chat"]').click();
    await contextChips.filter({ hasText: "mvp-guide.adoc" }).waitFor();

    await page
      .locator('[data-review-id="codex-execution-settings-toggle"]')
      .click();
    await page.getByRole("radio", { name: "Full access" }).click();
    const dangerConfirmation = page.locator(
      '[data-review-id="codex-execution-danger-confirmation"]',
    );
    await dangerConfirmation.waitFor();
    const dangerConfirmationShown = await dangerConfirmation.isVisible();
    await dangerConfirmation.getByRole("button", { name: "Cancel" }).click();
    const dangerCancelKeptWorkspaceWrite = await page
      .getByRole("radio", { name: "Workspace write" })
      .isChecked();
    await page
      .locator('[data-review-id="codex-execution-settings-toggle"]')
      .click();

    await composer.fill("@config");
    await page
      .locator('[data-review-id="codex-context-search-results"]')
      .waitFor();
    await page
      .locator('[data-review-id="codex-context-search-results"] button')
      .filter({ hasText: "src/config.ts" })
      .click();

    await page.evaluate(() => {
      window.__SVARD_PICK_CODEX_CONTEXT_FILES__ = [
        "/workspace/docs/git-modified.md",
      ];
    });
    await page.locator('[data-review-id="codex-context-add"]').click();
    await contextChips.filter({ hasText: "git-modified.md" }).waitFor();

    const internalDragSource = page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "git-untracked.md" });
    const internalDropTarget = page.locator('[data-review-id="codex-panel"]');
    await internalDragSource.scrollIntoViewIfNeeded();
    const internalDragSourceBox = await internalDragSource.boundingBox();
    const internalDropTargetBox = await internalDropTarget.boundingBox();
    if (!internalDragSourceBox || !internalDropTargetBox) {
      throw new Error("Codex internal drag geometry is unavailable.");
    }
    await page.mouse.move(
      internalDragSourceBox.x + internalDragSourceBox.width / 2,
      internalDragSourceBox.y + internalDragSourceBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      internalDragSourceBox.x + internalDragSourceBox.width / 2 + 24,
      internalDragSourceBox.y + internalDragSourceBox.height / 2 + 4,
      { steps: 6 },
    );
    const internalDragPreview = page.locator(
      '[data-review-id="codex-context-drag-preview"]',
    );
    await internalDragPreview.waitFor();
    const internalDragPreviewVisible = await internalDragPreview.isVisible();
    await page.mouse.move(
      internalDropTargetBox.x + internalDropTargetBox.width / 2,
      internalDropTargetBox.y + internalDropTargetBox.height / 2,
      { steps: 10 },
    );
    await page.waitForFunction(() =>
      document
        .querySelector('[data-review-id="codex-panel"]')
        ?.classList.contains("internal-drop-target"),
    );
    const internalDropTargetVisible = await internalDropTarget.evaluate(
      (element) => element.classList.contains("internal-drop-target"),
    );
    await page.mouse.up();
    await contextChips.filter({ hasText: "git-untracked.md" }).waitFor();
    const internalDragAdded =
      (await contextChips.filter({ hasText: "git-untracked.md" }).count()) ===
      1;

    await page.evaluate(() => {
      window.__SVARD_PICK_CODEX_CONTEXT_FILES__ = ["/workspace/.env"];
    });
    await page.locator('[data-review-id="codex-context-add"]').click();
    await page.locator('[data-review-id="codex-context-notice"]').waitFor();
    const unsupportedRejected =
      (await contextChips.count()) === 4 &&
      (
        await page
          .locator('[data-review-id="codex-context-notice"]')
          .innerText()
      ).includes("cannot be shared");

    await composer.fill("Explain the relationships across these files.");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.locator('[data-review-id="codex-text-response"]').waitFor();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '[data-review-id="codex-context-chip"][data-context-status="shared"]',
        ).length === 4,
    );
    const sharedCount = await page
      .locator(
        '[data-review-id="codex-context-chip"][data-context-status="shared"]',
      )
      .count();

    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "git-clean.md" })
      .click();
    await page
      .locator('[data-review-id="active-document-title"]')
      .filter({ hasText: "git-clean.md" })
      .waitFor();
    const contextCountAfterSwitch = await contextChips.count();

    await page.evaluate(() => {
      window.__SVARD_TRIGGER_NATIVE_FILE_DROP__?.({
        type: "drop",
        paths: ["/outside/notes.md"],
      });
    });
    await contextChips.filter({ hasText: "notes.md" }).waitFor();
    const nativeDropAdded =
      (await contextChips.filter({ hasText: "notes.md" }).count()) === 1;

    await composer.fill("Use the newly added context.");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '[data-review-id="codex-context-chip"][data-context-status="shared"]',
        ).length === 5,
    );
    await page.evaluate(() => {
      window.__SVARD_TRIGGER_DOCUMENT_CHANGE__?.("/outside/notes.md");
    });
    await page.locator('[data-review-id="codex-stale"]').waitFor();
    const staleBlocked =
      (await page
        .locator(
          '[data-review-id="codex-context-chip"][data-context-status="stale"]',
        )
        .count()) === 1;
    await page
      .locator('[data-review-id="codex-stale"]')
      .getByRole("button", { name: "Start new chat" })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '[data-review-id="codex-context-chip"][data-context-status="pending"]',
        ).length === 5,
    );

    await composer.fill("Compare the refreshed context.");
    const responseMode = page.locator('[data-review-id="codex-response-mode"]');
    if ((await responseMode.getAttribute("aria-pressed")) !== "true") {
      await responseMode.click();
    }
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-review-id="codex-response-mode"]')
          ?.getAttribute("aria-pressed") === "true",
    );
    await page.getByRole("button", { name: "Send message" }).click();
    await page.locator('[data-review-id="codex-openui-response"]').waitFor();
    await page.locator('[data-review-id="codex-chat-visibility"]').click();
    await page.locator('[data-review-id="codex-focused-response"]').waitFor();
    const focusedResponseVisible =
      (await page
        .locator(
          '[data-review-id="codex-focused-response"] [data-review-id="codex-openui-response"]',
        )
        .count()) === 1;
    const executionSettingsApplied = await page.evaluate(() => {
      const input = window.__SVARD_LAST_CODEX_TURN_INPUT__;
      return (
        input?.executionSettings?.sandboxMode === "workspace-write" &&
        input.executionSettings.commandNetworkAccess === true &&
        input.executionSettings.webSearch === true
      );
    });

    await page.locator('[data-review-id="codex-panel-close"]').click();
    await page
      .locator('[data-review-id="codex-main-split"]')
      .waitFor({ state: "detached" });
    const rightSidebarRestored =
      (await page.locator('[data-review-id="right-sidebar"]').count()) === 1;
    await page.locator('[data-review-id="codex-spike-toggle"]').click();
    await page.locator('[data-review-id="codex-panel"]').waitFor();
    await page.locator('[data-review-id="codex-chat-visibility"]').click();

    await page.evaluate(
      ({
        contextCountAfterSwitch,
        currentDocumentPending,
        dangerCancelKeptWorkspaceWrite,
        dangerConfirmationShown,
        executionSettingsApplied,
        focusedResponseVisible,
        initialRightSidebar,
        initialComposerBottomAligned,
        internalDragAdded,
        internalDragPreviewVisible,
        internalDropTargetVisible,
        nativeDropAdded,
        newChatAvailable,
        readOnlyDefault,
        rightSidebarRestored,
        settingsRequireNewChat,
        sharedCount,
        staleBlocked,
        unsupportedRejected,
      }) => {
        window.__SVARD_CODEX_MULTIFILE_CHECK__ = {
          contextCountAfterSwitch,
          currentDocumentPending,
          dangerCancelKeptWorkspaceWrite,
          dangerConfirmationShown,
          executionSettingsApplied,
          focusedResponseVisible,
          initialRightSidebar,
          initialComposerBottomAligned,
          internalDragAdded,
          internalDragPreviewVisible,
          internalDropTargetVisible,
          nativeDropAdded,
          newChatAvailable,
          readOnlyDefault,
          rightSidebarRestored,
          settingsRequireNewChat,
          sharedCount,
          staleBlocked,
          unsupportedRejected,
        };
      },
      {
        contextCountAfterSwitch,
        currentDocumentPending,
        dangerCancelKeptWorkspaceWrite,
        dangerConfirmationShown,
        executionSettingsApplied,
        focusedResponseVisible,
        initialRightSidebar,
        initialComposerBottomAligned,
        internalDragAdded,
        internalDragPreviewVisible,
        internalDropTargetVisible,
        nativeDropAdded,
        newChatAvailable,
        readOnlyDefault,
        rightSidebarRestored,
        settingsRequireNewChat,
        sharedCount,
        staleBlocked,
        unsupportedRejected,
      },
    );
  } else if (scenario === "viewer-codex-openui") {
    const initialRightSidebar =
      (await page.locator('[data-review-id="right-sidebar"]').count()) === 1;

    await page.locator('[data-review-id="split-view-toggle"]').click();
    await page.locator('[data-review-id="viewer-split"]').waitFor();
    await page.locator('[data-review-id="codex-spike-toggle"]').click();
    await page.getByText("Split Viewを閉じてください。").waitFor();
    const splitViewBlocked =
      (await page.locator('[data-review-id="codex-panel"]').count()) === 0;
    await page.locator('[data-review-id="split-view-toggle"]').click();
    await page
      .locator('[data-review-id="viewer-split"]')
      .waitFor({ state: "detached" });

    await page.locator('[data-review-id="codex-spike-toggle"]').click();
    await page.locator('[data-review-id="codex-consent"]').waitFor();
    await page.locator('[data-review-id="codex-consent-continue"]').click();

    const composer = page.getByRole("textbox", {
      name: "Type your query here",
    });
    const send = page.getByRole("button", { name: "Send message" });
    await composer.fill("Summarize this document in three points.");
    await send.click();
    await page.locator('[data-review-id="codex-text-response"]').waitFor();

    const resizer = page.locator(".codex-main-resizer");
    const resizerBox = await resizer.boundingBox();
    if (!resizerBox) {
      throw new Error("Codex split resizer is unavailable");
    }
    await page.mouse.move(
      resizerBox.x + resizerBox.width / 2,
      resizerBox.y + resizerBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      resizerBox.x + resizerBox.width / 2 + 70,
      resizerBox.y + resizerBox.height / 2,
    );
    await page.mouse.up();

    await page.locator('[data-review-id="codex-response-mode"]').click();
    await composer.fill("Compare the document boundaries in a table.");
    await send.click();
    await page.locator('[data-review-id="codex-openui-response"]').waitFor();

    await page.locator('[data-review-id="codex-chat-visibility"]').click();
    await page.locator('[data-review-id="codex-focused-response"]').waitFor();
    const focusedResponseVisible =
      (await page
        .locator(
          '[data-review-id="codex-focused-response"] [data-review-id="codex-openui-response"]',
        )
        .count()) === 1;
    await page.locator('[data-review-id="codex-chat-visibility"]').click();

    await composer.fill("Render invalid OpenUI for fallback.");
    await send.click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-review-id="codex-text-response"]')
          .length >= 2,
    );
    const plainTextFallback =
      (await page.locator('[data-review-id="codex-text-response"]').count()) >=
      2;

    await page.locator('[data-review-id="codex-panel-close"]').click();
    await page
      .locator('[data-review-id="codex-main-split"]')
      .waitFor({ state: "detached" });
    const rightSidebarRestored =
      (await page.locator('[data-review-id="right-sidebar"]').count()) === 1;

    await page.locator('[data-review-id="codex-spike-toggle"]').click();
    await page.locator('[data-review-id="codex-panel"]').waitFor();
    await page.locator('[data-review-id="codex-response-mode"]').click();
    await composer.fill("Show the comparison table again.");
    await send.click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-review-id="codex-openui-response"]')
          .length >= 2,
    );

    await page.evaluate(
      ({
        focusedResponseVisible,
        initialRightSidebar,
        plainTextFallback,
        rightSidebarRestored,
        splitViewBlocked,
      }) => {
        const documentPane = document
          .querySelector(".codex-document-pane")
          ?.getBoundingClientRect();
        const aiPane = document
          .querySelector(".codex-ai-pane")
          ?.getBoundingClientRect();
        window.__SVARD_CODEX_OPENUI_CHECK__ = {
          focusedResponseVisible,
          initialRightSidebar,
          plainTextFallback,
          rightSidebarRestored,
          splitViewBlocked,
          documentWidth: documentPane?.width ?? 0,
          aiWidth: aiPane?.width ?? 0,
        };
      },
      {
        focusedResponseVisible,
        initialRightSidebar,
        plainTextFallback,
        rightSidebarRestored,
        splitViewBlocked,
      },
    );
  } else {
    return false;
  }
  return true;
}
