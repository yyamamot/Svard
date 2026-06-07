import { describe, expect, it, vi } from "vitest";

import { GitRefPicker } from "../../src/ui/components/GitRefPicker";
import type { GitRefItem, GitRefList } from "../../src/core/types";
import { createReactRootHarness } from "./helpers/reactHarness";

function refItem(index: number): GitRefItem {
  const revision = index.toString(16).padStart(40, "0");
  return {
    kind: "commit",
    name: revision.slice(0, 7),
    revision,
    shortRevision: revision.slice(0, 7),
    summary: `commit ${index}`,
  };
}

function refList(items: GitRefItem[], hasMore = false): GitRefList {
  return {
    status: "ok",
    relativePath: "docs/sample.md",
    items,
    message: null,
    hasMore,
    nextCursor: hasMore ? items.at(-1)?.revision : null,
  };
}

describe("GitRefPicker pagination", () => {
  it("shows load more only when refs have more pages", async () => {
    const harness = createReactRootHarness();
    const onLoadMore = vi.fn(async () => {});
    try {
      harness.render(
        <GitRefPicker
          kind="commit"
          path="/workspace/docs/sample.md"
          refs={refList([refItem(1)], true)}
          loading={false}
          loadingMore={false}
          query=""
          onClose={vi.fn()}
          onLoadMore={onLoadMore}
          onQueryChange={vi.fn(async () => {})}
          onSelect={vi.fn()}
        />,
      );

      await harness.click(harness.byReviewId("git-ref-picker-load-more"));

      expect(onLoadMore).toHaveBeenCalledTimes(1);
    } finally {
      harness.cleanup();
    }
  });

  it("reloads refs when query changes and keeps synthetic commit input", async () => {
    vi.useFakeTimers();
    const harness = createReactRootHarness();
    const onQueryChange = vi.fn(async () => {});
    const onSelect = vi.fn();
    try {
      harness.render(
        <GitRefPicker
          kind="commit"
          path="/workspace/docs/sample.md"
          refs={refList([])}
          loading={false}
          loadingMore={false}
          query=""
          onClose={vi.fn()}
          onLoadMore={vi.fn(async () => {})}
          onQueryChange={onQueryChange}
          onSelect={onSelect}
        />,
      );

      await harness.setInputValue(
        harness.inputByReviewId("git-ref-picker-input"),
        "abcdef1",
      );
      vi.runAllTimers();
      await harness.click(harness.byReviewId("git-ref-picker-item"));

      expect(onQueryChange).toHaveBeenCalledWith("abcdef1");
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ revision: "abcdef1" }),
      );
    } finally {
      vi.useRealTimers();
      harness.cleanup();
    }
  });
});
