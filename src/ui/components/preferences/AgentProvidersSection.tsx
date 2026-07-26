import { useEffect, useState } from "react";
import type {
  AgentModelDescriptor,
  AgentProbe,
  AgentProviderRuntimeSnapshot,
  AppConfig,
} from "../../../core/types";
import type { AgentProvidersSectionProps } from "./types";

const probeLabels: Record<AgentProbe["state"], string> = {
  notFound: "Not installed",
  broken: "Needs attention",
  authenticationRequired: "Sign in required",
  ready: "Ready",
  unsupportedVersion: "Update required",
};

export function AgentProvidersSection({
  config,
  host,
  onChange,
}: AgentProvidersSectionProps) {
  const codex = config.agentProviders.codex;
  const [runtime, setRuntime] = useState<AgentProviderRuntimeSnapshot | null>(
    () => host.peekAgentProviderRuntime("codex-app-server", codex.executable),
  );
  const [probing, setProbing] = useState(runtime === null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const probe = runtime?.probe ?? null;
  const catalog = runtime?.catalog ?? null;

  async function loadCodexRuntime(refresh = false) {
    const cached = host.peekAgentProviderRuntime(
      "codex-app-server",
      codex.executable,
    );
    if (refresh || !cached) {
      setProbing(true);
    } else {
      setRuntime(cached);
    }
    setProbeError(null);
    try {
      setRuntime(
        await host.getAgentProviderRuntime("codex-app-server", {
          refresh,
          executablePreference: codex.executable,
        }),
      );
    } catch (error) {
      setProbeError(
        error instanceof Error
          ? error.message
          : "Codex models could not be refreshed.",
      );
    } finally {
      setProbing(false);
    }
  }

  useEffect(() => {
    void loadCodexRuntime();
    // The host instance is stable for the lifetime of the Preferences page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, codex.executable.mode, codex.executable.path]);

  function updateCodex(patch: Partial<AppConfig["agentProviders"]["codex"]>) {
    onChange({
      ...config,
      agentProviders: {
        ...config.agentProviders,
        activeProvider: "codex-app-server",
        codex: { ...codex, ...patch },
      },
    });
  }

  const defaultModel = catalog?.models.find((model) => model.isDefault) ?? null;
  const selectedModel = codex.model
    ? (catalog?.models.find((model) => model.model === codex.model) ?? null)
    : defaultModel;
  const savedModelUnavailable =
    codex.model !== null &&
    (Boolean(probeError || runtime?.issue) ||
      Boolean(probe && probe.state !== "ready") ||
      Boolean(
        catalog && !catalog.models.some((model) => model.model === codex.model),
      ));
  const supportedEfforts = selectedModel?.supportedReasoningEfforts ?? [];
  const savedEffortUnavailable =
    codex.reasoningEffort !== "default" &&
    !supportedEfforts.some((effort) => effort.value === codex.reasoningEffort);
  const personalitySupported = selectedModel?.supportsPersonality !== false;

  useEffect(() => {
    if (
      selectedModel &&
      !selectedModel.supportsPersonality &&
      codex.personality !== "default"
    ) {
      updateCodex({ personality: "default" });
    }
    // Only provider capability changes should normalize this saved value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel?.model, selectedModel?.supportsPersonality]);

  function changeModel(model: string) {
    updateCodex({
      model: model || null,
      reasoningEffort: "default",
      personality: "default",
    });
  }

  async function chooseExecutable() {
    const preference = await host.pickAgentExecutable("codex-app-server");
    if (preference) updateCodex({ executable: preference });
  }

  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-agent-providers"
    >
      <h3>AI Providers</h3>
      <p className="preference-section-intro">
        Choose how workspace chat runs. Codex is available now; additional local
        CLI providers will use the same chat and approval interface.
      </p>

      <div className="provider-card agent-provider-card">
        <div className="provider-card-head">
          <div>
            <h4>Codex CLI</h4>
            <p className="mode-help">Primary provider · app-server</p>
          </div>
          <span
            className={`provider-token-status ${
              probe?.state === "ready" ? "stored" : ""
            }`}
            data-review-id="agent-provider-codex-status"
          >
            {probing
              ? "Checking…"
              : probe
                ? probeLabels[probe.state]
                : "Not checked"}
          </span>
        </div>

        <div className="agent-provider-installation">
          <label>
            Codex installation
            <select
              data-review-id="agent-provider-codex-installation"
              value={codex.executable.mode}
              onChange={(event) => {
                if (event.target.value === "auto") {
                  updateCodex({
                    executable: { mode: "auto", path: null },
                  });
                } else {
                  void chooseExecutable();
                }
              }}
            >
              <option value="auto">Automatic</option>
              {codex.executable.mode === "custom" ? (
                <option value="custom">Custom executable</option>
              ) : null}
            </select>
          </label>
          <span
            className="mode-help"
            data-review-id="agent-provider-codex-installation-detail"
          >
            {runtime?.installation
              ? `${runtime.installation.displayName} · ${runtime.installation.version}`
              : codex.executable.mode === "custom"
                ? "Custom executable needs attention."
                : "Svard checks standard Codex installations automatically."}
          </span>
          <div className="provider-card-actions">
            <button type="button" onClick={() => void chooseExecutable()}>
              Choose executable…
            </button>
            {codex.executable.mode === "custom" ? (
              <button
                type="button"
                onClick={() =>
                  updateCodex({
                    executable: { mode: "auto", path: null },
                  })
                }
              >
                Reset to Automatic
              </button>
            ) : null}
          </div>
        </div>

        <label>
          Model
          <select
            data-review-id="agent-provider-codex-model"
            value={codex.model ?? ""}
            onChange={(event) => changeModel(event.target.value)}
          >
            <option value="">
              Codex default
              {defaultModel ? ` — ${defaultModel.displayName}` : ""}
            </option>
            {savedModelUnavailable ? (
              <option value={codex.model ?? ""}>
                Unavailable — {codex.model}
              </option>
            ) : null}
            {catalog?.models.map((model) => (
              <option key={model.id} value={model.model}>
                {model.displayName}
              </option>
            ))}
          </select>
          {selectedModel ? (
            <>
              <span className="mode-help">{selectedModel.description}</span>
              <span className="mode-help">
                Inputs: {formatInputModalities(selectedModel)}
              </span>
            </>
          ) : (
            <span className="mode-help">
              Uses the current default from Codex.
            </span>
          )}
          {savedModelUnavailable ? (
            <span
              className="notice error"
              data-review-id="agent-model-unavailable"
            >
              This saved model is unavailable. Choose Codex default or another
              available model before starting a new chat.
            </span>
          ) : null}
          {catalog && catalog.models.length === 0 ? (
            <span className="notice error">
              Codex did not report any available models. Codex default remains
              available.
            </span>
          ) : null}
        </label>

        <div className="agent-provider-setting-grid">
          <label>
            Reasoning effort
            <select
              data-review-id="agent-provider-codex-reasoning"
              value={codex.reasoningEffort}
              onChange={(event) =>
                updateCodex({
                  reasoningEffort: event.target
                    .value as AppConfig["agentProviders"]["codex"]["reasoningEffort"],
                })
              }
            >
              <option value="default">
                Model default
                {selectedModel?.defaultReasoningEffort
                  ? ` — ${selectedModel.defaultReasoningEffort}`
                  : ""}
              </option>
              {savedEffortUnavailable ? (
                <option value={codex.reasoningEffort}>
                  Unavailable — {codex.reasoningEffort}
                </option>
              ) : null}
              {supportedEfforts.map((effort) => (
                <option key={effort.value} value={effort.value}>
                  {formatEffort(effort.value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Response style
            <select
              data-review-id="agent-provider-codex-personality"
              value={codex.personality}
              disabled={!personalitySupported}
              onChange={(event) =>
                updateCodex({
                  personality: event.target
                    .value as AppConfig["agentProviders"]["codex"]["personality"],
                })
              }
            >
              <option value="default">Codex default</option>
              <option value="friendly">Friendly</option>
              <option value="pragmatic">Pragmatic</option>
              <option value="none">Neutral</option>
            </select>
            {!personalitySupported ? (
              <span className="mode-help">
                Response styles are not supported by this model.
              </span>
            ) : null}
          </label>
        </div>

        <label>
          Default permission
          <select
            data-review-id="agent-provider-codex-permission"
            value={codex.permissionMode}
            onChange={(event) =>
              updateCodex({
                permissionMode: event.target
                  .value as AppConfig["agentProviders"]["codex"]["permissionMode"],
              })
            }
          >
            <option value="observe">Observe · read only</option>
            <option value="agent">Agent · workspace write</option>
            <option value="fullAccess">Full Access · confirm each chat</option>
          </select>
          <span className="mode-help">
            Full Access still requires explicit confirmation when a chat starts.
          </span>
        </label>

        <div className="agent-provider-toggles">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={codex.networkAccess}
              onChange={(event) =>
                updateCodex({ networkAccess: event.target.checked })
              }
            />
            <span>Allow network access by default</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={codex.webSearch}
              onChange={(event) =>
                updateCodex({ webSearch: event.target.checked })
              }
            />
            <span>Enable web search by default</span>
          </label>
        </div>

        <div className="provider-card-actions">
          <button
            type="button"
            disabled={probing}
            onClick={() => void loadCodexRuntime(true)}
          >
            {probing ? "Refreshing…" : "Refresh Codex"}
          </button>
        </div>
        {probe?.version ? (
          <p className="mode-help">Detected {probe.version}</p>
        ) : null}
        {probeError || runtime?.issue ? (
          <p className="notice error">
            {probeError ?? runtime?.issue?.message} Codex default remains
            available; explicit saved models cannot start a new chat until
            refreshed.
          </p>
        ) : null}
      </div>

      <div className="agent-provider-roadmap" aria-label="Planned providers">
        <ProviderRoadmapCard
          name="Claude Code CLI"
          detail="Planned provider adapter"
        />
        <ProviderRoadmapCard
          name="GitHub Copilot CLI"
          detail="Planned provider adapter"
        />
      </div>
    </section>
  );
}

function formatInputModalities(model: AgentModelDescriptor): string {
  return model.inputModalities
    .map((modality) => (modality === "image" ? "images" : "text"))
    .join(", ");
}

function formatEffort(value: string): string {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function ProviderRoadmapCard({
  name,
  detail,
}: {
  name: string;
  detail: string;
}) {
  return (
    <div className="provider-card agent-provider-card planned" aria-disabled>
      <div className="provider-card-head">
        <div>
          <h4>{name}</h4>
          <p className="mode-help">{detail}</p>
        </div>
        <span className="provider-token-status">Coming later</span>
      </div>
      <p className="mode-help">
        This provider is shown to clarify the multi-provider direction. It
        cannot be selected yet.
      </p>
    </div>
  );
}
