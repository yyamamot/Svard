import { describe, expect, it } from "vitest";
import { placeSelectionToolbar } from "../../src/ui/lib/selectionToolbar";

const bounds = {
  top: 0,
  right: 800,
  bottom: 600,
  left: 0,
  width: 800,
  height: 600,
};

describe("selection mini toolbar placement", () => {
  it("prefers a gap above the first selected line", () => {
    expect(
      placeSelectionToolbar({
        bounds,
        firstLine: {
          top: 200,
          right: 320,
          bottom: 220,
          left: 120,
          width: 200,
          height: 20,
        },
        lastLine: {
          top: 260,
          right: 400,
          bottom: 280,
          left: 120,
          width: 280,
          height: 20,
        },
        toolbarHeight: 36,
        toolbarWidth: 180,
      }),
    ).toEqual({ left: 120, top: 156, side: "above" });
  });

  it("flips below when there is no room above", () => {
    expect(
      placeSelectionToolbar({
        bounds,
        firstLine: {
          top: 12,
          right: 320,
          bottom: 32,
          left: 120,
          width: 200,
          height: 20,
        },
        lastLine: {
          top: 52,
          right: 360,
          bottom: 72,
          left: 120,
          width: 240,
          height: 20,
        },
        toolbarHeight: 36,
        toolbarWidth: 180,
      }),
    ).toEqual({ left: 120, top: 80, side: "below" });
  });

  it("clamps the toolbar inside the viewer", () => {
    expect(
      placeSelectionToolbar({
        bounds,
        firstLine: {
          top: 200,
          right: 790,
          bottom: 220,
          left: 760,
          width: 30,
          height: 20,
        },
        lastLine: {
          top: 200,
          right: 790,
          bottom: 220,
          left: 760,
          width: 30,
          height: 20,
        },
        toolbarHeight: 36,
        toolbarWidth: 180,
      }),
    ).toEqual({ left: 612, top: 156, side: "above" });
  });
});
