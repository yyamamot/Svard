import { describe, expect, it, vi } from "vitest";
import { addCaptureAreaItem } from "../../src/ui/hooks/documentLinks/contextMenuItems";
import type { ContextMenuItem } from "../../src/ui/types";

describe("Capture Area context menu item", () => {
  it("adds Capture Area after existing document actions", () => {
    const beginCapture = vi.fn();
    const items: ContextMenuItem[] = [
      {
        id: "copy-document-path",
        label: "Copy Document Path",
        onSelect: vi.fn(),
      },
    ];

    const beginReferencedCapture = vi.fn();
    addCaptureAreaItem(items, beginCapture, beginReferencedCapture);

    expect(items).toHaveLength(3);
    expect(items[1]?.id).toBe("capture-area");
    expect(items[1]?.label).toBe("Capture Area…");
    expect(items[1]?.separatorBefore).toBe(true);
    items[1]?.onSelect();
    expect(beginCapture).toHaveBeenCalledOnce();
    expect(items[2]?.id).toBe("capture-area-with-reference");
    expect(items[2]?.label).toBe("Capture Area with Reference…");
    items[2]?.onSelect();
    expect(beginReferencedCapture).toHaveBeenCalledOnce();
  });
});
