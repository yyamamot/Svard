import { useEffect, useState } from "react";
import type { DocumentPayload } from "../../core/types";
import type { OpenFileReloadState } from "../types";

export function useOpenFileReloadStates(tabs: DocumentPayload[]) {
  const [openFileReloadStates, setOpenFileReloadStates] = useState<
    Record<string, OpenFileReloadState>
  >({});

  useEffect(() => {
    const openPaths = new Set(tabs.map((tab) => tab.path));
    setOpenFileReloadStates((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([path]) => openPaths.has(path)),
      ),
    );
  }, [tabs]);

  return { openFileReloadStates, setOpenFileReloadStates };
}
