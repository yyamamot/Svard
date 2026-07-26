import {
  ChevronsDown,
  ChevronsUp,
  FileText,
  Pin,
  PinOff,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { isSupportedDocumentPath } from "../../../core/documentFormat";
import {
  filterOpenFiles,
  getOpenFilesFilterMode,
} from "../../../core/openFilesFilter";
import { hasMovedBeyondThreshold } from "../../../core/reorderDrag";
import type { DocumentPayload, GitDiffStatus } from "../../../core/types";
import {
  activateCodexContextPointerCapture,
  prepareFileCompareDragData,
  prepareCodexContextPointerCapture,
  scheduleClearFileCompareDragData,
  writeFileCompareDragData,
} from "../../lib/fileCompareDrag";
import { gitStatusDisplay } from "../../lib/gitStatusDisplay";
import { fileName, isMiddleMouseButton } from "../../lib/path";
import { preferencesTabId } from "../../lib/workspaceTabs";
import type { OpenFileReloadState } from "../../types";
import { findReorderIndex } from "./shared";
import type { ReorderDragState } from "./shared";

export function OpenFilesList({
  sectionRef,
  collapsed,
  tabs,
  activePath,
  preferencesTabOpen,
  preferencesActive,
  pinnedTabs,
  gitStatusByPath,
  reloadStateByPath,
  filterValue,
  filterInputRef,
  onFilterChange,
  onActivate,
  onActivatePreferences,
  onClose,
  onClosePreferences,
  onReorder,
  onOpenGitDiff,
  onToggleCollapsed,
  onTogglePinned,
}: {
  sectionRef?: RefObject<HTMLElement | null>;
  collapsed: boolean;
  tabs: DocumentPayload[];
  activePath?: string;
  preferencesTabOpen: boolean;
  preferencesActive: boolean;
  pinnedTabs: string[];
  gitStatusByPath: Record<string, GitDiffStatus>;
  reloadStateByPath: Record<string, OpenFileReloadState>;
  filterValue: string;
  filterInputRef: RefObject<HTMLInputElement | null>;
  onFilterChange: (value: string) => void;
  onActivate: (path: string) => void;
  onActivatePreferences: () => void;
  onClose: (path: string) => void;
  onClosePreferences: () => void;
  onReorder: (fromPath: string, toPath: string) => void;
  onOpenGitDiff: (path: string) => void;
  onToggleCollapsed: () => void;
  onTogglePinned: (path: string) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<ReorderDragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const filterMode = getOpenFilesFilterMode(filterValue);
  const displayTabs = filterOpenFiles(tabs, filterValue);
  const filterQuery = filterValue.trim().toLowerCase();
  const showPreferencesTab =
    preferencesTabOpen && (!filterQuery || "preferences".includes(filterQuery));
  const openFileCount = tabs.length + (preferencesTabOpen ? 1 : 0);

  if (collapsed) {
    return (
      <section
        ref={sectionRef}
        className="open-files collapsed"
        data-review-id="open-files"
      >
        <div
          className="open-files-collapsed-bar"
          data-review-id="open-files-collapsed-bar"
        >
          <span>Open Files ({openFileCount})</span>
          <button
            type="button"
            className="icon-button compact"
            data-review-id="open-files-expand"
            aria-label="Expand Open Files"
            title="Expand Open Files"
            onClick={onToggleCollapsed}
          >
            <ChevronsDown size={14} />
          </button>
        </div>
      </section>
    );
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.button !== 0 || displayTabs.length <= 1) {
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
    const overIndex = findReorderIndex(
      listRef.current,
      "open-file-item",
      event.clientX,
      event.clientY,
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
      const fromPath = displayTabs[dragState.fromIndex]?.path;
      const toPath = displayTabs[dragState.overIndex]?.path;
      if (fromPath && toPath) {
        onReorder(fromPath, toPath);
      }
    }
    setDragState(null);
  }

  function handleActivateClick(path: string) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onActivate(path);
  }

  return (
    <section
      ref={sectionRef}
      className="open-files"
      data-review-id="open-files"
    >
      <div className="open-files-header">
        <h2>Open Files</h2>
        <div className="open-files-actions">
          <button
            type="button"
            className="icon-button compact"
            data-review-id="open-files-collapse"
            aria-label="Collapse Open Files"
            title="Collapse Open Files"
            onClick={onToggleCollapsed}
          >
            <ChevronsUp size={14} />
          </button>
        </div>
      </div>
      <label className="open-files-filter">
        <Search size={13} />
        <input
          ref={filterInputRef}
          data-review-id="open-files-filter"
          value={filterValue}
          placeholder="Filter open files"
          onChange={(event) => onFilterChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onFilterChange("");
            }
            if (event.key === "Enter") {
              const target = displayTabs[0];
              if (target) {
                event.preventDefault();
                onActivate(target.path);
              }
            }
          }}
        />
        {filterMode === "glob" && filterValue.trim() ? (
          <span
            className="open-files-filter-mode"
            data-review-id="open-files-filter-mode"
          >
            Glob
          </span>
        ) : null}
      </label>
      <div className="open-files-list" ref={listRef}>
        {displayTabs.length === 0 && !showPreferencesTab && (
          <p className="open-files-empty">No open files</p>
        )}
        {showPreferencesTab && (
          <div
            className={`open-file-row ${preferencesActive ? "active" : ""}`}
            data-review-id="open-file-item"
            data-tab-kind="preferences"
            data-path={preferencesTabId}
          >
            <button
              type="button"
              className="open-file-button"
              title="Preferences"
              aria-label="Preferences"
              onClick={onActivatePreferences}
            >
              <Settings size={14} />
              <span>Preferences</span>
            </button>
            <button
              type="button"
              className="open-file-close"
              data-review-id="open-file-close"
              aria-label="Close Preferences"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onClosePreferences();
              }}
            >
              <X size={13} />
            </button>
          </div>
        )}
        {displayTabs.map((tab, index) => {
          const isActive = tab.path === activePath;
          const isPinned = pinnedTabs.includes(tab.path);
          const gitStatus = gitStatusDisplay(gitStatusByPath[tab.path]);
          const reloadState = reloadStateByPath[tab.path];
          const visibleReloadState =
            reloadState?.status === "reloading" ||
            reloadState?.status === "error"
              ? reloadState
              : null;
          const reloadLabel =
            visibleReloadState?.status === "reloading"
              ? "Reloading"
              : visibleReloadState?.status === "error"
                ? "Reload failed"
                : null;
          const statusTitleParts = [
            gitStatus?.label,
            reloadLabel
              ? `${reloadLabel}${visibleReloadState?.message ? `: ${visibleReloadState.message}` : ""}`
              : null,
          ].filter(Boolean);
          const statusAriaParts = [gitStatus?.label, reloadLabel].filter(
            Boolean,
          );
          return (
            <div
              key={tab.path}
              className={`open-file-row ${isActive ? "active" : ""} ${
                isPinned ? "pinned" : ""
              } ${
                dragState?.fromIndex === index &&
                dragState.status === "dragging"
                  ? "dragging"
                  : ""
              } ${
                dragState?.overIndex === index && dragState.fromIndex !== index
                  ? "drop-before"
                  : ""
              } ${gitStatus?.className ?? ""} ${
                visibleReloadState ? `reload-${visibleReloadState.status}` : ""
              }`}
              data-review-id="open-file-item"
              data-context-menu-kind="open-file"
              data-path={tab.path}
              data-reload-status={visibleReloadState?.status}
              data-git-status={
                gitStatus ? gitStatusByPath[tab.path] : undefined
              }
              draggable={isSupportedDocumentPath(tab.path)}
              onPointerDown={(event) => {
                if (isSupportedDocumentPath(tab.path)) {
                  prepareFileCompareDragData(tab.path);
                  prepareCodexContextPointerCapture(
                    event.currentTarget,
                    event.pointerId,
                  );
                }
              }}
              onDragStart={(event) => {
                if (isSupportedDocumentPath(tab.path)) {
                  if (
                    activateCodexContextPointerCapture({
                      clientX: event.clientX,
                      clientY: event.clientY,
                    })
                  ) {
                    event.preventDefault();
                    return;
                  }
                  writeFileCompareDragData(event.dataTransfer, tab.path);
                }
              }}
              onDragEnd={() => scheduleClearFileCompareDragData()}
              onMouseDown={(event) => {
                if (isMiddleMouseButton(event)) {
                  event.preventDefault();
                }
              }}
              onAuxClick={(event) => {
                if (isMiddleMouseButton(event)) {
                  event.preventDefault();
                  event.stopPropagation();
                  onClose(tab.path);
                }
              }}
            >
              <button
                type="button"
                className="open-file-button"
                title={
                  statusTitleParts.length > 0
                    ? `${tab.path} · ${statusTitleParts.join(" · ")}`
                    : tab.path
                }
                aria-label={
                  statusAriaParts.length > 0
                    ? `${fileName(tab.path)}, ${statusAriaParts.join(", ")}`
                    : fileName(tab.path)
                }
                onPointerDown={(event) => handlePointerDown(event, index)}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointerDrag}
                onPointerCancel={() => setDragState(null)}
                onClick={() => handleActivateClick(tab.path)}
              >
                <FileText size={14} />
                <span>{fileName(tab.path)}</span>
              </button>
              <span className="open-file-status-slot">
                {gitStatus ? (
                  <button
                    type="button"
                    className={`git-status-badge git-status-diff-button ${gitStatus.className}`}
                    data-review-id="git-status-diff-button"
                    aria-label={`Open diff for ${fileName(tab.path)}`}
                    title="Open diff"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenGitDiff(tab.path);
                    }}
                  >
                    {gitStatus.shortLabel}
                  </button>
                ) : null}
                {reloadLabel ? (
                  <span
                    className="reload-status-badge"
                    data-review-id="open-file-reload-status"
                    aria-hidden="true"
                  >
                    {visibleReloadState?.status === "reloading"
                      ? "Reloading"
                      : "Reload failed"}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                className="open-file-pin"
                data-review-id="open-file-pin"
                aria-label={
                  isPinned
                    ? `Unpin ${fileName(tab.path)}`
                    : `Pin ${fileName(tab.path)}`
                }
                title={isPinned ? "Unpin file" : "Pin file"}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePinned(tab.path);
                }}
              >
                {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
              </button>
              <button
                type="button"
                className="open-file-close"
                data-review-id="open-file-close"
                aria-label={`Close ${fileName(tab.path)}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(tab.path);
                }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
