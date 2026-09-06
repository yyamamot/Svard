import { getUiCommandTitle } from "../../lib/appLabels";
import {
  defaultMouseGestureConfig,
  mouseGestureMappings,
  normalizeMouseGestureMappings,
} from "../../../core/mouseGestures";
import type { MouseGesturesSectionProps } from "./types";

export function MouseGesturesSection({
  config,
  gestureErrors,
  recordingGestureIndex,
  recordingPattern,
  onChange,
  onResetMappings,
  onStartRecording,
  onUpdateMapping,
  onRecordPointerDown,
  onRecordPointerMove,
  onRecordPointerUp,
}: MouseGesturesSectionProps) {
  const mouseGestures = config.mouseGestures ?? defaultMouseGestureConfig;
  const mappings = normalizeMouseGestureMappings(mouseGestures.mappings);
  return (
    <section
      className="preference-section"
      data-review-id="preferences-tab-mouse-gestures"
    >
      <h3>Mouse Gestures</h3>
      <label className="checkbox-row" data-review-id="mouse-gestures-enabled">
        <input
          type="checkbox"
          checked={mouseGestures.enabled}
          onChange={(event) =>
            onChange({
              ...config,
              mouseGestures: {
                ...mouseGestures,
                enabled: event.target.checked,
              },
            })
          }
        />
        Enable right-button drag gestures
      </label>
      <label
        className="checkbox-row"
        data-review-id="mouse-gesture-trail-toggle"
      >
        <input
          type="checkbox"
          checked={mouseGestures.showTrail}
          onChange={(event) =>
            onChange({
              ...config,
              mouseGestures: {
                ...mouseGestures,
                showTrail: event.target.checked,
              },
            })
          }
        />
        Show gesture trail
      </label>
      <label>
        Minimum distance
        <input
          type="number"
          min="16"
          max="96"
          step="4"
          value={mouseGestures.minDistancePx}
          onChange={(event) =>
            onChange({
              ...config,
              mouseGestures: {
                ...mouseGestures,
                minDistancePx: Number(event.target.value),
              },
            })
          }
        />
      </label>
      <div className="gesture-table-toolbar">
        <h4>Gesture assignments</h4>
        <div className="gesture-table-actions">
          <button
            type="button"
            className="button subtle"
            data-review-id="mouse-gesture-reset"
            onClick={onResetMappings}
          >
            Reset to defaults
          </button>
        </div>
      </div>
      <table className="gesture-table" data-review-id="mouse-gesture-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Gesture</th>
            <th>Record / Clear</th>
          </tr>
        </thead>
        <tbody>
          {mappings
            .slice(0, mouseGestureMappings.length)
            .map((mapping, index) => (
              <tr
                key={mapping.commandId}
                data-mouse-gesture-row-index={index}
                data-review-id="mouse-gesture-row"
              >
                <td>
                  <span>{getUiCommandTitle(mapping.commandId)}</span>
                  <code>{mapping.commandId}</code>
                </td>
                <td>
                  <kbd>{mapping.pattern || "Unassigned"}</kbd>
                  {gestureErrors[index] && (
                    <span
                      className="gesture-row-error"
                      data-review-id="mouse-gesture-duplicate-error"
                    >
                      {gestureErrors[index]}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="button subtle"
                    data-review-id="mouse-gesture-record"
                    onClick={() => onStartRecording(index)}
                  >
                    {recordingGestureIndex === index ? "Cancel" : "Record"}
                  </button>
                  {recordingGestureIndex === index && (
                    <div
                      className="gesture-record-pad"
                      data-review-id="mouse-gesture-record-pad"
                      onContextMenu={(event) => event.preventDefault()}
                      onPointerDown={(event) =>
                        onRecordPointerDown(event, index)
                      }
                      onPointerMove={(event) =>
                        onRecordPointerMove(event, index)
                      }
                      onPointerUp={(event) =>
                        onRecordPointerUp(event, index, mapping)
                      }
                    >
                      {recordingPattern || "Right-drag here"}
                    </div>
                  )}
                  <button
                    type="button"
                    className="button subtle"
                    data-review-id="mouse-gesture-clear"
                    onClick={() =>
                      onUpdateMapping(index, {
                        ...mapping,
                        pattern: "",
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
      <p className="notice">
        Gestures run only in the viewer and are disabled by default.
      </p>
    </section>
  );
}
