import { describe, expect, it } from "vitest";

import { hasMovedBeyondThreshold } from "../../src/core/reorderDrag";

describe("reorder drag threshold", () => {
  it("keeps small pointer movement as a click", () => {
    expect(
      hasMovedBeyondThreshold({
        startX: 10,
        startY: 10,
        currentX: 13,
        currentY: 14,
      }),
    ).toBe(false);
  });

  it("treats movement at the threshold as a drag", () => {
    expect(
      hasMovedBeyondThreshold({
        startX: 10,
        startY: 10,
        currentX: 16,
        currentY: 10,
      }),
    ).toBe(true);
  });
});
