import type { GeneralSectionProps } from "./types";

export function GeneralSection({
  config,
  zoomValue,
  onUpdateTheme,
  onUpdateAsciiDocTheme,
  onUpdateZoom,
  onUpdateZoomWithMouseWheel,
  onUpdatePostDiffGitMarkers,
  onUpdateChangeReviewDisplay,
}: GeneralSectionProps) {
  const changeReviewDisplay =
    config.experimental.changeReviewDisplay ?? "detailed";

  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-general"
    >
      <h3>General</h3>
      <div className="preference-field">
        <span className="preference-label">Theme</span>
        <div
          className="segmented-control"
          data-review-id="theme-control"
          role="radiogroup"
          aria-label="Theme"
        >
          {(["light", "dark"] as const).map((theme) => (
            <label
              key={theme}
              className={`segmented-option ${config.theme === theme ? "active" : ""}`}
            >
              <input
                type="radio"
                name="theme"
                value={theme}
                checked={config.theme === theme}
                onChange={() => onUpdateTheme(theme)}
              />
              <span>{theme === "light" ? "Light" : "Dark"}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="preference-field">
        <span className="preference-label">AsciiDoc theme</span>
        <div
          className="segmented-control"
          data-review-id="asciidoc-theme-control"
          role="radiogroup"
          aria-label="AsciiDoc theme"
        >
          {(["antora", "asciidoctor"] as const).map((asciidocTheme) => (
            <label
              key={asciidocTheme}
              className={`segmented-option ${
                config.reader.asciidocTheme === asciidocTheme ? "active" : ""
              }`}
            >
              <input
                type="radio"
                name="asciidoc-theme"
                value={asciidocTheme}
                checked={config.reader.asciidocTheme === asciidocTheme}
                onChange={() => onUpdateAsciiDocTheme(asciidocTheme)}
              />
              <span>
                {asciidocTheme === "asciidoctor" ? "Asciidoctor" : "Antora"}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="preference-field" data-review-id="zoom-control">
        <div className="zoom-header">
          <span className="preference-label">Zoom</span>
          <output data-review-id="zoom-value">{zoomValue}%</output>
        </div>
        <div className="zoom-slider-row">
          <span className="zoom-bound">80</span>
          <input
            type="range"
            data-review-id="zoom-slider"
            min="80"
            max="140"
            step="10"
            value={zoomValue}
            aria-label="Zoom"
            onChange={(event) => onUpdateZoom(Number(event.target.value))}
          />
          <span className="zoom-bound">140</span>
          <button
            type="button"
            className="button subtle"
            data-review-id="zoom-reset"
            disabled={zoomValue === 100}
            onClick={() => onUpdateZoom(100)}
          >
            Reset
          </button>
        </div>
        <label className="checkbox-row checkbox-row-detailed">
          <input
            type="checkbox"
            data-review-id="zoom-wheel-toggle"
            checked={config.zoomWithMouseWheel}
            onChange={(event) =>
              onUpdateZoomWithMouseWheel(event.target.checked)
            }
          />
          <span className="checkbox-copy">
            <span>Zoom with mouse wheel</span>
            <span className="preference-help-text">
              Use Command + scroll on macOS or Ctrl + scroll on Windows and
              Linux.
            </span>
          </span>
        </label>
      </div>
      <div className="preference-field">
        <span className="preference-label">Diff</span>
        <div className="change-review-settings">
          <label className="checkbox-row checkbox-row-detailed">
            <input
              type="checkbox"
              data-review-id="general-post-diff-git-markers-control"
              checked={config.experimental.postDiffGitMarkers}
              onChange={(event) =>
                onUpdatePostDiffGitMarkers(event.target.checked)
              }
            />
            <span className="checkbox-copy">
              <span>Change Review Mode</span>
              <span className="preference-help-text">
                Show working tree changes directly in the viewer. Diff Preview
                handoff markers are also kept for the current document.
              </span>
            </span>
          </label>
          <div className="change-review-display-setting">
            <span className="preference-sub-label">Display style</span>
            <div
              className="segmented-control"
              data-review-id="change-review-display-control"
              role="radiogroup"
              aria-label="Change review display"
            >
              {(["detailed", "subtle"] as const).map((display) => (
                <label
                  key={display}
                  className={`segmented-option ${
                    changeReviewDisplay === display ? "active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="change-review-display"
                    value={display}
                    checked={changeReviewDisplay === display}
                    onChange={() => onUpdateChangeReviewDisplay(display)}
                  />
                  <span>{display === "detailed" ? "Detailed" : "Subtle"}</span>
                </label>
              ))}
            </div>
            <p
              className="preference-help-text change-review-display-help"
              data-review-id="change-review-display-help"
              aria-live="polite"
            >
              {changeReviewDisplay === "subtle"
                ? "Shows low-contrast change markers in the reading margin without highlighting the document."
                : "Highlights changed blocks, list items, table cells, and words directly in the document."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
