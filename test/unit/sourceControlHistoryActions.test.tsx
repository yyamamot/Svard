import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AppConfig,
  DocumentPayload,
  HostAdapter,
} from "../../src/core/types";
import {
  configWithWorkspace,
  createHost,
  mockAnimationFrame,
  SourceControlHarness,
  type OpenContextMenu,
  type SourceControlActions,
} from "./helpers/sourceControlHarness";

describe("useSourceControlActions history pagination", () => {
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    container.remove();
  });

  async function render(
    config: AppConfig,
    host: HostAdapter,
    options: {
      document?: DocumentPayload;
      onActions?: (actions: SourceControlActions) => void;
      openContextMenu?: OpenContextMenu;
      rootDirectory?: string;
    } = {},
  ) {
    await act(async () => {
      root.render(
        <SourceControlHarness config={config} host={host} {...options} />,
      );
    });
    await act(async () => {});
  }

  it("loads older Repo Graph commits only when requested", async () => {
    const host = createHost();
    host.getGitCommitGraph = vi
      .fn()
      .mockResolvedValueOnce({
        status: "ok",
        scope: "repository",
        repositoryRoot: "/workspace",
        relativePath: null,
        currentBranch: "main",
        headCommit: null,
        items: [
          {
            revision: "new",
            shortHash: "new",
            parentRevisions: [],
            parentShortHashes: [],
            summary: "New",
            author: "Developer",
            date: "2026-05-20T00:00:00.000Z",
            fileStatus: "modified",
          },
        ],
        hasMore: true,
        nextCursor: "new",
        message: null,
      })
      .mockResolvedValueOnce({
        status: "ok",
        scope: "repository",
        repositoryRoot: "/workspace",
        relativePath: null,
        currentBranch: "main",
        headCommit: null,
        items: [
          {
            revision: "old",
            shortHash: "old",
            parentRevisions: [],
            parentShortHashes: [],
            summary: "Old",
            author: "Developer",
            date: "2026-05-19T00:00:00.000Z",
            fileStatus: "modified",
          },
        ],
        hasMore: false,
        nextCursor: null,
        message: null,
      });
    let actions: SourceControlActions | undefined;

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "graph",
        sourceControlGraphScope: "repository",
      }),
      host,
      {
        onActions: (nextActions) => {
          actions = nextActions;
        },
      },
    );

    expect(actions?.gitCommitGraph?.items.map((item) => item.revision)).toEqual(
      ["new"],
    );
    expect(host.getGitCommitGraph).toHaveBeenLastCalledWith("/workspace", {
      scope: "repository",
      path: null,
      limit: 20,
    });
    await act(async () => {
      await actions!.loadMoreGitCommitGraph();
    });

    expect(host.getGitCommitGraph).toHaveBeenLastCalledWith("/workspace", {
      scope: "repository",
      path: null,
      limit: 50,
      cursor: "new",
    });
    expect(actions?.gitCommitGraph?.items.map((item) => item.revision)).toEqual(
      ["new", "old"],
    );
  });

  it("loads older File History commits only when requested", async () => {
    const restoreAnimationFrame = mockAnimationFrame();
    const host = createHost();
    host.getGitFileHistory = vi
      .fn()
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        status: "ok",
        relativePath: "docs/guide.md",
        items: [
          {
            revision: "old",
            shortHash: "old",
            parentRevision: null,
            parentShortHash: null,
            summary: "Old",
            author: "Developer",
            date: "2026-05-19T00:00:00.000Z",
            fileStatus: "modified",
          },
        ],
        hasMore: false,
        nextCursor: null,
        message: null,
      });
    let actions: SourceControlActions | undefined;

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "graph",
        sourceControlGraphScope: "file",
      }),
      host,
      {
        onActions: (nextActions) => {
          actions = nextActions;
        },
      },
    );
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    expect(host.getGitFileHistory).toHaveBeenLastCalledWith(
      "/workspace/docs/guide.md",
      {
        limit: 20,
      },
    );

    await act(async () => {
      await actions!.loadMoreGitFileHistory();
    });

    expect(host.getGitFileHistory).toHaveBeenLastCalledWith(
      "/workspace/docs/guide.md",
      {
        limit: 50,
        cursor: "new",
      },
    );
    expect(
      actions?.gitTimelineHistory?.items.map((item) => item.revision),
    ).toEqual(["new", "old"]);
    restoreAnimationFrame();
  });
});
