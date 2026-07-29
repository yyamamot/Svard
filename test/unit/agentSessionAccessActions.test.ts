import { describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../../src/core/defaultConfig";
import { codexAppServerCapabilities } from "../../src/core/types";
import {
  createAgentContextProfileSelector,
  createRestartSessionFromProviderDefaults,
  effectiveContextProfile,
} from "../../src/ui/agent/agentSessionAccessActions";

describe("agent session context profile actions", () => {
  it("keeps the saved focused preference while using provider defaults when unsupported", () => {
    const codex = structuredClone(defaultConfig.agentProviders.codex);
    expect(
      effectiveContextProfile(codex, {
        providerId: "codex-app-server",
        probe: {
          providerId: "codex-app-server",
          state: "ready",
          source: "path",
          capabilities: {
            ...codexAppServerCapabilities,
            focusedContext: false,
          },
        },
        installation: null,
        catalog: null,
        issue: null,
      }),
    ).toBe("providerDefaults");
    expect(codex.contextProfile).toBe("focused");
  });

  it("updates idle preview and starts a preserving transaction for an open session", async () => {
    const setContextProfile = vi.fn();
    const startSessionTransaction = vi.fn().mockResolvedValue(true);
    const idleSelect = createAgentContextProfileSelector({
      permissionMode: "observe",
      runtime: null,
      sessionOpen: () => false,
      setContextProfile,
      startSessionTransaction,
    });
    await idleSelect("providerDefaults");
    expect(setContextProfile).toHaveBeenCalledWith("providerDefaults");
    expect(startSessionTransaction).not.toHaveBeenCalled();

    const activeSelect = createAgentContextProfileSelector({
      permissionMode: "agent",
      runtime: {
        providerId: "codex-app-server",
        probe: {
          providerId: "codex-app-server",
          state: "ready",
          source: "path",
          capabilities: codexAppServerCapabilities,
        },
        installation: null,
        catalog: null,
        issue: null,
      },
      sessionOpen: () => true,
      setContextProfile,
      startSessionTransaction,
    });
    await activeSelect("focused");
    expect(startSessionTransaction).toHaveBeenCalledWith({
      nextMode: "agent",
      nextContextProfile: "focused",
      preserveComposerContext: true,
    });
  });

  it("routes full-access provider defaults through confirmation", async () => {
    const startSessionTransaction = vi.fn().mockResolvedValue(true);
    const requestFullAccessConfirmation = vi.fn();
    const restart = createRestartSessionFromProviderDefaults({
      clearIdleSession: vi.fn(),
      codexDefaults: {
        ...defaultConfig.agentProviders.codex,
        permissionMode: "fullAccess",
      },
      contextProfile: "focused",
      requestFullAccessConfirmation,
      sessionOpen: () => true,
      startSessionTransaction,
    });
    await restart();
    expect(requestFullAccessConfirmation).toHaveBeenCalledOnce();
    expect(startSessionTransaction).not.toHaveBeenCalled();
    await requestFullAccessConfirmation.mock.calls[0]?.[0]();
    expect(startSessionTransaction).toHaveBeenCalledWith({
      nextMode: "fullAccess",
      nextNetworkAccess: false,
      nextWebSearch: false,
      nextContextProfile: "focused",
    });
  });
});
