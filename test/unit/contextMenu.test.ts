import { describe, expect, it } from "vitest";
import { clampContextMenuPosition } from "../../src/ui/lib/contextMenu";

describe("clampContextMenuPosition", () => {
  it("keeps a menu inside the viewport", () => {
    expect(
      clampContextMenuPosition({
        x: 780,
        y: 580,
        width: 180,
        height: 140,
        viewportWidth: 800,
        viewportHeight: 600,
      }),
    ).toEqual({ left: 612, top: 452 });
  });

  it("keeps the requested position when there is enough room", () => {
    expect(
      clampContextMenuPosition({
        x: 120,
        y: 80,
        width: 180,
        height: 140,
        viewportWidth: 800,
        viewportHeight: 600,
      }),
    ).toEqual({ left: 120, top: 80 });
  });
});
