import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type {
  AppConfig,
  DocumentPayload,
  HostAdapter,
  SplitSessionState,
} from "../../core/types";
import { pruneWorkspacePathState } from "../../core/workspaceState";
import { normalizeConfig } from "../lib/config";
import { mergeWorkspaceConfigForSave } from "../lib/windowConfig";
import type { PaneId, ViewerPaneSnapshot } from "../types";

interface UseWorkspacePersistenceOptions {
  activeHeadingId: string | null;
  config: AppConfig | null;
  documentPayload: DocumentPayload | null;
  focusedPaneId: PaneId;
  host: HostAdapter;
  isLoading: boolean;
  paneSnapshots: Record<PaneId, ViewerPaneSnapshot>;
  setConfig: (config: AppConfig) => void;
  splitEnabled: boolean;
  splitRatio: number;
  viewerRef: RefObject<HTMLElement | null>;
  windowSessionId: string;
}

export function useWorkspacePersistence({
  activeHeadingId,
  config,
  documentPayload,
  focusedPaneId,
  host,
  isLoading,
  paneSnapshots,
  setConfig,
  splitEnabled,
  splitRatio,
  viewerRef,
  windowSessionId,
}: UseWorkspacePersistenceOptions) {
  const lastPersistedSessionRef = useRef("");

  async function persistWorkspace(partial: Partial<AppConfig["workspace"]>) {
    if (!config) {
      return;
    }

    const nextConfig = {
      ...config,
      workspace: {
        ...config.workspace,
        ...partial,
      },
    };
    setConfig(nextConfig);
    const persistedConfig = normalizeConfig(await host.loadConfig());
    await host.saveConfig(
      mergeWorkspaceConfigForSave({
        persistedConfig,
        windowConfig: nextConfig,
        windowSessionId,
      }),
    );
  }

  useEffect(() => {
    if (!config || isLoading) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const activePath = documentPayload?.path;
      const currentScrollTop = viewerRef.current?.scrollTop ?? 0;
      const nextScrollPositions = { ...config.workspace.scrollPositions };
      const nextActiveHeadingByPath = {
        ...config.workspace.activeHeadingByPath,
      };

      if (activePath) {
        nextScrollPositions[activePath] = Math.round(currentScrollTop);
        if (activeHeadingId) {
          nextActiveHeadingByPath[activePath] = activeHeadingId;
        }
      }

      const nextSplitSession: SplitSessionState | null =
        splitEnabled && documentPayload
          ? {
              enabled: true,
              focusedPaneId,
              splitRatio,
              panePaths: {
                left:
                  (focusedPaneId === "left"
                    ? documentPayload
                    : paneSnapshots.left.documentPayload
                  )?.path ?? null,
                right:
                  (focusedPaneId === "right"
                    ? documentPayload
                    : paneSnapshots.right.documentPayload
                  )?.path ?? null,
              },
            }
          : null;
      const priorityPaths = [
        activePath,
        ...(config.workspace.openTabs ?? []),
        nextSplitSession?.panePaths.left,
        nextSplitSession?.panePaths.right,
      ].filter((path): path is string => Boolean(path));
      const prunedScrollPositions = pruneWorkspacePathState(
        nextScrollPositions,
        priorityPaths,
      );
      const prunedActiveHeadingByPath = pruneWorkspacePathState(
        nextActiveHeadingByPath,
        priorityPaths,
      );
      const signature = JSON.stringify({
        activePath,
        scrollPositions: prunedScrollPositions,
        activeHeadingByPath: prunedActiveHeadingByPath,
        splitSession: nextSplitSession,
      });
      if (signature === lastPersistedSessionRef.current) {
        return;
      }
      lastPersistedSessionRef.current = signature;
      void persistWorkspace({
        activePath: activePath ?? null,
        scrollPositions: prunedScrollPositions,
        activeHeadingByPath: prunedActiveHeadingByPath,
        splitSession: nextSplitSession,
      });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeHeadingId,
    config,
    documentPayload,
    focusedPaneId,
    isLoading,
    paneSnapshots.left.documentPayload,
    paneSnapshots.right.documentPayload,
    splitEnabled,
    splitRatio,
    windowSessionId,
  ]);

  return { persistWorkspace };
}
