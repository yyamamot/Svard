import { describe, expect, it } from "vitest";

import {
  changeRulerMarkerTopPercent,
  changeRulerTargetAnchorTop,
  clampRulerPercent,
} from "../../src/ui/components/gitDiffPreview/changeRuler";

describe("diff change ruler helpers", () => {
  it("clamps marker positions to a safe 0-100 percent range", () => {
    expect(
      changeRulerMarkerTopPercent({ scrollHeight: 1000, targetTop: 250 }),
    ).toBe(25);
    expect(
      changeRulerMarkerTopPercent({ scrollHeight: 1000, targetTop: -20 }),
    ).toBe(0);
    expect(
      changeRulerMarkerTopPercent({ scrollHeight: 1000, targetTop: 1200 }),
    ).toBe(100);
  });

  it("treats invalid marker inputs as the top of the ruler", () => {
    expect(
      changeRulerMarkerTopPercent({ scrollHeight: 0, targetTop: 50 }),
    ).toBe(0);
    expect(clampRulerPercent(Number.NaN)).toBe(0);
  });

  it("uses the target visual center as the ruler anchor", () => {
    const container = document.createElement("div");
    const target = document.createElement("div");
    container.scrollTop = 120;
    container.getBoundingClientRect = () =>
      ({
        top: 20,
        bottom: 420,
        left: 0,
        right: 100,
        width: 100,
        height: 400,
        x: 0,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect;
    target.getBoundingClientRect = () =>
      ({
        top: 260,
        bottom: 340,
        left: 0,
        right: 100,
        width: 100,
        height: 80,
        x: 0,
        y: 260,
        toJSON: () => ({}),
      }) as DOMRect;

    expect(changeRulerTargetAnchorTop({ container, target })).toBe(400);
  });
});
