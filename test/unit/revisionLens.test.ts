import { describe, expect, it } from "vitest";

import {
  uniqueRevisionLensBlockTargets,
  type RevisionLensMarkerTarget,
} from "../../src/ui/hooks/useRevisionLens";

function marker(
  id: string,
  diffBlockId: string,
  blockTarget: HTMLElement,
): RevisionLensMarkerTarget {
  return {
    blockTarget,
    interactionTarget: blockTarget,
    marker: {
      id,
      diffBlockId,
      kind: "changed",
      anchorBlockId: `rendered-block:${id}`,
      changeIndex: 0,
    },
  };
}

describe("Revision Lens marker targets", () => {
  it("keeps marker blocks in order and deduplicates compact child markers", () => {
    const first = document.createElement("p");
    const second = document.createElement("table");
    const targets = [
      marker("first", "diff:1", first),
      marker("first-child", "diff:1", first),
      marker("second", "diff:3", second),
    ];

    expect(uniqueRevisionLensBlockTargets(targets)).toEqual([
      targets[0],
      targets[2],
    ]);
  });
});
