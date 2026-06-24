import {
  localKrokiEndpointPlaceholder,
  publicKrokiEndpoint,
} from "../../../core/defaultConfig";
import { normalizeSvgAspectRatio } from "../../lib/diagramHtml";
import { sanitizeSvg } from "../../lib/sanitizeHtml";
import { dangerouslySetSafeHtml } from "../../lib/safeHtml";
import type { AppConfig } from "../../../core/types";
import type { KrokiSectionProps } from "./types";

export function KrokiSection({
  config,
  krokiModeHelpText,
  krokiTest,
  onChange,
  onRunKrokiTest,
  onUpdateKrokiMode,
}: KrokiSectionProps) {
  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-kroki"
    >
      <h3>Kroki</h3>
      <label>
        Mode
        <select
          data-review-id="kroki-mode-control"
          value={config.kroki.mode}
          onChange={(event) =>
            onUpdateKrokiMode(event.target.value as AppConfig["kroki"]["mode"])
          }
        >
          <option value="disabled">Disabled</option>
          <option value="remote">Remote / self-managed</option>
          <option value="public">Public kroki.io</option>
        </select>
      </label>
      <label>
        Endpoint URL
        <input
          data-review-id="kroki-endpoint-control"
          value={
            config.kroki.mode === "public"
              ? publicKrokiEndpoint
              : (config.kroki.endpointUrl ?? "")
          }
          placeholder={localKrokiEndpointPlaceholder}
          disabled={config.kroki.mode === "public"}
          onChange={(event) =>
            onChange({
              ...config,
              kroki: {
                ...config.kroki,
                endpointUrl: event.target.value || null,
              },
            })
          }
        />
        <span className="mode-help" data-review-id="kroki-mode-help">
          {krokiModeHelpText}
        </span>
      </label>
      <div className="readonly-row">
        <span>Output format</span>
        <select
          data-review-id="kroki-output-control"
          value={config.kroki.outputFormat}
          onChange={(event) =>
            onChange({
              ...config,
              kroki: {
                ...config.kroki,
                outputFormat: event.target
                  .value as AppConfig["kroki"]["outputFormat"],
              },
            })
          }
        >
          <option value="svg">SVG</option>
          <option value="png">PNG</option>
        </select>
      </div>
      <div className="readonly-row">
        <span>Cache policy</span>
        <strong>{config.kroki.cacheEnabled ? "Enabled" : "Disabled"}</strong>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          data-review-id="kroki-remote-confirmation-control"
          checked={
            config.kroki.mode === "public" ||
            config.kroki.requireRemoteConfirmation
          }
          disabled={config.kroki.mode === "public"}
          onChange={(event) =>
            onChange({
              ...config,
              kroki: {
                ...config.kroki,
                requireRemoteConfirmation: event.target.checked,
              },
            })
          }
        />
        <span>Require confirmation before remote diagram rendering</span>
      </label>
      <p className="mode-help" data-review-id="kroki-privacy-note">
        Remote sends diagram source to the configured endpoint. Public kroki.io
        always requires confirmation.
      </p>
      <div className="kroki-diagnostic" data-review-id="kroki-diagnostic">
        <div className="kroki-diagnostic-header">
          <div>
            <strong>PlantUML diagnostic</strong>
            <p className="mode-help">
              Renders a small Alice/Bob sample with the current Kroki settings.
            </p>
          </div>
          <button
            type="button"
            data-review-id="kroki-test-run"
            disabled={krokiTest.status === "running"}
            onClick={onRunKrokiTest}
          >
            {krokiTest.status === "running" ? "Testing..." : "Test render"}
          </button>
        </div>
        <div
          className={`kroki-diagnostic-result ${krokiTest.status}`}
          data-review-id="kroki-test-result"
        >
          <KrokiTestResult krokiTest={krokiTest} />
        </div>
      </div>
    </section>
  );
}

function KrokiTestResult({ krokiTest }: Pick<KrokiSectionProps, "krokiTest">) {
  if (krokiTest.status === "idle") {
    return <span>Not tested yet.</span>;
  }
  if (krokiTest.status === "running") {
    return <span>Rendering Alice/Bob with Kroki...</span>;
  }
  if (
    krokiTest.result?.status === "rendered" &&
    krokiTest.result.mediaType === "image/svg+xml" &&
    krokiTest.result.content
  ) {
    return (
      <div
        className="kroki-diagnostic-svg"
        data-review-id="kroki-test-svg"
        dangerouslySetInnerHTML={dangerouslySetSafeHtml(
          normalizeSvgAspectRatio(sanitizeSvg(krokiTest.result.content)),
        )}
      />
    );
  }
  if (
    krokiTest.result?.status === "rendered" &&
    krokiTest.result.mediaType === "image/png" &&
    krokiTest.result.content
  ) {
    return (
      <img
        className="kroki-diagnostic-image"
        data-review-id="kroki-test-image"
        alt="Kroki PlantUML diagnostic result"
        src={`data:image/png;base64,${krokiTest.result.content}`}
      />
    );
  }
  return <span>{krokiTest.message ?? "Kroki test failed."}</span>;
}
