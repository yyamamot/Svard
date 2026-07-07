import { createElement } from "react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import {
  Bookmark,
  Copy,
  FileX2,
  FilePenLine,
  FileText,
  GitCompare,
  History,
  Link as LinkIcon,
  Pin,
  PinOff,
  Trash2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  BookmarkEntry,
  DocumentPayload,
  GitRefKind,
  RenderResult,
} from "../../core/types";
import type { DocumentReviewSessionControls } from "../lib/documentReviewSession";
import { emptyDocumentReviewSessionControls } from "../lib/documentReviewSession";
import { fileName } from "../lib/path";
import type { ContextMenuItem } from "../types";

function menuIcon(Icon: LucideIcon) {
  return createElement(Icon, { size: 14 });
}

interface UseShellContextMenuOptions {
  activateSearchHit: (index: number) => void;
  activateWorkspaceSearchResult?: (index: number) => void;
  addBookmarkEntry: (entry: BookmarkEntry) => void | Promise<void>;
  articleRef: RefObject<HTMLElement | null>;
  bookmarks: BookmarkEntry[];
  closeAllTabs: () => void;
  closeOtherTabs: (path: string) => void;
  closeTab: (path: string) => void;
  copyText: (label: string, value?: string) => void | Promise<void>;
  documentPayload: DocumentPayload | null;
  documentReviewSession?: DocumentReviewSessionControls;
  navigateToHeading: (headingId: string) => void;
  openContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    items: ContextMenuItem[],
    sourceReviewId?: string,
  ) => boolean;
  openDocumentInNewWindow: (
    path: string,
    options?: { pinned?: boolean },
  ) => void | Promise<void>;
  moveTabToNewWindow: (path: string) => void | Promise<void>;
  openPathInEditor: (path: string) => void | Promise<void>;
  openTabs: DocumentPayload[];
  comparePickedDocuments: () => void | Promise<void>;
  compareWithActiveFile: (path: string) => void | Promise<void>;
  compareWithGitRef: (kind: GitRefKind, path: string) => void | Promise<void>;
  showGitDiff: (path: string) => void | Promise<void>;
  showGitFileHistory: (path: string) => void | Promise<void>;
  pinnedTabs: string[];
  removeBookmarkEntry: (path: string) => void | Promise<void>;
  renderResult: RenderResult | null;
  toggleActivePinnedTab: (path: string) => void;
}

export function useShellContextMenu({
  activateSearchHit,
  activateWorkspaceSearchResult,
  addBookmarkEntry,
  articleRef,
  bookmarks,
  closeAllTabs,
  closeOtherTabs,
  closeTab,
  copyText,
  documentPayload,
  documentReviewSession = emptyDocumentReviewSessionControls,
  navigateToHeading,
  openContextMenu,
  openDocumentInNewWindow,
  moveTabToNewWindow,
  openPathInEditor,
  openTabs,
  comparePickedDocuments,
  compareWithActiveFile,
  compareWithGitRef,
  showGitDiff,
  showGitFileHistory,
  pinnedTabs,
  removeBookmarkEntry,
  renderResult,
  toggleActivePinnedTab,
}: UseShellContextMenuOptions) {
  function sourceReferenceForHeading(headingId: string): string | undefined {
    if (!documentPayload) {
      return undefined;
    }
    const heading = renderResult?.headings.find(
      (item) => item.id === headingId,
    );
    if (!heading?.sourceLocation?.line) {
      return documentPayload.path
        ? `${documentPayload.path}#${encodeURIComponent(headingId)}`
        : undefined;
    }
    return `${heading.sourceLocation.sourcePath ?? documentPayload.path}:${heading.sourceLocation.line}#${encodeURIComponent(headingId)}`;
  }

  function sourceReferenceForSearchHit(index: number): string | undefined {
    const workspaceResult = document.querySelector<HTMLElement>(
      `[data-review-id="workspace-search-result-item"][data-search-index="${index}"]`,
    );
    const workspaceReference = workspaceResult?.getAttribute(
      "data-source-reference",
    );
    if (workspaceReference) {
      return workspaceReference;
    }
    const article = articleRef.current;
    const mark = article?.querySelector<HTMLElement>(
      `mark.search-hit[data-search-hit-index="${index}"]`,
    );
    if (!article || !mark) {
      return undefined;
    }
    const ownReference = mark
      .closest<HTMLElement>("[data-source-reference]")
      ?.getAttribute("data-source-reference");
    if (ownReference) {
      return ownReference;
    }
    const referenceSource = Array.from(
      article.querySelectorAll<HTMLElement>("[data-source-reference]"),
    )
      .filter(
        (element) =>
          element.compareDocumentPosition(mark) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      )
      .at(-1);
    return (
      referenceSource?.getAttribute("data-source-reference") ??
      documentPayload?.path
    );
  }

  function handleShellContextMenu(event: ReactMouseEvent<HTMLElement>) {
    if (event.defaultPrevented) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest(".document-body")) {
      return;
    }

    const contextTarget = target.closest<HTMLElement>(
      "[data-context-menu-kind]",
    );
    if (!contextTarget) {
      return;
    }

    const {
      contextMenuKind,
      path,
      entryKind,
      headingId,
      searchIndex: hitIndex,
    } = contextTarget.dataset;
    const canCompareWithActive = (targetPath: string) =>
      Boolean(
        documentPayload?.path &&
        documentPayload.path !== targetPath &&
        isSupportedDocumentPath(documentPayload.path) &&
        isSupportedDocumentPath(targetPath),
      );
    const canCloseOtherFiles = (targetPath: string) =>
      openTabs.some(
        (tab) => tab.path !== targetPath && !pinnedTabs.includes(tab.path),
      );
    const addGitRefCompareItems = (targetPath: string) => {
      items.push({
        id: "compare-with-branch",
        label: "Compare with Branch...",
        icon: menuIcon(GitCompare),
        onSelect: () => compareWithGitRef("branch", targetPath),
      });
      items.push({
        id: "compare-with-tag",
        label: "Compare with Tag...",
        icon: menuIcon(GitCompare),
        onSelect: () => compareWithGitRef("tag", targetPath),
      });
      items.push({
        id: "compare-with-commit",
        label: "Compare with Commit...",
        icon: menuIcon(GitCompare),
        onSelect: () => compareWithGitRef("commit", targetPath),
      });
    };
    const addSupportedDocumentActions = (
      items: ContextMenuItem[],
      targetPath: string,
      options: { includeMoveTabToNewWindow?: boolean } = {},
    ) => {
      items.push({
        id: "open-in-new-window",
        label: "Open in New Window",
        icon: menuIcon(FileText),
        onSelect: () => openDocumentInNewWindow(targetPath),
      });
      if (options.includeMoveTabToNewWindow) {
        items.push({
          id: "move-tab-to-new-window",
          label: "Move Tab to New Window",
          icon: menuIcon(FileText),
          onSelect: () => moveTabToNewWindow(targetPath),
        });
      }
      items.push({
        id: "open-in-editor",
        label: "Open in Editor",
        icon: menuIcon(FilePenLine),
        onSelect: () => openPathInEditor(targetPath),
      });
      items.push({
        id: "show-git-diff",
        label: "Show Git Diff",
        icon: menuIcon(GitCompare),
        separatorBefore: true,
        onSelect: () => showGitDiff(targetPath),
      });
      items.push({
        id: "show-file-history",
        label: "Show File History",
        icon: menuIcon(History),
        onSelect: () => showGitFileHistory(targetPath),
      });
      if (canCompareWithActive(targetPath)) {
        items.push({
          id: "compare-with-active-file",
          label: "Compare with Active File",
          icon: menuIcon(GitCompare),
          separatorBefore: true,
          onSelect: () => compareWithActiveFile(targetPath),
        });
      }
      items.push({
        id: "compare-files",
        label: "Compare Files...",
        icon: menuIcon(GitCompare),
        separatorBefore: !canCompareWithActive(targetPath),
        onSelect: () => comparePickedDocuments(),
      });
      addGitRefCompareItems(targetPath);
    };
    const copyPathItem = (
      targetPath: string,
      separatorBefore = true,
    ): ContextMenuItem => ({
      id: "copy-path",
      label: "Copy Path",
      icon: menuIcon(Copy),
      separatorBefore,
      onSelect: () => copyText("Path", targetPath),
    });
    const items: ContextMenuItem[] = [];
    const addDocumentReviewItems = (targetPath: string) => {
      items.push(
        {
          id: "mark-review-viewed",
          label: "Mark viewed",
          separatorBefore: true,
          onSelect: () => documentReviewSession.markViewed(targetPath),
        },
        {
          id: "mark-review-needs-attention",
          label: "Mark needs attention",
          onSelect: () =>
            documentReviewSession.markNeedsAttention(targetPath),
        },
        {
          id: "reset-review-state",
          label: "Reset review state",
          onSelect: () => documentReviewSession.reset(targetPath),
        },
      );
    };

    if (contextMenuKind === "file-tree" && path) {
      const bookmarkKind = entryKind === "directory" ? "directory" : "file";
      if (bookmarkKind === "file" && isSupportedDocumentPath(path)) {
        addSupportedDocumentActions(items, path);
        if (contextTarget.dataset.documentReviewTarget === "true") {
          addDocumentReviewItems(path);
        }
      }
      items.push(copyPathItem(path, items.length > 0));
      items.push({
        id: "bookmark",
        label: "Bookmark",
        icon: menuIcon(Bookmark),
        onSelect: () =>
          addBookmarkEntry({
            path,
            kind: bookmarkKind,
            name: fileName(path) || path,
          }),
      });
    } else if (
      (contextMenuKind === "open-file" || contextMenuKind === "tab") &&
      path
    ) {
      const isPinned = pinnedTabs.includes(path);
      if (isSupportedDocumentPath(path)) {
        addSupportedDocumentActions(items, path, {
          includeMoveTabToNewWindow: true,
        });
      }
      items.push({
        id: "pin",
        label: isPinned ? "Unpin" : "Pin",
        icon: menuIcon(isPinned ? PinOff : Pin),
        separatorBefore: items.length > 0,
        onSelect: () => toggleActivePinnedTab(path),
      });
      items.push(copyPathItem(path, items.length > 0));
      items.push({
        id: "close",
        label: "Close",
        icon: menuIcon(X),
        danger: true,
        separatorBefore: true,
        onSelect: () => closeTab(path),
      });
      if (canCloseOtherFiles(path)) {
        items.push({
          id: "close-other-files",
          label: "Close Other Files",
          icon: menuIcon(FileX2),
          danger: true,
          onSelect: () => closeOtherTabs(path),
        });
      }
      items.push({
        id: "close-all-files",
        label: "Close All Files",
        icon: menuIcon(X),
        danger: true,
        onSelect: () => closeAllTabs(),
      });
    } else if (contextMenuKind === "bookmark" && path) {
      const bookmark = bookmarks.find((item) => item.path === path);
      if (bookmark?.kind === "file" && isSupportedDocumentPath(path)) {
        addSupportedDocumentActions(items, path);
      }
      items.push(copyPathItem(path, items.length > 0));
      items.push({
        id: "remove",
        label: "Remove",
        icon: menuIcon(Trash2),
        danger: true,
        separatorBefore: true,
        onSelect: () => removeBookmarkEntry(path),
      });
    } else if (contextMenuKind === "search-result" && hitIndex) {
      const index = Number.parseInt(hitIndex, 10);
      const isWorkspaceResult = Boolean(
        (event.target as HTMLElement | null)?.closest(
          '[data-review-id="workspace-search-result-item"]',
        ),
      );
      const sourceReference = sourceReferenceForSearchHit(index);
      items.push({
        id: "open-result",
        label: "Open Result",
        icon: menuIcon(FileText),
        onSelect: () =>
          isWorkspaceResult && activateWorkspaceSearchResult
            ? activateWorkspaceSearchResult(index)
            : activateSearchHit(index),
      });
      if (sourceReference) {
        items.push({
          id: "copy-source-reference",
          label: "Copy Source Reference",
          icon: menuIcon(LinkIcon),
          onSelect: () => copyText("Source reference", sourceReference),
        });
      }
    } else if (contextMenuKind === "toc-item" && headingId) {
      const sourceReference = sourceReferenceForHeading(headingId);
      items.push({
        id: "open-heading",
        label: "Open Heading",
        icon: menuIcon(FileText),
        onSelect: () => navigateToHeading(headingId),
      });
      if (sourceReference) {
        items.push({
          id: "copy-heading-link",
          label: "Copy Heading Link",
          icon: menuIcon(LinkIcon),
          onSelect: () => copyText("Heading link", sourceReference),
        });
        items.push({
          id: "copy-source-reference",
          label: "Copy Source Reference",
          icon: menuIcon(Copy),
          onSelect: () => copyText("Source reference", sourceReference),
        });
      }
    }

    openContextMenu(
      event,
      items,
      contextTarget.getAttribute("data-review-id") ?? undefined,
    );
  }

  return { handleShellContextMenu };
}
