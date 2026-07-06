import { useCallback, useState } from "react";
import type { DocumentPayload } from "../../core/types";

export function useAppWorkspacePreferencesState(
  documentPayload: DocumentPayload | null,
) {
  const [tabMoreOpen, setTabMoreOpen] = useState(false);
  const [preferencesTabOpen, setPreferencesTabOpen] = useState(false);
  const [activeWorkspaceTabKind, setActiveWorkspaceTabKind] = useState<
    "document" | "preferences"
  >("document");
  const preferencesOpen =
    preferencesTabOpen && activeWorkspaceTabKind === "preferences";
  const activeDocumentPayload = preferencesOpen ? null : documentPayload;
  const openPreferencesTab = useCallback(() => {
    setPreferencesTabOpen(true);
    setActiveWorkspaceTabKind("preferences");
    setTabMoreOpen(false);
  }, []);

  return {
    activeDocumentPayload,
    openPreferencesTab,
    preferencesOpen,
    preferencesTabOpen,
    setActiveWorkspaceTabKind,
    setPreferencesTabOpen,
    setTabMoreOpen,
    tabMoreOpen,
  };
}
