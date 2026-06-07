import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenFilesList } from "../../src/ui/components/sidebar/OpenFilesList";
import type { DocumentPayload } from "../../src/core/types";
import type { OpenFileReloadState } from "../../src/ui/types";

const tab = (path: string): DocumentPayload => ({
  path,
  basePath: "/workspace",
  format: path.endsWith(".md") ? "markdown" : "asciidoc",
  source: "# Fixture",
  updatedAt: "2026-05-21T00:00:00.000Z",
});

function renderOpenFilesList(
  root: Root,
  options: {
    tabs?: DocumentPayload[];
    activePath?: string;
    pinnedTabs?: string[];
    gitStatusByPath?: Record<string, "modified" | "untracked" | "clean">;
    reloadStateByPath?: Record<string, OpenFileReloadState>;
    onActivate?: (path: string) => void;
    onClose?: (path: string) => void;
    onOpenGitDiff?: (path: string) => void;
    onTogglePinned?: (path: string) => void;
  } = {},
) {
  const props = {
    sectionRef: undefined,
    collapsed: false,
    tabs: options.tabs ?? [tab("/workspace/docs/git-modified.md")],
    activePath: options.activePath,
    preferencesTabOpen: false,
    preferencesActive: false,
    pinnedTabs: options.pinnedTabs ?? [],
    gitStatusByPath: options.gitStatusByPath ?? {},
    reloadStateByPath: options.reloadStateByPath ?? {},
    filterValue: "",
    filterInputRef: { current: null },
    onFilterChange: vi.fn(),
    onActivate: options.onActivate ?? vi.fn(),
    onActivatePreferences: vi.fn(),
    onClose: options.onClose ?? vi.fn(),
    onClosePreferences: vi.fn(),
    onReorder: vi.fn(),
    onOpenGitDiff: options.onOpenGitDiff ?? vi.fn(),
    onToggleCollapsed: vi.fn(),
    onTogglePinned: options.onTogglePinned ?? vi.fn(),
  };

  act(() => {
    root.render(<OpenFilesList {...props} />);
  });
}

describe("OpenFilesList", () => {
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

  it("keeps only collapse as the header action", () => {
    renderOpenFilesList(root, {
      tabs: [tab("/workspace/docs/one.md"), tab("/workspace/docs/two.md")],
      activePath: "/workspace/docs/one.md",
    });

    expect(
      container.querySelector('[data-review-id="open-files-collapse"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-review-id="open-files-close-others"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-review-id="open-files-close-all"]'),
    ).toBeNull();
  });

  it("opens diff from a changed file badge without activating the tab", async () => {
    const onActivate = vi.fn();
    const onOpenGitDiff = vi.fn();

    renderOpenFilesList(root, {
      activePath: "/workspace/docs/other.md",
      gitStatusByPath: {
        "/workspace/docs/git-modified.md": "modified",
      },
      onActivate,
      onOpenGitDiff,
    });

    const diffButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="git-status-diff-button"]',
    );
    expect(diffButton?.textContent).toBe("M");
    expect(diffButton?.getAttribute("title")).toBe("Open diff");
    expect(diffButton?.getAttribute("aria-label")).toBe(
      "Open diff for git-modified.md",
    );

    await act(async () => {
      diffButton?.click();
    });

    expect(onOpenGitDiff).toHaveBeenCalledWith(
      "/workspace/docs/git-modified.md",
    );
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("keeps pinned row state and pin action behavior", async () => {
    const onTogglePinned = vi.fn();

    renderOpenFilesList(root, {
      activePath: "/workspace/docs/other.md",
      pinnedTabs: ["/workspace/docs/git-modified.md"],
      onTogglePinned,
    });

    const row = container.querySelector('[data-review-id="open-file-item"]');
    const pinButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="open-file-pin"]',
    );
    expect(row?.classList.contains("pinned")).toBe(true);
    expect(pinButton?.getAttribute("aria-label")).toBe("Unpin git-modified.md");

    await act(async () => {
      pinButton?.click();
    });

    expect(onTogglePinned).toHaveBeenCalledWith(
      "/workspace/docs/git-modified.md",
    );
  });

  it("keeps active row close action behavior", async () => {
    const onClose = vi.fn();

    renderOpenFilesList(root, {
      activePath: "/workspace/docs/git-modified.md",
      onClose,
    });

    const row = container.querySelector('[data-review-id="open-file-item"]');
    const closeButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="open-file-close"]',
    );
    expect(row?.classList.contains("active")).toBe(true);
    expect(closeButton?.getAttribute("aria-label")).toBe(
      "Close git-modified.md",
    );

    await act(async () => {
      closeButton?.click();
    });

    expect(onClose).toHaveBeenCalledWith("/workspace/docs/git-modified.md");
  });

  it("keeps middle click close behavior on the row", async () => {
    const onClose = vi.fn();

    renderOpenFilesList(root, { onClose });

    const row = container.querySelector<HTMLElement>(
      '[data-review-id="open-file-item"]',
    );
    await act(async () => {
      row?.dispatchEvent(
        new MouseEvent("auxclick", { bubbles: true, button: 1 }),
      );
    });

    expect(onClose).toHaveBeenCalledWith("/workspace/docs/git-modified.md");
  });

  it("does not render a diff button for files without a Git change", () => {
    renderOpenFilesList(root, {
      gitStatusByPath: {
        "/workspace/docs/git-modified.md": "clean",
      },
    });

    expect(
      container.querySelector('[data-review-id="git-status-diff-button"]'),
    ).toBeNull();
  });

  it("does not show a Reloaded badge after a successful inactive reload", () => {
    renderOpenFilesList(root, {
      reloadStateByPath: {
        "/workspace/docs/git-modified.md": {
          status: "reloaded",
          updatedAt: "2026-05-21T00:01:00.000Z",
        },
      },
    });

    const row = container.querySelector('[data-review-id="open-file-item"]');
    expect(row?.getAttribute("data-reload-status")).toBeNull();
    expect(
      container.querySelector('[data-review-id="open-file-reload-status"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("Reloaded");
  });

  it("keeps reload error visible", () => {
    renderOpenFilesList(root, {
      reloadStateByPath: {
        "/workspace/docs/git-modified.md": {
          status: "error",
          message: "mock reload failed",
          updatedAt: "2026-05-21T00:01:00.000Z",
        },
      },
    });

    const row = container.querySelector('[data-review-id="open-file-item"]');
    expect(row?.getAttribute("data-reload-status")).toBe("error");
    expect(
      container.querySelector('[data-review-id="open-file-reload-status"]')
        ?.textContent,
    ).toBe("Reload failed");
  });
});
