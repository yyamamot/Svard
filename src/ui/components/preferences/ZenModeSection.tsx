import { defaultConfig } from "../../../core/defaultConfig";
import type { AppConfig } from "../../../core/types";
import type { ZenModeSectionProps } from "./types";

type ZenModePresetId = "default" | "minimal";

const zenModePresets: Array<{
  id: ZenModePresetId;
  label: string;
  config: AppConfig["zenMode"];
}> = [
  {
    id: "default",
    label: "Default",
    config: defaultConfig.zenMode,
  },
  {
    id: "minimal",
    label: "Minimal",
    config: {
      ...defaultConfig.zenMode,
      centerLayout: false,
      fullScreen: false,
    },
  },
];

function sameZenModeConfig(
  left: AppConfig["zenMode"],
  right: AppConfig["zenMode"],
) {
  return (
    left.centerLayout === right.centerLayout &&
    left.maxContentWidth === right.maxContentWidth &&
    left.hideTopbar === right.hideTopbar &&
    left.hideTabs === right.hideTabs &&
    left.hideLeftSidebar === right.hideLeftSidebar &&
    left.hideRightSidebar === right.hideRightSidebar &&
    left.hideStatusBar === right.hideStatusBar &&
    left.fullScreen === right.fullScreen &&
    left.exitOnEscape === right.exitOnEscape &&
    left.restorePreviousLayout === right.restorePreviousLayout &&
    left.applyToDiffPreview === right.applyToDiffPreview
  );
}

function activePresetFor(zenMode: AppConfig["zenMode"]) {
  return (
    zenModePresets.find((preset) => sameZenModeConfig(zenMode, preset.config))
      ?.id ?? "custom"
  );
}

export function ZenModeSection({
  config,
  onUpdateZenMode,
}: ZenModeSectionProps) {
  const zenMode = config.zenMode;
  const activePreset = activePresetFor(zenMode);
  const hideInterfaceChrome =
    zenMode.hideTopbar &&
    zenMode.hideTabs &&
    zenMode.hideLeftSidebar &&
    zenMode.hideRightSidebar &&
    zenMode.hideStatusBar;

  function updateZenMode(next: Partial<typeof zenMode>) {
    onUpdateZenMode({ ...zenMode, ...next });
  }

  function updateInterfaceChrome(hidden: boolean) {
    updateZenMode({
      hideTopbar: hidden,
      hideTabs: hidden,
      hideLeftSidebar: hidden,
      hideRightSidebar: hidden,
      hideStatusBar: hidden,
    });
  }

  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-zen-mode"
    >
      <h3>Zen Mode</h3>
      <p className="preference-section-intro">
        Choose what disappears while Zen mode is active.
      </p>

      <div className="preference-field">
        <span className="preference-label">Preset</span>
        <div
          className="segmented-control segmented-control-four"
          data-review-id="zen-mode-preset-control"
          role="radiogroup"
          aria-label="Zen mode preset"
        >
          {zenModePresets.map((preset) => (
            <label
              key={preset.id}
              className={`segmented-option ${
                activePreset === preset.id ? "active" : ""
              }`}
            >
              <input
                type="radio"
                name="zen-mode-preset"
                value={preset.id}
                checked={activePreset === preset.id}
                onChange={() => onUpdateZenMode(preset.config)}
              />
              <span>{preset.label}</span>
            </label>
          ))}
          <label
            className={`segmented-option ${
              activePreset === "custom" ? "active" : ""
            }`}
          >
            <input
              type="radio"
              name="zen-mode-preset"
              value="custom"
              checked={activePreset === "custom"}
              readOnly
            />
            <span>Custom</span>
          </label>
        </div>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          data-review-id="zen-mode-center-layout-control"
          checked={zenMode.centerLayout}
          onChange={(event) =>
            updateZenMode({ centerLayout: event.target.checked })
          }
        />
        <span>Center reader layout</span>
      </label>

      <label className="preference-inline-input">
        <span>Content width</span>
        <input
          type="number"
          data-review-id="zen-mode-max-width-control"
          min="640"
          max="1280"
          step="40"
          value={zenMode.maxContentWidth}
          disabled={!zenMode.centerLayout}
          onChange={(event) =>
            updateZenMode({ maxContentWidth: Number(event.target.value) })
          }
        />
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          data-review-id="zen-mode-hide-interface-control"
          checked={hideInterfaceChrome}
          onChange={(event) => updateInterfaceChrome(event.target.checked)}
        />
        <span>Hide title and controls</span>
      </label>
      <p className="preference-help-text">
        Hides the file name, toolbar buttons, tabs, sidebars, and status
        feedback.
      </p>

      <label className="checkbox-row">
        <input
          type="checkbox"
          data-review-id="zen-mode-exit-escape-control"
          checked={zenMode.exitOnEscape}
          onChange={(event) =>
            updateZenMode({ exitOnEscape: event.target.checked })
          }
        />
        <span>Exit with Escape</span>
      </label>

      <details
        className="preference-advanced"
        data-review-id="zen-mode-advanced-settings"
      >
        <summary>Advanced</summary>
        <div className="preference-advanced-controls">
          <label className="checkbox-row">
            <input
              type="checkbox"
              data-review-id="zen-mode-hide-topbar-control"
              checked={zenMode.hideTopbar}
              onChange={(event) =>
                updateZenMode({ hideTopbar: event.target.checked })
              }
            />
            <span>Hide top toolbar</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              data-review-id="zen-mode-hide-tabs-control"
              checked={zenMode.hideTabs}
              onChange={(event) =>
                updateZenMode({ hideTabs: event.target.checked })
              }
            />
            <span>Hide tabs</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              data-review-id="zen-mode-hide-left-sidebar-control"
              checked={zenMode.hideLeftSidebar}
              onChange={(event) =>
                updateZenMode({ hideLeftSidebar: event.target.checked })
              }
            />
            <span>Hide left sidebar</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              data-review-id="zen-mode-hide-right-sidebar-control"
              checked={zenMode.hideRightSidebar}
              onChange={(event) =>
                updateZenMode({ hideRightSidebar: event.target.checked })
              }
            />
            <span>Hide right sidebar</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              data-review-id="zen-mode-hide-status-bar-control"
              checked={zenMode.hideStatusBar}
              onChange={(event) =>
                updateZenMode({ hideStatusBar: event.target.checked })
              }
            />
            <span>Hide status bar</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              data-review-id="zen-mode-full-screen-control"
              checked={zenMode.fullScreen}
              onChange={(event) =>
                updateZenMode({ fullScreen: event.target.checked })
              }
            />
            <span>Use system full screen</span>
          </label>
          <p className="preference-help-text">
            Attempts to enter operating system full screen. Zen mode still works
            if this is unavailable.
          </p>
          <label className="checkbox-row">
            <input
              type="checkbox"
              data-review-id="zen-mode-restore-layout-control"
              checked={zenMode.restorePreviousLayout}
              onChange={(event) =>
                updateZenMode({ restorePreviousLayout: event.target.checked })
              }
            />
            <span>Restore previous layout</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              data-review-id="zen-mode-apply-diff-preview-control"
              checked={zenMode.applyToDiffPreview}
              onChange={(event) =>
                updateZenMode({ applyToDiffPreview: event.target.checked })
              }
            />
            <span>Hide Diff Preview controls</span>
          </label>
          <p className="preference-help-text">
            When Zen mode is active, hides the Diff Preview title, toolbar, and
            change ruler.
          </p>
        </div>
      </details>
    </section>
  );
}
