import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import { defaultConfig } from "../../src/core/defaultConfig";
import type {
  AgentEvent,
  AgentSessionInfo,
  AgentSessionListInput,
  AgentSessionPage,
  AgentSessionStartInput,
  AgentTurnInput,
  AgentTurnOutcome,
} from "../../src/core/types";
import { AgentPanelHost } from "../../src/ui/agent/AgentPanelHost";
import {
  createReactRootHarness,
  type ReactRootHarness,
} from "./helpers/reactHarness";

class WorkspaceIsolationHost extends MockHostAdapter {
  readonly starts: AgentSessionStartInput[] = [];
  readonly turns: AgentTurnInput[] = [];
  readonly cancels: Array<{ sessionId: string; turnId: string }> = [];
  readonly closes: string[] = [];
  holdFirstTurn = false;
  delayFirstStart = false;
  delayNextClose = false;
  delayNextHistory = false;
  failNextCancel = false;
  failNextClose = false;
  historyRequests = 0;
  private releaseClose: (() => void) | null = null;
  private releaseStart: (() => void) | null = null;
  private releaseHistory: (() => void) | null = null;
  private heldTurn:
    | {
        input: AgentTurnInput;
        onEvent: (event: AgentEvent) => void;
        resolve: (outcome: AgentTurnOutcome) => void;
      }
    | undefined;
  private readonly handlers = new Map<string, (event: AgentEvent) => void>();

  override async startAgentSession(
    input: AgentSessionStartInput,
    onEvent: (event: AgentEvent) => void,
  ): Promise<AgentSessionInfo> {
    this.starts.push(structuredClone(input));
    this.handlers.set(input.clientSessionId, onEvent);
    if (this.delayFirstStart && this.starts.length === 1) {
      await new Promise<void>((resolve) => {
        this.releaseStart = resolve;
      });
    }
    return super.startAgentSession(input, onEvent);
  }

  releaseDelayedStart() {
    this.releaseStart?.();
    this.releaseStart = null;
  }

  override async listAgentSessions(
    input: AgentSessionListInput,
  ): Promise<AgentSessionPage> {
    this.historyRequests += 1;
    if (this.delayNextHistory) {
      this.delayNextHistory = false;
      await new Promise<void>((resolve) => {
        this.releaseHistory = resolve;
      });
    }
    return super.listAgentSessions(input);
  }

  releaseDelayedHistory() {
    this.releaseHistory?.();
    this.releaseHistory = null;
  }

  emitEvent(clientSessionId: string, event: AgentEvent) {
    this.handlers.get(clientSessionId)?.(event);
  }

  override async sendAgentTurn(
    input: AgentTurnInput,
  ): Promise<AgentTurnOutcome> {
    this.turns.push(structuredClone(input));
    if (!this.holdFirstTurn || this.turns.length !== 1) {
      return super.sendAgentTurn(input);
    }
    const onEvent = this.handlers.get(input.clientSessionId);
    if (!onEvent) throw new Error("Missing session event handler.");
    onEvent({ type: "turnStarted", clientTurnId: input.clientTurnId });
    onEvent({
      type: "turnInputAccepted",
      clientTurnId: input.clientTurnId,
      imageAttachmentIds: [],
    });
    return new Promise<AgentTurnOutcome>((resolve) => {
      this.heldTurn = { input, onEvent, resolve };
    });
  }

  override async cancelAgentTurn(
    clientSessionId: string,
    clientTurnId: string,
  ): Promise<void> {
    this.cancels.push({ sessionId: clientSessionId, turnId: clientTurnId });
    if (this.failNextCancel) {
      this.failNextCancel = false;
      throw new Error("Synthetic cancel failure.");
    }
    if (
      this.heldTurn?.input.clientSessionId === clientSessionId &&
      this.heldTurn.input.clientTurnId === clientTurnId
    ) {
      this.heldTurn.onEvent({
        type: "turnCancelled",
        clientTurnId,
      });
      this.heldTurn.resolve({ status: "cancelled" });
      this.heldTurn = undefined;
      return;
    }
    await super.cancelAgentTurn(clientSessionId, clientTurnId);
  }

  override async closeAgentSession(clientSessionId: string): Promise<void> {
    this.closes.push(clientSessionId);
    if (this.delayNextClose) {
      this.delayNextClose = false;
      await new Promise<void>((resolve) => {
        this.releaseClose = resolve;
      });
    }
    if (this.failNextClose) {
      this.failNextClose = false;
      throw new Error("Synthetic close failure.");
    }
    await super.closeAgentSession(clientSessionId);
  }

  releaseDelayedClose() {
    this.releaseClose?.();
    this.releaseClose = null;
  }
}

describe("Agent Chat workspace isolation", () => {
  let harness: ReactRootHarness;
  let host: WorkspaceIsolationHost;

  beforeEach(() => {
    harness = createReactRootHarness();
    host = new WorkspaceIsolationHost();
  });

  afterEach(() => {
    harness.cleanup();
  });

  function render(workspaceRoot: string) {
    harness.render(
      <AgentPanelHost
        activeDocument={null}
        host={host}
        open
        onClose={() => {}}
        providerConfig={structuredClone(defaultConfig).agentProviders}
        workspaceRoot={workspaceRoot}
      />,
    );
  }

  async function send(question: string) {
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

  it("closes the old runtime and lazily starts an empty chat in the new workspace", async () => {
    render("/workspace-a");
    await send("Question for workspace A");
    await vi.waitFor(() => expect(host.turns).toHaveLength(1));
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(
        "Question for workspace A",
      ),
    );
    const firstSessionId = host.starts[0]?.clientSessionId;

    const composer =
      harness.container.querySelector<HTMLTextAreaElement>("textarea");
    await harness.setTextAreaValue(composer, "Workspace A draft");
    render("/workspace-b");

    await vi.waitFor(() => expect(host.closes).toContain(firstSessionId));
    expect(harness.container.querySelectorAll(".agent-turn")).toHaveLength(0);
    expect(
      harness.container.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("");
    expect(harness.container.textContent).toContain(
      "Workspace changed. AI Chat is ready for a new conversation.",
    );
    expect(host.starts).toHaveLength(1);

    await send("Question for workspace B");
    await vi.waitFor(() => expect(host.starts).toHaveLength(2));
    expect(host.starts[1]?.workspaceRoot).toBe("/workspace-b");
    expect(host.starts[1]?.clientSessionId).not.toBe(firstSessionId);

    const workspaceAHistory = await host.listAgentSessions({
      providerId: "codex-app-server",
      workspaceRoot: "/workspace-a",
    });
    expect(
      workspaceAHistory.sessions.some(
        (session) => session.clientSessionId === firstSessionId,
      ),
    ).toBe(true);
  });

  it("cancels the active turn and discards queued input on workspace change", async () => {
    host.holdFirstTurn = true;
    render("/workspace-a");
    await send("Long running question");
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector<HTMLButtonElement>(
          '[aria-label="Queue"]',
        ),
      ).toBeTruthy(),
    );
    await harness.setTextAreaValue(
      harness.container.querySelector<HTMLTextAreaElement>("textarea"),
      "Queued for workspace A",
    );
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Queue"]',
      ),
    );

    render("/workspace-b");

    await vi.waitFor(() => expect(host.cancels).toHaveLength(1));
    await vi.waitFor(() => expect(host.closes.length).toBeGreaterThan(0));
    expect(host.turns).toHaveLength(1);
    expect(harness.container.querySelectorAll(".agent-turn")).toHaveLength(0);
    expect(
      harness.container.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("");
  });

  it("closes the old runtime even when active turn cancellation fails", async () => {
    host.holdFirstTurn = true;
    host.failNextCancel = true;
    render("/workspace-a");
    await send("Long running question");
    await vi.waitFor(() => expect(host.turns).toHaveLength(1));
    const firstSessionId = host.starts[0]?.clientSessionId;

    render("/workspace-b");

    await vi.waitFor(() => expect(host.cancels).toHaveLength(1));
    await vi.waitFor(() => expect(host.closes).toContain(firstSessionId));
  });

  it("closes a pending approval when the workspace changes", async () => {
    host.holdFirstTurn = true;
    render("/workspace-a");
    await send("Approval question");
    await vi.waitFor(() => expect(host.turns).toHaveLength(1));
    const firstSessionId = host.starts[0]?.clientSessionId;
    host.emitEvent(firstSessionId, {
      type: "permissionRequested",
      request: {
        requestId: "approval-a",
        kind: "command",
        title: "Synthetic approval",
        impact: "Synthetic impact",
      },
    });
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Synthetic approval"),
    );

    render("/workspace-b");

    await vi.waitFor(() =>
      expect(harness.container.textContent).not.toContain("Synthetic approval"),
    );
    expect(harness.container.textContent).not.toContain("Allow once");
    expect(harness.container.textContent).not.toContain("Deny");
  });

  it("waits for old runtime cleanup before starting the new workspace", async () => {
    render("/workspace-a");
    await send("Workspace A");
    await vi.waitFor(() => expect(host.starts).toHaveLength(1));
    host.delayNextClose = true;

    render("/workspace-b");
    await vi.waitFor(() => expect(host.closes).toHaveLength(1));
    await send("Workspace B");
    expect(host.starts).toHaveLength(1);

    host.releaseDelayedClose();
    await vi.waitFor(() => expect(host.starts).toHaveLength(2));
    expect(host.starts[1]?.workspaceRoot).toBe("/workspace-b");
  });

  it("fails closed and retries the same cleanup on the next explicit send", async () => {
    render("/workspace-a");
    await send("Workspace A");
    await vi.waitFor(() => expect(host.starts).toHaveLength(1));
    const firstSessionId = host.starts[0]?.clientSessionId;
    host.failNextClose = true;

    render("/workspace-b");

    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(
        "The previous AI Chat could not be closed.",
      ),
    );
    expect(host.starts).toHaveLength(1);

    await send("Workspace B after retry");

    await vi.waitFor(() => expect(host.starts).toHaveLength(2));
    expect(
      host.closes.filter((sessionId) => sessionId === firstSessionId),
    ).toHaveLength(2);
    expect(host.starts[1]?.workspaceRoot).toBe("/workspace-b");
  });

  it("ignores a session start that completes after the workspace changes", async () => {
    host.delayFirstStart = true;
    render("/workspace-a");
    await send("Delayed workspace A question");
    await vi.waitFor(() => expect(host.starts).toHaveLength(1));
    const delayedSessionId = host.starts[0]?.clientSessionId;

    render("/workspace-b");
    host.releaseDelayedStart();

    await vi.waitFor(() =>
      expect(
        host.closes.filter((sessionId) => sessionId === delayedSessionId)
          .length,
      ).toBeGreaterThan(0),
    );
    expect(harness.container.querySelectorAll(".agent-turn")).toHaveLength(0);

    await send("Workspace B after delayed start");
    await vi.waitFor(() => expect(host.starts).toHaveLength(2));
    await vi.waitFor(() => expect(host.turns).toHaveLength(1));
    expect(host.starts[1]?.workspaceRoot).toBe("/workspace-b");
    expect(host.turns[0]?.question).toBe("Workspace B after delayed start");
  });

  it("applies only the final workspace in a rapid sequence", async () => {
    render("/workspace-a");
    await send("Workspace A");
    await vi.waitFor(() => expect(host.starts).toHaveLength(1));

    render("/workspace-b");
    render("/workspace-c");
    await send("Workspace C");

    await vi.waitFor(() => expect(host.starts).toHaveLength(2));
    expect(host.starts.map((start) => start.workspaceRoot)).toEqual([
      "/workspace-a",
      "/workspace-c",
    ]);
    expect(host.turns.at(-1)?.question).toBe("Workspace C");
  });

  it("discards a history response from the previous workspace", async () => {
    render("/workspace-a");
    await send("Workspace A history");
    await vi.waitFor(() => expect(host.starts).toHaveLength(1));
    host.delayNextHistory = true;
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Open chat history"]',
      ),
    );
    await vi.waitFor(() => expect(host.historyRequests).toBe(1));

    render("/workspace-b");
    host.releaseDelayedHistory();

    await vi.waitFor(() =>
      expect(
        harness.container.querySelector(
          '[data-review-id="agent-session-history"]',
        ),
      ).toBeNull(),
    );
    expect(
      harness.container.querySelectorAll(".agent-session-item"),
    ).toHaveLength(0);
  });
});
