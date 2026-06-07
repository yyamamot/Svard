import { FileText, FolderOpen } from "lucide-react";
import { bookmarkName } from "../../core/bookmarks";
import type { AppConfig, BookmarkEntry } from "../../core/types";
import { fileName } from "../lib/path";

export function StartPage({
  recentDocuments,
  recentDirectories,
  bookmarks,
  onOpenDocument,
  onOpenDirectory,
  onPickDocument,
  onPickDirectory,
  onClearRecentDocuments,
  onClearRecentDirectories,
}: {
  recentDocuments: AppConfig["workspace"]["recentDocuments"];
  recentDirectories: AppConfig["workspace"]["recentDirectories"];
  bookmarks: BookmarkEntry[];
  onOpenDocument: (path: string) => void;
  onOpenDirectory: (path: string) => void;
  onPickDocument: () => void;
  onPickDirectory: () => void;
  onClearRecentDocuments: () => void;
  onClearRecentDirectories: () => void;
}) {
  return (
    <div className="start-page" data-review-id="start-page">
      <div className="start-page-header">
        <div>
          <h1>Svard</h1>
          <p>Open a local document or folder to start reading.</p>
        </div>
      </div>
      <div className="start-page-actions">
        <button type="button" className="button" onClick={onPickDocument}>
          <FileText size={15} />
          Open File
        </button>
        <button
          type="button"
          className="button subtle"
          onClick={onPickDirectory}
        >
          <FolderOpen size={15} />
          Open Folder
        </button>
      </div>
      <div className="start-page-grid">
        <section>
          <div className="start-page-section-header">
            <h2>Recent Documents</h2>
            {recentDocuments.length > 0 && (
              <button
                type="button"
                className="start-page-clear"
                onClick={onClearRecentDocuments}
              >
                Clear
              </button>
            )}
          </div>
          {recentDocuments.length > 0 ? (
            recentDocuments.slice(0, 8).map((entry) => (
              <button
                type="button"
                key={entry.path}
                className="start-page-item"
                title={entry.path}
                onClick={() => onOpenDocument(entry.path)}
              >
                <FileText size={14} />
                <span>{entry.name ?? fileName(entry.path)}</span>
              </button>
            ))
          ) : (
            <p className="start-page-empty">No recent documents</p>
          )}
        </section>
        <section>
          <div className="start-page-section-header">
            <h2>Recent Folders</h2>
            {recentDirectories.length > 0 && (
              <button
                type="button"
                className="start-page-clear"
                onClick={onClearRecentDirectories}
              >
                Clear
              </button>
            )}
          </div>
          {recentDirectories.length > 0 ? (
            recentDirectories.slice(0, 8).map((entry) => (
              <button
                type="button"
                key={entry.path}
                className="start-page-item"
                title={entry.path}
                onClick={() => onOpenDirectory(entry.path)}
              >
                <FolderOpen size={14} />
                <span>{entry.name ?? fileName(entry.path)}</span>
              </button>
            ))
          ) : (
            <p className="start-page-empty">No recent folders</p>
          )}
        </section>
        <section>
          <h2>Bookmarks</h2>
          {bookmarks.length > 0 ? (
            bookmarks.slice(0, 8).map((bookmark) => (
              <button
                type="button"
                key={bookmark.path}
                className="start-page-item"
                title={bookmark.path}
                onClick={() =>
                  bookmark.kind === "directory"
                    ? onOpenDirectory(bookmark.path)
                    : onOpenDocument(bookmark.path)
                }
              >
                {bookmark.kind === "directory" ? (
                  <FolderOpen size={14} />
                ) : (
                  <FileText size={14} />
                )}
                <span>{bookmarkName(bookmark)}</span>
              </button>
            ))
          ) : (
            <p className="start-page-empty">No bookmarks</p>
          )}
        </section>
      </div>
    </div>
  );
}
