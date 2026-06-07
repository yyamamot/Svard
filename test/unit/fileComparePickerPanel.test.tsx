import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

import { FileComparePickerPanel } from "../../src/ui/components/FileComparePickerPanel";
import type { HostAdapter, NativeFileDropEvent } from "../../src/core/types";
import {
  clearFileCompareDragData,
  readFileCompareDragData,
  writeFileCompareDragData,
} from "../../src/ui/lib/fileCompareDrag";
import { createReactRootHarness } from "./helpers/reactHarness";

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

async function dispatchDrop(element: HTMLElement, dataTransfer: DataTransfer) {
  await act(async () => {
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    element.dispatchEvent(event);
  });
}

function mockHost(): HostAdapter {
  return {
    watchNativeFileDrop: vi.fn(async () => ({ dispose: vi.fn() })),
  } as unknown as HostAdapter;
}

function mockHostWithNativeDrop(
  onRegister: (callback: (event: NativeFileDropEvent) => void) => void,
): HostAdapter {
  return {
    resolveDroppedDocumentPath: vi.fn(async (path: string) => path),
    watchNativeFileDrop: vi.fn(async (callback) => {
      onRegister(callback);
      return { dispose: vi.fn() };
    }),
  } as unknown as HostAdapter;
}

describe("FileComparePickerPanel app drag/drop", () => {
  afterEach(() => {
    clearFileCompareDragData();
  });

  it("uses the active app drag session when drop DataTransfer is empty", async () => {
    const harness = createReactRootHarness();
    try {
      harness.render(
        <FileComparePickerPanel
          initialLeftPath="/workspace/docs/base.md"
          host={mockHost()}
          onChooseDocument={vi.fn()}
          onClose={vi.fn()}
          onCompare={vi.fn()}
        />,
      );

      writeFileCompareDragData(
        fakeDataTransfer({ failSetData: true }),
        "/workspace/docs/from-tree.adoc",
      );
      await dispatchDrop(
        harness.byReviewId("file-compare-right-slot"),
        fakeDataTransfer(),
      );

      expect(
        harness.byReviewId("file-compare-right-slot").textContent,
      ).toContain("from-tree.adoc");
      expect(harness.byReviewId("file-compare-validation").textContent).toBe(
        "Ready to compare.",
      );
      expect(readFileCompareDragData(fakeDataTransfer())).toBeNull();
    } finally {
      harness.cleanup();
    }
  });

  it("keeps slots unchanged and explains empty app drops", async () => {
    const harness = createReactRootHarness();
    try {
      harness.render(
        <FileComparePickerPanel
          initialLeftPath="/workspace/docs/base.md"
          host={mockHost()}
          onChooseDocument={vi.fn()}
          onClose={vi.fn()}
          onCompare={vi.fn()}
        />,
      );

      await dispatchDrop(
        harness.byReviewId("file-compare-right-slot"),
        fakeDataTransfer(),
      );

      expect(
        harness.byReviewId("file-compare-right-slot").textContent,
      ).not.toContain("from-tree");
      expect(harness.byReviewId("file-compare-validation").textContent).toBe(
        "Drop a markup document from Files, Open Files, or Bookmarks.",
      );
    } finally {
      harness.cleanup();
    }
  });

  it("uses app drag session for native drop events with empty paths", async () => {
    let nativeDrop: ((event: NativeFileDropEvent) => void) | null = null;
    const harness = createReactRootHarness();
    const originalElementFromPoint = document.elementFromPoint;
    try {
      harness.render(
        <FileComparePickerPanel
          initialLeftPath="/workspace/docs/base.md"
          host={mockHostWithNativeDrop((callback) => {
            nativeDrop = callback;
          })}
          onChooseDocument={vi.fn()}
          onClose={vi.fn()}
          onCompare={vi.fn()}
        />,
      );
      await act(async () => {});
      document.elementFromPoint = vi.fn(() =>
        harness.byReviewId("file-compare-right-slot"),
      );

      writeFileCompareDragData(
        fakeDataTransfer({ failSetData: true }),
        "/workspace/docs/native-tree.md",
      );
      await act(async () => {
        nativeDrop?.({
          type: "drop",
          paths: [],
          position: { x: 10, y: 10 },
        });
      });

      expect(
        harness.byReviewId("file-compare-right-slot").textContent,
      ).toContain("native-tree.md");
      expect(harness.byReviewId("file-compare-validation").textContent).toBe(
        "Ready to compare.",
      );
    } finally {
      document.elementFromPoint = originalElementFromPoint;
      harness.cleanup();
    }
  });
});
