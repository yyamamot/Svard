import { useEffect, useRef, useState } from "react";
import type { CacheSectionProps } from "./types";

type CacheClearState = "idle" | "clearing" | "cleared" | "failed";

export function CacheSection({
  config,
  onChange,
  onClearKrokiCache,
  onClearPlantUmlSvgCache,
}: CacheSectionProps) {
  const resetTimers = useRef<number[]>([]);
  const [krokiClearState, setKrokiClearState] =
    useState<CacheClearState>("idle");
  const [plantUmlClearState, setPlantUmlClearState] =
    useState<CacheClearState>("idle");

  useEffect(
    () => () => {
      for (const timer of resetTimers.current) {
        window.clearTimeout(timer);
      }
      resetTimers.current = [];
    },
    [],
  );

  async function clearCache(
    action: () => void | Promise<void>,
    setState: (state: CacheClearState) => void,
  ) {
    setState("clearing");
    try {
      await action();
      setState("cleared");
    } catch {
      setState("failed");
    }
    const timer = window.setTimeout(() => {
      setState("idle");
    }, 1800);
    resetTimers.current.push(timer);
  }

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
        Each diagram cache keeps up to 128 MiB and removes the least recently
        used files automatically.
      </p>
      <button
        type="button"
        className="button subtle"
        data-review-id="kroki-cache-clear"
        disabled={krokiClearState === "clearing"}
        onClick={() => void clearCache(onClearKrokiCache, setKrokiClearState)}
        aria-live="polite"
      >
        {clearButtonLabel(krokiClearState, "Kroki cache", "Clear Kroki cache")}
      </button>
      <div className="readonly-row">
        <span>Local diagram cache</span>
        <strong>app cache dir / plantuml-local</strong>
      </div>
      <p className="mode-help">
        Reuses built-in PlantUML SVG results without using Kroki. Also keeps up
        to 128 MiB on disk.
      </p>
      <button
        type="button"
        className="button subtle"
        data-review-id="plantuml-local-cache-clear"
        disabled={plantUmlClearState === "clearing"}
        onClick={() =>
          void clearCache(onClearPlantUmlSvgCache, setPlantUmlClearState)
        }
        aria-live="polite"
      >
        {clearButtonLabel(
          plantUmlClearState,
          "Local diagram cache",
          "Clear local diagram cache",
        )}
      </button>
    </section>
  );
}

function clearButtonLabel(
  state: CacheClearState,
  label: string,
  idleLabel: string,
) {
  if (state === "clearing") {
    return "Clearing...";
  }
  if (state === "cleared") {
    return `${label} cleared`;
  }
  if (state === "failed") {
    return `${label} clear failed`;
  }
  return idleLabel;
}
