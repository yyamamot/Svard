import type { DiagramsSectionProps } from "./types";
import { normalizeSvgAspectRatio } from "../../lib/diagramHtml";
import { sanitizeSvg } from "../../lib/sanitizeHtml";
import { dangerouslySetSafeHtml } from "../../lib/safeHtml";

export function DiagramsSection({
  config,
  onOpenKrokiSettings,
  onUpdateRenderer,
  onUpdateFastDiagramLoading,
  onUpdateTimeout,
  externalPlantUmlTest,
  onRunExternalPlantUmlTest,
  onUpdateExternalPlantUmlFallback,
  onUpdateExternalPlantUmlPath,
}: DiagramsSectionProps) {
  const externalPlantUmlEnabled =
    config.diagram.plantumlExternalFallback === "on-local-failure";
  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-diagrams"
    >
      <h3>Diagrams</h3>
      <p className="preference-section-intro">
        Choose the renderer used for each diagram format.
      </p>
      <label className="checkbox-row checkbox-row-detailed">
        <input
          type="checkbox"
          data-review-id="experimental-diagram-placeholder-rendering-control"
          checked={config.experimental.diagramPlaceholderRendering}
          onChange={(event) => onUpdateFastDiagramLoading(event.target.checked)}
        />
        <span className="checkbox-copy">
          <span>Fast diagram loading</span>
          <span className="preference-help-text">
            Show diagram placeholders first so the document becomes readable
            sooner. This is enabled by default and can be disabled here.
          </span>
        </span>
      </label>
      <div
        className="diagram-settings"
        data-review-id="diagram-renderer-settings"
      >
        <div className="diagram-setting-row" data-review-id="mermaid-renderer">
          <div className="diagram-setting-copy">
            <span className="preference-label">Mermaid</span>
            <p className="preference-help-text">
              Mermaid uses the built-in renderer.
            </p>
          </div>
          <span
            className="diagram-renderer-static"
            data-review-id="mermaid-renderer-built-in"
          >
            Built-in
          </span>
        </div>
        <DiagramRendererSetting
          label="PlantUML"
          helpText="Use the built-in PlantUML renderer, or send diagrams to Kroki."
          name="plantuml-renderer"
          reviewId="plantuml-renderer-control"
          value={config.diagram.plantumlRenderer}
          onChange={(renderer) =>
            onUpdateRenderer("plantumlRenderer", renderer)
          }
          onOpenKrokiSettings={onOpenKrokiSettings}
        />
        <DiagramRendererSetting
          label="Graphviz / DOT"
          helpText="Use the built-in Graphviz renderer, or send diagrams to Kroki."
          name="graphviz-renderer"
          reviewId="graphviz-renderer-control"
          value={config.diagram.graphvizRenderer}
          onChange={(renderer) =>
            onUpdateRenderer("graphvizRenderer", renderer)
          }
          onOpenKrokiSettings={onOpenKrokiSettings}
        />
      </div>
      <details
        className="diagram-advanced"
        data-review-id="diagram-advanced-settings"
      >
        <summary>Advanced</summary>
        <div className="diagram-advanced-controls">
          <TimeoutControl
            label="PlantUML timeout"
            reviewId="plantuml-timeout-control"
            value={config.diagram.plantumlTimeoutMs}
            onChange={(value) => onUpdateTimeout("plantumlTimeoutMs", value)}
          />
          <div
            className="preference-field"
            data-review-id="plantuml-external-fallback-control"
          >
            <span className="preference-label">External PlantUML fallback</span>
            <select
              value={config.diagram.plantumlExternalFallback}
              onChange={(event) =>
                onUpdateExternalPlantUmlFallback(
                  event.target
                    .value as typeof config.diagram.plantumlExternalFallback,
                )
              }
            >
              <option value="disabled">Disabled</option>
              <option value="on-local-failure">On built-in failure</option>
            </select>
            <span className="preference-help-text">
              Uses a user-provided PlantUML binary only after built-in local
              rendering fails. The first uncached render can be slow because it
              starts an external process.
            </span>
          </div>
          <PathControl
            label="PlantUML binary path"
            reviewId="plantuml-external-binary-path"
            value={config.diagram.plantumlExternalBinaryPath}
            disabled={!externalPlantUmlEnabled}
            placeholder="/path/to/plantuml"
            onChange={(value) =>
              onUpdateExternalPlantUmlPath("plantumlExternalBinaryPath", value)
            }
          />
          <PathControl
            label="Graphviz dot path (optional)"
            reviewId="plantuml-external-dot-path"
            value={config.diagram.plantumlExternalDotPath}
            disabled={!externalPlantUmlEnabled}
            placeholder="/path/to/dot"
            helpText="Optional for sequence diagrams. Set this when class, component, deployment, or other Graphviz layout diagrams fail because PlantUML cannot find dot."
            onChange={(value) =>
              onUpdateExternalPlantUmlPath("plantumlExternalDotPath", value)
            }
          />
          <TimeoutControl
            label="External PlantUML timeout"
            reviewId="plantuml-external-timeout-control"
            value={config.diagram.plantumlExternalTimeoutMs}
            onChange={(value) =>
              onUpdateTimeout("plantumlExternalTimeoutMs", value)
            }
          />
          <div
            className="kroki-diagnostic"
            data-review-id="plantuml-external-test"
          >
            <div className="kroki-diagnostic-header">
              <div>
                <strong>External PlantUML test</strong>
                <p className="mode-help">
                  Renders a small Alice/Bob sample through the configured
                  binary. This confirms PlantUML startup, but not Graphviz dot
                  availability.
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
                data-review-id="plantuml-external-test-run"
                disabled={
                  !externalPlantUmlEnabled ||
                  !config.diagram.plantumlExternalBinaryPath ||
                  externalPlantUmlTest.status === "running"
                }
                onClick={onRunExternalPlantUmlTest}
              >
                {externalPlantUmlTest.status === "running"
                  ? "Testing..."
                  : "Test external PlantUML"}
              </button>
            </div>
            <div
              className={`kroki-diagnostic-result ${externalPlantUmlTest.status}`}
              data-review-id="plantuml-external-test-result"
            >
              <ExternalPlantUmlTestResult test={externalPlantUmlTest} />
            </div>
          </div>
          <TimeoutControl
            label="Graphviz / DOT timeout"
            reviewId="graphviz-timeout-control"
            value={config.diagram.graphvizTimeoutMs}
            onChange={(value) => onUpdateTimeout("graphvizTimeoutMs", value)}
          />
        </div>
      </details>
    </section>
  );
}

function PathControl({
  label,
  reviewId,
  value,
  disabled,
  placeholder,
  helpText,
  onChange,
}: {
  label: string;
  reviewId: string;
  value: string | null;
  disabled: boolean;
  placeholder: string;
  helpText?: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="preference-field">
      <span className="preference-label">{label}</span>
      <input
        type="text"
        data-review-id={reviewId}
        value={value ?? ""}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value.trim() || null)}
      />
      {helpText ? (
        <span className="preference-help-text">{helpText}</span>
      ) : null}
    </label>
  );
}

function ExternalPlantUmlTestResult({
  test,
}: {
  test: DiagramsSectionProps["externalPlantUmlTest"];
}) {
  if (test.status === "idle") {
    return <span>Not tested.</span>;
  }
  if (test.status === "running") {
    return <span>Testing external PlantUML...</span>;
  }
  if (test.result?.status === "rendered" && test.result.svg) {
    return (
      <div
        className="kroki-diagnostic-svg"
        data-review-id="plantuml-external-test-svg"
        dangerouslySetInnerHTML={dangerouslySetSafeHtml(
          normalizeSvgAspectRatio(sanitizeSvg(test.result.svg)),
        )}
      />
    );
  }
  if (test.status === "success") {
    return <span>External PlantUML returned SVG successfully.</span>;
  }
  return <span>{test.message ?? "External PlantUML test failed."}</span>;
}

function DiagramRendererSetting({
  label,
  helpText,
  name,
  reviewId,
  value,
  onChange,
  onOpenKrokiSettings,
}: {
  label: string;
  helpText: string;
  name: string;
  reviewId: string;
  value: "local" | "kroki";
  onChange: (value: "local" | "kroki") => void;
  onOpenKrokiSettings: () => void;
}) {
  return (
    <div className="diagram-setting-row">
      <div className="diagram-setting-copy">
        <span className="preference-label">{label}</span>
        <p className="preference-help-text">{helpText}</p>
        {value === "kroki" ? (
          <p className="preference-help-text">
            Uses the endpoint configured in Kroki settings.{" "}
            <button
              className="preference-inline-action"
              type="button"
              data-review-id="diagram-open-kroki-settings"
              onClick={onOpenKrokiSettings}
            >
              Open Kroki settings
            </button>
          </p>
        ) : null}
      </div>
      <RendererControl
        name={name}
        reviewId={reviewId}
        label={`${label} renderer`}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function RendererControl({
  name,
  reviewId,
  label,
  value,
  onChange,
}: {
  name: string;
  reviewId: string;
  label: string;
  value: "local" | "kroki";
  onChange: (value: "local" | "kroki") => void;
}) {
  return (
    <div
      className="segmented-control"
      data-review-id={reviewId}
      role="radiogroup"
      aria-label={label}
    >
      {(["local", "kroki"] as const).map((renderer) => (
        <label
          key={renderer}
          className={`segmented-option ${value === renderer ? "active" : ""}`}
        >
          <input
            type="radio"
            name={name}
            value={renderer}
            checked={value === renderer}
            onChange={() => onChange(renderer)}
          />
          <span>{renderer === "local" ? "Built-in" : "Kroki"}</span>
        </label>
      ))}
    </div>
  );
}

function TimeoutControl({
  label,
  reviewId,
  value,
  min = 1000,
  onChange,
}: {
  label: string;
  reviewId: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="preference-field">
      <span className="preference-label">{label}</span>
      <div className="unit-input-row">
        <input
          type="number"
          data-review-id={reviewId}
          min={min}
          max="60000"
          step="1000"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span data-review-id="diagram-timeout-unit">ms</span>
      </div>
    </div>
  );
}
