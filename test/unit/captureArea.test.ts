import { describe, expect, it } from "vitest";
import {
  captureAreaBackground,
  captureAreaImageSize,
  clampCaptureArea,
  minimumCaptureAreaSize,
  visibleCaptureBounds,
} from "../../src/ui/lib/captureArea";

describe("capture area geometry", () => {
  const bounds = { left: 100, top: 80, width: 400, height: 300 };

  it("normalizes a drag in either direction and clamps it to the visible document", () => {
    expect(clampCaptureArea(460, 330, 140, 120, bounds)).toEqual({
      left: 140,
      top: 120,
      width: 320,
      height: 210,
    });
    expect(clampCaptureArea(20, 40, 700, 600, bounds)).toEqual(bounds);
  });

  it("does not create a capture for a tiny drag", () => {
    expect(
      clampCaptureArea(
        100,
        80,
        100 + minimumCaptureAreaSize - 1,
        80 + minimumCaptureAreaSize - 1,
        bounds,
      ),
    ).toBeNull();
  });

  it("uses only the document area visible in the viewer pane", () => {
    expect(
      visibleCaptureBounds(
        new DOMRect(40, 60, 600, 500),
        new DOMRect(100, 80, 400, 300),
      ),
    ).toEqual(bounds);
  });

  it("uses device pixels while preserving the 4096px image limit", () => {
    expect(captureAreaImageSize({ width: 1000, height: 500 }, 2)).toEqual({
      width: 2000,
      height: 1000,
    });
    expect(captureAreaImageSize({ width: 3000, height: 1500 }, 2)).toEqual({
      width: 4096,
      height: 2048,
    });
  });

  it("uses the nearest opaque reader surface as the PNG background", () => {
    const outer = document.createElement("div");
    outer.style.backgroundColor = "rgb(247, 248, 249)";
    const inner = document.createElement("div");
    inner.style.backgroundColor = "transparent";
    outer.append(inner);
    document.body.append(outer);

    expect(captureAreaBackground(inner)).toBe("rgb(247, 248, 249)");
    outer.remove();
  });
});
