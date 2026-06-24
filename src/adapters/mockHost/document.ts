import {
  authorizeDirectory,
  compareDocuments,
  listDirectory,
  loadDocumentOrder,
  loadConfig,
  openDocument,
  openExternalUrl,
  openPathInEditor,
  pickDirectory,
  pickDocument,
  resolveDocumentLink,
  clearDocumentLinkCache,
  resolveDroppedDocumentPath,
  resolveLocalImage,
  resolveWorkspacePaths,
  saveConfig,
} from "./files";
import type { HostAdapter } from "../../core/types";

export type MockDocumentFacade = Pick<
  HostAdapter,
  | "pickDocument"
  | "pickDirectory"
  | "resolveDroppedDocumentPath"
  | "authorizeDirectory"
  | "openDocument"
  | "listDirectory"
  | "loadDocumentOrder"
  | "loadConfig"
  | "saveConfig"
  | "resolveWorkspacePaths"
  | "resolveDocumentLink"
  | "clearDocumentLinkCache"
  | "resolveLocalImage"
  | "openExternalUrl"
  | "openPathInEditor"
  | "openNewWindow"
  | "openDocumentInNewWindow"
  | "openCurrentDocumentInNewWindow"
  | "compareDocuments"
>;

export function createMockDocumentFacade(): MockDocumentFacade {
  return {
    pickDocument,
    pickDirectory,
    resolveDroppedDocumentPath,
    authorizeDirectory,
    openDocument,
    listDirectory,
    loadDocumentOrder,
    loadConfig,
    saveConfig,
    resolveWorkspacePaths,
    resolveDocumentLink,
    clearDocumentLinkCache,
    resolveLocalImage,
    openExternalUrl,
    openPathInEditor,
    openNewWindow: async (_request) => undefined,
    openDocumentInNewWindow: async (_request) => undefined,
    openCurrentDocumentInNewWindow: async (_request) => undefined,
    compareDocuments,
  };
}
