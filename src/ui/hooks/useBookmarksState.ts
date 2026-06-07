import {
  addBookmark,
  bookmarkName,
  removeBookmark,
  reorderBookmark,
  toggleBookmark,
} from "../../core/bookmarks";
import type {
  AppConfig,
  BookmarkEntry,
  DocumentPayload,
} from "../../core/types";
import { fileName } from "../lib/path";

interface UseBookmarksStateOptions {
  config: AppConfig | null;
  documentPayload: DocumentPayload | null;
  openDirectory: (path: string) => Promise<void>;
  openDocument: (
    path: string,
    options?: { recordNavigation?: boolean },
  ) => Promise<void>;
  persistWorkspace: (
    workspace: Partial<AppConfig["workspace"]>,
  ) => Promise<void>;
  rootDirectory: string;
  setSidebarTab: (tab: AppConfig["workspace"]["sidebarTab"]) => Promise<void>;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}

export function useBookmarksState({
  config,
  documentPayload,
  openDirectory,
  openDocument,
  persistWorkspace,
  rootDirectory,
  setSidebarTab,
  showInlineNotice,
}: UseBookmarksStateOptions) {
  async function addBookmarkEntry(entry: BookmarkEntry) {
    const currentBookmarks = config?.workspace.bookmarks ?? [];
    const result = addBookmark(currentBookmarks, entry);
    if (!result.added) {
      showInlineNotice(`${bookmarkName(entry)} is already bookmarked`, {
        tone: "warning",
      });
      return;
    }
    await persistWorkspace({ bookmarks: result.bookmarks });
    showInlineNotice(`${bookmarkName(entry)} bookmarked`, { tone: "success" });
  }

  async function addActiveBookmark() {
    if (!documentPayload) {
      showInlineNotice("No active document to bookmark", { tone: "warning" });
      return;
    }
    await addBookmarkEntry({
      path: documentPayload.path,
      kind: "file",
      name: fileName(documentPayload.path),
    });
  }

  async function addRootBookmark() {
    await addBookmarkEntry({
      path: rootDirectory,
      kind: "directory",
      name: fileName(rootDirectory) || rootDirectory,
    });
  }

  async function removeBookmarkEntry(path: string) {
    const nextBookmarks = removeBookmark(
      config?.workspace.bookmarks ?? [],
      path,
    );
    await persistWorkspace({ bookmarks: nextBookmarks });
    showInlineNotice(`${fileName(path) || path} removed from bookmarks`, {
      tone: "success",
    });
  }

  async function moveBookmark(fromIndex: number, toIndex: number) {
    const nextBookmarks = reorderBookmark(
      config?.workspace.bookmarks ?? [],
      fromIndex,
      toIndex,
    );
    await persistWorkspace({ bookmarks: nextBookmarks });
  }

  async function openBookmark(entry: BookmarkEntry) {
    try {
      if (entry.kind === "directory") {
        await openDirectory(entry.path);
        await setSidebarTab("files");
        showInlineNotice(`Opened ${bookmarkName(entry)}`, { tone: "success" });
        return;
      }

      await openDocument(entry.path);
    } catch (bookmarkError) {
      showInlineNotice(
        bookmarkError instanceof Error
          ? `Bookmark open failed: ${bookmarkError.message}`
          : "Bookmark open failed",
        { tone: "error" },
      );
    }
  }

  async function toggleActiveBookmark() {
    if (!documentPayload) {
      return;
    }
    const entry: BookmarkEntry = {
      path: documentPayload.path,
      kind: "file",
      name: fileName(documentPayload.path),
    };
    const result = toggleBookmark(config?.workspace.bookmarks ?? [], entry);
    await persistWorkspace({ bookmarks: result.bookmarks });
    showInlineNotice(
      result.bookmarked
        ? `${bookmarkName(entry)} bookmarked`
        : `${bookmarkName(entry)} removed from bookmarks`,
      { tone: "success" },
    );
  }

  return {
    addActiveBookmark,
    addBookmarkEntry,
    addRootBookmark,
    moveBookmark,
    openBookmark,
    removeBookmarkEntry,
    toggleActiveBookmark,
  };
}
