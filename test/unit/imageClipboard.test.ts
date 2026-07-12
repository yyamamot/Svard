import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyPngToClipboard,
  imageClipboardSize,
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

  it("rejects images without usable dimensions", () => {
    expect(() => imageClipboardSize(0, 100)).toThrow("usable dimensions");
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
