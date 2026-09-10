export async function buildAppShellAgentOpenUiAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  return {
    hasAgentStage5:
      scenario === "viewer-site-ai-chat-main" ||
      scenario === "viewer-agent-chat-streaming" ||
      scenario === "viewer-agent-chat-approval" ||
      scenario === "viewer-agent-chat-openui" ||
      scenario === "viewer-agent-chat-openui-exploration" ||
      scenario === "viewer-agent-chat-openui-basic-review" ||
      scenario === "viewer-agent-chat-openui-basic-gallery" ||
      scenario === "viewer-agent-chat-openui-basic-balanced" ||
      scenario === "viewer-agent-chat-openui-basic-lean" ||
      scenario === "viewer-agent-chat-openui-limit-diagnostics" ||
      scenario === "viewer-agent-chat-openui-component-challengers" ||
      scenario === "viewer-agent-chat-image-input" ||
      scenario === "viewer-agent-chat-activity" ||
      scenario === "viewer-agent-chat-output-hygiene" ||
      scenario === "viewer-agent-chat-markdown-answer" ||
      scenario === "viewer-agent-chat-conversation-usability" ||
      scenario === "viewer-agent-chat-running-input-control" ||
      scenario === "viewer-agent-chat-change-review" ||
      scenario === "viewer-agent-chat-selection" ||
      scenario === "viewer-agent-chat-selection-image" ||
      scenario === "viewer-agent-chat-active-file" ||
      scenario === "viewer-agent-chat-session-management" ||
      scenario === "viewer-agent-chat-workspace-isolation" ||
      scenario === "viewer-agent-chat-main-bottom-dock" ||
      scenario === "viewer-agent-chat-detached-window" ||
      scenario === "viewer-agent-chat-dark-theme" ||
      scenario === "viewer-agent-chat-composer-access" ||
      scenario === "viewer-agent-chat-context-pressure" ||
      scenario === "viewer-agent-chat-token-diagnostics" ||
      scenario === "viewer-agent-chat-context-profile"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_STAGE5_CHECK__;
            return (
              result?.initialRightSidebar === true &&
              result?.composerBottomAligned === true &&
              result?.compactComposerBottomAligned === true &&
              result?.currentActivityVisible === true &&
              result?.darkControlsThemed === true &&
              result?.reasoningVisible === true &&
              result?.toolVisible === true &&
              result?.approvalResolved === true &&
              result?.activityFailureVisible === true &&
              result?.emptyActivityHidden === true &&
              result?.openUiVisible === true &&
              result?.openUiEvaluationVisible === true &&
              result?.explorationInteraction === true &&
              result?.groupedReadActivity === true &&
              result?.rightSidebarRestored === true
            );
          })
        : true,
    hasOpenUiLimitDiagnostics:
      scenario === "viewer-agent-chat-openui-limit-diagnostics"
        ? await page.evaluate(
            () =>
              window.__SVARD_AGENT_STAGE5_CHECK__
                ?.openUiLimitDiagnosticsVisible === true,
          )
        : true,
    hasOpenUiBasicProfileEvaluation:
      scenario === "viewer-agent-chat-openui-basic-review" ||
      scenario === "viewer-agent-chat-openui-basic-gallery" ||
      scenario === "viewer-agent-chat-openui-basic-balanced" ||
      scenario === "viewer-agent-chat-openui-basic-lean" ||
      scenario === "viewer-agent-chat-openui-component-challengers"
        ? await page.evaluate(
            () =>
              window.__SVARD_AGENT_STAGE5_CHECK__?.openUiEvaluationVisible ===
                true &&
              window.__SVARD_AGENT_STAGE5_CHECK__
                ?.openUiEvaluationWideLayout === true,
          )
        : true,
  };
}

export async function buildAppShellAgentChatAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  return {
    hasAgentOutputHygiene:
      scenario === "viewer-agent-chat-output-hygiene"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_OUTPUT_HYGIENE_CHECK__;
            return (
              result?.hasOpenUiRoot === false &&
              result?.hasInternalMemory === false &&
              result?.hasZeroDuration === false &&
              result?.emptyDetails === 0 &&
              result?.workspaceReadVisible === true
            );
          })
        : true,
    hasAgentConversationUsability:
      scenario === "viewer-agent-chat-conversation-usability"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_USABILITY_CHECK__;
            return (
              result?.restoredInput === true &&
              result?.markdownCopied === true &&
              result?.codeCopied === true &&
              result?.rawDslCopied === false &&
              result?.newActivityVisible === true &&
              result?.jumpedToLatest === true &&
              result?.turnCount === 3
            );
          })
        : true,
    hasAgentRunningInputControl:
      scenario === "viewer-agent-chat-running-input-control"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_RUNNING_INPUT_CHECK__;
            return (
              result?.steeredVisible === true && result?.queuedTurnCount >= 2
            );
          })
        : true,
    hasAgentDisconnectRecovery:
      scenario === "viewer-agent-chat-disconnect-recovery"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_DISCONNECT_RECOVERY_CHECK__;
            return (
              result?.activityClosed === true &&
              result?.approvalClosed === true &&
              result?.bottomPlacement === true &&
              result?.compactLayoutValid === true &&
              result?.detachedExclusive === true &&
              result?.failedTurnMaintained === true &&
              result?.reconnectCleared === true &&
              result?.restoredDraft === true &&
              result?.reusedDraft === true &&
              result?.reuseDidNotSend === true &&
              result?.rightPlacement === true &&
              result?.runningClosed === true
            );
          })
        : true,
    hasAgentChangeReview:
      scenario === "viewer-agent-chat-change-review"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_CHANGE_REVIEW_CHECK__;
            return (
              result?.chatMaintained === true && result?.fivePaths === true
            );
          })
        : true,
    hasAgentImageInput:
      scenario === "viewer-agent-chat-image-input"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_IMAGE_CHECK__;
            return (
              result?.attachedBeforeRemove === 3 &&
              result?.attachedAfterRemove === 2 &&
              result?.attachedWhileWorking === true &&
              result?.internalDragPreviewVisible === true &&
              result?.historyImages === 3 &&
              result?.pendingImages === 0
            );
          })
        : true,
    hasAgentSelection:
      scenario === "viewer-site-ai-chat-main" ||
      scenario === "viewer-agent-chat-selection" ||
      scenario === "viewer-agent-chat-selection-image"
        ? await page.evaluate((activeScenario) => {
            const result = window.__SVARD_AGENT_SELECTION_CHECK__;
            return (
              result?.historySelections === 1 &&
              result?.pendingSelections === 0 &&
              result?.mixedContentOrder === true &&
              (activeScenario !== "viewer-agent-chat-selection" ||
                result?.mathSerialized === true)
            );
          }, scenario)
        : true,
    hasPublicSiteAiChat:
      scenario === "viewer-site-ai-chat-main"
        ? bodyText.includes("Release Review Guide") &&
          bodyText.includes("What should I verify before this release?") &&
          bodyText.includes("Release review summary") &&
          bodyText.includes("Verify these items before publishing") &&
          bodyText.includes("AI Chat") &&
          bodyText.includes("Auto") &&
          bodyText.includes("Observe") &&
          !bodyText.includes("Mock") &&
          !bodyText.includes("IMP-") &&
          !bodyText.includes("/Users/") &&
          !bodyText.includes("protocol identifiers")
        : true,
    hasAgentMediaContext:
      scenario === "viewer-agent-chat-media-context"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_MEDIA_CHECK__;
            return (
              result?.historyMedia === true &&
              result?.pendingMedia === 0 &&
              result?.hasLocation === true &&
              result?.hasDiagramSource === true &&
              result?.ordered === true
            );
          })
        : true,
    hasAgentActiveFile:
      scenario === "viewer-agent-chat-active-file"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_ACTIVE_FILE_CHECK__;
            return (
              result?.initialFocusChipCount === 0 &&
              result?.firstFocusCount === 0 &&
              result?.firstActivePath?.endsWith("/docs/mvp-guide.adoc") &&
              result?.secondActivePath?.endsWith(
                "/docs/render-fixtures.adoc",
              ) &&
              result?.secondFocusCount === 1 &&
              typeof result?.secondFocusPath === "string" &&
              result.secondFocusPath !== result.secondActivePath
            );
          })
        : true,
    hasAgentSessionManagement:
      scenario === "viewer-agent-chat-session-management"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_SESSION_MANAGEMENT_CHECK__;
            return (
              result?.automaticTitleVisible === true &&
              result?.currentNamed === true &&
              result?.deleteConfirmation === true &&
              result?.readOnlyHistory === true &&
              result?.searchControlsHidden === true
            );
          })
        : true,
    hasAgentWorkspaceIsolation:
      scenario === "viewer-agent-chat-workspace-isolation"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_WORKSPACE_ISOLATION_CHECK__;
            return (
              result?.darkThemeMaintained === true &&
              result?.draftCleared === true &&
              result?.newConversationStarted === true &&
              result?.oldConversationCleared === true &&
              result?.panelMaintained === true
            );
          })
        : true,
    hasAgentMainBottomDock:
      scenario === "viewer-agent-chat-main-bottom-dock"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_MAIN_BOTTOM_DOCK_CHECK__;
            return (
              result?.bottomPlacement === true &&
              result?.bottomRestored === true &&
              result?.compactLayoutValid === true &&
              result?.darkThemeMaintained === true &&
              result?.diffDrawerMaintained === true &&
              result?.draftPreserved === true &&
              result?.resized === true &&
              result?.rightPlacementMaintained === true &&
              result?.rightSidebarHidden === true &&
              result?.splitReopenMaintained === true &&
              result?.splitViewMaintained === true &&
              result?.streamingMoveMaintained === true
            );
          })
        : true,
    hasAgentDetachedWindow:
      scenario === "viewer-agent-chat-detached-window"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_DETACHED_WINDOW_CHECK__;
            return (
              result?.bottomReattached === true &&
              JSON.stringify(result?.detachedMenuLabels) ===
                JSON.stringify(["Focus separate window", "Attach to Main"]) &&
              result?.diffDrawerClosedAfterDetach === true &&
              result?.diffDrawerReopenedAfterReattach === true &&
              JSON.stringify(result?.diffMenuLabels) ===
                JSON.stringify([
                  "Diff Preview",
                  "Separate window",
                  "Hide AI Chat",
                ]) &&
              result?.diffPreviewMaintained === true &&
              result?.draftPreserved === true &&
              result?.focusMaintainedSingleOwner === true &&
              result?.mainControllerRemoved === true &&
              result?.mainPanelFlashed === false &&
              JSON.stringify(result?.normalMenuLabels) ===
                JSON.stringify(["Right side", "Bottom", "Separate window"]) &&
              result?.reattached === true &&
              result?.rightSidebarRestored === true
            );
          })
        : true,
    hasAgentProviderSetup:
      scenario === "viewer-agent-chat-provider-setup"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_PROVIDER_SETUP_CHECK__;
            return (
              result?.compactLayoutValid === true &&
              result?.firstProbeCount === 1 &&
              result?.noChatCreated === true &&
              JSON.stringify(result?.readyMenuLabels) ===
                JSON.stringify(["Right side", "Bottom", "Separate window"]) &&
              result?.repeatedSetupRequest === true &&
              result?.setupLabel === true &&
              result?.visibleWithoutProvider === true &&
              result?.warningVisible === true
            );
          })
        : true,
    hasAgentComposerAccess:
      scenario === "viewer-agent-chat-composer-access"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_COMPOSER_ACCESS_CHECK__;
            return (
              result?.bottomMaintained === true &&
              result?.darkThemeMaintained === true &&
              result?.diffMaintained === true &&
              result?.draftPreserved === true &&
              result?.focusRestored === true &&
              result?.headerControlRemoved === true &&
              result?.initialObserve === true &&
              result?.insideViewport === true &&
              result?.opensAbove === true &&
              result?.popoverStayedOpen === true &&
              result?.rightMaintained === true &&
              result?.toolbarBelowInput === true
            );
          })
        : true,
    hasAgentContextPressure:
      scenario === "viewer-agent-chat-context-pressure"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_CONTEXT_PRESSURE_CHECK__;
            return (
              result?.automaticNoticeVisible === true &&
              result?.bottomMaintained === true &&
              result?.diffMaintained === true &&
              result?.draftPreserved === true &&
              result?.exactUsageVisible === true &&
              result?.gettingFullVisible === true &&
              result?.manualResultVisible === true &&
              result?.nearlyFullVisible === true &&
              result?.normalVisible === true &&
              result?.rightMaintained === true &&
              result?.sendSuppressed === true
            );
          })
        : true,
    hasAgentTokenDiagnostics:
      scenario === "viewer-agent-chat-token-diagnostics"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_TOKEN_DIAGNOSTICS_CHECK__;
            return (
              result?.bottomMaintained === true &&
              result?.compactReachable === true &&
              result?.comparisonVisible === true &&
              result?.darkThemeMaintained === true &&
              result?.diffMaintained === true &&
              result?.exactValuesVisible === true &&
              result?.insideCompactViewport === true &&
              result?.provenanceVisible === true
            );
          })
        : true,
    hasAgentContextProfile:
      scenario === "viewer-agent-chat-context-profile"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_CONTEXT_PROFILE_CHECK__;
            return (
              result?.bottomMaintained === true &&
              result?.boundaryVisible === true &&
              result?.darkThemeMaintained === true &&
              result?.diffMaintained === true &&
              result?.draftPreserved === true &&
              result?.focusedVisible === true &&
              result?.insideViewport === true &&
              result?.opensAbove === true &&
              result?.providerExtensionsSelected === true &&
              result?.rightMaintained === true
            );
          })
        : true,
  };
}
