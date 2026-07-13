import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyPngToClipboard,
  imageClipboardSize,
  imageReferenceCompositeLayout,
  imageReferencePixelDensity,
  wrapReferenceText,
} from "../../src/ui/lib/imageClipboard";

describe("image clipboard sizing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("preserves small image dimensions", () => {
    expect(imageClipboardSize(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it("limits the longest edge to 4096 pixels", () => {
    expect(imageClipboardSize(8192, 4096)).toEqual({
      width: 4096,
      height: 2048,
    });
  });

  it("uses Retina density without exceeding the source resolution", () => {
    expect(imageReferencePixelDensity(2000, 1000, 2)).toBe(2);
    expect(imageReferencePixelDensity(1000, 1000, 2)).toBe(1);
  });

  it("keeps content and footer inside the 4096px image limit", () => {
    expect(imageReferenceCompositeLayout(4096, 2048, 256)).toEqual({
      width: 4096,
      height: 2304,
      contentHeight: 2048,
      footerHeight: 256,
    });
    expect(imageReferenceCompositeLayout(8192, 4096, 512)).toEqual({
      width: 4096,
      height: 2304,
      contentHeight: 2048,
      footerHeight: 256,
    });
  });

  it("rejects images without usable dimensions", () => {
    expect(() => imageClipboardSize(0, 100)).toThrow("usable dimensions");
  });

  it("wraps long reference paths without dropping characters", () => {
    const lines = wrapReferenceText(
      "Image: /workspace/a-very-long-image-name.png\nFile: /workspace/doc.md:8",
      12,
      (value) => value.length,
    );
    expect(lines).toEqual([
      "Image: /work",
      "space/a-very",
      "-long-image-",
      "name.png",
      "File: /works",
      "pace/doc.md:",
      "8",
    ]);
  });

  it("starts a PNG clipboard write with an unresolved blob", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const blob = Promise.resolve(new Blob(["png"], { type: "image/png" }));
    class ClipboardItemMock {
      constructor(readonly items: Record<string, Promise<Blob>>) {}
    }
    vi.stubGlobal("ClipboardItem", ClipboardItemMock);
    vi.stubGlobal("navigator", { clipboard: { write } });

    await copyPngToClipboard(blob);

    expect(write).toHaveBeenCalledOnce();
    const [[[item]]] = write.mock.calls as [[[ClipboardItemMock]]];
    expect(item.items["image/png"]).toBe(blob);
  });
});
