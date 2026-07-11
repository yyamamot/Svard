import { describe, expect, it } from "vitest";
import { imageClipboardSize } from "../../src/ui/lib/imageClipboard";

describe("image clipboard sizing", () => {
  it("preserves small image dimensions", () => {
    expect(imageClipboardSize(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it("limits the longest edge to 4096 pixels", () => {
    expect(imageClipboardSize(8192, 4096)).toEqual({ width: 4096, height: 2048 });
  });

  it("rejects images without usable dimensions", () => {
    expect(() => imageClipboardSize(0, 100)).toThrow("usable dimensions");
  });
});
