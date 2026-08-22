import { runAgentChatUsabilityScenario } from "./agentChatUsability.mjs";
import {
  recordAgentMainBottomStreamingMove,
  runAgentMainBottomDockScenario,
} from "./agentChatMainBottomDock.mjs";
import {
  confirmAgentComposerFullAccess,
  exerciseAgentComposerAccessPlacements,
  prepareAgentComposerAccessScenario,
  reopenAgentComposerAccessForCapture,
} from "./agentChatComposerAccess.mjs";
import { agentChatContextScenarios } from "./agentChatContextScenarios.mjs";
import { runAgentWorkspaceIsolationScenario } from "./agentChatWorkspaceIsolation.mjs";
import { runAgentDetachedWindowScenario } from "./agentChatDetachedWindow.mjs";
import { selectAgentChatDisplay } from "./agentChatDisplayMenu.mjs";
import { runAgentChatProviderSetupScenario } from "./agentChatProviderSetup.mjs";
import { runAgentChatDisconnectRecoveryScenario } from "./agentChatDisconnectRecovery.mjs";
import { runAgentImageInputScenario } from "./agentChatImageInput.mjs";
import { runAgentSessionManagementScenario } from "./agentChatSessionManagement.mjs";
import { recordAgentSelectionMediaChecks } from "./agentChatSelectionMedia.mjs";
import { collectAgentChatResultChecks } from "./agentChatResultChecks.mjs";
import {
  recordAgentChangeReviewScenario,
  isAgentChatScenario,
  runAgentRunningInputScenario,
  shouldRestoreAgentViewport,
  usesResponsiveAgentViewport,
} from "./agentChatRunningControls.mjs";
export async function applyAppShellAgentChatScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (isAgentChatScenario(scenario)) {
    if (usesResponsiveAgentViewport(scenario)) {
      await page.setViewportSize({ width: 1280, height: 840 });
    }
    if (scenario === "viewer-agent-chat-provider-setup") {
      await runAgentChatProviderSetupScenario({ page });
      return true;
    }
    if (scenario === "viewer-agent-chat-dark-theme") {
      await page.evaluate(async () => {
        await window.__SVARD_COMMANDS__?.dispatch("theme.toggle");
      });
      await page.locator(".app-shell.theme-dark").waitFor();
    }
    const initialRightSidebar =
      (await page.locator('[data-review-id="right-sidebar"]').count()) === 1;
    if (scenario === "viewer-site-ai-chat-main") {
      await page.evaluate(() => {
        window.__SVARD_DOCUMENT_OVERRIDES__ = {
          ...(window.__SVARD_DOCUMENT_OVERRIDES__ ?? {}),
          "/workspace/docs/preferences.adoc": {
            source: `= Release Review Guide
:toc:

This guide keeps the release scope, verification steps, and follow-up checks together for reviewers.

== Release checklist

Confirm the supported platforms, verify the rendered documentation, and record any checks that still need an owner.

== Verification

Review the installer, open the sample documents, and confirm that diagrams and links behave as expected.

== Follow-up

Capture unresolved items before publishing the release notes.
`,
          },
        };
      });
      await page
        .locator(
          '[data-review-id="tree-file"][data-path="/workspace/docs/preferences.adoc"]',
        )
        .click();
      await page
        .locator('[data-review-id="document-body"] h1')
        .filter({ hasText: "Release Review Guide" })
        .waitFor();
      await page.evaluate(async () => {
        const leftSidebar = document.querySelector(
          '[data-review-id="left-sidebar"]',
        );
        if (leftSidebar) {
          await window.__SVARD_COMMANDS__?.dispatch("sidebar.toggleLeft");
        }
      });
      const paragraph = page
        .locator('[data-review-id="document-body"] p')
        .first();
      await paragraph.waitFor();
      await paragraph.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        element.dispatchEvent(new Event("selectionchange", { bubbles: true }));
        element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      });
      await page.locator('[data-review-id="selection-mini-toolbar"]').waitFor();
      await page
        .locator('[data-review-id="selection-mini-toolbar"]')
        .getByRole("button", { name: "Ask AI" })
        .click();
    } else if (scenario === "viewer-agent-chat-media-context") {
      await page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: "asciidoc-comprehensive-visual.adoc" })
        .click();
      await page
        .locator('[data-review-id="active-document-title"]')
        .filter({ hasText: "asciidoc-comprehensive-visual.adoc" })
        .waitFor();
      const diagram = page
        .locator(
          '[data-review-id="document-body"] [data-diagram-id] svg, [data-review-id="document-body"] [data-diagram-id] img',
        )
        .first();
      await diagram.waitFor();
      await diagram.scrollIntoViewIfNeeded();
      await diagram.click({ button: "right" });
      await page
        .locator('[data-review-id="context-menu"]')
        .getByRole("menuitem", { name: "Ask AI" })
        .click();
    } else if (scenario === "viewer-agent-chat-selection-image") {
      await page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: "asciidoc-comprehensive-visual.adoc" })
        .click();
      await page
        .locator('[data-review-id="active-document-title"]')
        .filter({ hasText: "asciidoc-comprehensive-visual.adoc" })
        .waitFor();
      const article = page.locator('[data-review-id="document-body"]');
      const image = article.locator(
        'img[data-image-path="assets/svard-sample.svg"]',
      );
      await image.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () => {
          const target = document.querySelector(
            '[data-review-id="document-body"] img[data-image-path="assets/svard-sample.svg"]',
          );
          return target instanceof HTMLImageElement && target.naturalWidth > 0;
        },
        { timeout: 10_000 },
      );
      await article.evaluate((element) => {
        const image = element.querySelector(
          'img[data-image-path="assets/svard-sample.svg"]',
        );
        const imageSection = Array.from(element.querySelectorAll("h2")).find(
          (heading) => heading.textContent?.includes("Image"),
        );
        const linksSection = Array.from(element.querySelectorAll("h2")).find(
          (heading) => heading.textContent?.includes("Links and Xrefs"),
        );
        if (!image || !imageSection || !linksSection) {
          throw new Error("Mixed selection fixture is unavailable");
        }
        const range = document.createRange();
        range.setStart(imageSection, 0);
        range.setEnd(linksSection, linksSection.childNodes.length);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        element.dispatchEvent(new Event("selectionchange", { bubbles: true }));
        element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      });
      await page.locator('[data-review-id="selection-mini-toolbar"]').waitFor();
      await page
        .locator('[data-review-id="selection-mini-toolbar"]')
        .getByRole("button", { name: "Ask AI" })
        .click();
    } else if (scenario === "viewer-agent-chat-selection") {
      await page.evaluate(() => {
        window.__SVARD_DOCUMENT_OVERRIDES__ = {
          ...(window.__SVARD_DOCUMENT_OVERRIDES__ ?? {}),
          "/workspace/docs/preferences.adoc": {
            source: String.raw`= Agent Math

本章は単一ヘッドなので、stem:[D_{\mathrm{head}}=D_{\mathrm{model}}=3]です。`,
          },
        };
      });
      await page
        .locator(
          '[data-review-id="tree-file"][data-path="/workspace/docs/preferences.adoc"]',
        )
        .click();
      const paragraph = page
        .locator('[data-review-id="document-body"] p')
        .first();
      await paragraph.waitFor();
      await paragraph.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        element.dispatchEvent(new Event("selectionchange", { bubbles: true }));
        element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      });
      await page.locator('[data-review-id="selection-mini-toolbar"]').waitFor();
      await page
        .locator('[data-review-id="selection-mini-toolbar"]')
        .getByRole("button", { name: "Ask AI" })
        .click();
    } else {
      await selectAgentChatDisplay(page, "Right side", {
        source: "topbar",
      });
    }
    const composer = page.getByPlaceholder(
      "Ask about this workspace · ⌘/Ctrl+Enter to send",
    );
    await composer.waitFor();
    if (scenario === "viewer-agent-chat-session-management") {
      await page.getByRole("button", { name: "Open chat history" }).click();
      const idleHistory = page.locator(
        '[data-review-id="agent-session-history"]',
      );
      await idleHistory.waitFor();
      if ((await idleHistory.locator(".agent-session-item").count()) !== 0) {
        throw new Error("Opening AI Chat created an empty saved session.");
      }
      await idleHistory
        .getByRole("button", { name: "Close chat history" })
        .click();
    }
    const darkControlsThemed =
      scenario !== "viewer-agent-chat-dark-theme" ||
      (await page
        .locator(".codex-panel-actions .button")
        .first()
        .evaluate((control) => {
          const style = getComputedStyle(control);
          return (
            style.backgroundColor !== "rgb(255, 255, 255)" &&
            style.color !== "rgb(23, 32, 38)"
          );
        }));
    const initialFocusChipCount =
      scenario === "viewer-agent-chat-active-file"
        ? await page.locator(".agent-focus-files > span").count()
        : 0;
    const panelBox = await page
      .locator('[data-review-id="agent-panel"]')
      .boundingBox();
    const composerBox = await page
      .locator(".agent-composer-dock")
      .boundingBox();
    const composerBottomAligned = Boolean(
      panelBox &&
      composerBox &&
      Math.abs(
        panelBox.y + panelBox.height - (composerBox.y + composerBox.height),
      ) <= 4,
    );
    if (scenario === "viewer-agent-chat-composer-access") {
      await prepareAgentComposerAccessScenario({ composer, page });
    }
    if (scenario === "viewer-agent-chat-context-profile") {
      await agentChatContextScenarios.profile.prepare({ composer, page });
    }
    if (scenario === "viewer-agent-chat-image-input") {
      await runAgentImageInputScenario({ composer, page });
    } else if (scenario === "viewer-agent-chat-openui") {
      const responseMode = page.locator(
        '[data-review-id="agent-response-mode"]',
      );
      await responseMode.click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-review-id="agent-response-mode"]')
            ?.getAttribute("aria-pressed") === "true",
      );
      await composer.fill("Visualize the workspace boundaries.");
    } else if (scenario === "viewer-agent-chat-openui-exploration") {
      const responseMode = page.locator(
        '[data-review-id="agent-response-mode"]',
      );
      await responseMode.click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-review-id="agent-response-mode"]')
            ?.getAttribute("aria-pressed") === "true",
      );
      await composer.fill("Build an OpenUI dashboard for this workspace.");
    } else if (
      scenario === "viewer-agent-chat-openui-basic-review" ||
      scenario === "viewer-agent-chat-openui-basic-gallery" ||
      scenario === "viewer-agent-chat-openui-basic-balanced" ||
      scenario === "viewer-agent-chat-openui-basic-lean" ||
      scenario === "viewer-agent-chat-openui-limit-diagnostics" ||
      scenario === "viewer-agent-chat-openui-component-challengers"
    ) {
      const responseMode = page.locator(
        '[data-review-id="agent-response-mode"]',
      );
      await responseMode.click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-review-id="agent-response-mode"]')
            ?.getAttribute("aria-pressed") === "true",
      );
      const prompts = {
        "viewer-agent-chat-openui-basic-review":
          "Show the OpenUI basic profile review.",
        "viewer-agent-chat-openui-basic-gallery":
          "Show the OpenUI basic profile gallery.",
        "viewer-agent-chat-openui-basic-balanced":
          "Show the OpenUI balanced profile comparison.",
        "viewer-agent-chat-openui-basic-lean":
          "Show the OpenUI lean profile comparison.",
        "viewer-agent-chat-openui-limit-diagnostics":
          "Show the OpenUI balanced limit diagnostic.",
        "viewer-agent-chat-openui-component-challengers":
          "Show the OpenUI component challengers.",
      };
      await composer.fill(prompts[scenario]);
    } else if (scenario === "viewer-agent-chat-approval") {
      await composer.fill("Approval is required for this workspace check.");
    } else if (scenario.endsWith("access") || scenario.endsWith("profile")) {
      // The scenario prepared its draft before opening the access menu.
    } else if (scenario === "viewer-agent-chat-context-pressure") {
      await composer.fill("Trigger automatic compaction for context pressure.");
    } else if (scenario === "viewer-agent-chat-token-diagnostics") {
      await composer.fill("Report token usage diagnostics.");
    } else if (scenario === "viewer-agent-chat-activity") {
      await composer.fill("Show activity failure handling.");
    } else if (scenario === "viewer-agent-chat-output-hygiene") {
      const responseMode = page.locator(
        '[data-review-id="agent-response-mode"]',
      );
      await responseMode.click();
      await composer.fill("Visualize output hygiene.");
    } else if (scenario === "viewer-agent-chat-markdown-answer") {
      await composer.fill("Show the Markdown answer example.");
    } else if (scenario === "viewer-agent-chat-conversation-usability") {
      await composer.fill(
        "Show the Markdown answer after approval cancellation.",
      );
    } else if (scenario === "viewer-agent-chat-running-input-control") {
      await composer.fill("Explain the current implementation.");
    } else if (scenario === "viewer-agent-chat-disconnect-recovery") {
      await composer.fill("Unexpected disconnect during approval.");
    } else if (scenario === "viewer-agent-chat-change-review") {
      await composer.fill("Show change review.");
    } else if (scenario === "viewer-site-ai-chat-main") {
      await page
        .locator('[data-review-id="agent-selection-attachments"]')
        .waitFor();
      await composer.fill("What should I verify before this release?");
    } else if (
      scenario === "viewer-agent-chat-selection" ||
      scenario === "viewer-agent-chat-selection-image"
    ) {
      await page
        .locator('[data-review-id="agent-selection-attachments"]')
        .waitFor();
      await composer.fill("Explain only the selected content.");
    } else if (scenario === "viewer-agent-chat-media-context") {
      await page
        .locator('[data-review-id="agent-media-attachments"]')
        .waitFor();
      await composer.fill("Explain this diagram.");
    } else if (scenario === "viewer-agent-chat-active-file") {
      await composer.fill("Which file am I currently viewing?");
    } else if (scenario === "viewer-agent-chat-session-management") {
      const responseMode = page.locator(
        '[data-review-id="agent-response-mode"]',
      );
      await responseMode.click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-review-id="agent-response-mode"]')
            ?.getAttribute("aria-pressed") === "true",
      );
      await composer.fill("Explain how the focused files are related.");
    } else {
      await composer.fill("Explain how the focused files are related.");
    }
    if (scenario === "viewer-agent-chat-disconnect-recovery") {
      await runAgentChatDisconnectRecoveryScenario({ composer, page });
      return true;
    }
    if (scenario === "viewer-agent-chat-conversation-usability") {
      await runAgentChatUsabilityScenario({ composer, page });
    } else if (scenario !== "viewer-agent-chat-image-input") {
      await composer.press("Meta+Enter");
    }
    if (scenario === "viewer-agent-chat-composer-access") {
      await confirmAgentComposerFullAccess({ page });
    }
    if (scenario === "viewer-agent-chat-main-bottom-dock") {
      await recordAgentMainBottomStreamingMove({ composer, page });
    }
    if (scenario === "viewer-agent-chat-running-input-control") {
      await runAgentRunningInputScenario({ composer, page });
    }
    let currentActivityVisible = true;
    if (
      scenario === "viewer-agent-chat-activity" ||
      scenario === "viewer-agent-chat-output-hygiene"
    ) {
      await page.locator(".agent-current-activity").waitFor();
      currentActivityVisible =
        (await page.locator(".agent-current-activity").count()) === 1;
    }
    if (scenario === "viewer-agent-chat-approval") {
      await page.getByRole("button", { name: "Allow once" }).waitFor();
      await page.getByRole("button", { name: "Allow once" }).click();
    }
    if (
      scenario === "viewer-agent-chat-openui" ||
      scenario === "viewer-agent-chat-openui-exploration" ||
      scenario === "viewer-agent-chat-openui-basic-review" ||
      scenario === "viewer-agent-chat-openui-basic-gallery" ||
      scenario === "viewer-agent-chat-openui-basic-balanced" ||
      scenario === "viewer-agent-chat-openui-basic-lean" ||
      scenario === "viewer-agent-chat-openui-limit-diagnostics" ||
      scenario === "viewer-agent-chat-openui-component-challengers" ||
      scenario === "viewer-agent-chat-output-hygiene" ||
      scenario === "viewer-agent-chat-session-management"
    ) {
      await page.waitForFunction(
        () =>
          document.querySelector(
            '[data-review-id="agent-openui-response"], [data-review-id="agent-openui-fallback"]',
          ) !== null,
      );
    } else if (scenario !== "viewer-agent-chat-image-input") {
      await page.locator(".agent-final-answer").last().waitFor();
    }
    if (scenario !== "viewer-agent-chat-image-input") {
      await page.waitForFunction(() => {
        const turns = document.querySelectorAll(".agent-turn");
        return (
          turns[turns.length - 1]?.getAttribute("data-turn-status") ===
          "completed"
        );
      });
    }
    let openUiEvaluationWideLayout = true;
    if (
      scenario === "viewer-agent-chat-openui-basic-review" ||
      scenario === "viewer-agent-chat-openui-basic-gallery" ||
      scenario === "viewer-agent-chat-openui-basic-balanced" ||
      scenario === "viewer-agent-chat-openui-basic-lean"
    ) {
      await selectAgentChatDisplay(page, "Bottom");
      const split = page.locator(
        '[data-review-id="codex-main-split"][data-agent-placement="bottom"]',
      );
      await split.waitFor();
      const resizer = page.locator(".codex-main-resizer");
      for (let step = 0; step < 16; step += 1) {
        await resizer.press("ArrowUp");
      }
      await page.evaluate(async () => {
        await window.__SVARD_COMMANDS__?.dispatch("sidebar.toggleLeft");
      });
      await page
        .locator('[data-review-id="left-sidebar"]')
        .waitFor({ state: "detached" });
      openUiEvaluationWideLayout =
        (await split.getAttribute("data-agent-placement")) === "bottom";
    }
    if (scenario === "viewer-agent-chat-composer-access") {
      await exerciseAgentComposerAccessPlacements({ page });
    }
    if (scenario === "viewer-agent-chat-context-profile") {
      await agentChatContextScenarios.profile.run({ page });
    }
    if (scenario === "viewer-agent-chat-context-pressure") {
      await agentChatContextScenarios.pressure.run({ composer, page });
    }
    if (scenario === "viewer-agent-chat-token-diagnostics")
      await agentChatContextScenarios.tokenDiagnostics.run({ page });
    if (scenario === "viewer-agent-chat-change-review") {
      await recordAgentChangeReviewScenario({ page });
    }
    if (scenario === "viewer-agent-chat-session-management") {
      await runAgentSessionManagementScenario({ page });
    }
    if (scenario === "viewer-agent-chat-workspace-isolation") {
      await runAgentWorkspaceIsolationScenario({ composer, page });
    }
    if (scenario === "viewer-agent-chat-main-bottom-dock") {
      await runAgentMainBottomDockScenario({ composer, page });
    }
    if (scenario === "viewer-agent-chat-detached-window") {
      await runAgentDetachedWindowScenario({ composer, page });
    }
    if (scenario === "viewer-agent-chat-active-file") {
      const firstTurn = await page.evaluate(
        () => window.__SVARD_AGENT_LAST_TURN_INPUT__,
      );
      let targetDocument = page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: "render-fixtures.adoc" });
      if ((await targetDocument.count()) === 0) {
        await page
          .locator('[data-review-id="tree-folder-toggle"]')
          .filter({ hasText: "docs" })
          .click();
        targetDocument = page
          .locator('[data-review-id="tree-file"]')
          .filter({ hasText: "render-fixtures.adoc" });
      }
      await targetDocument.click();
      await page
        .locator('[data-review-id="active-document-title"]')
        .filter({ hasText: "render-fixtures.adoc" })
        .waitFor();
      await page.getByRole("button", { name: "Add files or images" }).click();
      await page.getByRole("menuitem", { name: "Add files…" }).click();
      await page.locator(".agent-focus-files > span").waitFor();
      await composer.fill("Relate this file to the explicitly focused file.");
      await composer.press("Meta+Enter");
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.agent-turn[data-turn-status="completed"]')
            .length >= 2,
      );
      const secondTurn = await page.evaluate(
        () => window.__SVARD_AGENT_LAST_TURN_INPUT__,
      );
      await page.evaluate(
        ({ firstTurn, initialFocusChipCount, secondTurn }) => {
          window.__SVARD_AGENT_ACTIVE_FILE_CHECK__ = {
            initialFocusChipCount,
            firstActivePath: firstTurn?.activeFile?.path ?? null,
            firstFocusCount: firstTurn?.focusFiles?.length ?? -1,
            secondActivePath: secondTurn?.activeFile?.path ?? null,
            secondFocusCount: secondTurn?.focusFiles?.length ?? -1,
            secondFocusPath: secondTurn?.focusFiles?.[0]?.path ?? null,
          };
        },
        { firstTurn, initialFocusChipCount, secondTurn },
      );
    }
    await recordAgentSelectionMediaChecks({ page, scenario });
    const {
      activityFailureVisible,
      approvalResolved,
      emptyActivityHidden,
      explorationInteraction,
      externalLinkConfirmationVisible,
      groupedReadActivity,
      markdownAnswerVisible,
      openUiEvaluationVisible,
      openUiLimitDiagnosticsVisible,
      openUiVisible,
      reasoningVisible,
      toolVisible,
    } = await collectAgentChatResultChecks({
      page,
      scenario,
    });
    await page
      .locator('[data-review-id="agent-panel"]')
      .getByRole("button", { name: "Close AI Chat" })
      .click();
    await page
      .locator('[data-review-id="codex-main-split"]')
      .waitFor({ state: "detached" });
    await page.locator('[data-review-id="right-sidebar"]').waitFor();
    const rightSidebarRestored =
      (await page.locator('[data-review-id="right-sidebar"]').count()) === 1;
    if (usesResponsiveAgentViewport(scenario)) {
      await page.setViewportSize({ width: 960, height: 640 });
    }
    await selectAgentChatDisplay(page, "Right side", {
      source: "topbar",
    });
    await page.locator('[data-review-id="agent-panel"]').waitFor();
    let compactComposerBottomAligned = true;
    if (usesResponsiveAgentViewport(scenario)) {
      await page.locator(".agent-conversation").evaluate((conversation) => {
        conversation.scrollTop = 0;
      });
      const compactPanelBox = await page
        .locator('[data-review-id="agent-panel"]')
        .boundingBox();
      const compactComposerBox = await page
        .locator(".agent-composer-dock")
        .boundingBox();
      compactComposerBottomAligned = Boolean(
        compactPanelBox &&
        compactComposerBox &&
        Math.abs(
          compactPanelBox.y +
            compactPanelBox.height -
            (compactComposerBox.y + compactComposerBox.height),
        ) <= 4,
      );
    }
    if (scenario === "viewer-agent-chat-composer-access") {
      await reopenAgentComposerAccessForCapture({ page });
    }
    if (scenario === "viewer-agent-chat-context-pressure") {
      await agentChatContextScenarios.pressure.reopen({ page });
    }
    if (scenario === "viewer-agent-chat-token-diagnostics")
      await agentChatContextScenarios.tokenDiagnostics.reopen({ page });
    if (scenario === "viewer-agent-chat-context-profile") {
      await agentChatContextScenarios.profile.reopen({ page });
    }
    if (shouldRestoreAgentViewport(scenario)) {
      await page.setViewportSize({ width: 1280, height: 840 });
      await page.locator('[data-review-id="left-sidebar"]').waitFor();
    }
    if (
      scenario === "viewer-agent-chat-openui-basic-review" ||
      scenario === "viewer-agent-chat-openui-basic-gallery" ||
      scenario === "viewer-agent-chat-openui-basic-balanced" ||
      scenario === "viewer-agent-chat-openui-basic-lean" ||
      scenario === "viewer-agent-chat-openui-component-challengers"
    ) {
      await page
        .locator('[data-review-id="agent-openui-response"]')
        .last()
        .evaluate((answer) => {
          const conversation = answer.closest(".agent-conversation");
          if (!(conversation instanceof HTMLElement)) return;
          const answerBox = answer.getBoundingClientRect();
          const conversationBox = conversation.getBoundingClientRect();
          conversation.scrollLeft = 0;
          conversation.scrollTop += answerBox.top - conversationBox.top - 8;
        });
    }
    await page.evaluate(
      (result) => {
        window.__SVARD_AGENT_STAGE5_CHECK__ = result;
      },
      {
        approvalResolved,
        activityFailureVisible,
        compactComposerBottomAligned,
        composerBottomAligned,
        currentActivityVisible,
        darkControlsThemed,
        explorationInteraction,
        emptyActivityHidden,
        groupedReadActivity,
        initialRightSidebar,
        markdownAnswerVisible,
        externalLinkConfirmationVisible,
        openUiVisible,
        openUiEvaluationVisible,
        openUiEvaluationWideLayout,
        openUiLimitDiagnosticsVisible,
        reasoningVisible,
        rightSidebarRestored,
        toolVisible,
      },
    );
    if (scenario === "viewer-agent-chat-detached-window") {
      await page
        .locator('[data-review-id="agent-panel"]')
        .locator('[data-review-id="agent-display-menu-trigger"]')
        .click();
      await page.locator('[data-review-id="agent-display-menu"]').waitFor();
    }
    if (scenario === "viewer-agent-chat-session-management") {
      await page.setViewportSize({ width: 1280, height: 840 });
      await page.locator('[data-review-id="left-sidebar"]').waitFor();
      await page.locator('[data-review-id="shell"]').evaluate((shell) => {
        shell.style.setProperty("--left-sidebar-width", "356px");
      });
      await page.getByRole("button", { name: "Open chat history" }).click();
      await page.locator('[data-review-id="agent-session-history"]').waitFor();
    }
  } else {
    return false;
  }
  return true;
}
