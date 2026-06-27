import type { DocumentOrderResult } from "../../../core/types";
import type { DocumentsViewMode } from "../../lib/fileTreeDocuments";

export type FilesViewMode = DocumentsViewMode;

export type DocumentsFilter = "all" | "changed";

export type DocumentOrderSectionOptions = {
  sectionReviewId: string;
  notInNavReviewId: string;
  notInNavLabel: string;
};

export type ActiveDocumentOrder = {
  order: DocumentOrderResult;
  options: DocumentOrderSectionOptions;
} | null;

export type SuggestedDocumentsMode = {
  mode: Extract<
    FilesViewMode,
    "documents-mkdocs" | "documents-zensical" | "documents-antora"
  >;
  label: string;
};

export interface DocumentsPanelCommands {
  collapseAllDocumentSections(): void;
  revealCurrentDocument(): boolean;
  canRevealCurrentDocument(): boolean;
}
