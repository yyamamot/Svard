import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearFileCompareDragData,
  fileCompareDragType,
  isRecentFileCompareDragSession,
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
});
