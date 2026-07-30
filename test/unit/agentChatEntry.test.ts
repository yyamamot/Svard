import { afterEach, describe, expect, it, vi } from "vitest";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import {
  agentChatEntryStateFromRuntime,
  resolveAgentChatEntry,
} from "../../src/ui/agent/agentChatEntry";
import type { AgentProviderState } from "../../src/core/types";

const executablePreference = { mode: "auto" as const, path: null };

function runtimeOverrides() {
  return globalThis as typeof globalThis & {
    __SVARD_AGENT_PROVIDER_STATE__?: AgentProviderState;
    __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
  };
}

afterEach(() => {
  delete runtimeOverrides().__SVARD_AGENT_PROVIDER_STATE__;
  delete runtimeOverrides().__SVARD_AGENT_RUNTIME_LOAD_COUNT__;
  vi.restoreAllMocks();
});

describe("AI Chat entry provider resolution", () => {
  it("maps every non-ready provider state to setup", async () => {
    const host = new MockHostAdapter();
    const ready = await host.getAgentProviderRuntime("codex-app-server", {
      executablePreference,
    });

    expect(agentChatEntryStateFromRuntime(null)).toBe("unknown");
    expect(agentChatEntryStateFromRuntime(ready)).toBe("ready");
    for (const state of [
      "notFound",
      "broken",
      "authenticationRequired",
      "unsupportedVersion",
    ] satisfies AgentProviderState[]) {
      expect(
        agentChatEntryStateFromRuntime({
          ...ready,
          probe: { ...ready.probe, state },
        }),
      ).toBe("setupRequired");
    }
  });

  it("probes once when the runtime cache is empty", async () => {
    const host = new MockHostAdapter();

    await expect(
      resolveAgentChatEntry(host, executablePreference),
    ).resolves.toBe("ready");
    await expect(
      resolveAgentChatEntry(host, executablePreference),
    ).resolves.toBe("ready");
    expect(runtimeOverrides().__SVARD_AGENT_RUNTIME_LOAD_COUNT__).toBe(1);
  });

  it("does not re-probe a cached non-ready provider", async () => {
    const host = new MockHostAdapter();
    runtimeOverrides().__SVARD_AGENT_PROVIDER_STATE__ = "notFound";
    await host.getAgentProviderRuntime("codex-app-server", {
      executablePreference,
    });
    const getRuntime = vi.spyOn(host, "getAgentProviderRuntime");

    await expect(
      resolveAgentChatEntry(host, executablePreference),
    ).resolves.toBe("setupRequired");
    expect(getRuntime).not.toHaveBeenCalled();
  });

  it("treats a probe failure as setup required", async () => {
    const host = new MockHostAdapter();
    vi.spyOn(host, "getAgentProviderRuntime").mockRejectedValue(
      new Error("/private/provider/path failed"),
    );

    await expect(
      resolveAgentChatEntry(host, executablePreference),
    ).resolves.toBe("setupRequired");
  });
});
