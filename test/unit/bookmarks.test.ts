import { describe, expect, it } from "vitest";

import {
  addBookmark,
  bookmarkName,
  removeBookmark,
  reorderBookmark,
  toggleBookmark,
} from "../../src/core/bookmarks";
import type { BookmarkEntry } from "../../src/core/types";

const fileBookmark: BookmarkEntry = {
  path: "/workspace/docs/mvp-guide.adoc",
  kind: "file",
  name: "MVP Guide",
};

const directoryBookmark: BookmarkEntry = {
  path: "/workspace/docs",
  kind: "directory",
  name: "docs",
};

describe("bookmarks", () => {
  it("adds bookmarks and keeps paths unique", () => {
    const added = addBookmark([], fileBookmark);
    const duplicate = addBookmark(added.bookmarks, fileBookmark);

    expect(added.added).toBe(true);
    expect(added.bookmarks).toEqual([fileBookmark]);
    expect(duplicate.added).toBe(false);
    expect(duplicate.bookmarks).toEqual([fileBookmark]);
  });

  it("removes and reorders bookmarks", () => {
    const bookmarks = [fileBookmark, directoryBookmark];

    expect(removeBookmark(bookmarks, fileBookmark.path)).toEqual([
      directoryBookmark,
    ]);
    expect(reorderBookmark(bookmarks, 0, 1)).toEqual([
      directoryBookmark,
      fileBookmark,
    ]);
  });

  it("toggles the active bookmark", () => {
    const added = toggleBookmark([], fileBookmark);
    const removed = toggleBookmark(added.bookmarks, fileBookmark);

    expect(added.bookmarked).toBe(true);
    expect(added.bookmarks).toEqual([fileBookmark]);
    expect(removed.bookmarked).toBe(false);
    expect(removed.bookmarks).toEqual([]);
  });

  it("uses Windows path basenames for unnamed bookmarks", () => {
    expect(
      bookmarkName({
        path: "C:\\Users\\me\\project",
        kind: "directory",
      }),
    ).toBe("project");
  });
});
