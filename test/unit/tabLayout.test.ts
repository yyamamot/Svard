import { describe, expect, it } from "vitest";

import { getBoundedTabs } from "../../src/core/tabLayout";

describe("tab layout", () => {
  it("keeps the active tab visible when tabs overflow", () => {
    const paths = [
      "a.adoc",
      "b.adoc",
      "c.adoc",
      "d.adoc",
      "e.adoc",
      "f.adoc",
      "g.adoc",
      "h.adoc",
    ];

    const result = getBoundedTabs(paths, "b.adoc", 6);

    expect(result.visiblePaths).toContain("b.adoc");
    expect(result.visiblePaths).toHaveLength(6);
    expect(result.overflowPaths).toHaveLength(2);
  });

  it("keeps the source order for visible overflow tabs", () => {
    const paths = ["a.adoc", "b.adoc", "c.adoc", "d.adoc"];

    const result = getBoundedTabs(paths, null, 2);

    expect(result.visiblePaths).toEqual(["c.adoc", "d.adoc"]);
    expect(result.overflowPaths).toEqual(["a.adoc", "b.adoc"]);
  });
});
