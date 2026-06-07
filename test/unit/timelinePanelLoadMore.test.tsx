import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimelinePanel } from "../../src/ui/components/sidebar/TimelinePanel";
import type { GitFileHistory } from "../../src/core/types";

const history = {
  status: "ok",
  relativePath: "docs/guide.md",
  items: [
    {
      revision: "new",
      shortHash: "new",
      parentRevision: null,
      parentShortHash: null,
      summary: "New",
      author: "Developer",
      date: "2026-05-20T00:00:00.000Z",
      fileStatus: "modified",
    },
  ],
  hasMore: true,
  nextCursor: "new",
  message: null,
} satisfies GitFileHistory;

describe("TimelinePanel load more", () => {
  let container: HTMLDivElement;
  let root: Root;
  let intersectionCallbacks: Array<IntersectionObserverCallback>;
  const originalIntersectionObserver = globalThis.IntersectionObserver;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    intersectionCallbacks = [];
    globalThis.IntersectionObserver = class {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [];

      constructor(callback: IntersectionObserverCallback) {
        intersectionCallbacks.push(callback);
      }

      disconnect() {}
      observe() {}
      takeRecords() {
        return [];
      }
      unobserve() {}
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    act(() => root.unmount());
    globalThis.IntersectionObserver = originalIntersectionObserver;
    vi.restoreAllMocks();
    container.remove();
  });

  async function renderPanel(onLoadMore: () => void) {
    await act(async () => {
      root.render(
        <TimelinePanel
          history={history}
          loading={false}
          loadingMore={false}
          path="/workspace/docs/guide.md"
          selectedRevision={null}
          onLoadMore={onLoadMore}
          onOpenChanges={vi.fn()}
          onItemContextMenu={vi.fn()}
        />,
      );
    });
  }

  it("does not auto load older commits before user scroll intent", async () => {
    const onLoadMore = vi.fn();
    await renderPanel(onLoadMore);

    expect(intersectionCallbacks).toHaveLength(0);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("arms auto load more after downward scroll intent", async () => {
    const onLoadMore = vi.fn();
    await renderPanel(onLoadMore);

    const list = container.querySelector('[data-review-id="timeline-list"]');
    expect(list).not.toBeNull();
    await act(async () => {
      list?.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: 24 }),
      );
    });

    expect(intersectionCallbacks).toHaveLength(1);
    await act(async () => {
      intersectionCallbacks[0](
        [
          {
            isIntersecting: true,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("keeps the manual load more button available before scroll intent", async () => {
    const onLoadMore = vi.fn();
    await renderPanel(onLoadMore);

    const button = container.querySelector(
      '[data-review-id="timeline-load-more"] button',
    );
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
