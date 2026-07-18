import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GitCommitDetailsPanel } from "../../src/ui/components/GitCommitDetailsPanel";

describe("GitCommitDetailsPanel", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("hands the repository root to the commit All Diffs stream", async () => {
    const onClose = vi.fn();
    const onOpenAllDiffs = vi.fn();
    await act(async () => {
      root.render(
        <GitCommitDetailsPanel
          details={{
            repositoryRoot: "/workspace",
            revision: "fixture-revision",
            shortHash: "fixture",
            summary: "docs: update guide",
            author: "Svard",
            date: "2026-07-18T00:00:00Z",
            files: [
              {
                path: "docs/guide.md",
                status: "modified",
                documentPath: "/workspace/docs/guide.md",
              },
            ],
          }}
          onClose={onClose}
          onOpenFile={vi.fn()}
          onOpenAllDiffs={onOpenAllDiffs}
        />,
      );
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="git-commit-details-all-diffs"]',
        )
        ?.click();
    });

    expect(onOpenAllDiffs).toHaveBeenCalledWith({
      source: "git-commit-stream",
      repositoryRoot: "/workspace",
      items: [
        expect.objectContaining({
          path: "docs/guide.md",
          documentPath: "/workspace/docs/guide.md",
        }),
      ],
      revision: "fixture-revision",
      comparisonLabel: "Parent → fixture",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
