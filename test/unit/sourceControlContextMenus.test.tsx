import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppConfig, HostAdapter } from "../../src/core/types";
import type { ContextMenuItem } from "../../src/ui/types";
import {
  configWithWorkspace,
  contextMenuEvent,
  createHost,
  documentPayload,
  SourceControlHarness,
  type OpenContextMenu,
  type SourceControlActions,
} from "./helpers/sourceControlHarness";

describe("useSourceControlActions context menus", () => {
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
      openContextMenu?: OpenContextMenu;
    } = {},
  ) {
    await act(async () => {
      root.render(
        <SourceControlHarness config={config} host={host} {...options} />,
      );
    });
    await act(async () => {});
  }

  it("opens a custom Changes context menu without Copy Status", async () => {
    const host = createHost();
    const openContextMenu = vi.fn() as unknown as OpenContextMenu &
      ReturnType<typeof vi.fn>;
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      openContextMenu,
      onActions: (nextActions) => {
        actions = nextActions;
      },
    });

    expect(actions).toBeDefined();
    actions!.openSourceControlChangeContextMenu(contextMenuEvent(), {
      path: "docs/guide.md",
      status: "modified",
      documentPath: documentPayload.path,
    });

    const items = openContextMenu.mock.calls[0]?.[1] as ContextMenuItem[];
    expect(items.map((item) => item.label)).toEqual([
      "Open rendered diff",
      "Show File History",
      "Compare with Branch...",
      "Compare with Tag...",
      "Compare with Commit...",
      "Copy Path",
      "Copy Relative Path",
    ]);
  });

  it("opens a Branch Diff context menu with diff range and status copy", async () => {
    const host = createHost();
    const openContextMenu = vi.fn() as unknown as OpenContextMenu &
      ReturnType<typeof vi.fn>;
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      openContextMenu,
      onActions: (nextActions) => {
        actions = nextActions;
      },
    });

    expect(actions).toBeDefined();
    actions!.openSourceControlBranchDiffContextMenu(contextMenuEvent(), {
      path: "docs/guide.md",
      oldPath: "docs/old-guide.md",
      status: "renamed",
      documentPath: documentPayload.path,
    });

    const items = openContextMenu.mock.calls[0]?.[1] as ContextMenuItem[];
    expect(items.map((item) => item.label)).toContain("Copy Old Path");
    expect(items.map((item) => item.label)).toContain("Copy Diff Range");
    expect(items.map((item) => item.label)).toContain("Copy Status");
  });

  it("opens a Repo Graph context menu with commit actions", async () => {
    const host = createHost();
    const openContextMenu = vi.fn() as unknown as OpenContextMenu &
      ReturnType<typeof vi.fn>;
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      openContextMenu,
      onActions: (nextActions) => {
        actions = nextActions;
      },
    });

    expect(actions).toBeDefined();
    actions!.openSourceControlGraphContextMenu(contextMenuEvent(), {
      revision: "abcdef123456",
      shortHash: "abcdef1",
      parentRevisions: [],
      parentShortHashes: [],
      summary: "Update guide",
      author: "Developer",
      date: "2026-05-20T00:00:00.000Z",
      fileStatus: "modified",
    });

    const items = openContextMenu.mock.calls[0]?.[1] as ContextMenuItem[];
    expect(items.map((item) => item.label)).toEqual([
      "View Commit",
      "Select for Compare",
      "Copy Commit ID",
      "Copy Commit Message",
    ]);
  });
});
