import type { AppConfig, HostAdapter } from "../../core/types";
import { normalizeConfig } from "./config";
import { mergeWindowConfigForSave } from "./windowConfig";

export async function saveAppConfig({
  host,
  nextConfig,
  setConfig,
  setSidebarLayout,
  windowSessionId,
}: {
  host: HostAdapter;
  nextConfig: AppConfig;
  setConfig: (config: AppConfig) => void;
  setSidebarLayout: (layout: AppConfig["layout"]) => void;
  windowSessionId: string;
}) {
  const normalizedConfig = normalizeConfig(nextConfig);
  setConfig(normalizedConfig);
  setSidebarLayout(normalizedConfig.layout);
  void host.setWindowTheme(normalizedConfig.theme);
  const persistedConfig = normalizeConfig(await host.loadConfig());
  await host.saveConfig(
    mergeWindowConfigForSave({
      persistedConfig,
      windowConfig: normalizedConfig,
      windowSessionId,
    }),
  );
}
