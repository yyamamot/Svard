import {
  ChevronDown,
  ChevronRight,
  ChevronsUp,
  FileText,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fileName } from "../lib/path";
import {
  directoryGitStatusBadgeLabel,
  fileGitStatusBadgeLabel,
} from "../lib/gitStatusBadgeLabels";
import { gitStatusDisplay } from "../lib/gitStatusDisplay";
import {
  buildGitDirectoryStatusSummary,
  mergeGitStatusWithChanges,
} from "../lib/gitDirectoryStatusSummary";
import {
  prepareFileCompareDragData,
  scheduleClearFileCompareDragData,
  writeFileCompareDragData,
} from "../lib/fileCompareDrag";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  DirectoryEntry,
  GitChanges,
  GitDiffStatus,
} from "../../core/types";

interface FileTreePanelProps {
  rootDirectory: string;
  rootEntries: DirectoryEntry[];
  childrenByDirectory: Record<string, DirectoryEntry[]>;
  expandedDirectories: Set<string>;
  loadingDirectories: Set<string>;
  directoryErrors: Record<string, string>;
  activePath?: string;
  gitStatusByPath: Record<string, GitDiffStatus>;
  gitChanges: GitChanges | null;
  onOpenFile: (path: string) => void;
  onOpenGitDiff: (path: string) => void;
  onToggleDirectory: (path: string) => void;
  onPickDocument: () => void;
  onPickDirectory: () => void;
  onRefresh: () => void;
  onCollapse: () => void;
}

export function FileTreePanel({
  rootDirectory,
  rootEntries,
  childrenByDirectory,
  expandedDirectories,
  loadingDirectories,
  directoryErrors,
  activePath,
  gitStatusByPath,
  gitChanges,
  onOpenFile,
  onOpenGitDiff,
  onToggleDirectory,
  onPickDocument,
  onPickDirectory,
  onRefresh,
  onCollapse,
}: FileTreePanelProps) {
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const openMenuRef = useRef<HTMLDivElement | null>(null);
  const fileTreeGitStatusByPath = useMemo(
    () => mergeGitStatusWithChanges(gitStatusByPath, gitChanges),
    [gitChanges, gitStatusByPath],
  );
  const directoryGitStatusByPath = useMemo(
    () => buildGitDirectoryStatusSummary(fileTreeGitStatusByPath),
    [fileTreeGitStatusByPath],
  );

  useEffect(() => {
    if (!openMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!openMenuRef.current?.contains(event.target as Node | null)) {
        setOpenMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [openMenuOpen]);

  function pickFromOpenMenu(callback: () => void) {
    callback();
    setOpenMenuOpen(false);
  }

  function renderTreeEntries(parentPath: string, depth: number): ReactNode {
    const entries = childrenByDirectory[parentPath] ?? [];

    return entries.map((entry) => {
      const isDirectory = entry.kind === "directory";
      const isExpanded = expandedDirectories.has(entry.path);
      const isActive = activePath === entry.path;
      const children = childrenByDirectory[entry.path] ?? [];
      const isLoading = loadingDirectories.has(entry.path);
      const directoryError = directoryErrors[entry.path];
      const directoryGitStatus = isDirectory
        ? directoryGitStatusByPath[entry.path]
        : null;
      const fileGitStatus = !isDirectory
        ? gitStatusDisplay(fileTreeGitStatusByPath[entry.path])
        : null;
      const gitStatus = isDirectory ? directoryGitStatus : fileGitStatus;
      const gitStatusBadgeText = directoryGitStatus
        ? String(directoryGitStatus.count)
        : fileGitStatus?.shortLabel;
      const gitStatusBadgeLabel = directoryGitStatus
        ? directoryGitStatusBadgeLabel(directoryGitStatus, entry.name)
        : fileGitStatus
          ? fileGitStatusBadgeLabel(fileGitStatus, entry.name)
          : undefined;
      const canDragCompare =
        !isDirectory && isSupportedDocumentPath(entry.path);
      const openLabel = isDirectory
        ? `${entry.name}, ${isExpanded ? "expanded" : "collapsed"}`
        : entry.name;

      return (
        <div key={entry.path} className="tree-node" data-review-id="tree-node">
          <div
            className={`tree-row ${isDirectory ? "folder" : "file"} ${isActive ? "active" : ""} ${gitStatus?.className ?? ""}`}
            data-review-id={isDirectory ? "tree-folder-toggle" : "tree-file"}
            data-context-menu-kind="file-tree"
            data-path={entry.path}
            data-entry-kind={entry.kind}
            data-git-status={
              !isDirectory && gitStatus
                ? fileTreeGitStatusByPath[entry.path]
                : undefined
            }
            data-git-status-summary={
              directoryGitStatus ? directoryGitStatus.status : undefined
            }
            data-git-status-count={
              directoryGitStatus ? directoryGitStatus.count : undefined
            }
            data-git-status-modified-count={
              directoryGitStatus ? directoryGitStatus.modifiedCount : undefined
            }
            data-git-status-added-count={
              directoryGitStatus ? directoryGitStatus.addedCount : undefined
            }
            data-git-status-deleted-count={
              directoryGitStatus ? directoryGitStatus.deletedCount : undefined
            }
            data-git-status-untracked-count={
              directoryGitStatus ? directoryGitStatus.untrackedCount : undefined
            }
            data-git-status-label={gitStatusBadgeLabel}
            title={gitStatus ? `${entry.path} · ${gitStatus.label}` : undefined}
            aria-label={
              gitStatus ? `${entry.name}, ${gitStatus.label}` : undefined
            }
            draggable={canDragCompare}
            onPointerDown={() => {
              if (canDragCompare) {
                prepareFileCompareDragData(entry.path);
              }
            }}
            onDragStart={(event) => {
              if (canDragCompare) {
                writeFileCompareDragData(event.dataTransfer, entry.path);
              }
            }}
            onDragEnd={() => scheduleClearFileCompareDragData()}
          >
            <button
              type="button"
              className="tree-row-main"
              style={{ paddingLeft: `${8 + depth * 14}px` }}
              aria-label={openLabel}
              aria-expanded={isDirectory ? isExpanded : undefined}
              draggable={canDragCompare}
              onPointerDown={() => {
                if (canDragCompare) {
                  prepareFileCompareDragData(entry.path);
                }
              }}
              onDragStart={(event) => {
                if (canDragCompare) {
                  writeFileCompareDragData(event.dataTransfer, entry.path);
                }
              }}
              onDragEnd={() => scheduleClearFileCompareDragData()}
              onClick={() =>
                isDirectory
                  ? onToggleDirectory(entry.path)
                  : onOpenFile(entry.path)
              }
            >
              {isDirectory ? (
                isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )
              ) : (
                <span className="tree-spacer" />
              )}
              {isDirectory ? <FolderOpen size={15} /> : <FileText size={15} />}
              <span className="tree-label">{entry.name}</span>
            </button>
            {fileGitStatus ? (
              <button
                type="button"
                className={`git-status-badge git-status-diff-button ${fileGitStatus.className}`}
                data-review-id="git-status-diff-button"
                data-git-status-label={gitStatusBadgeLabel}
                aria-label={gitStatusBadgeLabel}
                title={gitStatusBadgeLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenGitDiff(entry.path);
                }}
              >
                {gitStatusBadgeText}
              </button>
            ) : directoryGitStatus ? (
              <span
                className="git-status-badge"
                data-review-id="git-status-badge"
                data-git-status-label={gitStatusBadgeLabel}
                aria-label={gitStatusBadgeLabel}
                title={gitStatusBadgeLabel}
              >
                {gitStatusBadgeText}
              </span>
            ) : null}
          </div>
          {isDirectory && isLoading && (
            <div
              className="tree-state"
              style={{ paddingLeft: `${30 + depth * 14}px` }}
            >
              Loading
            </div>
          )}
          {isDirectory && directoryError && (
            <div
              className="tree-state error"
              style={{ paddingLeft: `${30 + depth * 14}px` }}
            >
              {directoryError}
            </div>
          )}
          {isDirectory && isExpanded && children.length > 0
            ? renderTreeEntries(entry.path, depth + 1)
            : null}
        </div>
      );
    });
  }

  return (
    <>
      <div className="file-toolbar" data-review-id="file-toolbar">
        <div
          className="tree-root"
          data-review-id="tree-root"
          title={rootDirectory}
        >
          <FolderOpen size={15} />
          <span>
            {rootDirectory
              ? fileName(rootDirectory) || rootDirectory
              : "No folder"}
          </span>
        </div>
        <div className="file-toolbar-actions" aria-label="File tree actions">
          <div className="file-tree-open-menu-wrap" ref={openMenuRef}>
            <button
              type="button"
              className="icon-button file-tree-open-menu-trigger"
              data-review-id="file-tree-open-menu-trigger"
              aria-label="Open file or folder"
              title="Open file or folder"
              aria-haspopup="menu"
              aria-expanded={openMenuOpen}
              onClick={() => setOpenMenuOpen((value) => !value)}
            >
              <FileText size={15} />
            </button>
            {openMenuOpen && (
              <div
                className="file-tree-open-menu"
                data-review-id="file-tree-open-menu"
                role="menu"
                aria-label="Open file or folder"
              >
                <button
                  type="button"
                  className="file-tree-open-menu-item"
                  data-review-id="file-open-control"
                  role="menuitem"
                  onClick={() => pickFromOpenMenu(onPickDocument)}
                >
                  <FileText size={15} />
                  <span>Open File...</span>
                </button>
                <button
                  type="button"
                  className="file-tree-open-menu-item"
                  data-review-id="directory-open-control"
                  role="menuitem"
                  onClick={() => pickFromOpenMenu(onPickDirectory)}
                >
                  <FolderOpen size={15} />
                  <span>Open Folder...</span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            data-review-id="tree-refresh"
            aria-label="Refresh file tree"
            title="Refresh file tree"
            onClick={onRefresh}
          >
            <RefreshCw size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            data-review-id="tree-collapse-all"
            aria-label="Collapse all folders"
            title="Collapse all folders"
            onClick={onCollapse}
          >
            <ChevronsUp size={15} />
          </button>
        </div>
      </div>
      <div className="file-tree" data-review-id="file-tree">
        {rootEntries.length > 0 ? (
          renderTreeEntries(rootDirectory, 0)
        ) : (
          <button
            type="button"
            className="tree-row"
            data-review-id="tree-empty"
            onClick={onRefresh}
          >
            No markup files
          </button>
        )}
      </div>
    </>
  );
}
