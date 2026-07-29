import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  codexAppServerCapabilities,
  type AgentProbe,
} from "../../src/core/types";
import {
  AgentContextMenu,
  agentContextPressure,
  agentContextPressureLabel,
  formatAgentContextTokens,
  formatAgentTokenCount,
  nonCachedAgentInput,
} from "../../src/ui/agent/AgentContextMenu";
import type { AgentSessionController } from "../../src/ui/agent/useAgentSessionController";

describe("Agent context meter", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });
  it("uses the contracted remaining-context thresholds", () => {
    expect(agentContextPressure(26)).toBe("normal");
    expect(agentContextPressure(25)).toBe("gettingFull");
    expect(agentContextPressure(11)).toBe("gettingFull");
    expect(agentContextPressure(10)).toBe("nearlyFull");
    expect(agentContextPressureLabel("gettingFull")).toBe("Getting full");
    expect(formatAgentContextTokens(187_500)).toBe("187.5K");
  });

  it("formats exact diagnostic values and derives non-cached input", () => {
    const usage = {
      inputTokens: 187_000,
      cachedInputTokens: 180_000,
      outputTokens: 500,
      reasoningOutputTokens: 300,
      totalTokens: 187_500,
    };
    expect(formatAgentTokenCount(usage.totalTokens)).toBe("187,500");
    expect(nonCachedAgentInput(usage)).toBe(7_000);
  });

  it("hides unsupported diagnostics and keeps available details collapsed", async () => {
    const shell = document.createElement("div");
    shell.className = "app-shell";
    const container = document.createElement("div");
    shell.appendChild(container);
    document.body.appendChild(shell);
    const root = createRoot(container);
    const session = {
      activeTurnId: null,
      compactContext: () => Promise.resolve(),
      contextCompactionStatus: "idle",
      contextUsage: {
        usedTokens: 187_500,
        contextWindowTokens: 250_000,
        remainingPercent: 25,
      },
      lastCompaction: null,
      sessionReady: true,
      setAddMenuOpen: () => undefined,
      setHistoryOpen: () => undefined,
      setSettingsOpen: () => undefined,
      state: { turns: [{}] },
      tokenUsageDiagnostics: {
        latestRequest: {
          provenance: "providerReported",
          usage: {
            inputTokens: 187_000,
            cachedInputTokens: 180_000,
            outputTokens: 500,
            reasoningOutputTokens: 300,
            totalTokens: 187_500,
          },
        },
        turn: null,
        conversation: {
          provenance: "providerReported",
          usage: {
            inputTokens: 187_000,
            cachedInputTokens: 180_000,
            outputTokens: 500,
            reasoningOutputTokens: 300,
            totalTokens: 187_500,
          },
        },
      },
    } as unknown as AgentSessionController;
    const probe = {
      providerId: "codex-app-server",
      state: "ready",
      source: "path",
      capabilities: { ...codexAppServerCapabilities },
    } satisfies AgentProbe;

    await act(async () => {
      root.render(
        <AgentContextMenu
          placement="right"
          probe={{
            ...probe,
            capabilities: Object.fromEntries(
              Object.keys(probe.capabilities).map((key) => [key, false]),
            ) as unknown as AgentProbe["capabilities"],
          }}
          session={session}
          workspaceRoot="/workspace"
        />,
      );
    });
    expect(
      container.querySelector('[data-review-id="agent-context-trigger"]'),
    ).toBeNull();

    await act(async () => {
      root.render(
        <AgentContextMenu
          placement="right"
          probe={probe}
          session={session}
          workspaceRoot="/workspace"
        />,
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });
    const details = document.querySelector<HTMLDetailsElement>(
      '[data-review-id="agent-token-details"]',
    );
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(
      document.querySelector('[data-review-id="agent-token-details-content"]'),
    ).not.toBeNull();

    await act(async () => root.unmount());
  });
});
