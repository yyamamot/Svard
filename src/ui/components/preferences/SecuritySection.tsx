import type { SecuritySectionProps } from "./types";

export function SecuritySection({ config, onChange }: SecuritySectionProps) {
  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-security"
    >
      <h3>Security</h3>
      <label className="checkbox-row checkbox-row-detailed">
        <input
          type="checkbox"
          data-review-id="show-local-images-control"
          checked={config.security.allowLocalImages}
          onChange={(event) =>
            onChange({
              ...config,
              security: {
                ...config.security,
                allowLocalImages: event.target.checked,
              },
            })
          }
        />
        <span className="checkbox-copy">
          <span>Show local images</span>
          <span className="mode-help">
            Render image files referenced by the current document.
          </span>
        </span>
      </label>
      <label className="checkbox-row checkbox-row-detailed">
        <input
          type="checkbox"
          data-review-id="show-external-images-control"
          checked={config.security.showExternalImages}
          onChange={(event) =>
            onChange({
              ...config,
              security: {
                ...config.security,
                showExternalImages: event.target.checked,
              },
            })
          }
        />
        <span className="checkbox-copy">
          <span>Show external images</span>
          <span className="mode-help">
            Load http/https images from documents. This may contact external
            servers.
          </span>
        </span>
      </label>
      <label className="checkbox-row checkbox-row-detailed">
        <input
          type="checkbox"
          data-review-id="confirm-external-links-control"
          checked={config.security.confirmExternalLinks}
          onChange={(event) =>
            onChange({
              ...config,
              security: {
                ...config.security,
                confirmExternalLinks: event.target.checked,
              },
            })
          }
        />
        <span className="checkbox-copy">
          <span>Confirm external links before opening</span>
          <span className="mode-help">
            Ask before opening http/https links in the system browser.
          </span>
        </span>
      </label>
      <p className="notice">
        Self-managed Kroki endpoints are used only after configuration. Public
        kroki.io sends diagram source only after confirmation.
      </p>
    </section>
  );
}
