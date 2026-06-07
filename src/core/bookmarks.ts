import type { BookmarkEntry } from "./types";
import { pathBasename } from "./pathDisplay";
import { reorderByIndex } from "./reorder";

export function bookmarkName(entry: BookmarkEntry): string {
  return entry.name ?? pathBasename(entry.path);
}

export function addBookmark(
  bookmarks: BookmarkEntry[],
  entry: BookmarkEntry,
): { bookmarks: BookmarkEntry[]; added: boolean } {
  if (bookmarks.some((bookmark) => bookmark.path === entry.path)) {
    return { bookmarks, added: false };
  }
  return { bookmarks: [...bookmarks, entry], added: true };
}

export function removeBookmark(
  bookmarks: BookmarkEntry[],
  path: string,
): BookmarkEntry[] {
  return bookmarks.filter((bookmark) => bookmark.path !== path);
}

export function reorderBookmark(
  bookmarks: BookmarkEntry[],
  fromIndex: number,
  toIndex: number,
): BookmarkEntry[] {
  return reorderByIndex(bookmarks, fromIndex, toIndex);
}

export function toggleBookmark(
  bookmarks: BookmarkEntry[],
  entry: BookmarkEntry,
): { bookmarks: BookmarkEntry[]; bookmarked: boolean } {
  if (bookmarks.some((bookmark) => bookmark.path === entry.path)) {
    return {
      bookmarks: removeBookmark(bookmarks, entry.path),
      bookmarked: false,
    };
  }
  return { bookmarks: [...bookmarks, entry], bookmarked: true };
}
