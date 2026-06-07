import type { DiagramsSectionProps } from "./types";

export function DiagramsSection({
  config,
  onOpenKrokiSettings,
  onUpdateRenderer,
  onUpdateTimeout,
}: DiagramsSectionProps) {
  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-diagrams"
    >
      <h3>Diagrams</h3>
      <p className="preference-section-intro">
        Choose the renderer used for each diagram format.
      </p>
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
  onChange,
}: {
  label: string;
  reviewId: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="preference-field">
      <span className="preference-label">{label}</span>
      <div className="unit-input-row">
        <input
          type="number"
          data-review-id={reviewId}
          min="1000"
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
