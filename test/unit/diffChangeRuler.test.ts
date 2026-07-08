import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("keeps ruler marker colors semantic while active only changes weight", () => {
    const css = readFileSync(
      join(process.cwd(), "src/ui/styles/diff-preview/shell.css"),
      "utf8",
    );
    const markerRule =
      /\.git-diff-change-ruler-marker\s*\{(?<body>[^}]+)\}/.exec(css)?.groups
        ?.body ?? "";
    const activeRule =
      /\.git-diff-change-ruler-marker\.active\s*\{(?<body>[^}]+)\}/.exec(css)
        ?.groups?.body ?? "";

    expect(markerRule).toContain("min-height: 4px");
    expect(markerRule).toContain("left: 3px");
    expect(markerRule).toContain("right: 1px");
    expect(markerRule).toContain("border-radius: 2px");
    expect(activeRule).toContain("min-height: 6px");
    expect(activeRule).toContain("left: 1px");
    expect(activeRule).toContain("right: 0");
    expect(activeRule).toContain("z-index: 1");
    expect(activeRule).not.toContain("background:");
  });
});
