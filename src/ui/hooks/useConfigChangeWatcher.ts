import { useEffect, type Dispatch, type SetStateAction } from "react";

import type { AppConfig, HostAdapter } from "../../core/types";
import { normalizeConfig } from "../lib/config";
import { mergePersistedSharedConfigIntoWindow } from "../lib/windowConfig";

interface UseConfigChangeWatcherOptions {
  host: HostAdapter;
  setConfig: Dispatch<SetStateAction<AppConfig | null>>;
  setSidebarLayout: Dispatch<SetStateAction<AppConfig["layout"]>>;
}

export function useConfigChangeWatcher({
  host,
  setConfig,
  setSidebarLayout,
}: UseConfigChangeWatcherOptions) {
  useEffect(() => {
    let disposed = false;
    let handle: { dispose(): void } | null = null;

    async function refreshConfigFromDisk() {
      try {
        const loadedConfig = normalizeConfig(await host.loadConfig());
        if (disposed) {
          return;
        }
        setConfig((currentConfig) => {
          const nextConfig = currentConfig
            ? mergePersistedSharedConfigIntoWindow({
                persistedConfig: loadedConfig,
                windowConfig: currentConfig,
              })
            : loadedConfig;
          setSidebarLayout(nextConfig.layout);
          void host.setWindowTheme(nextConfig.theme);
          return nextConfig;
        });
      } catch {
        // Cross-window config sync is opportunistic; direct save/open flows remain authoritative.
      }
    }

    void host
      .watchConfigChanges?.(() => {
        void refreshConfigFromDisk();
      })
      .then((nextHandle) => {
        if (disposed) {
          nextHandle?.dispose();
          return;
        }
        handle = nextHandle ?? null;
      });

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [host, setConfig, setSidebarLayout]);
}
