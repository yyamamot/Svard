import type { DocumentsPanelCommands } from "../components/fileTreePanel/types";

let currentCommands: DocumentsPanelCommands | null = null;
const listeners = new Set<() => void>();

export function registerDocumentsPanelCommandBridge(
  commands: DocumentsPanelCommands | null,
): void {
  currentCommands = commands;
  for (const listener of listeners) {
    listener();
  }
}

export function getDocumentsPanelCommands(): DocumentsPanelCommands | null {
  return currentCommands;
}

export function canRevealCurrentDocumentInDocsOrder(): boolean {
  return currentCommands?.canRevealCurrentDocument() ?? false;
}

export function subscribeDocumentsPanelCommandBridge(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
