import type { useWorkspacePersistence } from "./useWorkspacePersistence";

type PersistWorkspace = ReturnType<
  typeof useWorkspacePersistence
>["persistWorkspace"];

export function useRecentWorkspaceActions(persistWorkspace: PersistWorkspace) {
  return {
    clearRecentDocuments: () => {
      void persistWorkspace({ recentDocuments: [] });
    },
    clearRecentDirectories: () => {
      void persistWorkspace({ recentDirectories: [] });
    },
  };
}
