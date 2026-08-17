import type { SiteScreenshotScenarioContext } from "./types";

const publicDocumentPath = "/workspace/docs/preferences.adoc";
const publicQuestion = "What should I verify before this release?";

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function waitForElement<T extends Element>(
  selector: string,
  timeoutMs = 10_000,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const element = document.querySelector<T>(selector);
    if (element) return element;
    await delay(50);
  }
  throw new Error(`Timed out waiting for screenshot element: ${selector}`);
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function installPublicDocumentOverride() {
  const target = window as typeof window & {
    __SVARD_DOCUMENT_OVERRIDES__?: Record<
      string,
      { source: string; updatedAt?: string }
    >;
  };
  target.__SVARD_DOCUMENT_OVERRIDES__ = {
    ...(target.__SVARD_DOCUMENT_OVERRIDES__ ?? {}),
    [publicDocumentPath]: {
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
}

export async function runAgentChatScenarios(
  context: SiteScreenshotScenarioContext,
) {
  if (context.scenario !== "viewer-site-ai-chat-main") return false;

  installPublicDocumentOverride();
  context.closeAllTabs();
  await context.openDocument(publicDocumentPath);
  context.setConfig((current) =>
    current
      ? {
          ...current,
          sidebarVisible: false,
          rightSidebarVisible: false,
        }
      : current,
  );

  const heading = await waitForElement<HTMLElement>(
    '[data-review-id="document-body"] h1',
  );
  if (!heading.textContent?.includes("Release Review Guide")) {
    throw new Error("Public AI Chat document did not render.");
  }
  if (document.querySelector('[data-review-id="left-sidebar"]')) {
    await window.__SVARD_COMMANDS__?.dispatch("sidebar.toggleLeft");
    await delay(150);
  }
  const paragraph = await waitForElement<HTMLElement>(
    '[data-review-id="document-body"] p',
  );
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  paragraph.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  paragraph.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

  const toolbar = await waitForElement<HTMLElement>(
    '[data-review-id="selection-mini-toolbar"]',
  );
  const askButton = Array.from(toolbar.querySelectorAll("button")).find(
    (button) => button.textContent?.includes("Ask AI"),
  );
  if (!askButton) throw new Error("Ask AI selection action is unavailable.");
  askButton.click();

  const composer = await waitForElement<HTMLTextAreaElement>(
    'textarea[placeholder^="Ask about this workspace"]',
  );
  await waitForElement('[data-review-id="agent-selection-attachments"]');
  setTextareaValue(composer, publicQuestion);
  composer.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter",
      metaKey: true,
    }),
  );

  await waitForElement(".agent-final-answer");
  await delay(250);
  return true;
}
