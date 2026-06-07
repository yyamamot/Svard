import { describe, expect, it } from "vitest";

import { reorderByIndex } from "../../src/core/reorder";

describe("reorderByIndex", () => {
  it("moves items to the requested index", () => {
    expect(reorderByIndex(["a", "b", "c"], 1, 0)).toEqual(["b", "a", "c"]);
    expect(reorderByIndex(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("keeps the original array for no-op and out-of-range moves", () => {
    const items = ["a", "b", "c"];

    expect(reorderByIndex(items, 1, 1)).toBe(items);
    expect(reorderByIndex(items, -1, 1)).toBe(items);
    expect(reorderByIndex(items, 1, 3)).toBe(items);
  });
});
