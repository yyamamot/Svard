import { useCallback, useState } from "react";
import type { DocumentPayload } from "../../core/types";
import type {
  PreferencesSectionId,
  PreferencesSectionRequest,
} from "../components/preferences/types";

export function useAppWorkspacePreferencesState(
  documentPayload: DocumentPayload | null,
) {
  const [tabMoreOpen, setTabMoreOpen] = useState(false);
  const [preferencesTabOpen, setPreferencesTabOpen] = useState(false);
  const [activeWorkspaceTabKind, setActiveWorkspaceTabKind] = useState<
    "document" | "preferences"
  >("document");
  const [preferencesSectionRequest, setPreferencesSectionRequest] =
    useState<PreferencesSectionRequest | null>(null);
  const preferencesOpen =
    preferencesTabOpen && activeWorkspaceTabKind === "preferences";
  const activeDocumentPayload = preferencesOpen ? null : documentPayload;
  const openPreferencesTab = useCallback((section?: PreferencesSectionId) => {
    if (section) {
      setPreferencesSectionRequest((current) => ({
        id: (current?.id ?? 0) + 1,
        section,
      }));
    }
    setPreferencesTabOpen(true);
    setActiveWorkspaceTabKind("preferences");
    setTabMoreOpen(false);
  }, []);

  return {
    activeDocumentPayload,
    openPreferencesTab,
    preferencesOpen,
    preferencesSectionRequest,
    preferencesTabOpen,
    setActiveWorkspaceTabKind,
    setPreferencesTabOpen,
    setTabMoreOpen,
    tabMoreOpen,
  };
}
