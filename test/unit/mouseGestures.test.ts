import { describe, expect, it } from "vitest";

import {
  defaultMouseGestureConfig,
  duplicateMouseGesturePatterns,
  normalizeMouseGesture,
  normalizeMouseGestureMappings,
  normalizeMouseGesturePattern,
  resolveMouseGesture,
} from "../../src/core/mouseGestures";

describe("mouse gestures", () => {
  it("keeps mouse gestures disabled by default", () => {
    expect(defaultMouseGestureConfig).toEqual({
      enabled: false,
      trigger: "rightButton",
      showTrail: true,
      minDistancePx: 32,
      mappings: expect.arrayContaining([
        {
          pattern: "Left",
          commandId: "navigation.back",
          builtIn: true,
        },
        {
          pattern: "Up Left",
          commandId: "tab.previous",
          builtIn: true,
        },
        {
          pattern: "Up Right",
          commandId: "tab.next",
          builtIn: true,
        },
      ]),
    });
  });

  it("resolves browser-style gestures to command ids", () => {
    expect(
      resolveMouseGesture(
        [
          { x: 100, y: 100 },
          { x: 40, y: 100 },
        ],
        32,
      ),
    ).toEqual({ pattern: "Left", commandId: "navigation.back" });
    expect(
      resolveMouseGesture(
        [
          { x: 100, y: 100 },
          { x: 160, y: 100 },
        ],
        32,
      ),
    ).toEqual({ pattern: "Right", commandId: "navigation.forward" });
    expect(
      resolveMouseGesture(
        [
          { x: 100, y: 100 },
          { x: 100, y: 40 },
          { x: 100, y: 100 },
        ],
        32,
      ),
    ).toEqual({ pattern: "Up Down", commandId: "viewer.reload" });
    expect(
      resolveMouseGesture(
        [
          { x: 100, y: 100 },
          { x: 100, y: 160 },
          { x: 160, y: 160 },
        ],
        32,
      ),
    ).toEqual({ pattern: "Down Right", commandId: "tab.close" });
  });

  it("resolves custom gesture mappings", () => {
    expect(
      resolveMouseGesture(
        [
          { x: 100, y: 100 },
          { x: 100, y: 160 },
          { x: 100, y: 100 },
        ],
        32,
        [{ pattern: "Down Up", commandId: "quickOpen.focus" }],
      ),
    ).toEqual({ pattern: "Down Up", commandId: "quickOpen.focus" });
  });

  it("normalizes persisted mappings and detects duplicates", () => {
    expect(normalizeMouseGesturePattern("Left Up Right Down")).toBe(
      "Left Up Right",
    );
    expect(normalizeMouseGesturePattern("Left Diagonal")).toBe("");
    expect(
      normalizeMouseGestureMappings([
        { pattern: "Left Up Right Down", commandId: "tab.next" },
      ]),
    ).toEqual(
      expect.arrayContaining([
        { pattern: "Left Up Right", commandId: "tab.next", builtIn: true },
      ]),
    );
    expect(
      normalizeMouseGestureMappings([
        { pattern: "Down Up", commandId: "search.focus" },
      ]),
    ).toEqual(
      expect.arrayContaining([
        { pattern: "Down Up", commandId: "search.focus", builtIn: false },
      ]),
    );
    expect(
      duplicateMouseGesturePatterns([
        { pattern: "Left", commandId: "navigation.back" },
        { pattern: "Left", commandId: "tab.next" },
      ]),
    ).toEqual(new Set(["Left"]));
  });

  it("ignores jitter and compresses repeated directions", () => {
    expect(
      normalizeMouseGesture(
        [
          { x: 100, y: 100 },
          { x: 110, y: 105 },
          { x: 140, y: 105 },
          { x: 190, y: 105 },
        ],
        32,
      ),
    ).toEqual(["Right"]);
  });

  it("limits gestures to three strokes", () => {
    expect(
      normalizeMouseGesture(
        [
          { x: 100, y: 100 },
          { x: 60, y: 100 },
          { x: 60, y: 60 },
          { x: 100, y: 60 },
          { x: 100, y: 100 },
        ],
        32,
      ),
    ).toEqual(["Left", "Up", "Right"]);
  });
});
