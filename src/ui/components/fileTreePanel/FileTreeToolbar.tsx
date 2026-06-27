import {
  ChevronsUp,
  FileText,
  FolderOpen,
  ListFilter,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fileName } from "../../lib/path";
import type { FilesViewMode, SuggestedDocumentsMode } from "./types";

interface FileTreeToolbarProps {
  rootDirectory: string;
  viewMode: FilesViewMode;
  hasMkdocsOrder: boolean;
  hasZensicalOrder: boolean;
  hasAntoraOrder: boolean;
  hasVitepressOrder: boolean;
  hasDocusaurusOrder: boolean;
  showExperimentalStaticSiteOrderSources: boolean;
  suggestedDocumentsMode?: SuggestedDocumentsMode;
  onPickDocument: () => void;
  onPickDirectory: () => void;
  onRefresh: () => void;
  onCollapse: () => void;
  onViewModeChange: (mode: FilesViewMode) => void;
}

export function FileTreeToolbar({
  rootDirectory,
  viewMode,
  hasMkdocsOrder,
  hasZensicalOrder,
  hasAntoraOrder,
  hasVitepressOrder,
  hasDocusaurusOrder,
  showExperimentalStaticSiteOrderSources,
  suggestedDocumentsMode,
  onPickDocument,
  onPickDirectory,
  onRefresh,
  onCollapse,
  onViewModeChange,
}: FileTreeToolbarProps) {
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const [viewModeMenuOpen, setViewModeMenuOpen] = useState(false);
  const openMenuRef = useRef<HTMLDivElement | null>(null);
  const viewModeMenuRef = useRef<HTMLDivElement | null>(null);

  useDismissableMenu(openMenuOpen, openMenuRef, () => setOpenMenuOpen(false));
  useDismissableMenu(viewModeMenuOpen, viewModeMenuRef, () =>
    setViewModeMenuOpen(false),
  );

  function pickFromOpenMenu(callback: () => void) {
    callback();
    setOpenMenuOpen(false);
  }

  function pickViewMode(nextMode: FilesViewMode) {
    onViewModeChange(nextMode);
    setViewModeMenuOpen(false);
  }
  const visibleSuggestedDocumentsMode =
    suggestedDocumentsMode && suggestedDocumentsMode.mode !== viewMode
      ? suggestedDocumentsMode
      : undefined;

  return (
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
        <div className="file-tree-open-menu-wrap" ref={viewModeMenuRef}>
          <button
            type="button"
            className={`icon-button documents-view-toggle ${
              viewMode !== "tree" ? "active" : ""
            }`}
            data-review-id="documents-view-toggle"
            aria-label="Choose file view mode"
            title="Choose file view mode"
            aria-haspopup="menu"
            aria-expanded={viewModeMenuOpen}
            aria-pressed={viewMode !== "tree"}
            onClick={() => setViewModeMenuOpen((value) => !value)}
          >
            <ListFilter size={15} />
          </button>
          {viewModeMenuOpen && (
            <div
              className="file-tree-open-menu documents-view-mode-menu"
              data-review-id="documents-view-mode-menu"
              role="menu"
              aria-label="File view mode"
            >
              <ViewModeMenuItem
                active={viewMode === "tree"}
                reviewId="documents-view-mode-tree"
                onPick={() => pickViewMode("tree")}
              >
                <FolderOpen size={15} />
                <span>File tree</span>
              </ViewModeMenuItem>
              <ViewModeMenuItem
                active={viewMode === "documents-path"}
                reviewId="documents-view-mode-path"
                ariaLabel="Documents only: Loaded"
                title="Show open documents as a temporary reading tree"
                onPick={() => pickViewMode("documents-path")}
              >
                <FileText size={15} />
                <span>Docs: Loaded</span>
              </ViewModeMenuItem>
              <ViewModeMenuItem
                active={viewMode === "documents-mkdocs"}
                disabled={!hasMkdocsOrder}
                reviewId="documents-view-mode-mkdocs"
                ariaLabel="Documents only: MkDocs order"
                title="Documents only: MkDocs order"
                onPick={() => pickViewMode("documents-mkdocs")}
              >
                <FileText size={15} />
                <span>Docs: MkDocs</span>
              </ViewModeMenuItem>
              <ViewModeMenuItem
                active={viewMode === "documents-zensical"}
                disabled={!hasZensicalOrder}
                reviewId="documents-view-mode-zensical"
                ariaLabel="Documents only: Zensical order"
                title="Documents only: Zensical order"
                onPick={() => pickViewMode("documents-zensical")}
              >
                <FileText size={15} />
                <span>Docs: Zensical</span>
              </ViewModeMenuItem>
              {showExperimentalStaticSiteOrderSources ? (
                <>
                  <ViewModeMenuItem
                    active={viewMode === "documents-vitepress"}
                    disabled={!hasVitepressOrder}
                    reviewId="documents-view-mode-vitepress"
                    ariaLabel="Documents only: VitePress order"
                    title="Documents only: VitePress order"
                    onPick={() => pickViewMode("documents-vitepress")}
                  >
                    <FileText size={15} />
                    <span>Docs: VitePress</span>
                  </ViewModeMenuItem>
                  <ViewModeMenuItem
                    active={viewMode === "documents-docusaurus"}
                    disabled={!hasDocusaurusOrder}
                    reviewId="documents-view-mode-docusaurus"
                    ariaLabel="Documents only: Docusaurus order"
                    title="Documents only: Docusaurus order"
                    onPick={() => pickViewMode("documents-docusaurus")}
                  >
                    <FileText size={15} />
                    <span>Docs: Docusaurus</span>
                  </ViewModeMenuItem>
                </>
              ) : null}
              <ViewModeMenuItem
                active={viewMode === "documents-antora"}
                disabled={!hasAntoraOrder}
                reviewId="documents-view-mode-antora"
                ariaLabel="Documents only: Antora order"
                title="Documents only: Antora order"
                onPick={() => pickViewMode("documents-antora")}
              >
                <FileText size={15} />
                <span>Docs: Antora</span>
              </ViewModeMenuItem>
            </div>
          )}
        </div>
        {visibleSuggestedDocumentsMode ? (
          <button
            type="button"
            className="documents-mode-suggestion"
            data-review-id="documents-mode-suggestion"
            title={visibleSuggestedDocumentsMode.label}
            onClick={() => pickViewMode(visibleSuggestedDocumentsMode.mode)}
          >
            {visibleSuggestedDocumentsMode.label}
          </button>
        ) : null}
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
  );
}

function ViewModeMenuItem({
  active,
  ariaLabel,
  children,
  disabled,
  reviewId,
  title,
  onPick,
}: {
  active: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
  disabled?: boolean;
  reviewId: string;
  title?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className={`file-tree-open-menu-item ${active ? "active" : ""}`}
      data-review-id={reviewId}
      role="menuitemradio"
      aria-checked={active}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onPick}
    >
      {children}
    </button>
  );
}

function useDismissableMenu(
  open: boolean,
  ref: React.RefObject<HTMLDivElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node | null)) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [close, open, ref]);
}
