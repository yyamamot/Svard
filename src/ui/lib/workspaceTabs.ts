import { settingsLabel } from "./appLabels";
import type { DocumentPayload } from "../../core/types";
import type { WorkspaceTab } from "../types";

export const preferencesTabId = "app://preferences" as const;

export type WorkspaceTabId = string | typeof preferencesTabId;

export function documentWorkspaceTab(document: DocumentPayload): WorkspaceTab {
  return {
    kind: "document",
    id: document.path,
    path: document.path,
    document,
  };
}

export function preferencesWorkspaceTab(): WorkspaceTab {
  return {
    kind: "preferences",
    id: preferencesTabId,
  };
}

export function buildWorkspaceTabs(
  documents: DocumentPayload[],
  preferencesOpen: boolean,
): WorkspaceTab[] {
  const documentTabs = documents.map(documentWorkspaceTab);
  return preferencesOpen
    ? [...documentTabs, preferencesWorkspaceTab()]
    : documentTabs;
}

export function activeWorkspaceTabId({
  activeDocumentPath,
  preferencesActive,
}: {
  activeDocumentPath: string | null | undefined;
  preferencesActive: boolean;
}): WorkspaceTabId | undefined {
  return preferencesActive
    ? preferencesTabId
    : (activeDocumentPath ?? undefined);
}

export function activeDocumentPathFromWorkspaceTab(
  tab: WorkspaceTab,
): string | null {
  return tab.kind === "document" ? tab.path : null;
}

export function workspaceTabTitle(tab: WorkspaceTab): string {
  return tab.kind === "preferences" ? settingsLabel() : tab.path;
}
