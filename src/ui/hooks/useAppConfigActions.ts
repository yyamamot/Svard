import type { AppConfig, HostAdapter } from "../../core/types";
import { saveAppConfig } from "../lib/saveAppConfig";

export function useAppConfigActions({
  host,
  setConfig,
  setSidebarLayout,
  windowSessionId,
}: {
  host: HostAdapter;
  setConfig: (config: AppConfig) => void;
  setSidebarLayout: (layout: AppConfig["layout"]) => void;
  windowSessionId: string;
}) {
  return {
    saveConfig: (nextConfig: AppConfig) =>
      saveAppConfig({
        host,
        nextConfig,
        setConfig,
        setSidebarLayout,
        windowSessionId,
      }),
  };
}
