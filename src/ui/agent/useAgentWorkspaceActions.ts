import { useCallback } from "react";
import { workspaceImageDataUrl } from "../codex/openUiLibrary";
import { resolveAgentWorkspacePath } from "./agentPanelModel";
import type { AgentPanelHostProps } from "./agentPanelTypes";

type WorkspaceActionOptions = Pick<
  AgentPanelHostProps,
  | "activeDocument"
  | "confirmExternalLink"
  | "host"
  | "onOpenDocument"
  | "workspaceRoot"
> & {
  setActionNotice: (notice: string | null) => void;
};

export function useAgentWorkspaceActions({
  activeDocument,
  confirmExternalLink,
  host,
  onOpenDocument,
  setActionNotice,
  workspaceRoot,
}: WorkspaceActionOptions) {
  const openAgentWorkspaceFile = useCallback(
    (relativePath: string) => {
      const path = resolveAgentWorkspacePath(workspaceRoot, relativePath);
      if (!path || !onOpenDocument) {
        setActionNotice("This workspace file could not be opened.");
        return;
      }
      setActionNotice(null);
      void Promise.resolve(onOpenDocument(path)).catch(() => {
        setActionNotice("This workspace file could not be opened.");
      });
    },
    [onOpenDocument, setActionNotice, workspaceRoot],
  );

  const openAgentExternalLink = useCallback(
    (url: string) => {
      if (!confirmExternalLink) {
        setActionNotice("This external link could not be opened.");
        return;
      }
      void confirmExternalLink(url).then((confirmed) => {
        if (!confirmed) return;
        void host.openExternalUrl(url).catch(() => {
          setActionNotice("This external link could not be opened.");
        });
      });
    },
    [confirmExternalLink, host, setActionNotice],
  );

  const resolveAgentWorkspaceImage = useCallback(
    async (relativePath: string) => {
      const path = resolveAgentWorkspacePath(workspaceRoot, relativePath);
      if (!path || !activeDocument) return null;
      try {
        const result = await host.resolveLocalImage(
          path,
          activeDocument.path,
          activeDocument.resourceContext ?? null,
        );
        return workspaceImageDataUrl(result);
      } catch {
        return null;
      }
    },
    [activeDocument, host, workspaceRoot],
  );

  return {
    openAgentExternalLink,
    openAgentWorkspaceFile,
    resolveAgentWorkspaceImage,
  };
}
