import { useState } from "react";
import type { AppConfig } from "../../../core/types";
import type { RemoteProvidersSectionProps } from "./types";

type ProviderId = "github" | "gitlab";

const providerLabels: Record<ProviderId, string> = {
  github: "GitHub",
  gitlab: "GitLab",
};

const providerTargetLabels: Record<ProviderId, string> = {
  github: "PR target",
  gitlab: "MR target",
};

export function RemoteProvidersSection({
  config,
  host,
  onChange,
}: RemoteProvidersSectionProps) {
  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-remote-providers"
    >
      <h3>PR / MR Providers</h3>
      <p className="mode-help">
        Used by Source Control &gt; Branch Diff to detect PR/MR target branches.
      </p>
      <p className="mode-help">
        Workflow: set token, enable provider, open Source Control &gt; Branch
        Diff, then choose PR target or MR target.
      </p>
      <p className="mode-help">
        Tokens are stored in the OS credential store and are never saved in app
        config.
      </p>
      {(["github", "gitlab"] as const).map((provider) => (
        <RemoteProviderCard
          key={provider}
          provider={provider}
          config={config}
          host={host}
          onChange={onChange}
        />
      ))}
    </section>
  );
}

function RemoteProviderCard({
  provider,
  config,
  host,
  onChange,
}: RemoteProvidersSectionProps & { provider: ProviderId }) {
  const providerConfig = config.remoteProviders[provider];
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateProvider(
    patch: Partial<AppConfig["remoteProviders"][ProviderId]>,
  ) {
    onChange({
      ...config,
      remoteProviders: {
        ...config.remoteProviders,
        [provider]: {
          ...providerConfig,
          ...patch,
        },
      },
    });
  }

  async function saveToken() {
    setBusy(true);
    setMessage(null);
    try {
      const status = await host.saveProviderToken(
        provider,
        providerConfig.hostUrl,
        token,
      );
      updateProvider({ tokenStored: status.stored });
      setToken("");
      setMessage(status.message ?? "Token stored.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to store token.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeToken() {
    setBusy(true);
    setMessage(null);
    try {
      const status = await host.deleteProviderToken(
        provider,
        providerConfig.hostUrl,
      );
      updateProvider({
        tokenStored: status.stored,
        lastTestStatus: null,
      });
      setToken("");
      setMessage(status.message ?? "Token removed.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to remove token.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await host.testProviderConnection(
        provider,
        providerConfig.hostUrl,
        config.network,
      );
      updateProvider({ lastTestStatus: result });
      setMessage(result.message ?? "Connection test finished.");
    } catch (error) {
      const result = {
        status: "error" as const,
        message:
          error instanceof Error
            ? error.message
            : "Provider connection test failed.",
      };
      updateProvider({ lastTestStatus: result });
      setMessage(result.message);
    } finally {
      setBusy(false);
    }
  }

  const tokenActionLabel = providerConfig.tokenStored
    ? "Replace token"
    : "Set token";
  const targetLabel = providerTargetLabels[provider];

  return (
    <div
      className="provider-card"
      data-review-id={`remote-provider-${provider}`}
    >
      <div className="provider-card-head">
        <h4>{providerLabels[provider]}</h4>
        <span
          className={`provider-token-status ${
            providerConfig.tokenStored ? "stored" : ""
          }`}
          data-review-id={`remote-provider-${provider}-token-status`}
        >
          {providerConfig.tokenStored
            ? `Ready for ${targetLabel} detection`
            : "Not configured"}
        </span>
      </div>
      <label>
        Host URL
        <input
          data-review-id={`remote-provider-${provider}-host`}
          value={providerConfig.hostUrl}
          onChange={(event) =>
            updateProvider({
              hostUrl: event.target.value,
              tokenStored: false,
              lastTestStatus: null,
            })
          }
        />
      </label>
      <label>
        API token
        <input
          data-review-id={`remote-provider-${provider}-token`}
          type="password"
          value={token}
          placeholder={providerConfig.tokenStored ? "Stored token" : "Token"}
          onChange={(event) => setToken(event.target.value)}
          autoComplete="off"
        />
        <span className="mode-help">
          Required for private repositories or API access.
        </span>
      </label>
      <label className="checkbox-row provider-enable-row">
        <input
          type="checkbox"
          data-review-id={`remote-provider-${provider}-enabled`}
          checked={providerConfig.enabled}
          onChange={(event) =>
            updateProvider({ enabled: event.target.checked })
          }
        />
        <span className="provider-enable-label">
          Use {providerLabels[provider]} to detect {targetLabel} branches
        </span>
      </label>
      <div className="provider-card-actions">
        <button
          type="button"
          data-review-id={`remote-provider-${provider}-save-token`}
          disabled={busy || !token.trim()}
          onClick={() => void saveToken()}
        >
          {tokenActionLabel}
        </button>
        <button
          type="button"
          data-review-id={`remote-provider-${provider}-remove-token`}
          disabled={busy || !providerConfig.tokenStored}
          onClick={() => void removeToken()}
        >
          Remove token
        </button>
        <button
          type="button"
          data-review-id={`remote-provider-${provider}-test`}
          disabled={busy || !providerConfig.tokenStored}
          onClick={() => void testConnection()}
        >
          Test connection
        </button>
      </div>
      {providerConfig.lastTestStatus ? (
        <p
          className={`mode-help provider-test-${providerConfig.lastTestStatus.status}`}
          data-review-id={`remote-provider-${provider}-test-result`}
        >
          {providerConfig.lastTestStatus.message ??
            providerConfig.lastTestStatus.status}
        </p>
      ) : null}
      {message ? <p className="mode-help">{message}</p> : null}
    </div>
  );
}
