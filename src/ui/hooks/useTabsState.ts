import { useMemo, useState } from "react";
import { defaultConfig } from "../../core/defaultConfig";
import { getBoundedTabs } from "../../core/tabLayout";
import { sortedOpenTabPaths } from "../../core/workspaceState";
import type { AppConfig, DocumentPayload } from "../../core/types";

export function useTabsState({
  activePath,
  config,
  maxVisibleTabs = 4,
}: {
  activePath: string | null | undefined;
  config: AppConfig | null;
  maxVisibleTabs?: number;
}) {
  const [tabs, setTabs] = useState<DocumentPayload[]>([]);
  const [lastClosedTabs, setLastClosedTabs] = useState<DocumentPayload[]>([]);
  const pinnedTabs = config?.workspace.pinnedTabs ?? [];
  const orderedTabs = useMemo(() => {
    const orderedPaths = sortedOpenTabPaths({
      ...(config?.workspace ?? defaultConfig.workspace),
      openTabs: tabs.map((tab) => tab.path),
      pinnedTabs,
    });
    return orderedPaths
      .map((path) => tabs.find((tab) => tab.path === path))
      .filter((tab): tab is DocumentPayload => Boolean(tab));
  }, [config?.workspace, pinnedTabs, tabs]);
  const tabLayout = useMemo(
    () =>
      getBoundedTabs(
        orderedTabs.map((tab) => tab.path),
        activePath,
        maxVisibleTabs,
      ),
    [activePath, maxVisibleTabs, orderedTabs],
  );
  const visibleTabs = useMemo(
    () =>
      tabLayout.visiblePaths
        .map((path) => orderedTabs.find((tab) => tab.path === path))
        .filter((tab): tab is DocumentPayload => Boolean(tab)),
    [orderedTabs, tabLayout.visiblePaths],
  );
  const overflowTabs = useMemo(
    () =>
      tabLayout.overflowPaths
        .map((path) => orderedTabs.find((tab) => tab.path === path))
        .filter((tab): tab is DocumentPayload => Boolean(tab)),
    [orderedTabs, tabLayout.overflowPaths],
  );

  return {
    lastClosedTabs,
    orderedTabs,
    overflowTabs,
    pinnedTabs,
    setLastClosedTabs,
    setTabs,
    tabs,
    visibleTabs,
  };
}
