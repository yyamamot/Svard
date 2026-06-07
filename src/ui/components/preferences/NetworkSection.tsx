import type { AppConfig } from "../../../core/types";
import type { NetworkSectionProps } from "./types";

export function NetworkSection({ config, onChange }: NetworkSectionProps) {
  const proxyMode = config.network.httpProxy.mode;
  const proxyUrl = config.network.httpProxy.url ?? "";

  function updateHttpProxy(patch: Partial<AppConfig["network"]["httpProxy"]>) {
    onChange({
      ...config,
      network: {
        ...config.network,
        httpProxy: {
          ...config.network.httpProxy,
          ...patch,
        },
      },
    });
  }

  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-network"
    >
      <h3>Network</h3>
      <div className="preference-field">
        <span className="preference-label">HTTP proxy</span>
        <div
          className="segmented-control"
          data-review-id="http-proxy-mode-control"
          role="radiogroup"
          aria-label="HTTP proxy"
        >
          {(["disabled", "custom"] as const).map((mode) => (
            <label
              key={mode}
              className={`segmented-option ${proxyMode === mode ? "active" : ""}`}
            >
              <input
                type="radio"
                name="http-proxy-mode"
                value={mode}
                checked={proxyMode === mode}
                onChange={() => updateHttpProxy({ mode })}
              />
              <span>{mode === "disabled" ? "Disabled" : "Custom"}</span>
            </label>
          ))}
        </div>
      </div>
      <label>
        Proxy URL
        <input
          data-review-id="http-proxy-url-control"
          value={proxyUrl}
          placeholder="http://127.0.0.1:8080"
          disabled={proxyMode !== "custom"}
          onChange={(event) =>
            updateHttpProxy({ url: event.target.value || null })
          }
        />
      </label>
    </section>
  );
}
