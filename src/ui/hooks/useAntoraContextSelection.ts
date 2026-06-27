import { useEffect, useRef, useState } from "react";
import type { DocumentPayload } from "../../core/types";

interface AntoraContextReloadOptions {
  documentPayload: DocumentPayload | null;
  openDocument: (
    path: string,
    options?: { recordNavigation?: boolean; clearDocumentLinkCache?: boolean },
  ) => Promise<void>;
  selectedAntoraContextId: string | null;
}

export function useAntoraContextSelectionState() {
  const [selectedContextId, setSelectedContextId] = useState<string | null>(
    null,
  );
  const [contextCount, setContextCount] = useState(0);
  const [selectorOpenSignal, setSelectorOpenSignal] = useState(0);

  return {
    canSelectContext: contextCount > 1,
    selectedContextId,
    selectorOpenSignal,
    sidebarProps: {
      selectedAntoraContextId: selectedContextId,
      antoraContextSelectorOpenSignal: selectorOpenSignal,
      onAntoraContextsChange: setContextCount,
      onSelectAntoraContext: setSelectedContextId,
    },
    openSelector: () => setSelectorOpenSignal((signal) => signal + 1),
    setContextCount,
    selectContext: setSelectedContextId,
  };
}

export function useReloadActiveDocumentOnAntoraContextChange({
  documentPayload,
  openDocument,
  selectedAntoraContextId,
}: AntoraContextReloadOptions) {
  const previousSelectedAntoraContextIdRef = useRef<string | null>(
    selectedAntoraContextId,
  );

  useEffect(() => {
    const previous = previousSelectedAntoraContextIdRef.current;
    previousSelectedAntoraContextIdRef.current = selectedAntoraContextId;
    if (
      previous === selectedAntoraContextId ||
      !documentPayload ||
      documentPayload.format !== "asciidoc"
    ) {
      return;
    }
    void openDocument(documentPayload.path, {
      recordNavigation: false,
      clearDocumentLinkCache: true,
    });
  }, [documentPayload, openDocument, selectedAntoraContextId]);
}
