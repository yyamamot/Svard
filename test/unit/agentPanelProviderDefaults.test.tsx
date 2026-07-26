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
    expect(host.turnInputs[1]?.visualizationInstructions).toContain(
      "SvardExperience",
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
  });
});
