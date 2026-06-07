import type { CacheSectionProps } from "./types";

export function CacheSection({
  config,
  onChange,
  onClearKrokiCache,
}: CacheSectionProps) {
  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-cache"
    >
      <h3>Cache</h3>
      <label className="checkbox-row checkbox-row-detailed">
        <input
          type="checkbox"
          checked={config.kroki.cacheEnabled}
          onChange={(event) =>
            onChange({
              ...config,
              kroki: {
                ...config.kroki,
                cacheEnabled: event.target.checked,
              },
            })
          }
        />
        <span className="checkbox-copy">
          <span>Kroki cache</span>
          <span className="mode-help">
            Store rendered Kroki diagrams on this device.
          </span>
        </span>
      </label>
      <div className="readonly-row">
        <span>Location</span>
        <strong>app cache dir / kroki</strong>
      </div>
      <p className="mode-help" data-review-id="cache-retention-note">
        Cached files are kept until you clear them or the operating system
        removes app cache data.
      </p>
      <button
        type="button"
        className="button subtle"
        data-review-id="cache-clear"
        onClick={onClearKrokiCache}
      >
        Clear cache
      </button>
    </section>
  );
}
