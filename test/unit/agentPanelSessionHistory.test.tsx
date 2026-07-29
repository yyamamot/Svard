import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import { defaultConfig } from "../../src/core/defaultConfig";
import type {
  AgentEvent,
  AgentSessionInfo,
  AgentSessionResumeInput,
  AgentSessionStartInput,
} from "../../src/core/types";
import { AgentPanelHost } from "../../src/ui/agent/AgentPanelHost";
import { agentSessionHistoryDateBounds } from "../../src/ui/agent/agentSessionHistorySearch";
import {
  createReactRootHarness,
  type ReactRootHarness,
} from "./helpers/reactHarness";

class SessionRecordingHost extends MockHostAdapter {
  readonly starts: AgentSessionStartInput[] = [];
  readonly resumes: AgentSessionResumeInput[] = [];
  readonly closes: string[] = [];

  override async startAgentSession(
    input: AgentSessionStartInput,
    onEvent: (event: AgentEvent) => void,
  ): Promise<AgentSessionInfo> {
    this.starts.push(structuredClone(input));
    return super.startAgentSession(input, onEvent);
  }

  override async resumeAgentSession(
    input: AgentSessionResumeInput,
    onEvent: (event: AgentEvent) => void,
  ): Promise<AgentSessionInfo> {
    this.resumes.push(structuredClone(input));
    return super.resumeAgentSession(input, onEvent);
  }

  override async closeAgentSession(clientSessionId: string): Promise<void> {
    this.closes.push(clientSessionId);
    return super.closeAgentSession(clientSessionId);
  }
}

describe("AgentPanelHost session history", () => {
  let harness: ReactRootHarness;
  let host: SessionRecordingHost;

  beforeEach(() => {
    harness = createReactRootHarness();
    host = new SessionRecordingHost();
  });

  afterEach(() => {
    delete (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_SESSION_RESUME_FAILURE__?: true | string;
      }
    ).__SVARD_AGENT_SESSION_RESUME_FAILURE__;
    harness.cleanup();
  });

  function render(open = true) {
    harness.render(
      <AgentPanelHost
        activeDocument={null}
        host={host}
        open={open}
        onClose={() => {}}
        providerConfig={structuredClone(defaultConfig).agentProviders}
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

  async function createPreviousChat() {
    render();
    await sendQuestion("Create the first chat");
    await vi.waitFor(() => expect(host.starts).toHaveLength(1));
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
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Start new chat"]',
      ),
    );
    await vi.waitFor(() => expect(host.starts).toHaveLength(2));
  }

  async function openHistory() {
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Open chat history"]',
      ),
    );
    await vi.waitFor(() =>
      expect(
        harness.container.querySelectorAll(".agent-session-item"),
      ).toHaveLength(2),
    );
  }

  it("resumes a previous Svard chat and retains the current chat on failure", async () => {
    await createPreviousChat();
    await openHistory();

    const previous = harness.container.querySelectorAll<HTMLButtonElement>(
      ".agent-session-open",
    )[1];
    await harness.click(previous);
    await vi.waitFor(() => expect(host.resumes).toHaveLength(1));
    expect(host.resumes[0]?.clientSessionId).toBe(
      host.starts[0]?.clientSessionId,
    );

    await openHistory();
    const current = [
      ...harness.container.querySelectorAll(".agent-session-item"),
    ].find((item) => item.textContent?.includes("Current chat"));
    expect(current?.textContent).toContain("Create the first chat");

    (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_SESSION_RESUME_FAILURE__?: true | string;
      }
    ).__SVARD_AGENT_SESSION_RESUME_FAILURE__ = true;
    const other = [...harness.container.querySelectorAll(".agent-session-item")]
      .find((item) => !item.textContent?.includes("Current chat"))
      ?.querySelector<HTMLButtonElement>(".agent-session-open");
    await harness.click(other);
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(
        "The saved agent session could not be resumed.",
      ),
    );
    expect(
      [...harness.container.querySelectorAll(".agent-session-item")].find(
        (item) => item.textContent?.includes("Current chat"),
      )?.textContent,
    ).toContain("Create the first chat");
  });

  it("renames, archives, restores, and confirms deletion of an inactive chat", async () => {
    await createPreviousChat();
    await openHistory();

    const previous = [
      ...harness.container.querySelectorAll<HTMLElement>(".agent-session-item"),
    ].find((item) => !item.textContent?.includes("Current chat"));
    await harness.click(
      previous?.querySelector<HTMLButtonElement>('[aria-label^="Rename "]'),
    );
    const name = previous?.querySelector<HTMLInputElement>(
      '[aria-label="Chat name"]',
    );
    await harness.setInputValue(name, "Document review");
    await harness.click(
      previous?.querySelector<HTMLButtonElement>(
        '[aria-label="Save chat name"]',
      ),
    );
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Document review"),
    );

    const renamed = [
      ...harness.container.querySelectorAll(".agent-session-item"),
    ].find((item) => item.textContent?.includes("Document review"));
    await harness.click(
      renamed?.querySelector<HTMLButtonElement>(
        '[aria-label^="Archive Document review"]',
      ),
    );
    await vi.waitFor(() =>
      expect(harness.container.textContent).not.toContain("Document review"),
    );

    await harness.click(harness.buttonByText("Archived"));
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Document review"),
    );
    const archived = [
      ...harness.container.querySelectorAll(".agent-session-item"),
    ].find((item) => item.textContent?.includes("Document review"));
    await harness.click(
      archived?.querySelector<HTMLButtonElement>(
        '[aria-label^="Delete Document review"]',
      ),
    );
    expect(harness.container.textContent).toContain(
      "Delete this chat permanently?",
    );
    await harness.click(harness.buttonByText("Cancel"));
    expect(harness.container.textContent).not.toContain(
      "Delete this chat permanently?",
    );

    await harness.click(
      archived?.querySelector<HTMLButtonElement>(
        '[aria-label^="Restore Document review"]',
      ),
    );
    await vi.waitFor(() =>
      expect(harness.container.textContent).not.toContain("Document review"),
    );
  });

  it("closes only the runtime and resumes the same persisted chat", async () => {
    render();
    await sendQuestion("Start the persisted chat");
    await vi.waitFor(() => expect(host.starts).toHaveLength(1));
    const sessionId = host.starts[0]!.clientSessionId;

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Close AI Chat"]',
      ),
    );
    await vi.waitFor(() => expect(host.closes).toContain(sessionId));
    render(false);
    render(true);

    expect(host.resumes).toHaveLength(0);
    await sendQuestion("Resume on demand");
    await vi.waitFor(() => expect(host.resumes).toHaveLength(1));
    expect(host.resumes[0]?.clientSessionId).toBe(sessionId);
    expect(host.starts).toHaveLength(1);
  });

  it("opens history and resets an idle draft without creating a session", async () => {
    render();
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector<HTMLTextAreaElement>("textarea"),
      ).toBeTruthy(),
    );
    await harness.setTextAreaValue(
      harness.container.querySelector<HTMLTextAreaElement>("textarea"),
      "Unsent draft",
    );

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Open chat history"]',
      ),
    );
    await vi.waitFor(() =>
      expect(
        harness.container.querySelector(
          '[data-review-id="agent-session-history"]',
        ),
      ).toBeTruthy(),
    );
    expect(host.starts).toHaveLength(0);

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Close chat history"]',
      ),
    );
    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Start new chat"]',
      ),
    );
    expect(host.starts).toHaveLength(0);
    expect(
      harness.container.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("");
  });

  it("keeps registry title and date search controls hidden", async () => {
    await createPreviousChat();
    await openHistory();
    expect(
      harness.container.querySelector('[aria-label="Search chat names"]'),
    ).toBeNull();
    expect(
      harness.container.querySelector(
        '[aria-label="Filter chats by update date"]',
      ),
    ).toBeNull();
  });

  it("uses local calendar-day boundaries for history date filters", () => {
    const bounds = agentSessionHistoryDateBounds(
      "last7Days",
      new Date(2026, 6, 29, 18, 30),
    );
    expect(new Date(bounds.updatedAtFrom! * 1_000)).toEqual(
      new Date(2026, 6, 23),
    );
    expect(new Date(bounds.updatedAtBefore! * 1_000)).toEqual(
      new Date(2026, 6, 30),
    );
  });
});
