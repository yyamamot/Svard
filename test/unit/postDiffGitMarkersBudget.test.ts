import { describe, expect, it } from "vitest";

import {
  buildPostDiffGitMarkerContext,
  postDiffGitMarkerBudget,
} from "../../src/ui/lib/gitRenderedDiff";
import {
  activePath,
  block,
  presentation,
  preview,
} from "./helpers/postDiffGitMarkerFixtures";

describe("post-diff git marker privacy and budget", () => {
  it("anchors deletion-only working tree markers to the nearest following current block", () => {
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([
        block("removed-source-block", "removed"),
        block("rendered-block:1", "unchanged"),
      ]),
    });

    expect(context?.markers).toEqual([
      expect.objectContaining({
        kind: "removed",
        anchorBlockId: "rendered-block:1",
        highlightBlock: false,
      }),
    ]);
  });

  it("caps rendered markers at the marker budget", () => {
    const blocks = Array.from(
      { length: postDiffGitMarkerBudget + 5 },
      (_, index) => block(`rendered-block:${index}`, "changed"),
    );
    const context = buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation(blocks),
    });

    expect(context?.totalCount).toBe(postDiffGitMarkerBudget + 5);
    expect(context?.renderedCount).toBe(postDiffGitMarkerBudget);
    expect(context?.markers).toHaveLength(postDiffGitMarkerBudget);
  });
});
