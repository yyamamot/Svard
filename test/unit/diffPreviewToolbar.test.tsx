import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiffToolbar } from "../../src/ui/components/gitDiffPreview/toolbar";
import type { DocumentDiffPreview } from "../../src/core/types";

const preview: DocumentDiffPreview = {
  source: "git",
  repositoryRoot: "/workspace",
  relativePath: "docs/guide.md",
  leftPath: "/workspace/docs/guide.md",
  rightPath: "/workspace/docs/guide.md",
  status: "modified",
  leftLabel: "HEAD",
  rightLabel: "Working Tree",
  hunks: [],
};

describe("DiffToolbar watch state", () => {
  let container: HTMLDivElement;
  let root: Root;

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

  function render(overrides: Partial<Parameters<typeof DiffToolbar>[0]> = {}) {
    const props: Parameters<typeof DiffToolbar>[0] = {
      config: null,
      preview,
      title: "guide.md",
      view: "preview",
      changeCount: 1,
      changeCountLabel: "1 change",
      isExpanded: true,
      syncScrollEnabled: true,
      tableViewAvailable: false,
      renderedSummaryLoading: false,
      renderedBlockCount: 1,
      onMoveChange: vi.fn(),
      onRefreshPreview: vi.fn(),
      onViewChange: vi.fn(),
      onToggleExpanded: vi.fn(),
      onSyncScrollChange: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
    act(() => {
      root.render(<DiffToolbar {...props} />);
    });
    return props;
  }

  it("shows stale state with a manual refresh action", () => {
    const onRefreshPreview = vi.fn();
    render({
      watchState: {
        status: "stale",
        reason: "metadata-event",
        message: "Preview changed on disk",
      },
      onRefreshPreview,
    });

    const badge = container.querySelector(
      '[data-review-id="git-diff-preview-watch-status"]',
    );
    expect(badge?.textContent).toBe("Stale");
    expect(badge?.getAttribute("data-watch-status")).toBe("stale");

    const button = container.querySelector<HTMLButtonElement>(
      '[data-review-id="git-diff-preview-refresh"]',
    );
    expect(button?.textContent).toContain("Refresh preview");
    act(() => {
      button?.click();
    });
    expect(onRefreshPreview).toHaveBeenCalledTimes(1);
  });

  it("disables refresh while the preview is refreshing", () => {
    render({
      watchState: {
        status: "refreshing",
        reason: "file-watch",
      },
    });

    expect(
      container.querySelector(
        '[data-review-id="git-diff-preview-watch-status"]',
      )?.textContent,
    ).toBe("Refreshing");
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-review-id="git-diff-preview-refresh"]',
      )?.disabled,
    ).toBe(true);
  });

  it("toggles the diff AI Chat without adding a question", () => {
    const onToggleAgentChat = vi.fn();
    render({
      agentChatAvailable: true,
      agentChatOpen: false,
      onToggleAgentChat,
    });

    const button = container.querySelector<HTMLButtonElement>(
      '[data-review-id="git-diff-agent-toggle"]',
    );
    expect(button?.textContent).toContain("Ask AI");
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    act(() => button?.click());
    expect(onToggleAgentChat).toHaveBeenCalledOnce();
  });

  it("disables diff AI Chat without a workspace", () => {
    render({ agentChatAvailable: false });
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-review-id="git-diff-agent-toggle"]',
      )?.disabled,
    ).toBe(true);
  });

  it("omits the current change attachment toolbar action", () => {
    render({ agentChatAvailable: true });
    expect(
      container.querySelector(
        '[data-review-id="git-diff-attach-current-change"]',
      ),
    ).toBeNull();
  });
});
