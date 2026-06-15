import { useMemo } from "react";

import { getBoundedTabs } from "../../core/tabLayout";
import type { DocumentPayload } from "../../core/types";
import type { WorkspaceTab } from "../types";
import {
  activeWorkspaceTabId as resolveActiveWorkspaceTabId,
  buildWorkspaceTabs,
} from "../lib/workspaceTabs";

interface UseWorkspaceTabLayoutStateOptions {
  activeDocumentPath: string | undefined;
  orderedTabs: DocumentPayload[];
  preferencesOpen: boolean;
  preferencesTabOpen: boolean;
}

export function useWorkspaceTabLayoutState({
  activeDocumentPath,
  orderedTabs,
  preferencesOpen,
  preferencesTabOpen,
}: UseWorkspaceTabLayoutStateOptions) {
  const workspaceTabs = useMemo(
    () => buildWorkspaceTabs(orderedTabs, preferencesTabOpen),
    [orderedTabs, preferencesTabOpen],
  );
  const activeWorkspaceTabId = resolveActiveWorkspaceTabId({
    activeDocumentPath,
    preferencesActive: preferencesOpen,
  });
  const workspaceTabLayout = useMemo(
    () =>
      getBoundedTabs(
        workspaceTabs.map((tab) => tab.id),
        activeWorkspaceTabId,
        4,
      ),
    [activeWorkspaceTabId, workspaceTabs],
  );
  const visibleWorkspaceTabs = useMemo(
    () =>
      workspaceTabLayout.visiblePaths
        .map((id) => workspaceTabs.find((tab) => tab.id === id))
        .filter((tab): tab is WorkspaceTab => Boolean(tab)),
    [workspaceTabLayout.visiblePaths, workspaceTabs],
  );
  const overflowWorkspaceTabs = useMemo(
    () =>
      workspaceTabLayout.overflowPaths
        .map((id) => workspaceTabs.find((tab) => tab.id === id))
        .filter((tab): tab is WorkspaceTab => Boolean(tab)),
    [workspaceTabLayout.overflowPaths, workspaceTabs],
  );

  return {
    activeWorkspaceTabId,
    overflowWorkspaceTabs,
    visibleWorkspaceTabs,
    workspaceTabs,
  };
}
