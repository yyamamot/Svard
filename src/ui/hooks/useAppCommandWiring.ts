import { useCallback, type RefObject } from "react";
import type { AppConfig, DocumentPayload } from "../../core/types";
import { svardWebsiteUrl } from "../../core/projectLinks";
import { nextRecentTabPath } from "../../core/workspaceState";
import { scrollViewer } from "../lib/viewerScroll";
import {
  useCommandDispatcher,
  type UseCommandDispatcherOptions,
} from "./useCommandDispatcher";

interface UseAppCommandWiringOptions extends Omit<
  UseCommandDispatcherOptions,
  | "canSwitchToRecentTab"
  | "documentPayload"
  | "onOpenWebsite"
  | "onScrollViewer"
  | "onSwitchToRecentTab"
> {
  activeDocumentPayload: DocumentPayload | null;
  config: AppConfig | null;
  orderedTabs: DocumentPayload[];
  onActivateDocumentWorkspaceTab: (path: string) => void | Promise<void>;
  onOpenExternalUrl: (url: string) => void | Promise<void>;
  viewerRef: RefObject<HTMLElement | null>;
}

export function useAppCommandWiring({
  activeDocumentPayload,
  config,
  orderedTabs,
  onActivateDocumentWorkspaceTab,
  onOpenExternalUrl,
  viewerRef,
  ...commandOptions
}: UseAppCommandWiringOptions) {
  const recentTabPath = nextRecentTabPath(
    config?.workspace.recentTabs ?? [],
    activeDocumentPayload?.path ?? null,
    orderedTabs.map((tab) => tab.path),
  );

  const switchToRecentTab = useCallback(() => {
    if (recentTabPath) {
      void onActivateDocumentWorkspaceTab(recentTabPath);
    }
  }, [onActivateDocumentWorkspaceTab, recentTabPath]);

  return useCommandDispatcher({
    ...commandOptions,
    config,
    documentPayload: activeDocumentPayload,
    viewerRef,
    canSwitchToRecentTab: Boolean(recentTabPath),
    onOpenWebsite: () => onOpenExternalUrl(svardWebsiteUrl),
    onScrollViewer: (kind) => scrollViewer(viewerRef, kind),
    onSwitchToRecentTab: switchToRecentTab,
  });
}
