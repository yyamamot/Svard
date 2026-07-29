import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentSessionPage } from "../../core/types";
import type { AgentSessionHistoryDateRange } from "./agentSessionHistorySearch";

export function useAgentSessionHistorySearchState() {
  const [historyQuery, setHistoryQuery] = useState("");
  const [debouncedHistoryQuery, setDebouncedHistoryQuery] = useState("");
  const [historyDateRange, setHistoryDateRange] =
    useState<AgentSessionHistoryDateRange>("any");
  const requestSequenceRef = useRef(0);
  const reloadRef = useRef<() => void>(() => undefined);

  const updateHistoryQuery = useCallback((query: string) => {
    setHistoryQuery(query);
    if (!query) setDebouncedHistoryQuery("");
  }, []);
  const resetHistorySearch = useCallback(() => {
    setHistoryQuery("");
    setDebouncedHistoryQuery("");
    setHistoryDateRange("any");
    requestSequenceRef.current += 1;
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedHistoryQuery(historyQuery),
      historyQuery ? 250 : 0,
    );
    return () => window.clearTimeout(timeout);
  }, [historyQuery]);

  return {
    debouncedHistoryQuery,
    historyDateRange,
    historyQuery,
    reloadRef,
    requestSequenceRef,
    resetHistorySearch,
    setHistoryDateRange,
    updateHistoryQuery,
    controller: {
      historyQuery,
      setHistoryQuery: updateHistoryQuery,
      historyDateRange,
      setHistoryDateRange,
    },
  };
}

export function useAgentSessionHistorySearchReload({
  historyArchived,
  historyOpen,
  loadSessionPage,
  search,
  sessionPage,
}: {
  historyArchived: boolean;
  historyOpen: boolean;
  loadSessionPage: (reset: boolean, archived?: boolean) => Promise<void>;
  search: ReturnType<typeof useAgentSessionHistorySearchState>;
  sessionPage: AgentSessionPage | null;
}) {
  const active =
    Boolean(search.debouncedHistoryQuery.trim()) ||
    search.historyDateRange !== "any";
  search.reloadRef.current = () =>
    historyOpen && active
      ? void loadSessionPage(true, historyArchived)
      : undefined;
  useEffect(() => {
    if (historyOpen && sessionPage?.managementCapabilities.search)
      void loadSessionPage(true, historyArchived);
  }, [search.debouncedHistoryQuery, search.historyDateRange]);
}
