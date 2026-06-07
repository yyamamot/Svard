import { useMemo, useState } from "react";

import { getCommandTitle } from "../../../core/commands";
import {
  defaultKeybindingMappings,
  formatShortcut,
} from "../../../core/keybindings";
import type { KeybindingPreset } from "../../../core/keybindings";
import type { KeybindingsSectionProps } from "./types";

export function KeybindingsSection({
  keybindingPreset,
  keybindingMappings,
  keybindingErrors,
  platform,
  recordingKeybindingIndex,
  onResetMappings,
  onStartRecording,
  onUpdateMapping,
  onUpdatePreset,
}: KeybindingsSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredMappings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return keybindingMappings
      .map((binding, index) => {
        const shortcut = binding.keys
          ? formatShortcut(binding.keys, platform)
          : "Unassigned";
        const searchableText = [
          getCommandTitle(binding.commandId),
          binding.commandId,
          shortcut,
          binding.context ?? "global",
        ]
          .join(" ")
          .toLowerCase();
        return {
          binding,
          index,
          matches: !query || searchableText.includes(query),
        };
      })
      .filter((row) => row.matches);
  }, [keybindingMappings, platform, searchQuery]);
  const searchCountLabel = `${filteredMappings.length} ${
    filteredMappings.length === 1 ? "shortcut" : "shortcuts"
  }`;

  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-keybindings"
    >
      <h3>Keybindings</h3>
      <label>
        Preset
        <select
          data-review-id="keybinding-preset-control"
          value={keybindingPreset}
          onChange={(event) =>
            onUpdatePreset(event.target.value as KeybindingPreset)
          }
        >
          <option value="native">Native OS</option>
        </select>
      </label>
      <p className="notice">
        Native uses Cmd on macOS and Ctrl on Windows / Linux. Use Record / Clear
        to adjust the actions you use.
      </p>
      <div className="gesture-table-toolbar">
        <h4>Shortcut assignments</h4>
        <div className="gesture-table-actions">
          <button
            type="button"
            className="button subtle"
            data-review-id="keybinding-reset"
            onClick={onResetMappings}
          >
            Reset to defaults
          </button>
        </div>
      </div>
      <div className="keybinding-search-row">
        <label className="keybinding-search-field">
          <span className="visually-hidden">Search keybindings</span>
          <input
            type="search"
            data-review-id="keybinding-search"
            placeholder="Search actions, commands, or shortcuts"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <span
          className="keybinding-search-count"
          data-review-id="keybinding-search-count"
        >
          {searchCountLabel}
        </span>
      </div>
      <div className="shortcut-table-wrap">
        <table
          className="shortcut-table"
          data-review-id="keybinding-shortcut-table"
        >
          <thead>
            <tr>
              <th>Action</th>
              <th>Shortcut</th>
              <th>Record / Clear</th>
            </tr>
          </thead>
          <tbody>
            {filteredMappings.length === 0 ? (
              <tr>
                <td
                  className="shortcut-table-empty"
                  colSpan={3}
                  data-review-id="keybinding-search-empty"
                >
                  No keybindings match your search.
                </td>
              </tr>
            ) : null}
            {filteredMappings.map(({ binding, index }) => (
              <tr
                key={`${binding.commandId}-${binding.keys}-${binding.context ?? "global"}-${index}`}
                data-keybinding-row-index={index}
                data-review-id="keybinding-shortcut-row"
              >
                <td>
                  <span>{getCommandTitle(binding.commandId)}</span>
                  <code data-review-id="keybinding-command-id">
                    {binding.commandId}
                  </code>
                  <span className="shortcut-context">
                    {binding.context ?? "global"}
                  </span>
                </td>
                <td className="shortcut-cell">
                  <kbd data-review-id="keybinding-shortcut">
                    {binding.keys
                      ? formatShortcut(binding.keys, platform)
                      : "Unassigned"}
                  </kbd>
                  {keybindingErrors[index] && (
                    <span
                      className="shortcut-row-error"
                      data-review-id="keybinding-duplicate-error"
                    >
                      {keybindingErrors[index]}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="button subtle"
                    data-review-id="keybinding-record"
                    onClick={() => onStartRecording(index)}
                  >
                    {recordingKeybindingIndex === index ? "Cancel" : "Record"}
                  </button>
                  {recordingKeybindingIndex === index && (
                    <span
                      className="shortcut-recording"
                      data-review-id="keybinding-recording"
                    >
                      Press shortcut, Escape or Tab to cancel
                    </span>
                  )}
                  <button
                    type="button"
                    className="button subtle"
                    data-review-id="keybinding-clear"
                    onClick={() =>
                      onUpdateMapping(index, {
                        ...binding,
                        keys: "",
                      })
                    }
                  >
                    Clear
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function defaultMappingsForPreset(preset: KeybindingPreset) {
  return defaultKeybindingMappings(preset);
}
