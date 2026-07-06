import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppConfig, HostAdapter } from "../../src/core/types";
import type { ContextMenuItem } from "../../src/ui/types";
import {
  configWithWorkspace,
  contextMenuEvent,
  createHost,
  deferred,
  SourceControlHarness,
  type OpenContextMenu,
  type SourceControlActions,
} from "./helpers/sourceControlHarness";

describe("useSourceControlActions review actions", () => {
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
    vi.restoreAllMocks();
    container.remove();
  });

  async function render(
    config: AppConfig,
    host: HostAdapter,
    options: {
      onActions?: (actions: SourceControlActions) => void;
      onDocumentReviewNeedsAttention?: Parameters<
        typeof SourceControlHarness
      >[0]["onDocumentReviewNeedsAttention"];
      onDocumentReviewReset?: Parameters<
        typeof SourceControlHarness
      >[0]["onDocumentReviewReset"];
      onDocumentReviewViewed?: Parameters<
        typeof SourceControlHarness
      >[0]["onDocumentReviewViewed"];
      openContextMenu?: OpenContextMenu;
      setDocumentDiffPreview?: Parameters<
        typeof SourceControlHarness
      >[0]["setDocumentDiffPreview"];
    } = {},
  ) {
    await act(async () => {
      root.render(
        <SourceControlHarness config={config} host={host} {...options} />,
      );
    });
    await act(async () => {});
  }

  it("adds review mark actions to Source Control Changes context menu", async () => {
    const host = createHost();
    const markNeedsAttention = vi.fn();
    const markViewed = vi.fn();
    const resetReviewState = vi.fn();
    const openContextMenu = vi.fn() as unknown as OpenContextMenu;
    let actions: SourceControlActions | undefined;

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "changes",
      }),
      host,
      {
        onActions: (nextActions) => {
          actions = nextActions;
        },
        onDocumentReviewNeedsAttention: markNeedsAttention,
        onDocumentReviewReset: resetReviewState,
        onDocumentReviewViewed: markViewed,
        openContextMenu,
      },
    );

    actions?.openSourceControlChangeContextMenu(contextMenuEvent(), {
      path: "docs/guide.md",
      documentPath: "/workspace/docs/guide.md",
      status: "modified",
    });

    const items = vi.mocked(openContextMenu).mock.calls[0]?.[1] as
      | ContextMenuItem[]
      | undefined;
    expect(items?.map((item) => item.label)).toContain("Mark viewed");
    expect(items?.map((item) => item.label)).toContain("Mark needs attention");
    expect(items?.map((item) => item.label)).toContain("Reset review state");

    items?.find((item) => item.label === "Mark needs attention")?.onSelect?.();
    expect(markNeedsAttention).toHaveBeenCalledWith("/workspace/docs/guide.md");
  });

  it("keeps the latest Git diff preview when review navigation requests overlap", async () => {
    const first =
      deferred<Awaited<ReturnType<HostAdapter["getGitDiffPreview"]>>>();
    const second =
      deferred<Awaited<ReturnType<HostAdapter["getGitDiffPreview"]>>>();
    const host = createHost();
    vi.mocked(host.getGitDiffPreview)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const setDocumentDiffPreview = vi.fn();
    const markViewed = vi.fn();
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      onActions: (nextActions) => {
        actions = nextActions;
      },
      onDocumentReviewViewed: markViewed,
      setDocumentDiffPreview,
    });

    void actions?.showGitDiff("/workspace/docs/first.md");
    void actions?.showGitDiff("/workspace/docs/second.md");

    expect(setDocumentDiffPreview).toHaveBeenNthCalledWith(1, null);
    expect(setDocumentDiffPreview).toHaveBeenNthCalledWith(2, null);

    await act(async () => {
      second.resolve({
        source: "git",
        repositoryRoot: "/workspace",
        relativePath: "docs/second.md",
        leftPath: "/workspace/docs/second.md",
        rightPath: "/workspace/docs/second.md",
        status: "modified",
        leftLabel: "HEAD",
        rightLabel: "Working Tree",
        hunks: [],
      });
      await second.promise;
    });

    expect(setDocumentDiffPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ relativePath: "docs/second.md" }),
    );
    expect(markViewed).toHaveBeenCalledWith("/workspace/docs/second.md");

    await act(async () => {
      first.resolve({
        source: "git",
        repositoryRoot: "/workspace",
        relativePath: "docs/first.md",
        leftPath: "/workspace/docs/first.md",
        rightPath: "/workspace/docs/first.md",
        status: "modified",
        leftLabel: "HEAD",
        rightLabel: "Working Tree",
        hunks: [],
      });
      await first.promise;
    });

    expect(setDocumentDiffPreview).toHaveBeenCalledTimes(3);
    expect(setDocumentDiffPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ relativePath: "docs/second.md" }),
    );
    expect(markViewed).not.toHaveBeenCalledWith("/workspace/docs/first.md");
  });

  it("fills the working tree diff preview path for review watch state", async () => {
    const host = createHost();
    vi.mocked(host.getGitDiffPreview).mockResolvedValueOnce({
      source: "git",
      repositoryRoot: "/workspace",
      relativePath: "docs/guide.md",
      leftPath: null,
      rightPath: null,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: [],
    });
    const setDocumentDiffPreview = vi.fn();
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      onActions: (nextActions) => {
        actions = nextActions;
      },
      setDocumentDiffPreview,
    });

    await act(async () => {
      await actions?.showGitDiff("/workspace/docs/guide.md");
    });

    expect(setDocumentDiffPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        leftPath: "/workspace/docs/guide.md",
        rightPath: "/workspace/docs/guide.md",
      }),
    );
  });
});
