import { describe, expect, it } from "vitest";

import {
  changeRulerMarkerTopPercent,
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
});
