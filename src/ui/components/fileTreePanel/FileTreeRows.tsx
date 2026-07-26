import { ChevronDown, ChevronRight, FileText, FolderOpen } from "lucide-react";
import type { DirectoryEntry, GitDiffStatus } from "../../../core/types";
import { isSupportedCodexContextPath } from "../../../core/codexContextPath";
import {
  activateCodexContextPointerCapture,
  prepareFileCompareDragData,
  prepareCodexContextPointerCapture,
  scheduleClearFileCompareDragData,
  writeFileCompareDragData,
} from "../../lib/fileCompareDrag";
import {
  directoryGitStatusBadgeLabel,
  fileGitStatusBadgeLabel,
} from "../../lib/gitStatusBadgeLabels";
import type { GitDirectoryStatusSummary } from "../../lib/gitDirectoryStatusSummary";
import { gitStatusDisplay } from "../../lib/gitStatusDisplay";

interface FileTreeRowsProps {
  rootDirectory: string;
  childrenByDirectory: Record<string, DirectoryEntry[]>;
  expandedDirectories: Set<string>;
  loadingDirectories: Set<string>;
  directoryErrors: Record<string, string>;
  activePath?: string;
  directoryGitStatusByPath: Record<string, GitDirectoryStatusSummary>;
  fileTreeGitStatusByPath: Record<string, GitDiffStatus>;
  openDocumentPaths: ReadonlySet<string>;
  onOpenFile: (path: string) => void;
  onOpenGitDiff: (path: string) => void;
  onToggleDirectory: (path: string) => void;
}

type RenderEntriesProps = Omit<FileTreeRowsProps, "rootDirectory"> & {
  parentPath: string;
  depth: number;
};

export function FileTreeRows({
  rootDirectory,
  childrenByDirectory,
  expandedDirectories,
  loadingDirectories,
  directoryErrors,
  activePath,
  directoryGitStatusByPath,
  fileTreeGitStatusByPath,
  openDocumentPaths,
  onOpenFile,
  onOpenGitDiff,
  onToggleDirectory,
}: FileTreeRowsProps) {
  return (
    <>
      {renderEntries({
        parentPath: rootDirectory,
        depth: 0,
        childrenByDirectory,
        expandedDirectories,
        loadingDirectories,
        directoryErrors,
        activePath,
        directoryGitStatusByPath,
        fileTreeGitStatusByPath,
        openDocumentPaths,
        onOpenFile,
        onOpenGitDiff,
        onToggleDirectory,
      })}
    </>
  );
}

function renderEntries({
  parentPath,
  depth,
  childrenByDirectory,
  expandedDirectories,
  loadingDirectories,
  directoryErrors,
  activePath,
  directoryGitStatusByPath,
  fileTreeGitStatusByPath,
  openDocumentPaths,
  onOpenFile,
  onOpenGitDiff,
  onToggleDirectory,
}: RenderEntriesProps) {
  const entries = childrenByDirectory[parentPath] ?? [];

  return entries.map((entry) => {
    const isDirectory = entry.kind === "directory";
    const isExpanded = expandedDirectories.has(entry.path);
    const children = childrenByDirectory[entry.path] ?? [];
    return (
      <FileTreeRow
        key={entry.path}
        entry={entry}
        depth={depth}
        isExpanded={isExpanded}
        isActive={activePath === entry.path}
        isLoading={loadingDirectories.has(entry.path)}
        directoryError={directoryErrors[entry.path]}
        directoryGitStatus={
          isDirectory ? directoryGitStatusByPath[entry.path] : undefined
        }
        fileGitStatus={
          !isDirectory
            ? gitStatusDisplay(fileTreeGitStatusByPath[entry.path])
            : null
        }
        rawFileGitStatus={fileTreeGitStatusByPath[entry.path]}
        isOpenDocument={!isDirectory && openDocumentPaths.has(entry.path)}
        onOpenFile={onOpenFile}
        onOpenGitDiff={onOpenGitDiff}
        onToggleDirectory={onToggleDirectory}
      >
        {isDirectory && isExpanded && children.length > 0
          ? renderEntries({
              parentPath: entry.path,
              depth: depth + 1,
              childrenByDirectory,
              expandedDirectories,
              loadingDirectories,
              directoryErrors,
              activePath,
              directoryGitStatusByPath,
              fileTreeGitStatusByPath,
              openDocumentPaths,
              onOpenFile,
              onOpenGitDiff,
              onToggleDirectory,
            })
          : null}
      </FileTreeRow>
    );
  });
}

function FileTreeRow({
  children,
  depth,
  directoryError,
  directoryGitStatus,
  entry,
  fileGitStatus,
  isActive,
  isExpanded,
  isLoading,
  isOpenDocument,
  rawFileGitStatus,
  onOpenFile,
  onOpenGitDiff,
  onToggleDirectory,
}: {
  children: React.ReactNode;
  depth: number;
  directoryError?: string;
  directoryGitStatus?: GitDirectoryStatusSummary;
  entry: DirectoryEntry;
  fileGitStatus: ReturnType<typeof gitStatusDisplay>;
  isActive: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  isOpenDocument: boolean;
  rawFileGitStatus?: GitDiffStatus;
  onOpenFile: (path: string) => void;
  onOpenGitDiff: (path: string) => void;
  onToggleDirectory: (path: string) => void;
}) {
  const isDirectory = entry.kind === "directory";
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
    !isDirectory && isSupportedCodexContextPath(entry.path);
  const openLabel = isDirectory
    ? `${entry.name}, ${isExpanded ? "expanded" : "collapsed"}`
    : `${entry.name}${isOpenDocument ? ", open" : ""}`;

  return (
    <div className="tree-node" data-review-id="tree-node">
      <div
        className={`tree-row ${isDirectory ? "folder" : "file"} ${isActive ? "active" : ""} ${gitStatus?.className ?? ""}`}
        data-review-id={isDirectory ? "tree-folder-toggle" : "tree-file"}
        data-context-menu-kind="file-tree"
        data-path={entry.path}
        data-entry-kind={entry.kind}
        data-git-status={
          !isDirectory && gitStatus ? rawFileGitStatus : undefined
        }
        data-git-status-summary={directoryGitStatus?.status}
        data-git-status-count={directoryGitStatus?.count}
        data-git-status-modified-count={directoryGitStatus?.modifiedCount}
        data-git-status-added-count={directoryGitStatus?.addedCount}
        data-git-status-deleted-count={directoryGitStatus?.deletedCount}
        data-git-status-untracked-count={directoryGitStatus?.untrackedCount}
        data-git-status-label={gitStatusBadgeLabel}
        data-document-open={isOpenDocument ? "true" : undefined}
        title={gitStatus ? `${entry.path} · ${gitStatus.label}` : undefined}
        aria-label={gitStatus ? `${entry.name}, ${gitStatus.label}` : undefined}
        draggable={canDragCompare}
        onPointerDown={(event) => {
          if (canDragCompare) {
            prepareFileCompareDragData(entry.path);
            prepareCodexContextPointerCapture(
              event.currentTarget,
              event.pointerId,
            );
          }
        }}
        onDragStart={(event) => {
          if (canDragCompare) {
            if (
              activateCodexContextPointerCapture({
                clientX: event.clientX,
                clientY: event.clientY,
              })
            ) {
              event.preventDefault();
              return;
            }
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
          onPointerDown={(event) => {
            if (canDragCompare) {
              prepareFileCompareDragData(entry.path);
              prepareCodexContextPointerCapture(
                event.currentTarget,
                event.pointerId,
              );
            }
          }}
          onDragStart={(event) => {
            if (canDragCompare) {
              if (
                activateCodexContextPointerCapture({
                  clientX: event.clientX,
                  clientY: event.clientY,
                })
              ) {
                event.preventDefault();
                return;
              }
              writeFileCompareDragData(event.dataTransfer, entry.path);
            }
          }}
          onDragEnd={() => scheduleClearFileCompareDragData()}
          onClick={() =>
            isDirectory ? onToggleDirectory(entry.path) : onOpenFile(entry.path)
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
          {isOpenDocument ? (
            <span className="documents-view-open-indicator">open</span>
          ) : null}
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
      {children}
    </div>
  );
}
