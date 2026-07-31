import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import { defaultConfig } from "../../src/core/defaultConfig";
import type {
  AgentEvent,
  AgentChatHandoffSnapshot,
  AgentQuotedContext,
  AgentSessionInfo,
  AgentSessionStartInput,
  AgentSteerInput,
  AgentSteerOutcome,
  AgentTurnInput,
  AgentTurnOutcome,
  AppConfig,
  DocumentChangeSnapshot,
  DocumentSelectionSnapshot,
} from "../../src/core/types";
import { AgentPanelHost } from "../../src/ui/agent/AgentPanelHost";
import { agentChatHandoffPayload } from "../../src/ui/agent/agentChatHandoff";
import { agentConversationIsNearBottom } from "../../src/ui/agent/useAgentConversationScroll";
import {
  createReactRootHarness,
  type ReactRootHarness,
} from "./helpers/reactHarness";

function selection(snapshotId: string): DocumentSelectionSnapshot {
  return {
    snapshotId,
    documentPath: "docs/guide.md",
    documentRevision: "revision",
    plainText: "Selected paragraph",
    blocks: [
      {
        type: "prose",
        role: "paragraph",
        markdown: "Selected paragraph",
        plainText: "Selected paragraph",
      },
    ],
    imageResources: [],
    provenance: [],
    diagnostics: [],
  };
}

function currentChange(): DocumentChangeSnapshot {
  const before = selection("change:before");
  before.documentRevision = "HEAD";
  before.plainText = "Before value";
  before.blocks[0] = {
    type: "prose",
    role: "paragraph",
    markdown: "Before value",
    plainText: "Before value",
  };
  const after = selection("change:after");
  after.documentRevision = "Working Tree";
  after.plainText = "After value";
  after.blocks[0] = {
    type: "prose",
    role: "paragraph",
    markdown: "After value",
    plainText: "After value",
  };
  return {
    snapshotId: "current-change",
    contextType: "change",
    documentPath: "docs/guide.md",
    comparisonLabel: "HEAD → Working Tree",
    changeKind: "changed",
    before,
    after,
    diagnostics: [],
  };
}

class UsabilityHost extends MockHostAdapter {
  failure: "none" | "before-accept" | "after-accept-once" = "none";
  redactAnswerOnce = false;
  readonly turnInputs: AgentTurnInput[] = [];
  readonly steerInputs: AgentSteerInput[] = [];
  private onEvent: ((event: AgentEvent) => void) | null = null;

  override async startAgentSession(
    input: AgentSessionStartInput,
    onEvent: (event: AgentEvent) => void,
  ): Promise<AgentSessionInfo> {
    this.onEvent = onEvent;
    return super.startAgentSession(input, onEvent);
  }

  override async sendAgentTurn(
    input: AgentTurnInput,
  ): Promise<AgentTurnOutcome> {
    this.turnInputs.push(structuredClone(input));
    if (this.redactAnswerOnce) {
      this.redactAnswerOnce = false;
      this.onEvent?.({
        type: "turnInputAccepted",
        clientTurnId: input.clientTurnId,
        imageAttachmentIds: [],
      });
      this.onEvent?.({
        type: "finalAnswerDelta",
        delta: "Read /workspace/docs/private.md.",
      });
      this.onEvent?.({
        type: "turnCompleted",
        clientTurnId: input.clientTurnId,
      });
      return { status: "completed" };
    }
    if (this.failure === "before-accept") {
      return {
        status: "failed",
        code: "synthetic-start-failure",
        message: "Synthetic turn start failure.",
      };
    }
    if (this.failure === "after-accept-once") {
      this.failure = "none";
      this.onEvent?.({
        type: "turnStarted",
        clientTurnId: input.clientTurnId,
      });
      this.onEvent?.({
        type: "turnInputAccepted",
        clientTurnId: input.clientTurnId,
        imageAttachmentIds: [],
      });
      this.onEvent?.({
        type: "turnFailed",
        clientTurnId: input.clientTurnId,
        code: "synthetic-provider-failure",
        message: "Synthetic provider failure.",
      });
      return {
        status: "failed",
        code: "synthetic-provider-failure",
        message: "Synthetic provider failure.",
      };
    }
    return super.sendAgentTurn(input);
  }

  override async steerAgentTurn(
    input: AgentSteerInput,
  ): Promise<AgentSteerOutcome> {
    this.steerInputs.push(structuredClone(input));
    return super.steerAgentTurn(input);
  }
}

function TestPanel({
  handoffSnapshot,
  host,
  initialQuotedContexts = [],
  onHandoffSnapshotChange,
  onReviewChanges,
  providerConfig = structuredClone(defaultConfig).agentProviders,
}: {
  handoffSnapshot?: AgentChatHandoffSnapshot | null;
  host: UsabilityHost;
  initialQuotedContexts?: AgentQuotedContext[];
  onHandoffSnapshotChange?: (snapshot: AgentChatHandoffSnapshot) => void;
  onReviewChanges?: () => void | Promise<void>;
  providerConfig?: AppConfig["agentProviders"];
}) {
  const [quotedContexts, setQuotedContexts] = useState(initialQuotedContexts);
  return (
    <AgentPanelHost
      activeDocument={null}
      handoffSnapshot={handoffSnapshot}
      host={host}
      open
      onClose={() => {}}
      providerConfig={providerConfig}
      quotedContexts={quotedContexts}
      onHandoffSnapshotChange={onHandoffSnapshotChange}
      onQuotedContextsAccepted={(snapshotIds) =>
        setQuotedContexts((current) =>
          current.filter((item) => !snapshotIds.includes(item.snapshotId)),
        )
      }
      onReviewChanges={onReviewChanges}
      workspaceRoot="/workspace"
    />
  );
}

describe("Agent Chat conversation usability", () => {
  let harness: ReactRootHarness;
  let host: UsabilityHost;

  beforeEach(() => {
    harness = createReactRootHarness();
    host = new UsabilityHost();
  });

  afterEach(() => {
    harness.cleanup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("sends a paired current change in Before then After order", async () => {
    harness.render(
      <TestPanel host={host} initialQuotedContexts={[currentChange()]} />,
    );

    await sendQuestion("この変更を説明してください");
    await vi.waitFor(() => expect(host.turnInputs).toHaveLength(1));

    const text = (host.turnInputs[0]?.contentParts ?? [])
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    expect(text).toContain(
      "Current rendered change: docs/guide.md · Changed · HEAD → Working Tree",
    );
    expect(text.indexOf("Before value")).toBeLessThan(
      text.indexOf("After value"),
    );
    expect(text).toContain("untrusted reference data");
  });

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

  it("automatically restores a question rejected before input acceptance", async () => {
    host.failure = "before-accept";
    harness.render(<TestPanel host={host} />);

    await sendQuestion("Keep this question");

    await vi.waitFor(() =>
      expect(
        harness.container.querySelector<HTMLTextAreaElement>("textarea")?.value,
      ).toBe("Keep this question"),
    );
    expect(harness.container.textContent).toContain(
      "Synthetic turn start failure.",
    );
    expect(harness.container.textContent).not.toContain("Restore input");
  });

  it("restores accepted failed input without sending it again", async () => {
    host.failure = "after-accept-once";
    harness.render(
      <TestPanel
        host={host}
        initialQuotedContexts={[selection("selection")]}
      />,
    );
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[data-review-id="agent-response-mode"]',
      ),
    );

    await sendQuestion("Visualize this selection");
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(
        "Synthetic provider failure.",
      ),
    );
    expect(host.turnInputs).toHaveLength(1);

    const composer =
      harness.container.querySelector<HTMLTextAreaElement>("textarea");
    await harness.setTextAreaValue(composer, "Existing draft");
    expect(harness.buttonByText("Restore input").disabled).toBe(true);
    await harness.setTextAreaValue(composer, "");

    await harness.click(harness.buttonByText("Restore input"));
    expect(composer?.value).toBe("Visualize this selection");
    expect(harness.container.textContent).toContain("Selected paragraph");
    expect(
      harness.container.querySelector('[data-review-id="agent-response-mode"]')
        ?.textContent,
    ).toContain("Visualize");
    expect(host.turnInputs).toHaveLength(1);

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>('[aria-label="Send"]'),
    );
    await vi.waitFor(() => expect(host.turnInputs).toHaveLength(2));
    expect(host.turnInputs[1]?.clientTurnId).not.toBe(
      host.turnInputs[0]?.clientTurnId,
    );
  });

  it("offers accepted cancelled input for explicit restoration", async () => {
    harness.render(<TestPanel host={host} />);
    await sendQuestion("Cancel and restore this");
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector<HTMLButtonElement>(
          '[aria-label="Cancel"]',
        ),
      ).toBeTruthy(),
    );
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Cancel"]',
      ),
    );

    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Restore input"),
    );
    await harness.click(harness.buttonByText("Restore input"));
    expect(
      harness.container.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("Cancel and restore this");
  });

  it("cleans up an unexpected disconnect and reconnects without replacing the conversation", async () => {
    const closeSession = vi.spyOn(host, "closeAgentSession");
    const resumeSession = vi.spyOn(host, "resumeAgentSession");
    const readHistory = vi.spyOn(host, "readAgentSessionHistory");
    let latestSnapshot: AgentChatHandoffSnapshot | null = null;
    harness.render(
      <TestPanel
        host={host}
        onHandoffSnapshotChange={(snapshot) => {
          latestSnapshot = snapshot;
        }}
      />,
    );

    await sendQuestion("Unexpected disconnect during approval");
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(
        "Codex app-server disconnected.",
      ),
    );
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Restore input"),
    );
    expect(
      harness.container.querySelector(
        '.agent-turn[data-turn-status="running"]',
      ),
    ).toBeNull();
    expect(harness.container.textContent).not.toContain("Approval required");
    await vi.waitFor(() => expect(closeSession).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(agentChatHandoffPayload(latestSnapshot)?.recoveryState).toBe(
        "disconnected",
      ),
    );

    const failedTurn = harness.container.querySelector(
      '.agent-turn[data-turn-status="failed"]',
    );
    expect(failedTurn).toBeTruthy();
    await vi.waitFor(() =>
      expect(harness.buttonByText("Reconnect").disabled).toBe(false),
    );
    await harness.click(harness.buttonByText("Reconnect"));

    await vi.waitFor(() => expect(resumeSession).toHaveBeenCalledTimes(1));
    expect(readHistory).not.toHaveBeenCalled();
    expect(
      harness.container.querySelector('.agent-turn[data-turn-status="failed"]'),
    ).toBe(failedTurn);
    expect(harness.container.textContent).not.toContain("AI Chat disconnected");
    expect(host.turnInputs).toHaveLength(1);
    expect(agentChatHandoffPayload(latestSnapshot)?.recoveryState).toBe(
      "connected",
    );
  });

  it("hydrates disconnected recovery state across an exclusive handoff", async () => {
    let latestSnapshot: AgentChatHandoffSnapshot | null = null;
    harness.render(
      <TestPanel
        key="main"
        host={host}
        onHandoffSnapshotChange={(snapshot) => {
          latestSnapshot = snapshot;
        }}
      />,
    );
    await sendQuestion("Unexpected disconnect while streaming");
    await vi.waitFor(() =>
      expect(agentChatHandoffPayload(latestSnapshot)?.recoveryState).toBe(
        "disconnected",
      ),
    );
    const handoffSnapshot = latestSnapshot;
    expect(handoffSnapshot).toBeTruthy();

    harness.render(
      <TestPanel
        key="detached"
        handoffSnapshot={handoffSnapshot}
        host={host}
      />,
    );

    expect(
      harness.container.querySelector('.agent-turn[data-turn-status="failed"]'),
    ).toBeTruthy();
    expect(harness.buttonByText("Reconnect")).toBeTruthy();
    await harness.click(harness.buttonByText("Reconnect"));
    await vi.waitFor(() =>
      expect(harness.container.textContent).not.toContain(
        "AI Chat disconnected",
      ),
    );
    expect(
      harness.container.querySelector('.agent-turn[data-turn-status="failed"]'),
    ).toBeTruthy();
  });

  it("reuses a completed live input as a new explicit turn", async () => {
    harness.render(<TestPanel host={host} />);
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[data-review-id="agent-response-mode"]',
      ),
    );
    await sendQuestion("Reuse this completed question");
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Reuse input"),
    );

    const composer =
      harness.container.querySelector<HTMLTextAreaElement>("textarea")!;
    await harness.setTextAreaValue(composer, "Existing draft");
    expect(harness.buttonByText("Reuse input").disabled).toBe(true);
    await harness.setTextAreaValue(composer, "");
    await harness.click(harness.buttonByText("Reuse input"));

    expect(composer.value).toBe("Reuse this completed question");
    expect(
      harness.container.querySelector('[data-review-id="agent-response-mode"]')
        ?.textContent,
    ).toContain("Visualize");
    expect(host.turnInputs).toHaveLength(1);

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>('[aria-label="Send"]'),
    );
    await vi.waitFor(() => expect(host.turnInputs).toHaveLength(2));
    expect(host.turnInputs[1]?.clientTurnId).not.toBe(
      host.turnInputs[0]?.clientTurnId,
    );
  });

  it("reconnects once before sending restored disconnected input", async () => {
    const resumeSession = vi.spyOn(host, "resumeAgentSession");
    harness.render(<TestPanel host={host} />);
    await sendQuestion("Unexpected disconnect while streaming");
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Restore input"),
    );
    await vi.waitFor(() =>
      expect(harness.buttonByText("Reconnect").disabled).toBe(false),
    );
    await harness.click(harness.buttonByText("Restore input"));
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>('[aria-label="Send"]'),
    );

    await vi.waitFor(() => expect(resumeSession).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(host.turnInputs).toHaveLength(2));
    expect(host.turnInputs[1]?.question).toBe(
      "Unexpected disconnect while streaming",
    );
  });

  it("fails closed until disconnected runtime cleanup is retried", async () => {
    const closeSession = vi
      .spyOn(host, "closeAgentSession")
      .mockRejectedValueOnce(new Error("Synthetic cleanup failure."));
    const resumeSession = vi.spyOn(host, "resumeAgentSession");
    harness.render(<TestPanel host={host} />);
    await sendQuestion("Unexpected disconnect while streaming");
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Restore input"),
    );
    await vi.waitFor(() =>
      expect(harness.buttonByText("Retry cleanup").disabled).toBe(false),
    );
    expect(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Start new chat"]',
      )?.disabled,
    ).toBe(true);
    expect(
      harness.container.querySelector<HTMLButtonElement>(
        '[data-review-id="agent-display-menu-trigger"]',
      )?.disabled,
    ).toBe(true);
    await harness.click(harness.buttonByText("Restore input"));
    const composer =
      harness.container.querySelector<HTMLTextAreaElement>("textarea")!;
    expect(
      harness.container.querySelector<HTMLButtonElement>('[aria-label="Send"]')
        ?.disabled,
    ).toBe(true);
    expect(resumeSession).not.toHaveBeenCalled();

    await harness.click(harness.buttonByText("Retry cleanup"));
    await vi.waitFor(() => expect(closeSession).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(harness.buttonByText("Reconnect").disabled).toBe(false),
    );
    expect(composer.value).toBe("Unexpected disconnect while streaming");
    expect(host.turnInputs).toHaveLength(1);
    expect(resumeSession).not.toHaveBeenCalled();

    await harness.click(harness.buttonByText("Reconnect"));
    await vi.waitFor(() => expect(resumeSession).toHaveBeenCalledTimes(1));
    expect(composer.value).toBe("Unexpected disconnect while streaming");
    expect(host.turnInputs).toHaveLength(1);
  });

  it("retries disconnected runtime cleanup when Close AI Chat is selected", async () => {
    const closeSession = vi
      .spyOn(host, "closeAgentSession")
      .mockRejectedValueOnce(new Error("Synthetic cleanup failure."))
      .mockRejectedValueOnce(new Error("Synthetic cleanup retry failure."));
    harness.render(<TestPanel host={host} />);
    await sendQuestion("Unexpected disconnect while streaming");
    await vi.waitFor(() =>
      expect(harness.buttonByText("Retry cleanup")).toBeTruthy(),
    );

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Close AI Chat"]',
      ),
    );

    await vi.waitFor(() => expect(closeSession).toHaveBeenCalledTimes(2));
    expect(harness.buttonByText("Retry cleanup")).toBeTruthy();
    expect(harness.container.textContent).toContain(
      "Codex app-server disconnected.",
    );
  });

  it("keeps disconnected Full Access input when reconnect confirmation is refused", async () => {
    const providerConfig = structuredClone(defaultConfig).agentProviders;
    providerConfig.codex.permissionMode = "fullAccess";
    harness.render(<TestPanel host={host} providerConfig={providerConfig} />);
    await sendQuestion("Unexpected disconnect while streaming");
    await harness.click(harness.buttonByText("Enable Full Access"));
    await vi.waitFor(() =>
      expect(harness.buttonByText("Reconnect")).toBeTruthy(),
    );
    await harness.click(harness.buttonByText("Restore input"));
    await harness.click(harness.buttonByText("Reconnect"));
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(
        "Resume this chat with Full Access?",
      ),
    );
    await harness.click(harness.buttonByText("Cancel"));

    expect(harness.buttonByText("Reconnect")).toBeTruthy();
    expect(
      harness.container.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("Unexpected disconnect while streaming");
    expect(host.turnInputs).toHaveLength(1);
  });

  it("queues one draft and sends it only after the active turn completes", async () => {
    harness.render(<TestPanel host={host} />);
    await sendQuestion("First response");
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector<HTMLButtonElement>(
          '[aria-label="Queue"]',
        ),
      ).toBeTruthy(),
    );
    const composer =
      harness.container.querySelector<HTMLTextAreaElement>("textarea")!;
    await harness.setTextAreaValue(composer, "Queued response");
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Queue"]',
      ),
    );

    expect(host.turnInputs).toHaveLength(1);
    expect(composer.readOnly).toBe(true);
    expect(harness.container.textContent).toContain(
      "Queued after the current response",
    );
    await vi.waitFor(() => expect(host.turnInputs).toHaveLength(2));
    expect(host.turnInputs[1]?.question).toBe("Queued response");
    expect(host.turnInputs[1]?.clientTurnId).not.toBe(
      host.turnInputs[0]?.clientTurnId,
    );
  });

  it("steers the active provider turn without starting a second turn", async () => {
    harness.render(<TestPanel host={host} />);
    await sendQuestion("First response");
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Steer"),
    );
    const composer =
      harness.container.querySelector<HTMLTextAreaElement>("textarea")!;
    await harness.setTextAreaValue(composer, "Focus on failure handling");
    await harness.click(harness.buttonByText("Steer"));

    await vi.waitFor(() => expect(host.steerInputs).toHaveLength(1));
    expect(host.turnInputs).toHaveLength(1);
    expect(host.steerInputs[0]?.clientTurnId).toBe(
      host.turnInputs[0]?.clientTurnId,
    );
    expect(harness.container.textContent).toContain("Steered");
    expect(harness.container.textContent).toContain(
      "Focus on failure handling",
    );
  });

  it("waits for cancellation before Stop and Send starts a new turn", async () => {
    harness.render(<TestPanel host={host} />);
    await sendQuestion("First response");
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Stop and Send"),
    );
    const composer =
      harness.container.querySelector<HTMLTextAreaElement>("textarea")!;
    await harness.setTextAreaValue(composer, "Replacement response");
    await harness.click(harness.buttonByText("Stop and Send"));

    expect(host.turnInputs).toHaveLength(1);
    await vi.waitFor(() => expect(host.turnInputs).toHaveLength(2));
    expect(host.turnInputs[1]?.question).toBe("Replacement response");
    expect(harness.container.textContent).not.toContain("Restore input");
  });

  it("shows deduplicated changed files and reviews the current working tree", async () => {
    const onReviewChanges = vi.fn();
    harness.render(<TestPanel host={host} onReviewChanges={onReviewChanges} />);
    await sendQuestion("Change review");

    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Changed files"),
    );
    expect(harness.container.textContent).toContain("src/ui/App.tsx");
    expect(harness.container.textContent).toContain("+1 more");
    expect(
      harness.container.querySelectorAll(".agent-changed-files li"),
    ).toHaveLength(5);
    await harness.click(harness.buttonByText("Review changes"));
    expect(onReviewChanges).toHaveBeenCalledOnce();
    expect(harness.container.textContent).toContain("AI Chat");
  });

  it("uses a 96 pixel threshold for following the latest activity", () => {
    expect(
      agentConversationIsNearBottom({
        clientHeight: 400,
        scrollHeight: 1000,
        scrollTop: 504,
      }),
    ).toBe(true);
    expect(
      agentConversationIsNearBottom({
        clientHeight: 400,
        scrollHeight: 1000,
        scrollTop: 503,
      }),
    ).toBe(false);
  });

  it("keeps a past scroll position until New activity is selected", async () => {
    harness.render(<TestPanel host={host} />);
    const conversation = harness.container.querySelector<HTMLDivElement>(
      ".agent-conversation",
    )!;
    Object.defineProperties(conversation, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 100, writable: true },
    });

    await sendQuestion("Stream a long response");
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector<HTMLButtonElement>(
          '[aria-label="Cancel"]',
        ),
      ).toBeTruthy(),
    );
    act(() => {
      conversation.scrollTop = 100;
      conversation.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("New activity"),
    );
    expect(conversation.scrollTop).toBe(100);

    await harness.click(harness.buttonByText("New activity"));
    expect(conversation.scrollTop).toBe(1000);
    expect(harness.container.textContent).not.toContain("New activity");
  });

  it("sends with Command or Control Enter without breaking IME or newlines", async () => {
    harness.render(<TestPanel host={host} />);
    const composer =
      harness.container.querySelector<HTMLTextAreaElement>("textarea")!;
    expect(composer.placeholder).toContain("⌘/Ctrl+Enter");
    await harness.setTextAreaValue(composer, "Do not send while composing");

    let allowedDefault = false;
    act(() => {
      allowedDefault = composer.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(allowedDefault).toBe(true);
    expect(host.turnInputs).toHaveLength(0);

    act(() => {
      allowedDefault = composer.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(allowedDefault).toBe(true);
    expect(host.turnInputs).toHaveLength(0);

    await harness.setTextAreaValue(composer, "Send with Command");
    act(() => {
      allowedDefault = composer.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(allowedDefault).toBe(false);
    await vi.waitFor(() => expect(host.turnInputs).toHaveLength(1));
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector<HTMLButtonElement>(
          '[aria-label="Send"]',
        ),
      ).toBeTruthy(),
    );

    const readyComposer =
      harness.container.querySelector<HTMLTextAreaElement>("textarea")!;
    await harness.setTextAreaValue(readyComposer, "Send with Control");
    act(() => {
      allowedDefault = readyComposer.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(allowedDefault).toBe(false);
    await vi.waitFor(() => expect(host.turnInputs).toHaveLength(2));
  });

  it("copies only the workspace-redacted Auto answer", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    host.redactAnswerOnce = true;
    harness.render(<TestPanel host={host} />);

    await sendQuestion("Return a private workspace path");
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(
        "Read ./docs/private.md.",
      ),
    );
    await harness.click(harness.buttonByText("Copy answer"));

    expect(writeText).toHaveBeenCalledWith("Read ./docs/private.md.");
    expect(writeText).not.toHaveBeenCalledWith(
      "Read /workspace/docs/private.md.",
    );
  });
});
