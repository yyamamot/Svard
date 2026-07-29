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
import {
  reopenAgentContextForCapture,
  runAgentContextPressureScenario,
} from "./agentChatContextPressure.mjs";
import {
  exerciseAgentContextProfilePlacements,
  prepareAgentContextProfileScenario,
  reopenAgentContextProfileForCapture,
} from "./agentChatContextProfile.mjs";
import { runAgentWorkspaceIsolationScenario } from "./agentChatWorkspaceIsolation.mjs";
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
    if (scenario === "viewer-agent-chat-dark-theme") {
      await page.evaluate(async () => {
        await window.__SVARD_COMMANDS__?.dispatch("theme.toggle");
      });
      await page.locator(".app-shell.theme-dark").waitFor();
    }
    const initialRightSidebar =
      (await page.locator('[data-review-id="right-sidebar"]').count()) === 1;
    if (scenario === "viewer-agent-chat-media-context") {
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
      const paragraph = page
        .locator('[data-review-id="document-body"] p')
        .first();
      await paragraph.waitFor();
      const points = await paragraph.evaluate((element) => {
        const text = Array.from(element.childNodes).find(
          (node) => node instanceof Text && node.data.trim().length > 12,
        );
        if (!(text instanceof Text)) {
          throw new Error("No selectable viewer text");
        }
        const endOffset = Math.min(text.data.length, 12);
        const startRange = document.createRange();
        startRange.setStart(text, 0);
        startRange.collapse(true);
        const endRange = document.createRange();
        endRange.setStart(text, endOffset);
        endRange.collapse(true);
        const start = startRange.getBoundingClientRect();
        const end = endRange.getBoundingClientRect();
        return {
          start: { x: start.left + 1, y: start.top + start.height / 2 },
          end: { x: end.left - 1, y: end.top + end.height / 2 },
        };
      });
      await page.mouse.move(points.end.x, points.end.y);
      await page.mouse.down();
      await page.mouse.move(points.start.x, points.start.y, { steps: 6 });
      await page.mouse.up();
      await page.locator('[data-review-id="selection-mini-toolbar"]').waitFor();
      await page
        .locator('[data-review-id="selection-mini-toolbar"]')
        .getByRole("button", { name: "Ask AI" })
        .click();
    } else {
      await page.locator('[data-review-id="codex-spike-toggle"]').click();
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
      await prepareAgentContextProfileScenario({ composer, page });
    }

    if (scenario === "viewer-agent-chat-image-input") {
      const internalDragSource = page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: "git-untracked.md" });
      await internalDragSource.scrollIntoViewIfNeeded();
      const internalDragSourceBox = await internalDragSource.boundingBox();
      if (!internalDragSourceBox) {
        throw new Error("Agent internal drag source geometry is unavailable.");
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
      const internalDragPreviewVisible =
        (await internalDragPreview.isVisible()) &&
        (await internalDragPreview.locator("svg").count()) === 1 &&
        (await internalDragPreview.textContent())?.includes("git-untracked.md");
      await page.mouse.up();
      const attachSyntheticImage = async (kind, name) => {
        await composer.evaluate(
          (input, payload) => {
            const bytes = Uint8Array.from(atob(payload.base64), (character) =>
              character.charCodeAt(0),
            );
            const file = new File([bytes], payload.name, {
              type: "image/png",
            });
            const transfer = new DataTransfer();
            transfer.items.add(file);
            const event =
              payload.kind === "paste"
                ? new ClipboardEvent("paste", {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: transfer,
                  })
                : new DragEvent("drop", {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: transfer,
                  });
            (payload.kind === "paste"
              ? input
              : input.closest(".agent-composer-dock")
            )?.dispatchEvent(event);
          },
          {
            base64:
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
            kind,
            name,
          },
        );
      };
      await attachSyntheticImage("paste", "pasted-diagram.png");
      await page.waitForFunction(
        () =>
          document.querySelectorAll(".agent-image-chip:not(.error)").length ===
          1,
      );
      await page.getByRole("button", { name: "Add files or images" }).click();
      await page.getByRole("menuitem", { name: "Add images…" }).click();
      await page.waitForFunction(
        () =>
          document.querySelectorAll(".agent-image-chip:not(.error)").length ===
          2,
      );
      await attachSyntheticImage("drop", "dropped-diagram.png");
      await page.waitForFunction(
        () =>
          document.querySelectorAll(".agent-image-chip:not(.error)").length ===
          3,
      );
      await page
        .locator('[data-review-id="agent-image-attachments"]')
        .waitFor();
      const attachedBeforeRemove = await page
        .locator(".agent-image-chip:not(.error)")
        .count();
      await page
        .getByRole("button", { name: "Remove pasted-diagram.png" })
        .click();
      const attachedAfterRemove = await page
        .locator(".agent-image-chip:not(.error)")
        .count();
      await composer.press("Meta+Enter");
      await page.locator(".agent-message-images img").first().waitFor();
      await page.locator(".agent-final-answer").waitFor();
      await composer.fill("Continue checking the workspace.");
      await composer.press("Meta+Enter");
      await page
        .locator('.agent-turn[data-turn-status="running"]')
        .last()
        .waitFor();
      await attachSyntheticImage("paste", "next-question.png");
      await page.waitForFunction(
        () =>
          document.querySelectorAll(".agent-image-chip:not(.error)").length ===
          1,
      );
      const attachedWhileWorking =
        (await page.locator(".agent-image-chip:not(.error)").count()) === 1;
      await page.waitForFunction(
        () => document.querySelectorAll(".agent-final-answer").length >= 2,
      );
      await composer.fill("Inspect the attached image.");
      await composer.press("Meta+Enter");
      await page.waitForFunction(
        () =>
          document.querySelectorAll(".agent-message-images img").length >= 3 &&
          document.querySelectorAll(".agent-final-answer").length >= 3,
      );
      await page.evaluate(
        ({
          attachedAfterRemove,
          attachedBeforeRemove,
          attachedWhileWorking,
          internalDragPreviewVisible,
        }) => {
          window.__SVARD_AGENT_IMAGE_CHECK__ = {
            attachedAfterRemove,
            attachedBeforeRemove,
            attachedWhileWorking,
            internalDragPreviewVisible,
            historyImages: document.querySelectorAll(
              ".agent-message-images img",
            ).length,
            pendingImages: document.querySelectorAll(
              ".agent-image-chip:not(.error)",
            ).length,
          };
        },
        {
          attachedAfterRemove,
          attachedBeforeRemove,
          attachedWhileWorking,
          internalDragPreviewVisible,
        },
      );
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
    } else if (scenario === "viewer-agent-chat-approval") {
      await composer.fill("Approval is required for this workspace check.");
    } else if (scenario.endsWith("access") || scenario.endsWith("profile")) {
      // The scenario prepared its draft before opening the access menu.
    } else if (scenario === "viewer-agent-chat-context-pressure") {
      await composer.fill("Trigger automatic compaction for context pressure.");
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
    } else if (scenario === "viewer-agent-chat-change-review") {
      await composer.fill("Show change review.");
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
    if (scenario === "viewer-agent-chat-composer-access") {
      await exerciseAgentComposerAccessPlacements({ page });
    }
    if (scenario === "viewer-agent-chat-context-profile") {
      await exerciseAgentContextProfilePlacements({ page });
    }
    if (scenario === "viewer-agent-chat-context-pressure") {
      await runAgentContextPressureScenario({ composer, page });
    }
    if (scenario === "viewer-agent-chat-change-review") {
      await recordAgentChangeReviewScenario({ page });
    }
    if (scenario === "viewer-agent-chat-session-management") {
      await page.getByRole("button", { name: "Open chat history" }).click();
      const initialHistory = page.locator(
        '[data-review-id="agent-session-history"]',
      );
      await initialHistory.waitFor();
      await initialHistory
        .getByText("Explain how the focused files are", { exact: true })
        .waitFor();
      const automaticTitleVisible =
        (await initialHistory
          .getByText("Explain how the focused files are", { exact: true })
          .count()) === 1;
      await initialHistory
        .getByRole("button", { name: "Close chat history" })
        .click();
      await page.getByRole("button", { name: "Start new chat" }).click();
      await page.getByRole("button", { name: "Open chat history" }).click();
      const history = page.locator('[data-review-id="agent-session-history"]');
      await history.waitFor();
      await page.waitForFunction(
        () => document.querySelectorAll(".agent-session-item").length === 2,
      );
      let previous = history
        .locator(".agent-session-item")
        .filter({ hasNotText: "Current chat" });
      await previous.getByRole("button", { name: /^Rename /u }).click();
      await previous
        .getByRole("textbox", { name: "Chat name" })
        .fill("Document review");
      await previous.getByRole("button", { name: "Save chat name" }).click();
      await history.getByText("Document review", { exact: true }).waitFor();
      previous = history
        .locator(".agent-session-item")
        .filter({ hasText: "Document review" });
      await previous
        .getByRole("button", { name: "Archive Document review" })
        .click();
      await history.getByRole("tab", { name: "Archived" }).click();
      await history.getByText("Document review", { exact: true }).waitFor();
      await history
        .getByRole("button", { name: "Restore Document review" })
        .click();
      await history.getByRole("tab", { name: "Recent" }).click();
      await history.getByText("Document review", { exact: true }).waitFor();
      await history
        .locator(".agent-session-item")
        .filter({ hasText: "Document review" })
        .locator(".agent-session-open")
        .click();
      await history.waitFor({ state: "detached" });
      await page.locator(".agent-turn").first().waitFor();
      const restoredAnswer = page
        .locator('[data-review-id="agent-openui-response"]')
        .first();
      const readOnlyHistory =
        (await restoredAnswer.getAttribute("data-read-only")) === "true" &&
        (await restoredAnswer
          .locator('[data-review-id="agent-openui-action"]:enabled')
          .count()) === 0 &&
        (await page.locator(".agent-restored-context-note").count()) === 0 &&
        !(await page
          .locator('[data-review-id="agent-panel"]')
          .innerText()
          .then((text) => text.includes("root = SvardExperience")));
      await page.getByRole("button", { name: "Open chat history" }).click();
      await history.waitFor();
      const currentNamed =
        (await history
          .locator(".agent-session-item")
          .filter({ hasText: "Document review" })
          .filter({ hasText: "Current chat" })
          .count()) === 1;
      const inactive = history
        .locator(".agent-session-item")
        .filter({ hasNotText: "Current chat" });
      await inactive.getByRole("button", { name: /^Delete /u }).click();
      const deleteConfirmation =
        (await history.getByText("Delete this chat permanently?").count()) ===
        1;
      await history.getByRole("button", { name: "Cancel" }).click();
      await history.getByRole("button", { name: "Close chat history" }).click();
      await page.evaluate(
        ({
          automaticTitleVisible,
          currentNamed,
          deleteConfirmation,
          readOnlyHistory,
        }) => {
          window.__SVARD_AGENT_SESSION_MANAGEMENT_CHECK__ = {
            automaticTitleVisible,
            currentNamed,
            deleteConfirmation,
            readOnlyHistory,
          };
        },
        {
          automaticTitleVisible,
          currentNamed,
          deleteConfirmation,
          readOnlyHistory,
        },
      );
    }
    if (scenario === "viewer-agent-chat-workspace-isolation") {
      await runAgentWorkspaceIsolationScenario({ composer, page });
    }
    if (scenario === "viewer-agent-chat-main-bottom-dock") {
      await runAgentMainBottomDockScenario({ composer, page });
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
    if (
      scenario === "viewer-agent-chat-selection" ||
      scenario === "viewer-agent-chat-selection-image"
    ) {
      const submittedTurn = await page.evaluate(
        () => window.__SVARD_AGENT_LAST_TURN_INPUT__,
      );
      await page.evaluate((turn) => {
        const parts = turn?.contentParts ?? [];
        const imageIndex = parts.findIndex((part) => part.type === "image");
        window.__SVARD_AGENT_SELECTION_CHECK__ = {
          historySelections: document.querySelectorAll(
            ".agent-message-selections > span",
          ).length,
          pendingSelections: document.querySelectorAll(".agent-selection-card")
            .length,
          mixedContentOrder:
            imageIndex < 0 ||
            (parts
              .slice(0, imageIndex)
              .some((part) => part.type === "text" && part.text.trim()) &&
              parts
                .slice(imageIndex + 1)
                .some((part) => part.type === "text" && part.text.trim())),
        };
      }, submittedTurn);
    }
    if (scenario === "viewer-agent-chat-media-context") {
      const submittedTurn = await page.evaluate(
        () => window.__SVARD_AGENT_LAST_TURN_INPUT__,
      );
      await page.evaluate((turn) => {
        const parts = turn?.contentParts ?? [];
        const imageIndex = parts.findIndex((part) => part.type === "image");
        window.__SVARD_AGENT_MEDIA_CHECK__ = {
          historyMedia:
            document.querySelectorAll(
              ".agent-message-selections .agent-message-media-thumbnail",
            ).length > 0,
          pendingMedia: document.querySelectorAll(".agent-media-card").length,
          hasLocation: parts.some(
            (part) =>
              part.type === "text" &&
              part.text.includes(
                "Media from docs/asciidoc-comprehensive-visual.adoc",
              ),
          ),
          hasDiagramSource: parts.some(
            (part) =>
              part.type === "text" && part.text.includes("Diagram source"),
          ),
          ordered:
            imageIndex > 0 &&
            parts
              .slice(0, imageIndex)
              .some((part) => part.type === "text" && part.text.trim()) &&
            parts
              .slice(imageIndex + 1)
              .some((part) => part.type === "text" && part.text.trim()),
        };
      }, submittedTurn);
    }
    const reasoningVisible =
      (await page.locator(".agent-work-summary").count()) >= 1;
    const toolVisible = (await page.locator(".agent-activity").count()) >= 1;
    const activityFailureVisible =
      scenario !== "viewer-agent-chat-activity" ||
      (await page.locator(".agent-activity.failed").count()) === 1;
    const emptyActivityHidden =
      scenario !== "viewer-agent-chat-activity" ||
      (await page
        .locator('.agent-activity[data-activity-category="command"]')
        .count()) === 1;
    let groupedReadActivity = true;
    if (scenario === "viewer-agent-chat-activity") {
      await page.locator(".agent-work-summary > summary").click();
      groupedReadActivity =
        (await page
          .locator('.agent-activity[data-activity-category="read"]')
          .count()) === 1 &&
        (await page
          .locator('.agent-activity[data-activity-category="read"]')
          .getByText("2 operations")
          .count()) === 1;
    }
    const approvalResolved =
      scenario !== "viewer-agent-chat-approval" ||
      (await page.getByRole("button", { name: "Allow once" }).count()) === 0;
    const openUiVisible =
      (scenario !== "viewer-agent-chat-openui" &&
        scenario !== "viewer-agent-chat-openui-exploration" &&
        scenario !== "viewer-agent-chat-output-hygiene") ||
      (await page
        .locator('[data-review-id="agent-openui-response"]')
        .count()) >= 1;
    let explorationInteraction = true;
    if (scenario === "viewer-agent-chat-openui-exploration") {
      await page.locator('[data-review-id="agent-openui-grid"]').waitFor();
      await page.locator('[data-review-id="agent-openui-file-list"]').waitFor();
      const action = page
        .locator('[data-review-id="agent-openui-action"]')
        .first();
      await action.click();
      await page.waitForFunction(
        () => document.querySelectorAll(".agent-user-message").length >= 2,
      );
      explorationInteraction =
        (await page.locator(".agent-user-message").count()) >= 2;
    }
    if (scenario === "viewer-agent-chat-output-hygiene") {
      const panelText = await page
        .locator('[data-review-id="agent-panel"]')
        .innerText();
      const emptyDetails = await page
        .locator(
          ".agent-activity-detail:not(:has(strong)):not(:has(pre)):not(:has(small))",
        )
        .count();
      await page.evaluate(
        ({ emptyDetails, panelText }) => {
          window.__SVARD_AGENT_OUTPUT_HYGIENE_CHECK__ = {
            emptyDetails,
            hasInternalMemory: panelText.includes("MEMORY.md"),
            hasOpenUiRoot: panelText.includes("root ="),
            hasZeroDuration: panelText.includes("0 ms"),
            workspaceReadVisible:
              document.querySelectorAll(
                '.agent-activity[data-activity-category="read"]',
              ).length >= 1,
          };
        },
        { emptyDetails, panelText },
      );
    }
    let markdownAnswerVisible = true;
    let externalLinkConfirmationVisible = true;
    if (scenario === "viewer-agent-chat-markdown-answer") {
      const answer = page.locator(".agent-markdown-answer").last();
      await answer
        .locator("code")
        .filter({ hasText: "docs/guide.md" })
        .waitFor();
      markdownAnswerVisible =
        (await answer.locator("strong").count()) >= 1 &&
        (await answer.locator("table").count()) === 1 &&
        (await answer.locator("pre code").count()) === 1;
      await answer
        .getByRole("link", { name: "Open external documentation" })
        .click();
      externalLinkConfirmationVisible =
        (await page
          .locator('[data-review-id="external-link-confirmation-dialog"]')
          .count()) === 1;
      await page.getByRole("button", { name: "Cancel" }).click();
    }
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
    await page.locator('[data-review-id="codex-spike-toggle"]').click();
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
      await reopenAgentContextForCapture({ page });
    }
    if (scenario === "viewer-agent-chat-context-profile") {
      await reopenAgentContextProfileForCapture({ page });
    }
    if (shouldRestoreAgentViewport(scenario)) {
      await page.setViewportSize({ width: 1280, height: 840 });
      await page.locator('[data-review-id="left-sidebar"]').waitFor();
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
        reasoningVisible,
        rightSidebarRestored,
        toolVisible,
      },
    );
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
