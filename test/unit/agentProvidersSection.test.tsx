import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import { defaultConfig } from "../../src/core/defaultConfig";
import type { AgentModelCatalog, AppConfig } from "../../src/core/types";
import { AgentProvidersSection } from "../../src/ui/components/preferences/AgentProvidersSection";
import {
  createReactRootHarness,
  type ReactRootHarness,
} from "./helpers/reactHarness";

describe("AgentProvidersSection model catalog", () => {
  let harness: ReactRootHarness;
  let config: AppConfig;
  let host: MockHostAdapter;

  beforeEach(() => {
    harness = createReactRootHarness();
    config = structuredClone(defaultConfig);
    host = new MockHostAdapter();
  });

  afterEach(() => {
    delete (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_MODEL_CATALOG__?: AgentModelCatalog;
        __SVARD_AGENT_MODEL_CATALOG_ERROR__?: string;
        __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
        __SVARD_AGENT_EXECUTABLE_PICK__?: string | null;
      }
    ).__SVARD_AGENT_MODEL_CATALOG__;
    delete (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_MODEL_CATALOG_ERROR__?: string;
      }
    ).__SVARD_AGENT_MODEL_CATALOG_ERROR__;
    delete (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
      }
    ).__SVARD_AGENT_RUNTIME_LOAD_COUNT__;
    delete (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_EXECUTABLE_PICK__?: string | null;
      }
    ).__SVARD_AGENT_EXECUTABLE_PICK__;
    harness.cleanup();
  });

  function render() {
    harness.render(
      <AgentProvidersSection
        config={config}
        host={host}
        onChange={(next) => {
          config = next;
          render();
        }}
      />,
    );
  }

  it("renders provider models and model-specific reasoning options", async () => {
    render();
    await vi.waitFor(() =>
      expect(
        harness.byReviewId<HTMLSelectElement>("agent-provider-codex-model")
          .options.length,
      ).toBeGreaterThan(2),
    );
    const model = harness.byReviewId<HTMLSelectElement>(
      "agent-provider-codex-model",
    );
    await act(async () => {
      model.value = "codex-fast";
      model.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(config.agentProviders.codex).toMatchObject({
      model: "codex-fast",
      reasoningEffort: "default",
      personality: "default",
    });
    expect(
      harness.byReviewId<HTMLSelectElement>("agent-provider-codex-personality")
        .disabled,
    ).toBe(true);
  });

  it("selects a custom executable without exposing its path and resets to automatic", async () => {
    (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_EXECUTABLE_PICK__?: string | null;
      }
    ).__SVARD_AGENT_EXECUTABLE_PICK__ = "/private/mock/custom/codex";
    render();
    await vi.waitFor(() =>
      expect(
        harness.byReviewId("agent-provider-codex-installation-detail")
          .textContent,
      ).toContain("PATH installation"),
    );
    await act(async () => {
      harness.container
        .querySelector<HTMLButtonElement>(".agent-provider-installation button")
        ?.click();
    });
    expect(config.agentProviders.codex.executable).toEqual({
      mode: "custom",
      path: "/private/mock/custom/codex",
    });
    await vi.waitFor(() =>
      expect(
        harness.byReviewId("agent-provider-codex-installation-detail")
          .textContent,
      ).toContain("Custom executable"),
    );
    expect(harness.container.textContent).not.toContain("/private/mock");
    const reset = [...harness.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Reset to Automatic",
    );
    await act(async () => reset?.click());
    expect(config.agentProviders.codex.executable).toEqual({
      mode: "auto",
      path: null,
    });
  });

  it("preserves a missing saved model as unavailable", async () => {
    config.agentProviders.codex.model = "removed-model";
    render();
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain(
        "This saved model is unavailable.",
      ),
    );
    expect(
      harness.byReviewId<HTMLSelectElement>("agent-provider-codex-model").value,
    ).toBe("removed-model");
  });

  it("reuses the runtime across remounts and refreshes only on request", async () => {
    render();
    await vi.waitFor(() =>
      expect(
        (
          globalThis as typeof globalThis & {
            __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
          }
        ).__SVARD_AGENT_RUNTIME_LOAD_COUNT__,
      ).toBe(1),
    );
    harness.render(<div>Other section</div>);
    render();
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Codex Balanced"),
    );
    expect(
      (
        globalThis as typeof globalThis & {
          __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
        }
      ).__SVARD_AGENT_RUNTIME_LOAD_COUNT__,
    ).toBe(1);

    const refresh = Array.from(
      harness.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Refresh Codex");
    expect(refresh).toBeDefined();
    await act(async () => {
      refresh?.click();
    });
    await vi.waitFor(() =>
      expect(
        (
          globalThis as typeof globalThis & {
            __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
          }
        ).__SVARD_AGENT_RUNTIME_LOAD_COUNT__,
      ).toBe(2),
    );
  });

  it("keeps a failed catalog result cached across remounts", async () => {
    (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_MODEL_CATALOG_ERROR__?: string;
      }
    ).__SVARD_AGENT_MODEL_CATALOG_ERROR__ = "Catalog unavailable.";
    render();
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Catalog unavailable."),
    );
    harness.render(<div>Other section</div>);
    render();
    await vi.waitFor(() =>
      expect(harness.container.textContent).toContain("Catalog unavailable."),
    );
    expect(
      (
        globalThis as typeof globalThis & {
          __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
        }
      ).__SVARD_AGENT_RUNTIME_LOAD_COUNT__,
    ).toBe(1);
  });
});
