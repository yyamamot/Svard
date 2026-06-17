import type { ExperimentalSectionProps } from "./types";

export function ExperimentalSection({
  config,
  onChange,
}: ExperimentalSectionProps) {
  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-experimental"
    >
      <h3>Experimental</h3>
      <p className="preference-help-text">
        These features may be removed or redesigned.
      </p>
      <label className="checkbox-row checkbox-row-detailed">
        <input
          type="checkbox"
          data-review-id="experimental-search-hit-ruler-control"
          checked={config.experimental.searchHitRuler}
          onChange={(event) =>
            onChange({
              ...config,
              experimental: {
                ...config.experimental,
                searchHitRuler: event.target.checked,
              },
            })
          }
        />
        <span className="checkbox-copy">
          <span>Search hit ruler</span>
          <span className="preference-help-text">
            Show a VS Code style overview ruler for current document search
            hits. This is disabled by default.
          </span>
        </span>
      </label>
      <label className="checkbox-row checkbox-row-detailed">
        <input
          type="checkbox"
          data-review-id="experimental-restore-additional-windows-control"
          checked={config.experimental.restoreAdditionalWindowsOnStartup}
          onChange={(event) =>
            onChange({
              ...config,
              experimental: {
                ...config.experimental,
                restoreAdditionalWindowsOnStartup: event.target.checked,
              },
            })
          }
        />
        <span className="checkbox-copy">
          <span>Restore additional windows on startup</span>
          <span className="preference-help-text">
            Reopen saved additional viewer windows on startup. This may restore
            private document paths and is disabled by default.
          </span>
        </span>
      </label>
    </section>
  );
}
