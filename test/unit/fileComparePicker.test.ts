import { describe, expect, it } from "vitest";

import {
  applyFileCompareDroppedPaths,
  setFileCompareSlot,
  swapFileCompareSlots,
  validateFileCompareSlots,
} from "../../src/core/fileComparePicker";

describe("file compare picker", () => {
  it("sets, swaps, and clears compare slots", () => {
    const first = setFileCompareSlot(
      { leftPath: null, rightPath: null },
      "left",
      "/workspace/docs/left.md",
    );
    const second = setFileCompareSlot(
      first,
      "right",
      "/workspace/docs/right.adoc",
    );

    expect(second).toEqual({
      leftPath: "/workspace/docs/left.md",
      rightPath: "/workspace/docs/right.adoc",
    });
    expect(swapFileCompareSlots(second)).toEqual({
      leftPath: "/workspace/docs/right.adoc",
      rightPath: "/workspace/docs/left.md",
    });
    expect(setFileCompareSlot(second, "left", null).leftPath).toBeNull();
  });

  it("validates missing, unsupported, duplicate, and valid pairs", () => {
    expect(
      validateFileCompareSlots({
        leftPath: null,
        rightPath: "/workspace/docs/right.md",
      }),
    ).toContain("Choose");
    expect(
      validateFileCompareSlots({
        leftPath: "/workspace/docs/left.txt",
        rightPath: "/workspace/docs/right.md",
      }),
    ).toContain("markup");
    expect(
      validateFileCompareSlots({
        leftPath: "/workspace/docs/left.md",
        rightPath: "/workspace/docs/left.md",
      }),
    ).toContain("different");
    expect(
      validateFileCompareSlots({
        leftPath: "/workspace/docs/left.md",
        rightPath: "/workspace/docs/right.adoc",
      }),
    ).toBeNull();
  });

  it("applies one supported dropped document to the requested slot", async () => {
    const result = await applyFileCompareDroppedPaths({
      slots: {
        leftPath: "/workspace/docs/left.md",
        rightPath: null,
      },
      side: "right",
      paths: ["/workspace/docs/right.adoc"],
      resolvePath: async (path) => path,
    });

    expect(result).toEqual({
      slots: {
        leftPath: "/workspace/docs/left.md",
        rightPath: "/workspace/docs/right.adoc",
      },
      message: null,
    });
  });

  it("rejects multi-file, unsupported, and duplicate native drops without changing slots", async () => {
    const slots = {
      leftPath: "/workspace/docs/left.md",
      rightPath: null,
    };

    await expect(
      applyFileCompareDroppedPaths({
        slots,
        side: "right",
        paths: ["/workspace/docs/right.md", "/workspace/docs/third.md"],
        resolvePath: async (path) => path,
      }),
    ).resolves.toEqual({
      slots,
      message: "Drop one markup document at a time.",
    });

    await expect(
      applyFileCompareDroppedPaths({
        slots,
        side: "right",
        paths: ["/workspace/docs/private.txt"],
        resolvePath: async (path) => path,
      }),
    ).resolves.toEqual({
      slots,
      message: "File compare is available for markup documents only.",
    });

    await expect(
      applyFileCompareDroppedPaths({
        slots,
        side: "right",
        paths: ["/workspace/docs/left.md"],
        resolvePath: async (path) => path,
      }),
    ).resolves.toEqual({
      slots,
      message: "Choose two different markup documents to compare.",
    });
  });

  it("keeps slots unchanged when dropped path resolution fails", async () => {
    const slots = {
      leftPath: null,
      rightPath: null,
    };

    await expect(
      applyFileCompareDroppedPaths({
        slots,
        side: "left",
        paths: ["/workspace/docs/missing.md"],
        resolvePath: async () => {
          throw new Error("Dropped item is not a file.");
        },
      }),
    ).resolves.toEqual({
      slots,
      message: "Dropped item is not a file.",
    });
  });
});
