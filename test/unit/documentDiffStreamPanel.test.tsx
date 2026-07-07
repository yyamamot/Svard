import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentDiffStreamPanel } from "../../src/ui/components/DocumentDiffStreamPanel";
import type { DocumentDiffPreview } from "../../src/core/types";
import type { ContentCursorCommandHandler } from "../../src/ui/lib/contentCursor";
import type { DocumentDiffStreamCommandBridge } from "../../src/ui/lib/documentDiffStreamCommands";
import {
  deriveGitRenderedDiffSummary,
  type GitRenderedDiffSummary,
} from "../../src/ui/lib/gitRenderedDiff";

vi.mock("../../src/ui/lib/gitRenderedDiff", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/ui/lib/gitRenderedDiff")>();
  return {
    ...actual,
    deriveGitRenderedDiffSummary: vi.fn(),
  };
});

const deriveGitRenderedDiffSummaryMock = vi.mocked(
  deriveGitRenderedDiffSummary,
);

describe("DocumentDiffStreamPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    deriveGitRenderedDiffSummaryMock.mockReset();
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(renderedDiffSummary());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("loads document sections and marks only loaded documents viewed", async () => {
    const markViewed = vi.fn();
    const preview = diffPreview("/workspace/docs/guide.md");
    const getGitDiffPreview = vi.fn().mockResolvedValue(preview);
    const props = requiredDiffStreamProps();

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              {
                kind: "document",
                path: "docs/guide.md",
                documentPath: "/workspace/docs/guide.md",
                status: "modified",
              },
              {
                kind: "document",
                path: "docs/second.md",
                documentPath: "/workspace/docs/second.md",
                status: "modified",
              },
            ],
          }}
          documentReviewSession={{
            stateByPath: {},
            summary: { total: 1, reviewed: 0, needsAttention: 0 },
            markViewed,
            markNeedsAttention: vi.fn(),
            reset: vi.fn(),
          }}
          getGitDiffPreview={getGitDiffPreview}
          {...props}
          onClose={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getGitDiffPreview).toHaveBeenCalledWith("/workspace/docs/guide.md");
    expect(getGitDiffPreview).toHaveBeenCalledWith("/workspace/docs/second.md");
    expect(markViewed).toHaveBeenCalledWith("/workspace/docs/guide.md");
    expect(markViewed).toHaveBeenCalledWith("/workspace/docs/second.md");
    expect(
      container.querySelector('[data-review-id="diff-stream-file-section"]'),
    ).not.toBeNull();
    expect(container.textContent).not.toContain("Loading rendered diff");
    expect(container.textContent).not.toContain("Preview failed");
  });

  it("does not fetch every document when All diffs opens", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const props = requiredDiffStreamProps();

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              documentStreamItem("docs/one.md"),
              documentStreamItem("docs/two.md"),
              documentStreamItem("docs/three.md"),
            ],
          }}
          getGitDiffPreview={getGitDiffPreview}
          {...props}
          onClose={vi.fn()}
        />,
      );
    });

    await flushPreviewLoad();

    expect(getGitDiffPreview).toHaveBeenCalledTimes(2);
    expect(getGitDiffPreview).not.toHaveBeenCalledWith(
      "/workspace/docs/three.md",
    );
  });

  it("hydrates sections when they enter the stream viewport", async () => {
    const intersection = installMockIntersectionObserver();
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const props = requiredDiffStreamProps();

    try {
      await act(async () => {
        root.render(
          <DocumentDiffStreamPanel
            config={null}
            preview={{
              source: "git-changes-stream",
              items: [
                documentStreamItem("docs/one.md"),
                documentStreamItem("docs/two.md"),
                documentStreamItem("docs/three.md"),
              ],
            }}
            getGitDiffPreview={getGitDiffPreview}
            {...props}
            onClose={vi.fn()}
          />,
        );
      });

      expect(getGitDiffPreview).not.toHaveBeenCalled();

      await act(async () => {
        intersection.trigger("docs/two.md");
      });
      await flushPreviewLoad();

      expect(getGitDiffPreview).toHaveBeenCalledTimes(1);
      expect(getGitDiffPreview).toHaveBeenCalledWith("/workspace/docs/two.md");
    } finally {
      intersection.restore();
    }
  });

  it("limits initial stream hydration to two concurrent preview requests", async () => {
    const intersection = installMockIntersectionObserver();
    const first = deferred<DocumentDiffPreview>();
    const second = deferred<DocumentDiffPreview>();
    const third = deferred<DocumentDiffPreview>();
    const getGitDiffPreview = vi.fn((path: string) => {
      if (path.endsWith("one.md")) {
        return first.promise;
      }
      if (path.endsWith("two.md")) {
        return second.promise;
      }
      return third.promise;
    });
    const props = requiredDiffStreamProps();

    try {
      await act(async () => {
        root.render(
          <DocumentDiffStreamPanel
            config={null}
            preview={{
              source: "git-changes-stream",
              items: [
                documentStreamItem("docs/one.md"),
                documentStreamItem("docs/two.md"),
                documentStreamItem("docs/three.md"),
              ],
            }}
            getGitDiffPreview={getGitDiffPreview}
            {...props}
            onClose={vi.fn()}
          />,
        );
      });

      await act(async () => {
        intersection.trigger("docs/one.md", "docs/two.md", "docs/three.md");
      });

      expect(getGitDiffPreview).toHaveBeenCalledTimes(2);

      await act(async () => {
        first.resolve(diffPreview("/workspace/docs/one.md"));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(getGitDiffPreview).toHaveBeenCalledTimes(3);
      second.resolve(diffPreview("/workspace/docs/two.md"));
      third.resolve(diffPreview("/workspace/docs/three.md"));
    } finally {
      intersection.restore();
    }
  });

  it("loads the next unloaded document before moving to its first target", async () => {
    const intersection = installMockIntersectionObserver();
    const getGitDiffPreview = vi.fn((path: string) =>
      Promise.resolve(diffPreview(path)),
    );
    const props = requiredDiffStreamProps();

    try {
      await act(async () => {
        root.render(
          <DocumentDiffStreamPanel
            config={null}
            preview={{
              source: "git-changes-stream",
              items: [
                documentStreamItem("docs/one.md"),
                documentStreamItem("docs/two.md"),
              ],
            }}
            getGitDiffPreview={getGitDiffPreview}
            {...props}
            onClose={vi.fn()}
          />,
        );
      });

      await act(async () => {
        intersection.trigger("docs/one.md");
      });
      await flushPreviewLoad();
      expect(getGitDiffPreview).toHaveBeenCalledTimes(1);

      await act(async () => {
        buttonByText("Next").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });
      await flushPreviewLoad();

      expect(getGitDiffPreview).toHaveBeenCalledWith("/workspace/docs/two.md");
      const activeTarget = container.querySelector(
        '[data-stream-index="1"] [data-active-change="true"]',
      );
      expect(activeTarget).not.toBeNull();
    } finally {
      intersection.restore();
    }
  });

  it("renders unsupported files as blocker rows without fetching previews", async () => {
    const getGitDiffPreview = vi.fn();
    const props = requiredDiffStreamProps();

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              {
                kind: "blocker",
                path: "assets/logo.png",
                status: "modified",
                reason: "Preview diff is available for markup documents only.",
              },
            ],
          }}
          getGitDiffPreview={getGitDiffPreview}
          {...props}
          onClose={vi.fn()}
        />,
      );
    });

    expect(getGitDiffPreview).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-review-id="diff-stream-blocker-row"]')
        ?.textContent,
    ).toContain("Preview diff is available for markup documents only.");
    expect(
      container.querySelector('[data-review-id="diff-stream-change-ruler"]'),
    ).toBeNull();
  });

  it("hides block meta in full preview and shows it in changes only", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const props = requiredDiffStreamProps();

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              {
                kind: "document",
                path: "docs/guide.md",
                documentPath: "/workspace/docs/guide.md",
                status: "modified",
              },
            ],
          }}
          getGitDiffPreview={getGitDiffPreview}
          {...props}
          onClose={vi.fn()}
        />,
      );
    });

    await flushPreviewLoad();

    expect(container.querySelector(".git-rendered-block-meta")).toBeNull();

    const changesOnlyButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="diff-stream-changes-only-view"]',
    );
    expect(changesOnlyButton).not.toBeNull();
    await act(async () => {
      changesOnlyButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.querySelector(".git-rendered-block-meta")).not.toBeNull();

    const fullPreviewButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="diff-stream-full-preview-view"]',
    );
    expect(fullPreviewButton).not.toBeNull();
    await act(async () => {
      fullPreviewButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.querySelector(".git-rendered-block-meta")).toBeNull();
  });

  it("renders stream ruler markers and keeps marker selection in sync", async () => {
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(renderedDiffSummary(2));
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const props = requiredDiffStreamProps();

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              {
                kind: "document",
                path: "docs/guide.md",
                documentPath: "/workspace/docs/guide.md",
                status: "modified",
              },
            ],
          }}
          getGitDiffPreview={getGitDiffPreview}
          {...props}
          onClose={vi.fn()}
        />,
      );
    });

    await flushPreviewLoad();
    await flushRulerMeasure();

    const markers = () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          '[data-review-id="diff-stream-change-ruler-marker"]',
        ),
      );
    expect(markers()).toHaveLength(2);
    expect(markers()[0].classList.contains("active")).toBe(true);

    await act(async () => {
      markers()[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(markers()[1].classList.contains("active")).toBe(true);

    await act(async () => {
      buttonByText("Previous").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(markers()[0].classList.contains("active")).toBe(true);

    await act(async () => {
      buttonByText("Next").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(markers()[1].classList.contains("active")).toBe(true);
  });

  it("moves next through list item and table row targets", async () => {
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(
      renderedDiffSummaryWithFineTargets(),
    );
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const props = requiredDiffStreamProps();
    const scrollTargets: Element[] = [];
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function scrollIntoViewMock() {
      scrollTargets.push(this);
    };

    try {
      await act(async () => {
        root.render(
          <DocumentDiffStreamPanel
            config={null}
            preview={{
              source: "git-changes-stream",
              items: [
                {
                  kind: "document",
                  path: "docs/guide.md",
                  documentPath: "/workspace/docs/guide.md",
                  status: "modified",
                },
              ],
            }}
            getGitDiffPreview={getGitDiffPreview}
            {...props}
            onClose={vi.fn()}
          />,
        );
      });

      await flushPreviewLoad();
      await flushRulerMeasure();

      await act(async () => {
        buttonByText("Next").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });

      const activeListItem = container.querySelector(
        ".git-rendered-list-item-change[data-active-change='true']",
      );
      expect(activeListItem?.textContent).toContain("New list item");
      expect(scrollTargets.at(-1)?.textContent).toContain("New list item");
      expect(scrollTargets.at(-1)?.getAttribute("data-change-index")).toBe("1");

      await act(async () => {
        buttonByText("Next").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });

      const activeTableRow = container.querySelector(
        ".git-rendered-table-row-change[data-active-change='true']",
      );
      expect(activeTableRow?.textContent).toContain("New table value");
      expect(scrollTargets.at(-1)?.textContent).toContain("New table value");
      expect(scrollTargets.at(-1)?.getAttribute("data-change-index")).toBe("2");

      await act(async () => {
        buttonByText("Previous").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });

      expect(
        container.querySelector(
          ".git-rendered-list-item-change[data-active-change='true']",
        )?.textContent,
      ).toContain("New list item");
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("selects fine-grained stream targets from ruler markers", async () => {
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(
      renderedDiffSummaryWithFineTargets(),
    );
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const props = requiredDiffStreamProps();

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              {
                kind: "document",
                path: "docs/guide.md",
                documentPath: "/workspace/docs/guide.md",
                status: "modified",
              },
            ],
          }}
          getGitDiffPreview={getGitDiffPreview}
          {...props}
          onClose={vi.fn()}
        />,
      );
    });

    await flushPreviewLoad();
    await flushRulerMeasure();

    const markers = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '[data-review-id="diff-stream-change-ruler-marker"]',
      ),
    );
    expect(markers).toHaveLength(3);

    await act(async () => {
      markers[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(markers[2].classList.contains("active")).toBe(true);
    const activeTarget = container.querySelector<HTMLElement>(
      ".git-rendered-table-row-change[data-active-change='true']",
    );
    expect(activeTarget?.textContent).toContain("New table value");
    expect(markers[2].dataset.changeIndex).toBe(
      activeTarget?.dataset.changeIndex,
    );
    expect(markers[2].dataset.streamIndex).toBe(
      activeTarget?.closest<HTMLElement>(
        '[data-review-id="diff-stream-file-section"]',
      )?.dataset.streamIndex,
    );
  });

  it("defers rendered context menu until right button release", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const props = requiredDiffStreamProps();
    const openContextMenu = vi.fn(() => true);

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              {
                kind: "document",
                path: "docs/guide.md",
                documentPath: "/workspace/docs/guide.md",
                status: "modified",
              },
            ],
          }}
          getGitDiffPreview={getGitDiffPreview}
          {...props}
          openContextMenu={openContextMenu}
          onClose={vi.fn()}
        />,
      );
    });

    await flushPreviewLoad();

    const rightPane = container.querySelector<HTMLElement>(
      '[data-review-id="diff-stream-right-pane"]',
    );
    expect(rightPane).not.toBeNull();

    await act(async () => {
      rightPane!.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          button: 2,
          buttons: 2,
          clientX: 12,
          clientY: 18,
        }),
      );
    });
    expect(openContextMenu).not.toHaveBeenCalled();

    await act(async () => {
      rightPane!.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          button: 2,
          buttons: 0,
          clientX: 12,
          clientY: 18,
        }),
      );
    });
    expect(openContextMenu).toHaveBeenCalledTimes(1);
  });

  it("opens rendered context menu immediately when contextmenu fires after release", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const props = requiredDiffStreamProps();
    const openContextMenu = vi.fn(() => true);

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              {
                kind: "document",
                path: "docs/guide.md",
                documentPath: "/workspace/docs/guide.md",
                status: "modified",
              },
            ],
          }}
          getGitDiffPreview={getGitDiffPreview}
          {...props}
          openContextMenu={openContextMenu}
          onClose={vi.fn()}
        />,
      );
    });

    await flushPreviewLoad();

    const rightPane = container.querySelector<HTMLElement>(
      '[data-review-id="diff-stream-right-pane"]',
    );
    expect(rightPane).not.toBeNull();

    await act(async () => {
      rightPane!.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          button: 2,
          buttons: 0,
          clientX: 12,
          clientY: 18,
        }),
      );
    });
    expect(openContextMenu).toHaveBeenCalledTimes(1);
  });

  it("routes content cursor and shortcut commands to the stream", async () => {
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(renderedDiffSummary(2));
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const contentCursorCommandRef: {
      current: ContentCursorCommandHandler | null;
    } = { current: null };
    const streamCommandRef: {
      current: DocumentDiffStreamCommandBridge | null;
    } = { current: null };
    const onClose = vi.fn();
    const props = requiredDiffStreamProps();

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              {
                kind: "document",
                path: "docs/guide.md",
                documentPath: "/workspace/docs/guide.md",
                status: "modified",
              },
            ],
          }}
          getGitDiffPreview={getGitDiffPreview}
          contentCursorCommandRef={contentCursorCommandRef}
          streamCommandRef={streamCommandRef}
          {...props}
          onClose={onClose}
        />,
      );
    });

    await flushPreviewLoad();
    await flushRulerMeasure();

    const markers = () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          '[data-review-id="diff-stream-change-ruler-marker"]',
        ),
      );
    expect(markers()[0].classList.contains("active")).toBe(true);

    await act(async () => {
      expect(contentCursorCommandRef.current?.("next")).toBe(true);
    });
    expect(markers()[1].classList.contains("active")).toBe(true);

    await act(async () => {
      expect(
        streamCommandRef.current?.dispatch("viewer.contentCursor.previous"),
      ).toBe(true);
    });
    expect(markers()[0].classList.contains("active")).toBe(true);

    const streamBody =
      container.querySelector<HTMLElement>(".diff-stream-body");
    expect(streamBody).not.toBeNull();
    Object.defineProperty(streamBody, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(streamBody, "scrollHeight", {
      configurable: true,
      value: 600,
    });
    await act(async () => {
      expect(streamCommandRef.current?.dispatch("viewer.pageDown")).toBe(true);
    });
    expect(streamBody!.scrollTop).toBeGreaterThan(0);

    await act(async () => {
      expect(streamCommandRef.current?.dispatch("tab.close")).toBe(true);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

async function flushPreviewLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function flushRulerMeasure() {
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  });
}

function buttonByText(text: string) {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((candidate) => candidate.textContent === text);
  if (!button) {
    throw new Error(`Missing button: ${text}`);
  }
  return button;
}

function requiredDiffStreamProps() {
  return {
    copyText: vi.fn().mockResolvedValue(undefined),
    openContextMenu: vi.fn(() => true),
    openDocument: vi.fn().mockResolvedValue(undefined),
    openPathInEditor: vi.fn().mockResolvedValue(undefined),
    resolveDocumentLink: vi.fn().mockResolvedValue({
      status: "blocked",
      message: "Missing",
    }),
    confirmExternalLink: vi.fn().mockResolvedValue(true),
    openExternalUrl: vi.fn().mockResolvedValue(undefined),
    onOpenDiagramPreview: vi.fn(),
    showInlineNotice: vi.fn(),
  };
}

function documentStreamItem(path: string) {
  return {
    kind: "document" as const,
    path,
    documentPath: `/workspace/${path}`,
    status: "modified" as const,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function installMockIntersectionObserver() {
  const original = globalThis.IntersectionObserver;
  const observed = new Set<Element>();
  let callback: IntersectionObserverCallback | null = null;
  globalThis.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];

    constructor(observerCallback: IntersectionObserverCallback) {
      callback = observerCallback;
    }

    observe(element: Element) {
      observed.add(element);
    }

    unobserve(element: Element) {
      observed.delete(element);
    }

    disconnect() {
      observed.clear();
    }

    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  return {
    trigger: (...paths: string[]) => {
      const pathSet = new Set(paths.map((path) => `/workspace/${path}`));
      const entries = Array.from(observed)
        .filter(
          (element) =>
            element instanceof HTMLElement &&
            element.dataset.streamKey &&
            pathSet.has(element.dataset.streamKey),
        )
        .map(
          (target) =>
            ({
              isIntersecting: true,
              target,
            }) as IntersectionObserverEntry,
        );
      callback?.(entries, {} as IntersectionObserver);
    },
    restore: () => {
      globalThis.IntersectionObserver = original;
    },
  };
}

function diffPreview(path: string): DocumentDiffPreview {
  return {
    source: "git",
    relativePath: "docs/guide.md",
    leftPath: path,
    rightPath: path,
    status: "modified",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    hunks: [
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [
          { kind: "removed", oldLine: 1, newLine: null, text: "# Old Guide" },
          { kind: "removed", oldLine: 3, newLine: null, text: "Old text" },
          { kind: "added", oldLine: null, newLine: 1, text: "# New Guide" },
          { kind: "added", oldLine: null, newLine: 3, text: "New text" },
        ],
      },
    ],
    leftText: "# Old Guide\n\nOld text",
    rightText: "# New Guide\n\nNew text",
  };
}

function renderedDiffSummary(count = 1): GitRenderedDiffSummary {
  return {
    blocks: Array.from({ length: count }, (_, index) => ({
      id: `paragraph-${index}`,
      kind: "changed" as const,
      blockKind: "paragraph" as const,
      left: {
        id: `paragraph-${index}-left`,
        kind: "paragraph" as const,
        tagName: "p",
        text: `Old text ${index}`,
        html: `<p>Old text ${index}</p>`,
      },
      right: {
        id: `paragraph-${index}-right`,
        kind: "paragraph" as const,
        tagName: "p",
        text: `New text ${index}`,
        html: `<p>New text ${index}</p>`,
      },
    })),
  };
}

function renderedDiffSummaryWithFineTargets(): GitRenderedDiffSummary {
  return {
    blocks: [
      {
        id: "paragraph-0",
        kind: "changed" as const,
        blockKind: "paragraph" as const,
        left: {
          id: "paragraph-0-left",
          kind: "paragraph" as const,
          tagName: "p",
          text: "Old paragraph",
          html: "<p>Old paragraph</p>",
        },
        right: {
          id: "paragraph-0-right",
          kind: "paragraph" as const,
          tagName: "p",
          text: "New paragraph",
          html: "<p>New paragraph</p>",
        },
      },
      {
        id: "list-0",
        kind: "changed" as const,
        blockKind: "list" as const,
        left: {
          id: "list-0-left",
          kind: "list" as const,
          tagName: "ul",
          text: "Old list item",
          html: "<ul><li>Old list item</li></ul>",
        },
        right: {
          id: "list-0-right",
          kind: "list" as const,
          tagName: "ul",
          text: "New list item",
          html: "<ul><li>New list item</li></ul>",
        },
        childChanges: [
          {
            kind: "changed" as const,
            side: "both" as const,
            confidence: "high" as const,
            leftIndex: 0,
            rightIndex: 0,
          },
        ],
      },
      {
        id: "table-0",
        kind: "changed" as const,
        blockKind: "table" as const,
        left: {
          id: "table-0-left",
          kind: "table" as const,
          tagName: "table",
          text: "Old table value",
          html: "<table><tbody><tr><td>Old table value</td></tr></tbody></table>",
        },
        right: {
          id: "table-0-right",
          kind: "table" as const,
          tagName: "table",
          text: "New table value",
          html: "<table><tbody><tr><td>New table value</td></tr></tbody></table>",
        },
        tableChanges: [
          {
            kind: "changed" as const,
            side: "both" as const,
            confidence: "high" as const,
            leftRowIndex: 0,
            rightRowIndex: 0,
            leftCellIndex: 0,
            rightCellIndex: 0,
          },
        ],
      },
    ],
  };
}
