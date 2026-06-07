import type { QuickOpenCandidate } from "../components/QuickOpen";
import type { CommandId } from "../../core/commands";
import type { AppConfig, DocumentPayload } from "../../core/types";
import { expandCollapsedSectionsContaining } from "../lib/sectionCollapse";
import type { NavigationLocation } from "../types";

interface UseQuickOpenActionsOptions {
  articleRef: React.RefObject<HTMLElement | null>;
  clearActiveContentCursor: () => void;
  dispatchCommand: (commandId: CommandId) => Promise<unknown> | unknown;
  documentPayload: DocumentPayload | null;
  navigateToHeading: (headingId: string) => void;
  openDirectory: (path: string) => Promise<void> | void;
  openDocumentWorkspaceTab: (path: string) => Promise<void> | void;
  recordNavigation: (nextLocation: NavigationLocation) => void;
  setActiveWorkspaceTabKind: (kind: "document" | "preferences") => void;
  setQuickOpenOpen: (open: boolean) => void;
  setQuickOpenQuery: (query: string) => void;
  setSidebarTab: (
    tab: AppConfig["workspace"]["sidebarTab"],
  ) => Promise<void> | void;
  setViewerShortcutHintsOpen: (open: boolean) => void;
  viewerRef: React.RefObject<HTMLElement | null>;
}

export function useQuickOpenActions({
  articleRef,
  clearActiveContentCursor,
  dispatchCommand,
  documentPayload,
  navigateToHeading,
  openDirectory,
  openDocumentWorkspaceTab,
  recordNavigation,
  setActiveWorkspaceTabKind,
  setQuickOpenOpen,
  setQuickOpenQuery,
  setSidebarTab,
  setViewerShortcutHintsOpen,
  viewerRef,
}: UseQuickOpenActionsOptions) {
  async function openQuickOpenCandidate(candidate: QuickOpenCandidate) {
    setQuickOpenOpen(false);
    setQuickOpenQuery("");
    if (candidate.type === "command") {
      await dispatchCommand(candidate.id);
      return;
    }
    clearActiveContentCursor();
    if (candidate.type === "heading") {
      navigateToHeading(candidate.id);
      return;
    }
    if (candidate.type === "sourceLine") {
      navigateToSourceLine(candidate.targetLine);
      return;
    }
    if (candidate.kind === "directory") {
      setActiveWorkspaceTabKind("document");
      await openDirectory(candidate.path);
      await setSidebarTab("files");
      return;
    }
    await openDocumentWorkspaceTab(candidate.path);
  }

  function navigateToSourceLine(line: number) {
    if (!documentPayload) {
      return;
    }
    recordNavigation({
      path: documentPayload.path,
      label: `Line ${line}`,
      scrollTop: viewerRef.current?.scrollTop,
    });
    const article = articleRef.current;
    const candidates = [
      ...(article?.querySelectorAll<HTMLElement>("[data-source-line]") ?? []),
    ];
    const target =
      candidates.find(
        (element) => Number(element.dataset.sourceLine) === line,
      ) ??
      candidates
        .filter((element) =>
          Number.isFinite(Number(element.dataset.sourceLine)),
        )
        .sort(
          (left, right) =>
            Math.abs(Number(left.dataset.sourceLine) - line) -
            Math.abs(Number(right.dataset.sourceLine) - line),
        )
        .at(0);
    if (!target) {
      return;
    }
    expandCollapsedSectionsContaining(target);
    target.scrollIntoView({ block: "start", behavior: "smooth" });
    target.classList.add("quick-open-line-jump-highlight");
    target.setAttribute("data-quick-open-line-jump-highlight", "true");
    window.setTimeout(() => {
      target.classList.remove("quick-open-line-jump-highlight");
      target.removeAttribute("data-quick-open-line-jump-highlight");
    }, 1800);
  }

  function openQuickOpen() {
    setQuickOpenOpen(true);
    setQuickOpenQuery("");
  }

  function showViewerShortcuts() {
    setQuickOpenOpen(false);
    setQuickOpenQuery("");
    setViewerShortcutHintsOpen(true);
  }

  return {
    navigateToSourceLine,
    openQuickOpen,
    openQuickOpenCandidate,
    showViewerShortcuts,
  };
}
