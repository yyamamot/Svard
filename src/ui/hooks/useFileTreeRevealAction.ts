import { useCallback, useLayoutEffect, useRef } from "react";
import type { AppConfig } from "../../core/types";

interface FileTreeRevealActionOptions {
  config: AppConfig | null;
  contextKey: string;
  enabled: boolean;
  onShowFileTree: () => void | Promise<void>;
  onReveal: () => Promise<void>;
  onCancelReveal: () => void;
  onSaveConfig: (config: AppConfig) => Promise<void>;
  showInlineNotice: (message: string, options: { tone: "warning" }) => void;
}

/** Keep palette and toolbar reveal on one path, including hidden sidebar setup. */
export function useFileTreeRevealAction(options: FileTreeRevealActionOptions) {
  const latest = useRef(options);
  const generation = useRef(0);
  useLayoutEffect(() => {
    latest.current = options;
  });
  useLayoutEffect(() => {
    generation.current += 1;
    return () => {
      generation.current += 1;
    };
  }, [options.contextKey, options.enabled]);

  return useCallback(async () => {
    const initial = latest.current;
    if (!initial.enabled || !initial.config) return;
    const request = ++generation.current;
    initial.onCancelReveal();
    const isCurrent = () =>
      generation.current === request && latest.current.enabled;
    try {
      await initial.onShowFileTree();
      if (!isCurrent()) return;
      if (
        !initial.config.sidebarVisible ||
        initial.config.workspace.sidebarTab !== "files"
      ) {
        await initial.onSaveConfig({
          ...initial.config,
          sidebarVisible: true,
          workspace: { ...initial.config.workspace, sidebarTab: "files" },
        });
      }
      if (isCurrent()) await latest.current.onReveal();
    } catch {
      if (isCurrent())
        latest.current.showInlineNotice(
          "Could not reveal the current file in the file tree.",
          { tone: "warning" },
        );
    }
  }, []);
}
