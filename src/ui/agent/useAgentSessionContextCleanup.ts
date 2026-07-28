import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  AgentAttachment,
  AgentFocusFile,
  AgentImageAttachment,
  AgentQuotedContext,
  DocumentMediaMode,
} from "../../core/types";
import type { AgentImageError } from "./agentPanelModel";

interface AgentSessionContextCleanupOptions {
  selectionImages: MutableRefObject<Map<string, AgentImageAttachment>>;
  submittedSelectionIds: MutableRefObject<string[]>;
  setAttachments: Dispatch<SetStateAction<AgentAttachment[]>>;
  setFocusFiles: Dispatch<SetStateAction<AgentFocusFile[]>>;
  setImageErrors: Dispatch<SetStateAction<AgentImageError[]>>;
  setImages: Dispatch<SetStateAction<AgentImageAttachment[]>>;
  setMediaModes: Dispatch<SetStateAction<Record<string, DocumentMediaMode>>>;
  setRestoredQuotedContexts: Dispatch<SetStateAction<AgentQuotedContext[]>>;
}

export function useAgentSessionContextCleanup({
  selectionImages,
  submittedSelectionIds,
  setAttachments,
  setFocusFiles,
  setImageErrors,
  setImages,
  setMediaModes,
  setRestoredQuotedContexts,
}: AgentSessionContextCleanupOptions) {
  function clearSessionLocalContext() {
    setImages([]);
    setRestoredQuotedContexts([]);
    setImageErrors([]);
    setFocusFiles([]);
    setAttachments([]);
    setMediaModes({});
    selectionImages.current.clear();
    submittedSelectionIds.current = [];
  }

  function preserveContextForAccessChange(directImageCount: number) {
    setImages([]);
    setImageErrors([]);
    selectionImages.current.clear();
    submittedSelectionIds.current = [];
    return directImageCount > 0;
  }

  return { clearSessionLocalContext, preserveContextForAccessChange };
}
