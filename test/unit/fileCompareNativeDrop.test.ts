import { afterEach, describe, expect, it, vi } from "vitest";

import { findNativeDropSlot } from "../../src/ui/components/FileComparePickerPanel";

function addSlot(side: "left" | "right", rect: DOMRect) {
  const element = document.createElement("section");
  element.dataset.fileCompareSlot = side;
  element.getBoundingClientRect = () => rect;
  document.body.append(element);
  return element;
}

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  } as DOMRect;
}

describe("file compare native drop hit testing", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("resolves an exact slot hit", () => {
    const picker = document.createElement("div");
    picker.className = "file-compare-picker";
    picker.getBoundingClientRect = () => rect(100, 80, 600, 300);
    document.body.append(picker);
    const left = addSlot("left", rect(120, 120, 200, 160));
    addSlot("right", rect(420, 120, 200, 160));
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => null,
    });
    vi.spyOn(document, "elementFromPoint").mockReturnValue(left);

    expect(findNativeDropSlot({ x: 180, y: 180 })).toBe("left");
  });

  it("falls back to the nearest slot when scaled coordinates miss the exact hit", () => {
    const picker = document.createElement("div");
    picker.className = "file-compare-picker";
    picker.getBoundingClientRect = () => rect(100, 80, 700, 320);
    document.body.append(picker);
    addSlot("left", rect(120, 120, 220, 160));
    addSlot("right", rect(500, 120, 220, 160));
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => null,
    });
    vi.spyOn(document, "elementFromPoint").mockReturnValue(null);

    expect(findNativeDropSlot({ x: 610, y: 200 })).toBe("right");
  });

  it("ignores drops outside the picker", () => {
    const picker = document.createElement("div");
    picker.className = "file-compare-picker";
    picker.getBoundingClientRect = () => rect(100, 80, 700, 320);
    document.body.append(picker);
    addSlot("left", rect(120, 120, 220, 160));
    addSlot("right", rect(500, 120, 220, 160));
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => null,
    });
    vi.spyOn(document, "elementFromPoint").mockReturnValue(null);

    expect(findNativeDropSlot({ x: 20, y: 20 })).toBeNull();
  });
});
