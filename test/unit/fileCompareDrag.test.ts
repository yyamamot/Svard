import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activateCodexContextPointerCapture,
  clearFileCompareDragData,
  codexContextPointerDragStartEvent,
  fileCompareDragType,
  isCodexContextPointerDragActive,
  isRecentFileCompareDragSession,
  prepareCodexContextPointerCapture,
  prepareFileCompareDragData,
  readCurrentFileCompareDragData,
  readFileCompareDragData,
  scheduleClearFileCompareDragData,
  writeFileCompareDragData,
} from "../../src/ui/lib/fileCompareDrag";

function fakeDataTransfer({ failSetData = false } = {}): DataTransfer {
  const values = new Map<string, string>();
  return {
    effectAllowed: "uninitialized",
    dropEffect: "none",
    setData(type: string, value: string) {
      if (failSetData) {
        throw new Error("setData unavailable");
      }
      values.set(type, value);
    },
    getData(type: string) {
      return values.get(type) ?? "";
    },
  } as DataTransfer;
}

describe("file compare drag payload", () => {
  afterEach(() => {
    clearFileCompareDragData();
    document.body.replaceChildren();
  });

  it("writes and reads the internal document path payload", () => {
    const transfer = fakeDataTransfer();
    writeFileCompareDragData(transfer, "/workspace/docs/left.md");

    expect(transfer.getData(fileCompareDragType)).toBe(
      "/workspace/docs/left.md",
    );
    expect(readFileCompareDragData(transfer)).toBe("/workspace/docs/left.md");
    expect(transfer.effectAllowed).toBe("copy");
  });

  it("falls back to plain text payload", () => {
    const transfer = fakeDataTransfer();
    transfer.setData("text/plain", "/workspace/docs/right.adoc");

    expect(readFileCompareDragData(transfer)).toBe(
      "/workspace/docs/right.adoc",
    );
  });

  it("falls back to the active in-app drag session when transfer data is empty", () => {
    const sourceTransfer = fakeDataTransfer({ failSetData: true });
    writeFileCompareDragData(sourceTransfer, "/workspace/docs/tree-source.md");

    expect(readFileCompareDragData(fakeDataTransfer())).toBe(
      "/workspace/docs/tree-source.md",
    );
  });

  it("clears the active in-app drag session", () => {
    writeFileCompareDragData(
      fakeDataTransfer({ failSetData: true }),
      "/workspace/docs/stale.md",
    );
    clearFileCompareDragData();

    expect(readFileCompareDragData(fakeDataTransfer())).toBeNull();
  });

  it("keeps drag session available until scheduled dragend cleanup runs", () => {
    vi.useFakeTimers();
    try {
      writeFileCompareDragData(
        fakeDataTransfer({ failSetData: true }),
        "/workspace/docs/delayed.md",
      );
      scheduleClearFileCompareDragData();

      expect(readCurrentFileCompareDragData()).toBe(
        "/workspace/docs/delayed.md",
      );

      vi.runAllTimers();

      expect(readCurrentFileCompareDragData()).toBeNull();
      expect(isRecentFileCompareDragSession()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("prepares a short-lived drag session before dragstart", () => {
    vi.useFakeTimers();
    try {
      prepareFileCompareDragData("/workspace/docs/prepared.md");

      expect(readCurrentFileCompareDragData()).toBe(
        "/workspace/docs/prepared.md",
      );

      vi.runAllTimers();

      expect(readCurrentFileCompareDragData()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("captures the pointer only after a Codex context drag starts", () => {
    const codexPanel = document.createElement("div");
    codexPanel.dataset.reviewId = "codex-panel";
    document.body.append(codexPanel);

    const target = document.createElement("button");
    const setPointerCapture = vi.fn();
    const onDragStart = vi.fn();
    target.setPointerCapture = setPointerCapture;
    document.body.append(target);
    window.addEventListener(codexContextPointerDragStartEvent, onDragStart);

    prepareFileCompareDragData("/workspace/docs/prepared.md");
    prepareCodexContextPointerCapture(target, 7);

    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(
      activateCodexContextPointerCapture({ clientX: 120, clientY: 80 }),
    ).toBe(true);
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(isCodexContextPointerDragActive()).toBe(true);
    expect(onDragStart).toHaveBeenCalledOnce();
    expect((onDragStart.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      clientX: 120,
      clientY: 80,
      path: "/workspace/docs/prepared.md",
    });

    window.removeEventListener(codexContextPointerDragStartEvent, onDragStart);
  });

  it("keeps the internal path until the pointer-based drop finishes", () => {
    vi.useFakeTimers();
    try {
      const codexPanel = document.createElement("div");
      codexPanel.dataset.reviewId = "codex-panel";
      document.body.append(codexPanel);

      const target = document.createElement("button");
      target.setPointerCapture = vi.fn();
      document.body.append(target);

      prepareFileCompareDragData("/workspace/docs/long-drag.md");
      prepareCodexContextPointerCapture(target, 9);
      activateCodexContextPointerCapture();
      scheduleClearFileCompareDragData();
      vi.runAllTimers();

      expect(readCurrentFileCompareDragData()).toBe(
        "/workspace/docs/long-drag.md",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
