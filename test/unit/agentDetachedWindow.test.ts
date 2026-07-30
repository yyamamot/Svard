import { describe, expect, it, vi } from "vitest";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import type {
  AgentChatHandoffSnapshot,
  AgentChatOwnerSync,
} from "../../src/core/types";

function handoffSnapshot(): AgentChatHandoffSnapshot {
  return {
    version: 1,
    clientSessionId: "client-session",
    workspaceRoot: "/workspace",
    lastEventSequence: 7,
    lastMainPlacement: "bottom",
    payload: {
      question: "queued draft",
      pendingTurn: { action: "queue" },
      contextPressure: {
        usage: { usedTokens: 1, contextWindow: 10 },
      },
      scroll: { followLatest: false, scrollTop: 240 },
    },
  };
}

describe("detached Agent Chat host contract", () => {
  it("moves a memory-only handoff request without exposing session data in its id", async () => {
    const host = new MockHostAdapter();
    const snapshot = handoffSnapshot();

    const handoffId = await host.openAgentChatWindow({ snapshot });
    const request = await host.takeCurrentAgentChatWindowRequest();

    expect(handoffId).not.toContain(snapshot.clientSessionId);
    expect(handoffId).not.toContain(snapshot.workspaceRoot);
    expect(request).toMatchObject({
      handoffId,
      originWindowLabel: "main",
      snapshot,
    });
    expect(await host.takeCurrentAgentChatWindowRequest()).toBeNull();
  });

  it("routes readiness, owner sync, origin actions, and reattach snapshots", async () => {
    const host = new MockHostAdapter();
    const ready = vi.fn();
    const sync = vi.fn();
    const action = vi.fn();
    const reattach = vi.fn();
    const reattachReady = vi.fn();
    const handles = await Promise.all([
      host.watchAgentChatReady(ready),
      host.watchAgentChatOwnerSync(sync),
      host.watchAgentChatOriginAction(action),
      host.watchAgentChatReattach(reattach),
      host.watchAgentChatReattachReady(reattachReady),
    ]);
    const ownerSync: AgentChatOwnerSync = {
      activeDocument: null,
      quotedContexts: [],
      workspaceRoot: "/workspace",
    };
    const snapshot = handoffSnapshot();

    await host.emitAgentChatReady("main", "opaque");
    await host.routeAgentChatOwnerSync(ownerSync);
    await host.routeAgentChatOriginAction({ type: "reviewChanges" });
    await host.emitAgentChatReattach("main", snapshot);
    await host.acknowledgeAgentChatReattach();

    expect(ready).toHaveBeenCalledWith("opaque");
    expect(sync).toHaveBeenCalledWith(ownerSync);
    expect(action).toHaveBeenCalledWith({ type: "reviewChanges" });
    expect(reattach).toHaveBeenCalledWith(snapshot);
    expect(reattachReady).toHaveBeenCalledOnce();
    handles.forEach((handle) => handle.dispose());
  });

  it("reattaches the event callback without resetting its sequence", async () => {
    const host = new MockHostAdapter();
    const mainEvents = vi.fn();
    const detachedEvents = vi.fn();
    await host.startAgentSession(
      {
        providerId: "codex-app-server",
        executablePreference: { mode: "auto", path: null },
        clientSessionId: "session",
        workspaceRoot: "/workspace",
        permissionMode: "observe",
        networkAccess: false,
        webSearch: false,
        contextProfile: "providerDefaults",
      },
      mainEvents,
    );
    const sequence = host.getAgentEventSequence("session");

    await host.attachAgentSession("session", sequence, detachedEvents);
    await host.respondToAgentApproval({
      clientSessionId: "session",
      requestId: "missing",
      decision: "deny",
    });

    expect(sequence).toBe(1);
    expect(host.getAgentEventSequence("session")).toBe(sequence);
    expect(mainEvents).toHaveBeenCalledTimes(1);
    expect(detachedEvents).not.toHaveBeenCalled();
  });
});
