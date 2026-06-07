import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookmarkEntry } from "../../src/core/types";
import { BookmarksPanel } from "../../src/ui/components/SidebarLists";

describe("BookmarksPanel add controls", () => {
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

  async function renderPanel(options?: {
    bookmarks?: BookmarkEntry[];
    activePath?: string;
    rootDirectory?: string;
    onAddActive?: () => void;
    onAddRoot?: () => void;
    onRemove?: (path: string) => void;
  }) {
    await act(async () => {
      root.render(
        <BookmarksPanel
          bookmarks={options?.bookmarks ?? []}
          activePath={options?.activePath}
          rootDirectory={options?.rootDirectory ?? "/workspace"}
          gitStatusByPath={{}}
          onAddActive={options?.onAddActive ?? vi.fn()}
          onAddRoot={options?.onAddRoot ?? vi.fn()}
          onOpen={vi.fn()}
          onRemove={options?.onRemove ?? vi.fn()}
          onReorder={vi.fn()}
        />,
      );
    });
  }

  function actionButton(reviewId: string) {
    const button = container.querySelector<HTMLButtonElement>(
      `[data-review-id="${reviewId}"]`,
    );
    if (!button) {
      throw new Error(`Button not found: ${reviewId}`);
    }
    return button;
  }

  it("shows add controls and adds unbookmarked targets", async () => {
    const addActive = vi.fn();
    const addRoot = vi.fn();
    await renderPanel({
      activePath: "/workspace/docs/01-specification.md",
      rootDirectory: "/workspace",
      onAddActive: addActive,
      onAddRoot: addRoot,
    });

    expect(actionButton("bookmark-add-active").textContent).toContain(
      "Add file",
    );
    expect(actionButton("bookmark-add-active").textContent).toContain(
      "01-specification.md",
    );
    expect(actionButton("bookmark-add-root").textContent).toContain(
      "Add folder",
    );
    expect(actionButton("bookmark-add-root").textContent).toContain(
      "workspace",
    );

    await act(async () => actionButton("bookmark-add-active").click());
    await act(async () => actionButton("bookmark-add-root").click());

    expect(addActive).toHaveBeenCalledTimes(1);
    expect(addRoot).toHaveBeenCalledTimes(1);
  });

  it("shows compact target names for Windows paths", async () => {
    await renderPanel({
      activePath: "C:\\Users\\me\\project\\docs\\guide.md",
      rootDirectory: "C:\\Users\\me\\project",
    });

    expect(actionButton("bookmark-add-active").textContent).toContain(
      "guide.md",
    );
    expect(actionButton("bookmark-add-root").textContent).toContain("project");
  });

  it("does not remove bookmarked targets from add controls", async () => {
    const addActive = vi.fn();
    const addRoot = vi.fn();
    const remove = vi.fn();
    await renderPanel({
      bookmarks: [
        {
          path: "/workspace/docs/01-specification.md",
          kind: "file",
          name: "01-specification.md",
        },
        { path: "/workspace", kind: "directory", name: "workspace" },
      ],
      activePath: "/workspace/docs/01-specification.md",
      rootDirectory: "/workspace",
      onAddActive: addActive,
      onAddRoot: addRoot,
      onRemove: remove,
    });

    expect(actionButton("bookmark-add-active").disabled).toBe(true);
    expect(actionButton("bookmark-add-root").disabled).toBe(true);
    expect(actionButton("bookmark-add-active").textContent).toContain(
      "Added file",
    );
    expect(actionButton("bookmark-add-root").textContent).toContain(
      "Added folder",
    );

    await act(async () => actionButton("bookmark-add-active").click());
    await act(async () => actionButton("bookmark-add-root").click());

    expect(addActive).not.toHaveBeenCalled();
    expect(addRoot).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("groups folder and file bookmarks by section", async () => {
    await renderPanel({
      bookmarks: [
        {
          path: "/workspace/docs/01-specification.md",
          kind: "file",
          name: "01-specification.md",
        },
        { path: "/workspace", kind: "directory", name: "workspace" },
      ],
      activePath: "/workspace/docs/01-specification.md",
      rootDirectory: "/workspace",
    });

    expect(container.textContent).toContain("Folders");
    expect(container.textContent).toContain("Files");
    const sections = Array.from(
      container.querySelectorAll<HTMLElement>(".bookmark-section"),
    );

    expect(sections[0]?.textContent).toContain("Folders");
    expect(sections[0]?.textContent).toContain("workspace");
    expect(sections[1]?.textContent).toContain("Files");
    expect(sections[1]?.textContent).toContain("01-specification.md");
  });

  it("keeps remove controls in the DOM for hover and focus disclosure", async () => {
    const remove = vi.fn();
    await renderPanel({
      bookmarks: [
        {
          path: "/workspace/docs/01-specification.md",
          kind: "file",
          name: "01-specification.md",
        },
      ],
      activePath: "/workspace/docs/01-specification.md",
      rootDirectory: "/workspace",
      onRemove: remove,
    });

    const row = container.querySelector('[data-review-id="bookmark-item"]');
    const removeButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="bookmark-remove"]',
    );
    expect(row).not.toBeNull();
    expect(removeButton?.getAttribute("aria-label")).toBe(
      "Remove 01-specification.md",
    );

    await act(async () => {
      removeButton?.click();
    });

    expect(remove).toHaveBeenCalledWith("/workspace/docs/01-specification.md");
  });

  it("disables add controls when there is no current target", async () => {
    await renderPanel({ activePath: undefined, rootDirectory: "" });

    expect(actionButton("bookmark-add-active").disabled).toBe(true);
    expect(actionButton("bookmark-add-active").textContent).toContain(
      "Add file",
    );
    expect(actionButton("bookmark-add-root").disabled).toBe(true);
    expect(actionButton("bookmark-add-root").textContent).toContain(
      "Add folder",
    );
  });
});
