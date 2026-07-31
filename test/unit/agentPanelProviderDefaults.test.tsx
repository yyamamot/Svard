import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import { defaultConfig } from "../../src/core/defaultConfig";
import type {
  AgentEvent,
  AgentSessionInfo,
  AgentSessionStartInput,
  AgentTurnInput,
  AgentTurnOutcome,
  AppConfig,
} from "../../src/core/types";
import { AgentPanelHost } from "../../src/ui/agent/AgentPanelHost";
import { svardOpenUiBalancedPrompt } from "../../src/ui/codex/openUiLibrary";
import { codexContextPointerDragStartEvent } from "../../src/ui/lib/fileCompareDrag";
import {
  createReactRootHarness,
  type ReactRootHarness,
} from "./helpers/reactHarness";

class RecordingMockHostAdapter extends MockHostAdapter {
  readonly sessionInputs: AgentSessionStartInput[] = [];
  readonly turnInputs: AgentTurnInput[] = [];
  failNextStart = false;

  override async startAgentSession(
    input: AgentSessionStartInput,
    onEvent: (event: AgentEvent) => void,
  ): Promise<AgentSessionInfo> {
    this.sessionInputs.push(structuredClone(input));
    if (this.failNextStart) {
      this.failNextStart = false;
      throw new Error("Synthetic session start failure.");
    }
    return super.startAgentSession(input, onEvent);
  }

  override async sendAgentTurn(
    input: AgentTurnInput,
  ): Promise<AgentTurnOutcome> {
    this.turnInputs.push(structuredClone(input));
    return super.sendAgentTurn(input);
  }
}

describe("AgentPanelHost provider defaults", () => {
  let harness: ReactRootHarness;
  let host: RecordingMockHostAdapter;
  let config: AppConfig;

  beforeEach(() => {
    harness = createReactRootHarness();
    host = new RecordingMockHostAdapter();
    config = structuredClone(defaultConfig);
  });

  afterEach(() => {
    harness.cleanup();
  });

  function render(open: boolean) {
    harness.render(
      <AgentPanelHost
        activeDocument={null}
        host={host}
        open={open}
        onClose={() => {}}
        providerConfig={config.agentProviders}
        workspaceRoot="/workspace"
      />,
    );
  }

  async function sendQuestion(question: string) {
    const composer =
      harness.container.querySelector<HTMLTextAreaElement>("textarea");
    await harness.setTextAreaValue(composer, question);
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector<HTMLButtonElement>(
          '[aria-label="Send"]',
        )?.disabled,
      ).toBe(false),
    );
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>('[aria-label="Send"]'),
    );
  }

  it("uses preferences loaded after the persistent panel first mounted", async () => {
    render(false);
    config.agentProviders.codex.permissionMode = "agent";
    config.agentProviders.codex.networkAccess = true;
    config.agentProviders.codex.webSearch = true;
    render(true);

    expect(host.sessionInputs).toHaveLength(0);
    await sendQuestion("Use the latest settings");
    await vi.waitFor(() => expect(host.sessionInputs).toHaveLength(1));

    expect(host.sessionInputs[0]).toMatchObject({
      permissionMode: "agent",
      networkAccess: true,
      webSearch: true,
    });
  });

  it("keeps the conversation visible without a focused-answer toggle", () => {
    render(true);

    expect(
      harness.container.querySelector('[aria-label="Hide Chat"]'),
    ).toBeNull();
    expect(
      harness.container.querySelector('[aria-label="Show Chat"]'),
    ).toBeNull();
    expect(harness.container.querySelector(".agent-conversation")).toBeTruthy();
  });

  it("moves Agent access below the question input", async () => {
    render(true);

    expect(
      harness.container.querySelector('[aria-label="Agent settings"]'),
    ).toBeNull();
    const textarea =
      harness.container.querySelector<HTMLTextAreaElement>("textarea");
    const trigger = harness.container.querySelector<HTMLButtonElement>(
      '[data-review-id="agent-access-trigger"]',
    );
    if (!textarea || !trigger) {
      throw new Error("Composer access controls are unavailable.");
    }
    expect(trigger?.getAttribute("aria-label")).toBe("Agent access: Observe");
    expect(
      textarea.compareDocumentPosition(trigger) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await harness.click(trigger);
    const popover = document.querySelector(
      '[data-review-id="agent-access-popover"]',
    );
    expect(popover?.textContent).toContain(
      "Changing access or context profile starts a new chat",
    );
    const agentRadio = [...popover!.querySelectorAll("label")]
      .find((label) => label.textContent?.trim() === "Agent")
      ?.querySelector<HTMLInputElement>('input[type="radio"]');
    await harness.click(agentRadio);
    expect(host.sessionInputs).toHaveLength(0);
    expect(trigger?.getAttribute("aria-label")).toBe("Agent access: Agent");

    await harness.pressKey("Escape");
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-review-id="agent-access-popover"]'),
      ).toBeNull(),
    );
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));

    await harness.click(trigger);
    await harness.pointerDown(document.body);
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-review-id="agent-access-popover"]'),
      ).toBeNull(),
    );
  });

  it("keeps the draft when Agent access starts a replacement chat", async () => {
    render(true);
    await sendQuestion("Start the current chat");
    await vi.waitFor(() => expect(host.sessionInputs).toHaveLength(1));
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector(
          '.agent-turn[data-turn-status="completed"]',
        ),
      ).toBeTruthy(),
    );

    const textarea =
      harness.container.querySelector<HTMLTextAreaElement>("textarea");
    await harness.setTextAreaValue(textarea, "Keep this draft");
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[data-review-id="agent-access-trigger"]',
      ),
    );
    const agentRadio = [...document.querySelectorAll("label")]
      .find((label) => label.textContent?.trim() === "Agent")
      ?.querySelector<HTMLInputElement>('input[type="radio"]');
    await harness.click(agentRadio);

    await vi.waitFor(() => expect(host.sessionInputs).toHaveLength(2));
    expect(host.sessionInputs[1]?.permissionMode).toBe("agent");
    expect(textarea?.value).toBe("Keep this draft");
    expect(
      document.querySelector('[data-review-id="agent-access-popover"]'),
    ).toBeTruthy();
  });

  it("shows provider context usage and preserves the draft during compaction", async () => {
    render(true);
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector(
          '[data-review-id="agent-context-trigger"]',
        ),
      ).toBeTruthy(),
    );
    const initialTrigger = harness.container.querySelector<HTMLButtonElement>(
      '[data-review-id="agent-context-trigger"]',
    );
    expect(initialTrigger?.getAttribute("aria-label")).toBe(
      "Context unavailable",
    );

    await sendQuestion("Start a context-aware chat");
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector(
          '.agent-turn[data-turn-status="completed"]',
        ),
      ).toBeTruthy(),
    );
    const trigger = harness.container.querySelector<HTMLButtonElement>(
      '[data-review-id="agent-context-trigger"]',
    );
    await vi.waitFor(() =>
      expect(trigger?.getAttribute("aria-label")).toBe("25% context remaining"),
    );

    const textarea =
      harness.container.querySelector<HTMLTextAreaElement>("textarea");
    await harness.setTextAreaValue(textarea, "Keep this compacting draft");
    await harness.click(trigger);
    const popover = document.querySelector(
      '[data-review-id="agent-context-popover"]',
    );
    expect(popover?.textContent).toContain("187.5K / 250K tokens");
    expect(popover?.textContent).toContain("Getting full");
    await harness.click(
      [...popover!.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Compact context"),
      ),
    );

    expect(textarea?.value).toBe("Keep this compacting draft");
    await vi.waitFor(() =>
      expect(trigger?.getAttribute("aria-label")).toBe("80% context remaining"),
    );
    expect(popover?.textContent).toContain("Last compacted manually");
    expect(textarea?.value).toBe("Keep this compacting draft");
  });

  it("sends OpenUI instructions only for Visualize turns", async () => {
    render(true);
    await sendQuestion("Build a dashboard in normal chat.");
    await vi.waitFor(() => expect(host.turnInputs).toHaveLength(1));
    expect(host.turnInputs[0]).toMatchObject({ responseMode: "auto" });
    expect(host.turnInputs[0]?.visualizationInstructions).toBeUndefined();

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[data-review-id="agent-response-mode"]',
      ),
    );
    await sendQuestion("Visualize the dashboard.");
    await vi.waitFor(() => expect(host.turnInputs).toHaveLength(2));
    expect(host.turnInputs[1]).toMatchObject({ responseMode: "visualize" });
    expect(host.turnInputs[1]?.visualizationInstructions).toBe(
      svardOpenUiBalancedPrompt,
    );

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[data-review-id="agent-response-mode"]',
      ),
    );
    await sendQuestion("Return to normal chat.");
    await vi.waitFor(() => expect(host.turnInputs).toHaveLength(3));
    expect(host.turnInputs[2]).toMatchObject({ responseMode: "auto" });
    expect(host.turnInputs[2]?.visualizationInstructions).toBeUndefined();
  });

  it("shows a file icon and label during an internal FileTree drag", async () => {
    render(true);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(codexContextPointerDragStartEvent, {
          detail: {
            clientX: 120,
            clientY: 80,
            path: "/workspace/docs/drag-preview.md",
          },
        }),
      );
    });

    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-review-id="codex-context-drag-preview"]'),
      ).toBeTruthy(),
    );
    const preview = document.querySelector(
      '[data-review-id="codex-context-drag-preview"]',
    );
    expect(preview?.textContent).toContain("drag-preview.md");
    expect(preview?.textContent).toContain("Add to AI Chat");
    expect(preview?.querySelector("svg")).toBeTruthy();

    act(() => {
      window.dispatchEvent(new PointerEvent("pointercancel"));
    });
    expect(
      document.querySelector('[data-review-id="codex-context-drag-preview"]'),
    ).toBeNull();
  });

  it("applies the latest preferences only when starting a new chat", async () => {
    render(true);
    await sendQuestion("Start the first chat");
    await vi.waitFor(() => expect(host.sessionInputs).toHaveLength(1));
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector(".agent-final-answer"),
      ).toBeTruthy(),
    );
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector<HTMLButtonElement>(
          '[aria-label="Send"]',
        ),
      ).toBeTruthy(),
    );
    expect(host.sessionInputs[0]?.permissionMode).toBe("observe");

    config.agentProviders.codex.permissionMode = "agent";
    config.agentProviders.codex.networkAccess = true;
    render(true);
    expect(host.sessionInputs).toHaveLength(1);

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Start new chat"]',
      ),
    );
    await vi.waitFor(() => expect(host.sessionInputs).toHaveLength(2));
    expect(host.sessionInputs[1]).toMatchObject({
      permissionMode: "agent",
      networkAccess: true,
    });
  });

  it("starts a saved Full Access chat only after the first action is confirmed", async () => {
    config.agentProviders.codex.permissionMode = "fullAccess";
    render(true);

    expect(
      harness.container.querySelector('[role="alertdialog"]'),
    ).not.toBeTruthy();
    await sendQuestion("Keep this draft");
    expect(host.sessionInputs).toHaveLength(0);
    expect(harness.container.textContent).toContain(
      "Enable Full Access for this chat?",
    );
    expect(
      harness.container.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("Keep this draft");

    await harness.click(harness.buttonByText("Cancel"));
    expect(host.sessionInputs).toHaveLength(0);
    expect(
      harness.container.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("Keep this draft");

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>('[aria-label="Send"]'),
    );
    await harness.click(harness.buttonByText("Enable Full Access"));
    await vi.waitFor(() => expect(host.sessionInputs).toHaveLength(1));
    expect(host.sessionInputs[0]?.permissionMode).toBe("fullAccess");
  });

  it("keeps the draft when lazy session start fails", async () => {
    host.failNextStart = true;
    render(true);

    await sendQuestion("Retry this exact question");
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(
        "Synthetic session start failure.",
      ),
    );
    expect(
      harness.container.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("Retry this exact question");
    expect(harness.container.querySelectorAll(".agent-turn")).toHaveLength(0);
  });

  it("starts the session before staging an image", async () => {
    render(true);
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector<HTMLButtonElement>(
          '[aria-label="Add files or images"]',
        ),
      ).toBeTruthy(),
    );
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Add files or images"]',
      ),
    );
    await vi.waitFor(() =>
      expect(harness.buttonByText("Add images…")).toBeTruthy(),
    );

    await harness.click(harness.buttonByText("Add images…"));

    await vi.waitFor(() => expect(host.sessionInputs).toHaveLength(1));
    await vi.waitFor(() =>
      expect(
        harness.container.querySelectorAll(".agent-image-chip:not(.error)"),
      ).toHaveLength(1),
    );

    const textarea =
      harness.container.querySelector<HTMLTextAreaElement>("textarea");
    await harness.setTextAreaValue(textarea, "Keep the document question");
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[data-review-id="agent-access-trigger"]',
      ),
    );
    const agentRadio = [...document.querySelectorAll("label")]
      .find((label) => label.textContent?.trim() === "Agent")
      ?.querySelector<HTMLInputElement>('input[type="radio"]');
    await harness.click(agentRadio);

    await vi.waitFor(() => expect(host.sessionInputs).toHaveLength(2));
    expect(textarea?.value).toBe("Keep the document question");
    expect(
      harness.container.querySelectorAll(".agent-image-chip:not(.error)"),
    ).toHaveLength(0);
    expect(harness.container.textContent).toContain(
      "Reattach direct images before sending this question.",
    );
  });
});
