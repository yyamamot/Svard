import { useCallback } from "react";
import type { AppConfig } from "../../core/types";

export function useSearchQueryForPath({
  config,
  tabQueries,
}: {
  config: AppConfig | null;
  tabQueries: Record<string, string>;
}) {
  return useCallback(
    (path: string, fallbackQuery = "") => {
      const tabQuery = tabQueries[path];
      if (tabQuery?.trim()) {
        return tabQuery;
      }
      if (fallbackQuery.trim()) {
        return fallbackQuery;
      }
      return config?.workspace.pinnedSearch ?? "";
    },
    [config?.workspace.pinnedSearch, tabQueries],
  );
}
