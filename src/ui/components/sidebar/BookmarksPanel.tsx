import { Bookmark, Check, FileText, FolderOpen, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { bookmarkName } from "../../../core/bookmarks";
import { isSupportedDocumentPath } from "../../../core/documentFormat";
import { hasMovedBeyondThreshold } from "../../../core/reorderDrag";
import type { BookmarkEntry, GitDiffStatus } from "../../../core/types";
import {
  activateCodexContextPointerCapture,
  prepareFileCompareDragData,
  prepareCodexContextPointerCapture,
  scheduleClearFileCompareDragData,
  writeFileCompareDragData,
} from "../../lib/fileCompareDrag";
import { gitStatusDisplay } from "../../lib/gitStatusDisplay";
import { fileName } from "../../lib/path";
import type { ReorderDragState } from "./shared";

type BookmarkDragState = ReorderDragState & {
  kind: BookmarkEntry["kind"];
};

function findBookmarkReorderIndex(
  listElement: HTMLElement | null,
  clientX: number,
  clientY: number,
  kind: BookmarkEntry["kind"],
): number | null {
  if (!listElement) {
    return null;
  }

  const element = document.elementFromPoint(clientX, clientY);
  const row =
    element instanceof HTMLElement
      ? element.closest<HTMLElement>('[data-review-id="bookmark-item"]')
      : null;
  if (!row || !listElement.contains(row) || row.dataset.entryKind !== kind) {
    return null;
  }

  const index = Number(row.dataset.bookmarkIndex);
  return Number.isInteger(index) ? index : null;
}

export function BookmarksPanel({
  bookmarks,
  activePath,
  rootDirectory,
  onAddActive,
  onAddRoot,
  onOpen,
  onRemove,
  onReorder,
  gitStatusByPath,
}: {
  bookmarks: BookmarkEntry[];
  activePath?: string;
  rootDirectory: string;
  gitStatusByPath: Record<string, GitDiffStatus>;
  onAddActive: () => void;
  onAddRoot: () => void;
  onOpen: (bookmark: BookmarkEntry) => void;
  onRemove: (path: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<BookmarkDragState | null>(null);
  const suppressNextClickRef = useRef(false);

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    bookmark: BookmarkEntry,
    index: number,
  ) {
    if (event.button !== 0 || bookmarks.length <= 1) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      fromIndex: index,
      overIndex: index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      status: "pending",
      kind: bookmark.kind,
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const isDragging =
      dragState.status === "dragging" ||
      hasMovedBeyondThreshold({
        startX: dragState.startX,
        startY: dragState.startY,
        currentX: event.clientX,
        currentY: event.clientY,
      });
    const overIndex = findBookmarkReorderIndex(
      listRef.current,
      event.clientX,
      event.clientY,
      dragState.kind,
    );
    if (
      isDragging &&
      overIndex !== null &&
      (overIndex !== dragState.overIndex || dragState.status !== "dragging")
    ) {
      setDragState({ ...dragState, overIndex, status: "dragging" });
    }
  }

  function finishPointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    if (dragState.status === "dragging") {
      event.preventDefault();
      suppressNextClickRef.current = true;
      onReorder(dragState.fromIndex, dragState.overIndex);
    }
    setDragState(null);
  }

  function handleOpenClick(bookmark: BookmarkEntry) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onOpen(bookmark);
  }

  const activeFileName = activePath
    ? fileName(activePath) || activePath
    : "No active file";
  const rootFolderName = rootDirectory
    ? fileName(rootDirectory) || rootDirectory
    : "No folder";
  const activeBookmarked = Boolean(
    activePath && bookmarks.some((bookmark) => bookmark.path === activePath),
  );
  const rootBookmarked = Boolean(
    rootDirectory &&
    bookmarks.some((bookmark) => bookmark.path === rootDirectory),
  );
  const folderBookmarks = bookmarks
    .map((bookmark, index) => ({ bookmark, index }))
    .filter((item) => item.bookmark.kind === "directory");
  const fileBookmarks = bookmarks
    .map((bookmark, index) => ({ bookmark, index }))
    .filter((item) => item.bookmark.kind === "file");

  function renderBookmarkRow(bookmark: BookmarkEntry, index: number) {
    const gitStatus =
      bookmark.kind === "file"
        ? gitStatusDisplay(gitStatusByPath[bookmark.path])
        : null;
    return (
      <div
        key={bookmark.path}
        className={`bookmark-row ${
          dragState?.fromIndex === index && dragState.status === "dragging"
            ? "dragging"
            : ""
        } ${
          dragState?.overIndex === index && dragState.fromIndex !== index
            ? "drop-before"
            : ""
        } ${gitStatus?.className ?? ""}`}
        data-review-id="bookmark-item"
        data-context-menu-kind="bookmark"
        data-path={bookmark.path}
        data-entry-kind={bookmark.kind}
        data-bookmark-index={index}
        data-git-status={gitStatus ? gitStatusByPath[bookmark.path] : undefined}
        draggable={
          bookmark.kind === "file" && isSupportedDocumentPath(bookmark.path)
        }
        onPointerDown={(event) => {
          if (
            bookmark.kind === "file" &&
            isSupportedDocumentPath(bookmark.path)
          ) {
            prepareFileCompareDragData(bookmark.path);
            prepareCodexContextPointerCapture(
              event.currentTarget,
              event.pointerId,
            );
          }
        }}
        onDragStart={(event) => {
          if (
            bookmark.kind === "file" &&
            isSupportedDocumentPath(bookmark.path)
          ) {
            if (
              activateCodexContextPointerCapture({
                clientX: event.clientX,
                clientY: event.clientY,
              })
            ) {
              event.preventDefault();
              return;
            }
            writeFileCompareDragData(event.dataTransfer, bookmark.path);
          }
        }}
        onDragEnd={() => scheduleClearFileCompareDragData()}
      >
        <button
          type="button"
          className="bookmark-open"
          data-review-id="bookmark-open"
          title={
            gitStatus ? `${bookmark.path} · ${gitStatus.label}` : bookmark.path
          }
          aria-label={
            gitStatus
              ? `${bookmarkName(bookmark)}, ${gitStatus.label}`
              : bookmarkName(bookmark)
          }
          onPointerDown={(event) => handlePointerDown(event, bookmark, index)}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={() => setDragState(null)}
          onClick={() => handleOpenClick(bookmark)}
        >
          {bookmark.kind === "directory" ? (
            <FolderOpen size={15} />
          ) : (
            <FileText size={15} />
          )}
          <span>{bookmarkName(bookmark)}</span>
          {gitStatus ? (
            <span
              className="git-status-badge"
              data-review-id="git-status-badge"
              aria-hidden="true"
            >
              {gitStatus.shortLabel}
            </span>
          ) : null}
        </button>
        <div className="bookmark-controls">
          <button
            type="button"
            className="open-file-close bookmark-remove"
            data-review-id="bookmark-remove"
            aria-label={`Remove ${bookmarkName(bookmark)}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(bookmark.path);
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  function renderSection(
    title: string,
    items: Array<{ bookmark: BookmarkEntry; index: number }>,
  ) {
    if (items.length === 0) {
      return null;
    }
    return (
      <section className="bookmark-section" data-review-id="bookmark-section">
        <h3 className="bookmark-section-title">{title}</h3>
        <div className="bookmark-section-list">
          {items.map(({ bookmark, index }) =>
            renderBookmarkRow(bookmark, index),
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="bookmarks-panel" data-review-id="bookmarks-panel">
      <div className="bookmark-actions">
        <button
          type="button"
          className={`bookmark-action-button ${activeBookmarked ? "added" : ""}`}
          data-review-id="bookmark-add-active"
          disabled={!activePath || activeBookmarked}
          aria-label={
            activePath
              ? activeBookmarked
                ? `File bookmark already added: ${activePath}`
                : `Bookmark file: ${activePath}`
              : "Bookmark file: no active file"
          }
          title={
            activePath
              ? activeBookmarked
                ? `File bookmark already added: ${activePath}`
                : `Bookmark file: ${activePath}`
              : "No active file"
          }
          onClick={() => {
            if (!activePath || activeBookmarked) {
              return;
            }
            onAddActive();
          }}
        >
          {activeBookmarked ? <Check size={14} /> : <Plus size={14} />}
          <span>{activeBookmarked ? "Added file" : "Add file"}</span>
          <small>{activeFileName}</small>
        </button>
        <button
          type="button"
          className={`bookmark-action-button ${rootBookmarked ? "added" : ""}`}
          data-review-id="bookmark-add-root"
          disabled={!rootDirectory || rootBookmarked}
          aria-label={
            rootDirectory
              ? rootBookmarked
                ? `Folder bookmark already added: ${rootDirectory}`
                : `Bookmark folder: ${rootDirectory}`
              : "Bookmark folder: no folder"
          }
          title={
            rootDirectory
              ? rootBookmarked
                ? `Folder bookmark already added: ${rootDirectory}`
                : `Bookmark folder: ${rootDirectory}`
              : "No folder"
          }
          onClick={() => {
            if (!rootDirectory || rootBookmarked) {
              return;
            }
            onAddRoot();
          }}
        >
          {rootBookmarked ? <Check size={14} /> : <Bookmark size={14} />}
          <span>{rootBookmarked ? "Added folder" : "Add folder"}</span>
          <small>{rootFolderName}</small>
        </button>
      </div>
      <div className="bookmark-list" ref={listRef}>
        {bookmarks.length > 0 ? (
          <>
            {renderSection("Folders", folderBookmarks)}
            {renderSection("Files", fileBookmarks)}
          </>
        ) : (
          <div className="bookmark-empty">No bookmarks</div>
        )}
      </div>
    </section>
  );
}
